from datetime import date

from app.db.models import Task
from app.flows.render import render_fallback_briefing

REQUIRED_SECTIONS = [
    "**The one thing:**",
    "## Today's shape",
    "## Focus (max 3)",
    "## Logistics",
    "## Watch-outs",
    "## Parked (and why)",
]


def _ctx(weather):
    d = date(2026, 7, 7)
    task = Task(title="Client proposal", domain="business", status="open", priority=1, scheduled_for=d)
    return {
        "date": d,
        "weather": weather,
        "calendar": [
            {"title": "Family dinner", "start": None, "end": None, "location": "Home"}
        ],
        "tasks": {"due_today": [], "overdue": [], "scheduled_today": [task]},
        "observations": [],
        "weekly_plan": None,
        "yesterday_briefing": None,
        "alerts": [],
        "missing": [],
    }


def test_briefing_has_all_required_sections():
    md = render_fallback_briefing(_ctx([{"date": "2026-07-07", "high": 78, "low": 61, "precip_prob": 10, "summary": "Sunny"}]))
    assert md.startswith("# Tuesday, July 7 — Briefing")
    for section in REQUIRED_SECTIONS:
        assert section in md, f"missing {section}"


def test_briefing_includes_calendar_weather_tasks():
    md = render_fallback_briefing(_ctx([{"date": "2026-07-07", "high": 78, "low": 61, "precip_prob": 10, "summary": "Sunny"}]))
    assert "Sunny" in md  # weather
    assert "Family dinner" in md or "dinner" in md.lower()  # calendar
    assert "Client proposal" in md  # task


def test_briefing_survives_weather_failure():
    # Failure injection: weather is None (integration down) — still produces a briefing.
    ctx = _ctx(None)
    ctx["missing"] = ["weather (TimeoutError)"]
    md = render_fallback_briefing(ctx)
    assert "Weather: unavailable." in md
    for section in REQUIRED_SECTIONS:
        assert section in md
