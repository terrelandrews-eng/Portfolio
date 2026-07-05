"""Daily briefing pipeline (spec §7.1).

Pre-gather context → single Chief-of-Staff completion (no tool loop) → persist
(upsert by date) → deliver by email. Falls back to the deterministic renderer when
the LLM is mocked or errors, so a briefing is always produced. Latency budget <60s.
"""

from __future__ import annotations

from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.agent import chief_of_staff, load_prompt
from app.config import get_settings
from app.db.models import Briefing, Priority
from app.flows.context import gather_briefing_context
from app.flows.render import (
    format_context_for_prompt,
    json_snapshot,
    render_fallback_briefing,
)
from app.integrations import email, telegram

DEFAULT_PRIORITIES = "No priorities document set."


async def _active_priorities(db: AsyncSession) -> str:
    row = await db.scalar(select(Priority).where(Priority.active.is_(True)))
    return row.content if row else DEFAULT_PRIORITIES


async def generate_briefing(db: AsyncSession, target: date | None = None, deliver: bool = True) -> Briefing:
    settings = get_settings()
    target = target or date.today()

    ctx = await gather_briefing_context(db, target)
    priorities = await _active_priorities(db)

    weekday = target.strftime("%A")
    date_long = target.strftime("%B %-d")

    agent = chief_of_staff()
    system = agent.render_system(user_name=settings.user_name, priorities=priorities)
    user = load_prompt("daily_briefing").format(
        weekday=weekday,
        date_long=date_long,
        timezone=settings.timezone,
        user_name=settings.user_name,
        context=format_context_for_prompt(ctx),
    )

    result = await agent.complete(trigger="daily_briefing", system=system, user=user)
    content = result.text or render_fallback_briefing(ctx)

    # Idempotent upsert by date (spec §14).
    briefing = await db.scalar(select(Briefing).where(Briefing.date == target))
    inputs = json_snapshot(ctx)
    if briefing:
        briefing.content = content
        briefing.inputs = inputs
    else:
        briefing = Briefing(date=target, content=content, inputs=inputs)
        db.add(briefing)
    await db.commit()
    await db.refresh(briefing)

    if deliver:
        try:
            await email.send_briefing(subject=f"LifeOS Briefing {target.isoformat()}", markdown_text=content)
        except Exception:  # noqa: BLE001 — delivery failure must not lose the briefing
            pass
        try:
            await telegram.send_message(content)
        except Exception:  # noqa: BLE001 — Telegram is best-effort
            pass

    return briefing
