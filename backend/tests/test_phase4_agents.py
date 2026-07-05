"""Phase 4: family/business contributions + merge, and chat calendar-intent helpers."""

from datetime import datetime
from zoneinfo import ZoneInfo

from app.agents import contributions as contrib
from app.flows.chat_agent import _event_summary, _next_weekday, _weekday_in

WEEK_START_MON = __import__("datetime").date(2026, 7, 6)
_EMPTY_CTX = {"weather": None, "missing": []}


def test_family_and_business_fallbacks_valid():
    fam = contrib.build_fallback("family", _EMPTY_CTX)
    biz = contrib.build_fallback("business", _EMPTY_CTX)
    assert isinstance(fam, contrib.FamilyContribution)
    assert isinstance(biz, contrib.BusinessContribution)
    assert any("date night" in f.activity.lower() for f in fam.family_time)
    assert biz.one_big_thing


def test_merge_folds_family_and_business_into_days():
    contribs = {d: contrib.build_fallback(d, _EMPTY_CTX) for d in contrib.DOMAIN_MODELS}
    structured = contrib.merge_contributions(contribs, WEEK_START_MON)

    friday = next(d for d in structured["days"] if d["day"] == "Friday")
    assert friday["family"] and "date night" in friday["family"].lower()
    monday = next(d for d in structured["days"] if d["day"] == "Monday")
    assert monday["deep_work"]
    assert structured.get("one_big_thing")


def test_merge_still_works_with_three_domains():
    # Backwards-compatible with the Phase 3 fan-out (no family/business).
    contribs = {d: contrib.build_fallback(d, _EMPTY_CTX) for d in ("meals", "health", "home")}
    structured = contrib.merge_contributions(contribs, WEEK_START_MON)
    assert len(structured["days"]) == 7
    assert all(d.get("family") is None for d in structured["days"])


def test_weekday_extraction():
    assert _weekday_in("plan a date night for Friday") == 4
    assert _weekday_in("do it on monday morning") == 0
    assert _weekday_in("sometime soon") is None


def test_next_weekday_is_upcoming_not_today():
    # 2026-07-06 is a Monday; next Monday should be +7, next Friday +4.
    now = datetime(2026, 7, 6, 10, 0, tzinfo=ZoneInfo("America/New_York"))
    assert _next_weekday(now, 0).date().isoformat() == "2026-07-13"
    assert _next_weekday(now, 4).date().isoformat() == "2026-07-10"


def test_event_summary_strips_command_verbs():
    assert _event_summary("schedule a dentist appointment") == "A dentist appointment"
    assert _event_summary("book the team offsite").lower().startswith("the team offsite")
