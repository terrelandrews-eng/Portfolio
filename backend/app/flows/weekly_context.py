"""Pre-gather context for the weekly plan + review (spec §7.2 step 1, §7.3 step 1).

Same fail-soft discipline as the daily briefing: external calls degrade to placeholders
and record the gap in `missing`; everything computable is done here in Python.
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Observation, Review, Task, WeeklyPlan
from app.flows.context import _safe
from app.integrations import gcal, weather

DOMAINS = ("meals", "health", "home", "family", "faith", "finance", "business")


async def gather_weekly_context(db: AsyncSession, week_start: date) -> dict:
    """Context for planning the week beginning `week_start` (a Monday)."""
    missing: list[str] = []
    week_end = week_start + timedelta(days=6)

    forecast = await _safe(weather.get_weather(7), None, missing, "weather")
    events = await _safe(gcal.get_events(db, week_start, week_end), [], missing, "calendar")

    open_tasks = list((await db.scalars(select(Task).where(Task.status == "open"))).all())
    tasks_by_domain: dict[str, list[Task]] = {}
    for t in open_tasks:
        tasks_by_domain.setdefault(t.domain, []).append(t)

    observations = list(
        (
            await db.scalars(
                select(Observation)
                .where(Observation.status == "active", Observation.confidence >= 0.5)
                .order_by(Observation.confidence.desc(), Observation.created_at.desc())
                .limit(20)
            )
        ).all()
    )

    last_review = await db.scalar(
        select(Review).where(Review.week_start < week_start).order_by(Review.week_start.desc()).limit(1)
    )
    recent_plans = list(
        (
            await db.scalars(
                select(WeeklyPlan)
                .where(WeeklyPlan.week_start < week_start)
                .order_by(WeeklyPlan.week_start.desc())
                .limit(4)
            )
        ).all()
    )

    return {
        "week_start": week_start,
        "week_end": week_end,
        "weather": forecast,
        "calendar": events,
        "tasks_by_domain": tasks_by_domain,
        "open_tasks": open_tasks,
        "observations": observations,
        "last_review": last_review,
        "recent_plans": recent_plans,
        "missing": missing,
    }


def observations_for_domain(ctx: dict, domain: str) -> list:
    return [o for o in ctx["observations"] if o.domain == domain]


def format_observations(observations: list) -> str:
    if not observations:
        return "(none recorded yet)"
    return "\n".join(f"- {o.content} (confidence {o.confidence:.2f})" for o in observations)
