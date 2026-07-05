"""Chat answering + routing to domain agents (spec §6.3, §7.4).

Two paths share one contract:
- Offline/mock: deterministic. Route → optional calendar-event proposal built from
  knowledge-hub preferences → deterministic domain answer.
- Real LLM: the domain (or Chief) agent runs a bounded tool-use loop (spec §6.2),
  and may stage proposals via the propose_calendar_event tool.

Either way the endpoint streams the final answer over SSE and surfaces any proposals.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.agent import chief_of_staff, domain_agent, load_prompt
from app.agents.tools import execute_tool, tool_defs_for
from app.config import get_settings
from app.db.models import Entity, Observation, Proposal
from app.flows.proposals import create_proposal

_WEEKDAYS = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}
_SPOUSE_RELATIONS = {"wife", "husband", "spouse", "partner"}
_CALENDAR_VERBS = ("schedule", "book", "plan", "add", "set up", "arrange")


def _now_local() -> datetime:
    return datetime.now(ZoneInfo(get_settings().timezone))


def _next_weekday(now: datetime, weekday: int) -> datetime:
    ahead = (weekday - now.weekday()) % 7
    ahead = ahead or 7  # always the *upcoming* one, not today
    return now + timedelta(days=ahead)


def _weekday_in(message: str) -> int | None:
    text = message.lower()
    for name, idx in _WEEKDAYS.items():
        if name in text:
            return idx
    return None


async def _spouse_name(db: AsyncSession) -> str | None:
    people = list((await db.scalars(select(Entity).where(Entity.type == "person"))).all())
    for p in people:
        if (p.attributes or {}).get("relationship", "").lower() in _SPOUSE_RELATIONS:
            return p.name
    return None


async def _restaurant_preference(db: AsyncSession) -> str | None:
    """Pull a date-night dining preference from the knowledge hub (obs or entity)."""
    obs = await db.scalar(
        select(Observation).where(
            Observation.domain == "family",
            Observation.status == "active",
            Observation.content.ilike("%restaurant%"),
        )
    )
    if obs:
        return obs.content
    ent = await db.scalar(select(Entity).where(Entity.type == "person"))
    if ent and (ent.attributes or {}).get("date_night_notes"):
        return ent.attributes["date_night_notes"]
    return None


async def build_calendar_proposal(
    db: AsyncSession, domain: str, message: str, now: datetime | None = None
) -> tuple[Proposal | None, str | None]:
    """Deterministically stage a calendar event when the message asks for one.

    Returns (proposal, preference_used). Only fires for domains that own calendar writes.
    """
    if domain not in ("family", "business", "health", "chief"):
        return None, None
    text = message.lower()
    is_date_night = "date night" in text
    is_calendar = is_date_night or any(v in text for v in _CALENDAR_VERBS)
    if not is_calendar:
        return None, None

    now = now or _now_local()
    weekday = _weekday_in(message)
    day = _next_weekday(now, weekday) if weekday is not None else (now + timedelta(days=1))

    preference = None
    if is_date_night:
        spouse = await _spouse_name(db) or "your partner"
        preference = await _restaurant_preference(db)
        summary = f"Date night with {spouse}"
        location = "a local restaurant" if preference else None
        start = datetime.combine(day.date(), time(19, 0), tzinfo=now.tzinfo)
        end = datetime.combine(day.date(), time(21, 0), tzinfo=now.tzinfo)
    else:
        summary = _event_summary(message)
        location = None
        start = datetime.combine(day.date(), time(9, 0), tzinfo=now.tzinfo)
        end = datetime.combine(day.date(), time(10, 0), tzinfo=now.tzinfo)

    proposal = await create_proposal(
        db,
        kind="calendar_event",
        summary=f"Add to calendar: {summary} ({day.strftime('%A')} {start.strftime('%-I%p').lower()})",
        payload={
            "summary": summary,
            "start": start.isoformat(),
            "end": end.isoformat(),
            "location": location,
        },
        source="chat",
        agent=domain,
    )
    return proposal, preference


def _event_summary(message: str) -> str:
    cleaned = re.sub(r"\b(please|can you|could you|for me)\b", "", message, flags=re.I).strip()
    cleaned = re.sub(r"^(schedule|book|plan|add|set up|arrange)\s+", "", cleaned, flags=re.I).strip()
    return (cleaned[:80] or "New event").capitalize()


async def domain_observations(db: AsyncSession, domain: str, limit: int = 6) -> list[Observation]:
    return list(
        (
            await db.scalars(
                select(Observation)
                .where(Observation.domain == domain, Observation.status == "active", Observation.confidence >= 0.5)
                .order_by(Observation.confidence.desc())
                .limit(limit)
            )
        ).all()
    )


def render_domain_fallback(domain: str, message: str, proposal: Proposal | None, preference: str | None) -> str:
    who = domain.capitalize()
    if proposal:
        p = proposal.payload
        loc = f" at {p['location']}" if p.get("location") else ""
        pref_note = f" I used your saved preference: \"{preference}\"." if preference else ""
        start = datetime.fromisoformat(p["start"])
        return (
            f"[{who} agent] I've drafted a calendar event: **{p['summary']}**{loc} on "
            f"{start.strftime('%A %-I:%M %p')}.{pref_note} It's staged for your approval — "
            "approve it and I'll add it to your calendar."
        )
    return (
        f"[{who} agent] (offline mode — set ANTHROPIC_API_KEY and MOCK_INTEGRATIONS=false for a full answer.) "
        f"You asked: \"{message}\". I'd handle this in the {domain} domain."
    )


async def run_tool_loop(
    db: AsyncSession, agent_name: str, system: str, message: str, max_iters: int = 4
) -> tuple[str, list[str]]:
    """Real-LLM bounded tool-use loop (spec §6.2). Returns (final_text, proposal_ids)."""
    import anthropic

    settings = get_settings()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    tools = tool_defs_for(agent_name)
    messages: list[dict] = [{"role": "user", "content": message}]
    proposal_ids: list[str] = []

    for _ in range(max_iters):
        resp = await client.messages.create(
            model=settings.model_main, max_tokens=1500, system=system, tools=tools, messages=messages
        )
        messages.append({"role": "assistant", "content": resp.content})
        tool_uses = [b for b in resp.content if getattr(b, "type", None) == "tool_use"]
        if not tool_uses:
            text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
            return text, proposal_ids

        results = []
        for tu in tool_uses:
            out = await execute_tool(db, tu.name, tu.input, agent=agent_name)
            if tu.name == "propose_calendar_event" and out.get("proposal_id"):
                proposal_ids.append(out["proposal_id"])
            results.append({"type": "tool_result", "tool_use_id": tu.id, "content": json.dumps(out, default=str)})
        messages.append({"role": "user", "content": results})

    return "I wasn't able to finish that in a few steps — could you narrow it down?", proposal_ids
