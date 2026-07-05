"""In-process APScheduler (spec §4, §7.1 trigger).

Schedules the daily briefing at BRIEFING_HOUR, the weekly review 1 hour before the
weekly plan (so insights feed the new plan), and the weekly plan on WEEKLY_PLAN_DAY at
WEEKLY_PLAN_HOUR — all timezone-aware (spec §14, §7.2, §7.3).
"""

from __future__ import annotations

from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import get_settings
from app.db.session import SessionLocal
from app.flows.daily_briefing import generate_briefing
from app.flows.weekly_plan import generate_weekly_plan
from app.flows.weekly_review import run_weekly_review

_scheduler: AsyncIOScheduler | None = None


async def _daily_briefing_job() -> None:
    async with SessionLocal() as db:
        await generate_briefing(db, deliver=True)


async def _weekly_review_job() -> None:
    # Data-only review (no answers yet); the /review/answers path enriches it later.
    async with SessionLocal() as db:
        await run_weekly_review(db)


async def _weekly_plan_job() -> None:
    async with SessionLocal() as db:
        await generate_weekly_plan(db)


def start_scheduler() -> AsyncIOScheduler:
    global _scheduler
    settings = get_settings()
    tz = ZoneInfo(settings.timezone)

    _scheduler = AsyncIOScheduler(timezone=tz)
    _scheduler.add_job(
        _daily_briefing_job,
        CronTrigger(hour=settings.briefing_hour, minute=0, timezone=tz),
        id="daily_briefing",
        replace_existing=True,
    )

    # Weekly review runs 1 hour before the plan so its insights feed the plan (§7.3).
    plan_day = settings.weekly_plan_day.lower()  # APScheduler wants e.g. "sun"
    plan_hour = settings.weekly_plan_hour
    review_hour = (plan_hour - 1) % 24
    _scheduler.add_job(
        _weekly_review_job,
        CronTrigger(day_of_week=plan_day, hour=review_hour, minute=0, timezone=tz),
        id="weekly_review",
        replace_existing=True,
    )
    _scheduler.add_job(
        _weekly_plan_job,
        CronTrigger(day_of_week=plan_day, hour=plan_hour, minute=0, timezone=tz),
        id="weekly_plan",
        replace_existing=True,
    )

    _scheduler.start()
    return _scheduler


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None


def scheduler_status() -> dict:
    if not _scheduler:
        return {"running": False, "jobs": []}
    return {
        "running": _scheduler.running,
        "jobs": [
            {"id": j.id, "next_run": j.next_run_time.isoformat() if j.next_run_time else None}
            for j in _scheduler.get_jobs()
        ],
    }
