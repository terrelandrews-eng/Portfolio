"""Formatting + deterministic fallback renderers for the weekly plan and review.

Like the daily briefing's render.py, the fallback renderers serve double duty: the
offline/mock output AND the fail-soft path when the real LLM errors, so a plan/review
narrative is always produced (spec §2.5).
"""

from __future__ import annotations

import json
from datetime import date, datetime


def _fmt_dt(dt) -> str:
    if isinstance(dt, datetime):
        return dt.strftime("%a %H:%M")
    return "?"


def format_weekly_context(ctx: dict) -> str:
    """Compact context block shared by domain agents and the Chief merge pass."""
    lines: list[str] = [
        f"Week: {ctx['week_start'].isoformat()} → {ctx['week_end'].isoformat()}",
        "",
        "Weather (7-day):",
    ]
    if ctx["weather"]:
        for i, d in enumerate(ctx["weather"]):
            lines.append(
                f"  - day {i}: {d.get('summary', '?')}, {d.get('low', '?')}–{d.get('high', '?')}°F, "
                f"{d.get('precip_prob', 0)}% precip"
            )
    else:
        lines.append("  - unavailable")

    lines += ["", "Calendar this week:"]
    if ctx["calendar"]:
        lines += [f"  - {_fmt_dt(e.get('start'))} {e.get('title', '?')}" for e in ctx["calendar"]]
    else:
        lines.append("  - (no events / calendar unavailable)")

    lines += ["", "Open tasks by domain:"]
    if ctx["tasks_by_domain"]:
        for domain, tasks in sorted(ctx["tasks_by_domain"].items()):
            titles = ", ".join(t.title for t in tasks[:6])
            lines.append(f"  - {domain}: {titles}")
    else:
        lines.append("  - none")

    if ctx["observations"]:
        lines += ["", "Active observations (preferences/patterns):"]
        lines += [f"  - [{o.domain}] {o.content}" for o in ctx["observations"]]

    if ctx["last_review"]:
        lines += ["", "Last week's review insights:", "  " + ctx["last_review"].insights[:500].replace("\n", " ")]

    if ctx["missing"]:
        lines += ["", f"MISSING CONTEXT: {', '.join(ctx['missing'])}"]

    return "\n".join(lines)


def format_contributions(contribs: dict) -> str:
    """Serialize the validated domain contributions for the Chief merge prompt."""
    out = []
    for domain, model in contribs.items():
        out.append(f"### {domain}\n{json.dumps(model.model_dump(), indent=2)}")
    return "\n\n".join(out)


def render_fallback_plan(structured: dict, ctx: dict) -> str:
    """Deterministic §7.2 markdown plan built purely from the merged structured payload."""
    week_of = structured["week_start"]
    lines = [f"# Week of {week_of} — Plan", "**Theme:** A balanced, realistic week — protect mornings and family dinners.", "", "## By day"]

    for day in structured["days"]:
        bits = []
        if day.get("dinner"):
            bits.append(f"dinner: {day['dinner']}")
        if day.get("workout"):
            bits.append(f"workout: {day['workout']}")
        if day.get("deep_work"):
            bits.append(f"deep work: {day['deep_work']}")
        if day.get("family"):
            bits.append(f"family: {day['family']}")
        if day.get("chores"):
            bits.append("chores: " + ", ".join(day["chores"]))
        detail = " · ".join(bits) if bits else "open"
        lines.append(f"- **{day['day']}** ({day['date']}): {detail}")

    lines += ["", "## Grocery list"]
    if structured["grocery_list"]:
        for group in structured["grocery_list"]:
            lines.append(f"- **{group['section']}:** " + ", ".join(group["items"]))
    else:
        lines.append("- (none)")

    lines += ["", "## Prep & notes"]
    lines += [f"- {n}" for n in structured["prep_notes"]] or ["- Nothing to prep ahead."]

    watchouts = list(structured["flags"])
    if ctx.get("missing"):
        watchouts.append(f"Missing context: {', '.join(ctx['missing'])}")
    lines += ["", "## Watch-outs"]
    lines += [f"- {w}" for w in watchouts] or ["- Nothing flagged."]

    return "\n".join(lines)


def render_fallback_review(review_ctx: dict, proposals: list[dict]) -> str:
    """Deterministic weekly-review narrative from planned-vs-actual data."""
    completed = review_ctx["completed_count"]
    total = review_ctx["planned_count"]
    rate = f"{completed}/{total}" if total else f"{completed}"
    lines = [
        f"# Weekly Review — week of {review_ctx['week_start']}",
        "## What happened",
        f"- Completed {rate} planned tasks this week.",
    ]
    if review_ctx["lagging_domain"]:
        lines.append(f"- {review_ctx['lagging_domain'].title()} had the most items left open.")
    if review_ctx["answers"]:
        lines += ["## Your notes"]
        lines += [f"- **{q}:** {a}" for q, a in review_ctx["answers"].items()]
    lines += ["## Insights"]
    if proposals:
        lines += [f"- {p['content']}" for p in proposals]
    else:
        lines.append("- Steady week — no new patterns detected.")
    return "\n".join(lines)


def plan_json_snapshot(ctx: dict, structured: dict) -> dict:
    """JSON-safe snapshot for weekly_plans.structured is `structured`; this is for review inputs."""
    return {
        "week_start": ctx["week_start"].isoformat() if isinstance(ctx["week_start"], date) else ctx["week_start"],
        "observations": [o.content for o in ctx["observations"]],
        "missing": ctx["missing"],
        "structured": structured,
    }
