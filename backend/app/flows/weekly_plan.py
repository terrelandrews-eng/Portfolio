"""Weekly planning pipeline (spec §7.2).

Gather → fan-out to Meals/Health/Home agents in parallel (each returns a
pydantic-validated JSON contribution, one retry on validation failure, §15.5) →
deterministic Python merge into `structured` → Chief-of-Staff narrative pass →
save a `weekly_plans` draft. Confirm turns the structured plan into tasks
(source='weekly_plan').

The structured payload is built in Python (§15.4) so the confirm→tasks path is valid
even when the LLM is mocked or errors; the LLM only writes the narrative prose.
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import date, timedelta

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents import contributions as contrib
from app.agents.agent import DOMAIN_AGENTS, chief_of_staff, domain_agent, load_prompt
from app.config import get_settings
from app.db.models import Task, WeeklyPlan
from app.flows.daily_briefing import _active_priorities
from app.flows.weekly_context import (
    format_observations,
    gather_weekly_context,
    observations_for_domain,
)
from app.flows.weekly_render import (
    format_contributions,
    format_weekly_context,
    render_fallback_plan,
)


def week_start_of(d: date) -> date:
    """Monday of the week containing `d`."""
    return d - timedelta(days=d.weekday())


def upcoming_week_start(today: date | None = None) -> date:
    """Monday of next week — the default target for planning."""
    return week_start_of(today or date.today()) + timedelta(days=7)


async def _domain_contribution(domain: str, ctx: dict) -> tuple[str, BaseModel, str]:
    """Run one domain agent with a single validation retry, else deterministic fallback."""
    agent = domain_agent(domain)
    obs = observations_for_domain(ctx, domain)
    system = agent.render_system(
        user_name=get_settings().user_name, observations=format_observations(obs)
    )
    user = load_prompt("domain_contribution").format(
        domain=domain,
        user_name=get_settings().user_name,
        week_of=ctx["week_start"].isoformat(),
        schema_hint=contrib.SCHEMA_HINTS[domain],
        context=format_weekly_context(ctx),
    )

    for _ in range(2):  # initial attempt + one retry on validation failure (§15.5)
        result = await agent.complete(trigger="weekly_plan", system=system, user=user)
        if not result.text:
            break  # mocked / error → fallback
        try:
            return domain, contrib.validate_contribution(domain, result.text), "llm"
        except Exception:  # noqa: BLE001 — invalid JSON/schema → retry then fallback
            continue

    return domain, contrib.build_fallback(domain, ctx), "fallback"


async def generate_weekly_plan(
    db: AsyncSession, week_start: date | None = None
) -> WeeklyPlan:
    settings = get_settings()
    week_start = week_start or upcoming_week_start()

    ctx = await gather_weekly_context(db, week_start)

    # Fan-out to the domain agents in parallel (spec §7.2 step 2).
    results = await asyncio.gather(*[_domain_contribution(d, ctx) for d in DOMAIN_AGENTS])
    contribs: dict[str, BaseModel] = {domain: model for domain, model, _ in results}

    # Deterministic merge → always-valid structured plan (spec §15.4).
    structured = contrib.merge_contributions(contribs, week_start)
    # Snapshot the context that fed the plan (observations flow the memory loop into
    # planning — spec §7.2 step 1; used to verify the weekly learning cycle).
    structured["context"] = {
        "observations": [o.content for o in ctx["observations"]],
        "contributions": {d: source for d, _, source in results},
        "missing": ctx["missing"],
    }

    # Chief-of-Staff narrative pass; fallback renderer stands in when mocked/error.
    priorities = await _active_priorities(db)
    chief = chief_of_staff()
    system = chief.render_system(user_name=settings.user_name, priorities=priorities)
    user = load_prompt("weekly_plan_merge").format(
        user_name=settings.user_name,
        week_of=week_start.isoformat(),
        timezone=settings.timezone,
        contributions=format_contributions(contribs),
        context=format_weekly_context(ctx),
    )
    result = await chief.complete(trigger="weekly_plan", system=system, user=user, max_tokens=2500)
    content = result.text or render_fallback_plan(structured, ctx)

    # Idempotent upsert by week_start; regenerating replaces the draft.
    plan = await db.scalar(select(WeeklyPlan).where(WeeklyPlan.week_start == week_start))
    if plan:
        plan.content = content
        plan.structured = structured
        plan.status = "draft"
    else:
        plan = WeeklyPlan(week_start=week_start, content=content, structured=structured, status="draft")
        db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return plan


async def confirm_weekly_plan(
    db: AsyncSession, plan_id: uuid.UUID, structured: dict | None = None
) -> dict:
    """Confirm a draft: persist any UI edits, then create tasks (source='weekly_plan')."""
    plan = await db.get(WeeklyPlan, plan_id)
    if not plan:
        from fastapi import HTTPException

        raise HTTPException(404, "Weekly plan not found")

    if structured is not None:
        plan.structured = structured
    data = plan.structured or {}

    created = _tasks_from_structured(data)
    for task in created:
        db.add(task)
    plan.status = "confirmed"
    await db.commit()
    await db.refresh(plan)
    return {"plan_id": str(plan.id), "status": plan.status, "tasks_created": len(created)}


def _tasks_from_structured(data: dict) -> list[Task]:
    """Turn the structured plan into schedulable tasks (workouts, chores, grocery run)."""
    tasks: list[Task] = []
    for day in data.get("days", []):
        day_date = _parse_date(day.get("date"))
        if day.get("workout"):
            tasks.append(
                Task(
                    title=day["workout"],
                    domain="health",
                    scheduled_for=day_date,
                    source="weekly_plan",
                    priority=2,
                )
            )
        for chore in day.get("chores", []):
            tasks.append(
                Task(title=chore, domain="home", scheduled_for=day_date, source="weekly_plan", priority=3)
            )

    # A single grocery run for the week, anchored to the first planned day.
    if data.get("grocery_list"):
        first_date = _parse_date(data["days"][0]["date"]) if data.get("days") else None
        tasks.append(
            Task(
                title="Grocery shopping (weekly plan)",
                domain="home",
                scheduled_for=first_date,
                source="weekly_plan",
                priority=2,
            )
        )
    return tasks


def _parse_date(value) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        return None
