"""'What should I be doing right now?' mini-briefing (spec §7.4).

Gathers a lightweight context — current time block, calendar for the next 4 hours,
top open tasks, and today's briefing — and provides a deterministic fallback answer
(≤120 words) for the offline/mock path.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models import Briefing, Task


def now_local() -> datetime:
    return datetime.now(ZoneInfo(get_settings().timezone))


def is_whatnow(message: str) -> bool:
    norm = "".join(c for c in message.lower() if c.isalnum() or c.isspace()).strip()
    return norm in {
        "what should i do right now",
        "what should i be doing right now",
        "whatnow",
        "wsid",
    }


async def whatnow_context(db: AsyncSession, now: datetime) -> dict:
    from app.integrations import gcal

    today = now.date()
    horizon = now + timedelta(hours=4)

    try:
        events = await gcal.get_events(db, today, today)
    except Exception:  # noqa: BLE001
        events = []
    # Next 4 hours only (events carry tz-aware datetimes).
    next_4h = [
        e for e in events
        if e.get("start") and now <= _as_aware(e["start"]) <= horizon
    ]

    top_tasks = list(
        (
            await db.scalars(
                select(Task)
                .where(Task.status == "open")
                .order_by(Task.priority, Task.due_date.nulls_last())
                .limit(5)
            )
        ).all()
    )

    briefing = await db.scalar(select(Briefing).where(Briefing.date == today))

    return {
        "now": now,
        "next_4h": next_4h,
        "top_tasks": top_tasks,
        "briefing_excerpt": (briefing.content[:600] if briefing else None),
    }


def _as_aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def format_whatnow_context(ctx: dict) -> str:
    lines = [f"Current time: {ctx['now'].strftime('%A %H:%M %Z')}"]
    lines.append("Next 4 hours on calendar:")
    if ctx["next_4h"]:
        lines += [
            f"  - {_as_aware(e['start']).strftime('%H:%M')} {e['title']}"
            for e in ctx["next_4h"]
        ]
    else:
        lines.append("  - nothing scheduled")
    lines.append("Top open tasks:")
    lines += [f"  - [{t.domain}/p{t.priority}] {t.title}" for t in ctx["top_tasks"]] or ["  - none"]
    if ctx["briefing_excerpt"]:
        lines.append("Today's briefing (excerpt):")
        lines.append("  " + ctx["briefing_excerpt"].replace("\n", " ")[:400])
    return "\n".join(lines)


def render_fallback_whatnow(ctx: dict) -> str:
    now = ctx["now"]
    nxt = ctx["next_4h"][0] if ctx["next_4h"] else None
    top = ctx["top_tasks"][0] if ctx["top_tasks"] else None

    if nxt:
        start = _as_aware(nxt["start"]).strftime("%H:%M")
        return (
            f"Right now ({now.strftime('%H:%M')}): head into **{nxt['title']}** at {start}. "
            "It's your next time-anchored commitment, so protect it. "
            + (f"After that, your top open item is \"{top.title}\" ({top.domain})." if top else "")
        )
    if top:
        return (
            f"Right now ({now.strftime('%H:%M')}): start **{top.title}** ({top.domain}, "
            f"priority {top.priority}). Nothing is scheduled in the next 4 hours, so this is "
            "the highest-leverage use of the open block. Give it a focused 45–60 minutes."
        )
    return (
        f"Right now ({now.strftime('%H:%M')}): nothing scheduled and no open tasks. "
        "Protect your top priority — rest, be present, or get ahead on tomorrow."
    )


def render_fallback_chat(message: str, has_briefing: bool) -> str:
    hint = (
        "Today's briefing is ready on the Today screen. "
        if has_briefing
        else "No briefing yet today — generate one from the Today screen. "
    )
    return (
        f"{hint}I'm the Chief of Staff (offline mode — set ANTHROPIC_API_KEY and "
        f"MOCK_INTEGRATIONS=false for full answers). You asked: \"{message}\"."
    )
