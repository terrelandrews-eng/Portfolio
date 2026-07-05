"""Pre-gather all briefing context (spec §7.1 step 1).

Each external step is wrapped so a failure degrades to a placeholder and records the
gap in `missing` — the briefing never blocks on a down integration (spec §2.5, §5.33).
Everything computable (task buckets, alerts) is done here in Python (spec §15.4).
"""

from __future__ import annotations

from dataclasses import asdict
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Briefing, Entity, Observation, Priority, Task, WeeklyPlan
from app.flows.alerts import bills_due, maintenance_due, upcoming_birthdays
from app.integrations import gcal, weather


async def _safe(coro, fallback, missing: list[str], label: str):
    try:
        return await coro
    except Exception as exc:  # noqa: BLE001 — fail soft
        missing.append(f"{label} ({type(exc).__name__})")
        return fallback


async def gather_briefing_context(db: AsyncSession, target: date) -> dict:
    missing: list[str] = []

    # External integrations (may fail — degrade gracefully).
    forecast = await _safe(weather.get_weather(3), None, missing, "weather")
    events = await _safe(gcal.get_events(db, target, target + timedelta(days=2)), [], missing, "calendar")

    # Local data (Postgres).
    open_tasks = list((await db.scalars(select(Task).where(Task.status == "open"))).all())
    due_today = [t for t in open_tasks if t.due_date == target]
    overdue = [t for t in open_tasks if t.due_date and t.due_date < target]
    scheduled_today = [t for t in open_tasks if t.scheduled_for == target]

    observations = list(
        (
            await db.scalars(
                select(Observation)
                .where(Observation.status == "active", Observation.confidence >= 0.5)
                .order_by(Observation.confidence.desc(), Observation.created_at.desc())
                .limit(12)
            )
        ).all()
    )

    entities = list((await db.scalars(select(Entity))).all())
    alerts_raw = (
        maintenance_due(entities, target)
        + upcoming_birthdays(entities, target)
        + bills_due(open_tasks, target)
    )

    def _alert_dict(a) -> dict:
        d = asdict(a)
        d["due_date"] = a.due_date.isoformat() if a.due_date else None
        return d

    alerts = [_alert_dict(a) for a in alerts_raw]

    weekly_plan = await db.scalar(
        select(WeeklyPlan)
        .where(WeeklyPlan.week_start <= target)
        .order_by(WeeklyPlan.week_start.desc())
        .limit(1)
    )
    yesterday = await db.scalar(select(Briefing).where(Briefing.date == target - timedelta(days=1)))

    return {
        "date": target,
        "weather": forecast,
        "calendar": events,
        "tasks": {"due_today": due_today, "overdue": overdue, "scheduled_today": scheduled_today},
        "observations": observations,
        "weekly_plan": weekly_plan,
        "yesterday_briefing": yesterday.content if yesterday else None,
        "alerts": alerts,
        "missing": missing,
    }
