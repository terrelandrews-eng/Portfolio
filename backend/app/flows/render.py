"""Rendering helpers for the daily briefing.

- format_context_for_prompt: turns the gathered context into a compact text block for
  the LLM system/user prompt.
- render_fallback_briefing: a deterministic §7.1-formatted briefing built purely in
  Python. Used both as the offline/mock output and as the fail-soft path when the LLM
  errors (spec §2.5) — so a briefing always contains calendar + weather + tasks.
- json_snapshot: a JSON-safe snapshot for the briefings.inputs column (spec §5.6).
"""

from __future__ import annotations

from datetime import date, datetime


def _fmt_time(dt) -> str:
    if isinstance(dt, datetime):
        return dt.strftime("%H:%M")
    return "?"


def _weather_line(forecast) -> str:
    if not forecast:
        return "Weather: unavailable."
    today = forecast[0]
    return (
        f"Weather today: {today['summary']}, {today['low']}–{today['high']}°F, "
        f"{today['precip_prob']}% precip."
    )


def _event_lines(events) -> list[str]:
    if not events:
        return ["(no calendar events / calendar unavailable)"]
    return [
        f"{_fmt_time(e['start'])}–{_fmt_time(e['end'])} {e['title']}"
        + (f" @ {e['location']}" if e.get("location") else "")
        for e in events
    ]


def _task_line(t) -> str:
    due = f" (due {t.due_date.isoformat()})" if t.due_date else ""
    return f"[{t.domain}/p{t.priority}] {t.title}{due}"


def format_context_for_prompt(ctx: dict) -> str:
    tasks = ctx["tasks"]
    lines: list[str] = []

    lines.append(_weather_line(ctx["weather"]))
    lines.append("")
    lines.append("Calendar (today + next 2 days):")
    lines += [f"  - {ln}" for ln in _event_lines(ctx["calendar"])]

    lines.append("")
    lines.append("Tasks due today:")
    lines += [f"  - {_task_line(t)}" for t in tasks["due_today"]] or ["  - none"]
    lines.append("Overdue tasks:")
    lines += [f"  - {_task_line(t)}" for t in tasks["overdue"]] or ["  - none"]
    lines.append("Scheduled for today:")
    lines += [f"  - {_task_line(t)}" for t in tasks["scheduled_today"]] or ["  - none"]

    if ctx["observations"]:
        lines.append("")
        lines.append("Relevant patterns/preferences (observations):")
        lines += [f"  - {o.content}" for o in ctx["observations"]]

    if ctx["alerts"]:
        lines.append("")
        lines.append("Computed alerts:")
        lines += [f"  - [{a['kind']}] {a['detail']}" for a in ctx["alerts"]]

    if ctx["missing"]:
        lines.append("")
        lines.append(f"MISSING CONTEXT: {', '.join(ctx['missing'])}")

    return "\n".join(lines)


def _weekday_long(d: date) -> tuple[str, str]:
    return d.strftime("%A"), d.strftime("%B %-d")


def render_fallback_briefing(ctx: dict) -> str:
    d: date = ctx["date"]
    weekday, date_long = _weekday_long(d)
    tasks = ctx["tasks"]

    # Focus: top 3 by priority across scheduled/due/overdue (deduped by id).
    pool: dict = {}
    for bucket in ("scheduled_today", "due_today", "overdue"):
        for t in tasks[bucket]:
            pool.setdefault(t.id, t)
    focus = sorted(pool.values(), key=lambda t: (t.priority, t.due_date or d))[:3]

    one_thing = focus[0].title if focus else "Protect your top priority and stay present."

    # Today's shape (weather + load).
    weather = _weather_line(ctx["weather"])
    load = f"{len(ctx['calendar'])} calendar item(s), {len(pool)} active task(s)."

    # Logistics: pull dinner/workout hints from tasks + calendar.
    dinner = next(
        (e["title"] for e in ctx["calendar"] if "dinner" in e["title"].lower()),
        next((t.title for t in pool.values() if t.domain == "meals"), "cook something simple"),
    )
    workout = next((t.title for t in pool.values() if t.domain == "health"), "rest / mobility")
    errands = ", ".join(t.title for t in pool.values() if t.domain == "home") or "none"

    watchouts = [f"[{a['kind']}] {a['title']}" for a in ctx["alerts"]]
    for t in tasks["overdue"]:
        if t.due_date and (d - t.due_date).days > 7:
            watchouts.append(f"Overdue >7d: {t.title} (due {t.due_date.isoformat()})")
    if ctx["missing"]:
        watchouts.append(f"Missing context: {', '.join(ctx['missing'])}")

    parked = [t for t in pool.values() if t not in focus]

    lines = [
        f"# {weekday}, {date_long} — Briefing",
        f"**The one thing:** {one_thing}"
        + (f" — {focus[0].domain} priority {focus[0].priority}." if focus else ""),
        "## Today's shape",
        f"{weather} {load} "
        + ("Rain likely — keep outdoor tasks flexible." if _is_wet(ctx["weather"]) else "Good day to move."),
        "## Focus (max 3)",
    ]
    if focus:
        lines += [f"{i+1}. {t.title} ({t.domain})" for i, t in enumerate(focus)]
    else:
        lines.append("1. No scheduled tasks — protect your top priority.")

    lines += [
        "## Logistics",
        f"- Dinner: {dinner} | Workout: {workout} | Errands/chores: {errands}",
        "## Watch-outs",
    ]
    lines += [f"- {w}" for w in watchouts] or ["- Nothing falling through the cracks."]

    lines.append("## Parked (and why)")
    if parked:
        lines += [f"- {t.title} — lower priority (p{t.priority}), revisit later." for t in parked[:6]]
    else:
        lines.append("- Nothing parked.")

    return "\n".join(lines)


def _is_wet(forecast) -> bool:
    return bool(forecast) and forecast[0].get("precip_prob", 0) >= 50


def json_snapshot(ctx: dict) -> dict:
    """JSON-serializable snapshot of the context used (for briefings.inputs)."""

    def task_dict(t):
        return {
            "id": str(t.id),
            "title": t.title,
            "domain": t.domain,
            "priority": t.priority,
            "due_date": t.due_date.isoformat() if t.due_date else None,
        }

    def event_dict(e):
        return {
            "title": e["title"],
            "start": e["start"].isoformat() if e.get("start") else None,
            "end": e["end"].isoformat() if e.get("end") else None,
            "location": e.get("location"),
        }

    return {
        "date": ctx["date"].isoformat(),
        "weather": ctx["weather"],
        "calendar": [event_dict(e) for e in ctx["calendar"]],
        "tasks": {k: [task_dict(t) for t in v] for k, v in ctx["tasks"].items()},
        "observations": [o.content for o in ctx["observations"]],
        "alerts": ctx["alerts"],
        "missing": ctx["missing"],
    }
