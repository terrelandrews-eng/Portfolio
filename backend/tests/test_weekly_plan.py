"""Phase 3: domain contribution validation + deterministic merge (spec §7.2, §15.4/§15.5)."""

from datetime import date

import pytest
from pydantic import ValidationError

from app.agents import contributions as contrib
from app.flows.weekly_plan import _tasks_from_structured
from app.flows.weekly_render import render_fallback_plan

WEEK_START = date(2026, 7, 6)  # a Monday
_EMPTY_CTX = {"weather": None, "missing": []}

PLAN_SECTIONS = ["# Week of", "## By day", "## Grocery list", "## Prep & notes", "## Watch-outs"]


def test_validate_good_meals_contribution():
    raw = '{"dinners":[{"day":"Monday","meal":"Tacos"}],"grocery_list":[],"prep_block":null}'
    model = contrib.validate_contribution("meals", raw)
    assert isinstance(model, contrib.MealsContribution)
    assert model.dinners[0].meal == "Tacos"


def test_validate_tolerates_code_fences_and_prose():
    raw = 'Here is the JSON:\n```json\n{"chores":[{"day":"Saturday","task":"Mow"}]}\n```'
    model = contrib.validate_contribution("home", raw)
    assert model.chores[0].task == "Mow"


def test_validate_rejects_missing_required_field():
    # Health requires `workouts`; this should raise so the flow retries/falls back.
    with pytest.raises((ValidationError, ValueError)):
        contrib.validate_contribution("health", '{"flags":["overdue checkup"]}')


def test_fallbacks_are_valid_models():
    for domain in ("meals", "health", "home"):
        model = contrib.build_fallback(domain, _EMPTY_CTX)
        assert isinstance(model, contrib.DOMAIN_MODELS[domain])


def test_merge_produces_seven_dated_days_and_grocery():
    contribs = {d: contrib.build_fallback(d, _EMPTY_CTX) for d in ("meals", "health", "home")}
    structured = contrib.merge_contributions(contribs, WEEK_START)

    assert len(structured["days"]) == 7
    assert structured["days"][0]["date"] == "2026-07-06"
    assert structured["days"][6]["date"] == "2026-07-12"
    assert structured["grocery_list"], "expected a consolidated grocery list"
    # The Sunday meal-prep observation should surface as a prep note.
    assert any("prep" in n.lower() for n in structured["prep_notes"])


def test_confirm_derives_tasks_from_structured():
    contribs = {d: contrib.build_fallback(d, _EMPTY_CTX) for d in ("meals", "health", "home")}
    structured = contrib.merge_contributions(contribs, WEEK_START)
    tasks = _tasks_from_structured(structured)

    assert tasks, "confirm should create tasks"
    assert all(t.source == "weekly_plan" for t in tasks)
    assert {t.domain for t in tasks} <= {"health", "home"}
    assert any(t.domain == "health" for t in tasks)  # workouts
    assert any("Grocery" in t.title for t in tasks)  # weekly grocery run


def test_home_outdoor_chore_is_weather_sensitive():
    home = contrib.build_fallback("home", _EMPTY_CTX)
    assert any(c.weather_sensitive for c in home.chores)


def test_fallback_plan_has_required_sections():
    contribs = {d: contrib.build_fallback(d, _EMPTY_CTX) for d in ("meals", "health", "home")}
    structured = contrib.merge_contributions(contribs, WEEK_START)
    md = render_fallback_plan(structured, {"missing": []})
    for section in PLAN_SECTIONS:
        assert section in md, f"missing {section}"
