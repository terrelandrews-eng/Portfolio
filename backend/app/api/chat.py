"""Chat endpoint (spec §6.3, §7.4, §8).

Classifies each message and routes to a domain agent (or the Chief of Staff for
multi-domain/ambiguous). The literal "what should I do right now?" stays special-cased
to the mini-briefing. Streams tokens over SSE and emits any staged proposals so the UI
can offer one-click approval. Uses its own DB session (the stream outlives the handler).
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from datetime import date

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select

from app.agents.agent import chief_of_staff, domain_agent, load_prompt
from app.api.deps import require_token
from app.config import get_settings
from app.db.models import Briefing, ChatMessage, Proposal
from app.db.session import SessionLocal
from app.flows.chat_agent import (
    build_calendar_proposal,
    domain_observations,
    render_domain_fallback,
    run_tool_loop,
)
from app.flows.daily_briefing import _active_priorities
from app.flows.routing import classify
from app.flows.weekly_context import format_observations
from app.flows.whatnow import (
    format_whatnow_context,
    is_whatnow,
    now_local,
    render_fallback_whatnow,
    render_fallback_chat,
    whatnow_context,
)
from app.schemas import ChatRequest

router = APIRouter(prefix="/chat", tags=["chat"], dependencies=[Depends(require_token)])


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


async def _run(req: ChatRequest) -> AsyncIterator[str]:
    settings = get_settings()

    async with SessionLocal() as db:
        db.add(ChatMessage(session_id=req.session_id, role="user", content=req.message))
        await db.commit()

        if is_whatnow(req.message):
            async for frame in _whatnow_stream(db, req):
                yield frame
            return

        route = await classify(req.message)
        domain = route["domain"]
        use_chief = route["needs_multiple"] or domain == "chief"
        agent_name = "chief_of_staff" if use_chief else domain

        # Build the agent's system prompt.
        if use_chief:
            priorities = await _active_priorities(db)
            system = chief_of_staff().render_system(user_name=settings.user_name, priorities=priorities)
        else:
            obs = await domain_observations(db, domain)
            system = domain_agent(domain).render_system(
                user_name=settings.user_name, observations=format_observations(obs)
            )

        yield _sse("meta", {"agent": agent_name, "domain": domain, "mode": "chat"})

        proposal_ids: list[str] = []
        if settings.use_real_llm:
            answer, proposal_ids = await run_tool_loop(db, agent_name, system, req.message)
            for word in (answer or "").split(" "):
                yield _sse("token", {"t": word + " "})
        else:
            # Deterministic path: stage a calendar proposal from knowledge-hub prefs, then answer.
            proposal, preference = await build_calendar_proposal(db, domain, req.message)
            if proposal:
                proposal_ids.append(str(proposal.id))
            answer = render_domain_fallback(domain, req.message, proposal, preference)
            for word in answer.split(" "):
                yield _sse("token", {"t": word + " "})

        proposals = await _proposal_dicts(db, proposal_ids)
        if proposals:
            yield _sse("proposals", {"proposals": proposals})

        db.add(ChatMessage(session_id=req.session_id, role="assistant", content=answer, agent=agent_name))
        await db.commit()

    yield _sse("done", {})


async def _whatnow_stream(db, req: ChatRequest) -> AsyncIterator[str]:
    settings = get_settings()
    agent = chief_of_staff()
    priorities = await _active_priorities(db)
    system = agent.render_system(user_name=settings.user_name, priorities=priorities)

    ctx = await whatnow_context(db, now_local())
    user = load_prompt("whatnow").format(
        now=ctx["now"].strftime("%A %H:%M"),
        timezone=settings.timezone,
        user_name=settings.user_name,
        context=format_whatnow_context(ctx),
        message=req.message,
    )
    fallback = render_fallback_whatnow(ctx)

    yield _sse("meta", {"agent": "chief_of_staff", "domain": "chief", "mode": "whatnow"})

    collected: list[str] = []
    if settings.use_real_llm:
        async for token in agent.stream(trigger="chat_whatnow", system=system, user=user):
            collected.append(token)
            yield _sse("token", {"t": token})
    else:
        for word in fallback.split(" "):
            collected.append(word + " ")
            yield _sse("token", {"t": word + " "})

    answer = "".join(collected).strip()
    db.add(ChatMessage(session_id=req.session_id, role="assistant", content=answer, agent="chief_of_staff"))
    await db.commit()
    yield _sse("done", {})


async def _proposal_dicts(db, ids: list[str]) -> list[dict]:
    if not ids:
        return []
    rows = list((await db.scalars(select(Proposal).where(Proposal.id.in_(ids)))).all())
    return [{"id": str(p.id), "kind": p.kind, "summary": p.summary, "status": p.status} for p in rows]


@router.post("")
async def chat(req: ChatRequest):
    return StreamingResponse(_run(req), media_type="text/event-stream")
