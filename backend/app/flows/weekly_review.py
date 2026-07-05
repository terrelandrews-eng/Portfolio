"""Weekly review — the learning loop (spec §7.3, §4 "memory compounds").

Load last week's plan vs. what actually happened → (optionally) collect 3–5 short
answers → Chief-of-Staff narrative insights + proposed observations → apply the §5.3
dedup/confidence logic. Runs data-only when no answers are supplied (the 12h-timeout
path), so a Review record + at least one observation are always produced.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from datetime import date, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.agent import chief_of_staff, load_prompt
from app.config import get_settings
from app.db.models import Briefing, Review, Task, WeeklyPlan
from app.flows.daily_briefing import _active_priorities
from app.flows.weekly_plan import week_start_of
from app.flows.weekly_render import render_fallback_review
from app.knowledge.embeddings import get_embedding_provider
from app.knowledge.observations import apply_proposed_observations

REVIEW_QUESTIONS = [
    "Energy this week (1–5)?",
    "What worked?",
    "What fell through?",
    "Anything to protect next week?",
]

_DONE = {"done", "completed"}
_JSON_LIST_RE = re.compile(r"\[.*\]", re.DOTALL)


def review_week_start(today: date | None = None) -> date:
    """The week being reviewed — the (current/ending) week's Monday."""
    return week_start_of(today or date.today())


async def build_review_context(db: AsyncSession, week_start: date, answers: dict | None = None) -> dict:
    week_end = week_start + timedelta(days=6)
    plan = await db.scalar(select(WeeklyPlan).where(WeeklyPlan.week_start == week_start))

    scheduled = list(
        (
            await db.scalars(
                select(Task).where(
                    Task.scheduled_for.is_not(None),
                    Task.scheduled_for >= week_start,
                    Task.scheduled_for <= week_end,
                )
            )
        ).all()
    )
    planned = [t for t in scheduled if t.source == "weekly_plan"] or scheduled
    completed = [t for t in planned if t.status in _DONE]
    incomplete = [t for t in planned if t.status not in _DONE]
    lagging = Counter(t.domain for t in incomplete).most_common(1)

    briefings = list(
        (
            await db.scalars(
                select(Briefing).where(Briefing.date >= week_start, Briefing.date <= week_end)
            )
        ).all()
    )

    return {
        "week_start": week_start.isoformat(),
        "week_end": week_end.isoformat(),
        "plan": plan,
        "planned": [_task_brief(t) for t in planned],
        "completed": [_task_brief(t) for t in completed],
        "incomplete": [_task_brief(t) for t in incomplete],
        "planned_count": len(planned),
        "completed_count": len(completed),
        "lagging_domain": lagging[0][0] if lagging else None,
        "briefing_count": len(briefings),
        "answers": answers or {},
    }


def _task_brief(t: Task) -> dict:
    return {"title": t.title, "domain": t.domain, "status": t.status}


def format_review_context(ctx: dict) -> str:
    lines = [
        f"Week reviewed: {ctx['week_start']} → {ctx['week_end']}",
        f"Planned tasks: {ctx['planned_count']} | Completed: {ctx['completed_count']}",
    ]
    if ctx["incomplete"]:
        lines.append("Left open:")
        lines += [f"  - [{t['domain']}] {t['title']}" for t in ctx["incomplete"]]
    if ctx["completed"]:
        lines.append("Completed:")
        lines += [f"  - [{t['domain']}] {t['title']}" for t in ctx["completed"]]
    if ctx["answers"]:
        lines.append("User answers:")
        lines += [f"  - {q}: {a}" for q, a in ctx["answers"].items()]
    return "\n".join(lines)


def _fallback_proposals(ctx: dict) -> list[dict]:
    """Deterministic proposer — always yields at least one observation (spec §4)."""
    proposals: list[dict] = []
    if ctx["lagging_domain"]:
        proposals.append(
            {
                "domain": ctx["lagging_domain"],
                "kind": "pattern",
                "content": (
                    f"{ctx['lagging_domain'].title()} tasks tend to slip during busy weeks — "
                    "schedule fewer, earlier."
                ),
            }
        )
    proposals.append(
        {
            "domain": "general",
            "kind": "fact",
            "content": (
                f"In the week of {ctx['week_start']}, "
                f"{ctx['completed_count']}/{ctx['planned_count']} planned tasks were completed."
            ),
        }
    )
    return proposals


def _parse_review_output(text: str) -> tuple[str, list[dict] | None]:
    if "---JSON---" in text:
        narrative, _, jtxt = text.partition("---JSON---")
        match = _JSON_LIST_RE.search(jtxt)
        if match:
            try:
                proposals = json.loads(match.group(0))
                if isinstance(proposals, list):
                    return narrative.strip(), proposals
            except json.JSONDecodeError:
                pass
    return text.strip(), None


async def run_weekly_review(
    db: AsyncSession, week_start: date | None = None, answers: dict | None = None
) -> Review:
    settings = get_settings()
    week_start = week_start or review_week_start()
    ctx = await build_review_context(db, week_start, answers)

    chief = chief_of_staff()
    priorities = await _active_priorities(db)
    system = chief.render_system(user_name=settings.user_name, priorities=priorities)
    user = load_prompt("weekly_review").format(
        user_name=settings.user_name,
        week_of=week_start.isoformat(),
        context=format_review_context(ctx),
    )
    result = await chief.complete(trigger="weekly_review", system=system, user=user, max_tokens=1800)

    proposals: list[dict] | None = None
    insights: str | None = None
    if result.text:
        insights, proposals = _parse_review_output(result.text)
    if not proposals:  # mocked, error, or unparseable JSON → deterministic proposer
        proposals = _fallback_proposals(ctx)
    if not insights:
        insights = render_fallback_review(ctx, proposals)

    # Apply the §5.3 dedup/confidence logic; new ones land as status='proposed'.
    embedder = get_embedding_provider()
    summary = await apply_proposed_observations(db, proposals, embedder)

    stored_proposals = {"proposals": proposals, **summary}
    review = await db.scalar(select(Review).where(Review.week_start == week_start))
    planned_snapshot = {"structured": ctx["plan"].structured if ctx["plan"] else None, "tasks": ctx["planned"]}
    actual_snapshot = {
        "completed": ctx["completed"],
        "incomplete": ctx["incomplete"],
        "completed_count": ctx["completed_count"],
        "planned_count": ctx["planned_count"],
        "briefing_count": ctx["briefing_count"],
        "answers": ctx["answers"],
    }
    if review:
        review.planned = planned_snapshot
        review.actual = actual_snapshot
        review.insights = insights
        review.proposed_observations = stored_proposals
    else:
        review = Review(
            week_start=week_start,
            planned=planned_snapshot,
            actual=actual_snapshot,
            insights=insights,
            proposed_observations=stored_proposals,
        )
        db.add(review)
    await db.commit()
    await db.refresh(review)
    return review
