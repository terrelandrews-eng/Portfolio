"""Domain-agent weekly contributions (spec §7.2 step 2).

Each domain agent (Meals, Health, Home) returns a JSON contribution that is validated
against a pydantic model. The flow gives one retry on validation failure (spec §15.5),
then falls back to a deterministic Python-built contribution so the weekly plan is
*always* produced with a valid `structured` payload — mirroring the Phase 2 rule that
the data is computed in Python and the LLM only writes prose (spec §15.4, §2.5).
"""

from __future__ import annotations

import json
import re
from datetime import date, timedelta

from pydantic import BaseModel, Field

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


# ---- Contribution schemas (validated per domain) ----
class DinnerItem(BaseModel):
    day: str
    meal: str
    prep_notes: str | None = None


class GroceryGroup(BaseModel):
    section: str
    items: list[str] = Field(default_factory=list)


class MealsContribution(BaseModel):
    dinners: list[DinnerItem]
    grocery_list: list[GroceryGroup] = Field(default_factory=list)
    prep_block: str | None = None


class WorkoutItem(BaseModel):
    day: str
    activity: str
    time: str | None = None
    duration_min: int | None = None


class HealthContribution(BaseModel):
    workouts: list[WorkoutItem]
    flags: list[str] = Field(default_factory=list)


class ChoreItem(BaseModel):
    day: str
    task: str
    weather_sensitive: bool = False


class HomeContribution(BaseModel):
    chores: list[ChoreItem]
    flags: list[str] = Field(default_factory=list)


class FamilyItem(BaseModel):
    day: str
    activity: str


class FamilyContribution(BaseModel):
    family_time: list[FamilyItem]
    flags: list[str] = Field(default_factory=list)


class BusinessBlock(BaseModel):
    day: str
    focus: str
    time: str | None = None


class BusinessContribution(BaseModel):
    deep_work: list[BusinessBlock]
    one_big_thing: str | None = None
    flags: list[str] = Field(default_factory=list)


DOMAIN_MODELS: dict[str, type[BaseModel]] = {
    "meals": MealsContribution,
    "health": HealthContribution,
    "home": HomeContribution,
    "family": FamilyContribution,
    "business": BusinessContribution,
}

# Compact schema hints injected into each domain prompt (kept terse on purpose).
SCHEMA_HINTS: dict[str, str] = {
    "meals": (
        '{"dinners":[{"day":"Monday","meal":"...","prep_notes":"..."}],'
        '"grocery_list":[{"section":"Produce","items":["..."]}],'
        '"prep_block":"Sunday 4pm ..."}'
    ),
    "health": (
        '{"workouts":[{"day":"Monday","activity":"...","time":"06:30","duration_min":45}],'
        '"flags":["..."]}'
    ),
    "home": (
        '{"chores":[{"day":"Saturday","task":"...","weather_sensitive":true}],'
        '"flags":["..."]}'
    ),
    "family": (
        '{"family_time":[{"day":"Friday","activity":"Date night with ..."}],'
        '"flags":["birthday in 10 days"]}'
    ),
    "business": (
        '{"deep_work":[{"day":"Monday","focus":"...","time":"09:00"}],'
        '"one_big_thing":"...","flags":["..."]}'
    ),
}

_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)


def extract_json(text: str) -> str:
    """Pull the first JSON object out of an LLM response (tolerates code fences/prose)."""
    match = _JSON_RE.search(text)
    if not match:
        raise ValueError("no JSON object found")
    return match.group(0)


def validate_contribution(domain: str, text: str) -> BaseModel:
    model = DOMAIN_MODELS[domain]
    return model.model_validate(json.loads(extract_json(text)))


# ---- Deterministic fallbacks (offline / mock / validation-failure path) ----
def _is_dry(weather, day_index: int) -> bool:
    """Best-effort dry-day check from the 3-day forecast; default dry beyond horizon."""
    if not weather or day_index >= len(weather):
        return True
    return weather[day_index].get("precip_prob", 0) < 50


def fallback_meals(ctx: dict) -> MealsContribution:
    rotation = [
        ("Sheet-pan chicken & veg", "Chop veg night before"),
        ("Turkey chili", "Double batch — freeze half"),
        ("Pasta primavera", None),
        ("Tacos", "Prep slaw ahead"),
        ("Salmon & rice bowls", None),
        ("Homemade pizza night", "Kids help assemble"),
        ("Roast + leftovers", "Cook Sunday, eat Mon"),
    ]
    dinners = [
        DinnerItem(day=DAYS[i], meal=meal, prep_notes=notes)
        for i, (meal, notes) in enumerate(rotation)
    ]
    grocery = [
        GroceryGroup(section="Produce", items=["Mixed veg", "Salad greens", "Onions", "Peppers"]),
        GroceryGroup(section="Protein", items=["Chicken thighs", "Ground turkey", "Salmon"]),
        GroceryGroup(section="Pantry", items=["Rice", "Pasta", "Tortillas", "Canned beans"]),
        GroceryGroup(section="Dairy", items=["Cheese", "Milk", "Eggs"]),
    ]
    return MealsContribution(
        dinners=dinners,
        grocery_list=grocery,
        prep_block="Sunday 4pm — batch prep proteins and chop veg (correlates with fewer takeout nights).",
    )


def fallback_health(ctx: dict) -> HealthContribution:
    # Honor the "workouts before 7am" pattern: schedule early on Mon/Wed/Fri + Sat.
    plan = {
        "Monday": ("Strength — full body", "06:30", 45),
        "Wednesday": ("Zone-2 run", "06:30", 40),
        "Friday": ("Strength — upper", "06:30", 45),
        "Saturday": ("Long walk / mobility", "08:00", 60),
    }
    workouts = [
        WorkoutItem(day=day, activity=act, time=t, duration_min=d)
        for day, (act, t, d) in plan.items()
    ]
    return HealthContribution(workouts=workouts, flags=[])


def fallback_home(ctx: dict) -> HomeContribution:
    weather = ctx.get("weather")
    # Weather-weight outdoor chores onto the driest of the next few days (spec §6-Home).
    dry_day = next((DAYS[i] for i in range(min(3, 7)) if _is_dry(weather, i)), "Saturday")
    chores = [
        ChoreItem(day="Monday", task="Trash & recycling out", weather_sensitive=False),
        ChoreItem(day="Wednesday", task="Vacuum + tidy common areas", weather_sensitive=False),
        ChoreItem(day=dry_day, task="Yard work / outdoor maintenance", weather_sensitive=True),
        ChoreItem(day="Saturday", task="Groceries + weekly reset", weather_sensitive=False),
        ChoreItem(day="Sunday", task="Laundry + meal prep support", weather_sensitive=False),
    ]
    return HomeContribution(chores=chores, flags=[])


def fallback_family(ctx: dict) -> FamilyContribution:
    # Protect Friday date night (honor "local restaurant" preference) + weekend family time.
    return FamilyContribution(
        family_time=[
            FamilyItem(day="Friday", activity="Date night with Sarah (local restaurant)"),
            FamilyItem(day="Sunday", activity="Family afternoon — no work"),
        ],
        flags=[],
    )


def fallback_business(ctx: dict) -> BusinessContribution:
    return BusinessContribution(
        deep_work=[
            BusinessBlock(day="Monday", focus="Client proposal — deep work", time="09:00"),
            BusinessBlock(day="Tuesday", focus="Product roadmap", time="09:00"),
            BusinessBlock(day="Thursday", focus="Invoicing + follow-ups", time="09:00"),
        ],
        one_big_thing="Ship the client proposal",
        flags=[],
    )


FALLBACK_BUILDERS = {
    "meals": fallback_meals,
    "health": fallback_health,
    "home": fallback_home,
    "family": fallback_family,
    "business": fallback_business,
}


def build_fallback(domain: str, ctx: dict) -> BaseModel:
    return FALLBACK_BUILDERS[domain](ctx)


# ---- Deterministic Python merge → structured plan (always valid) ----
def merge_contributions(contribs: dict[str, BaseModel], week_start: date) -> dict:
    """Compose the per-domain contributions into the plan's `structured` payload.

    Everything actionable lives here so the confirm→tasks path never depends on the
    LLM. `days` is Monday-anchored with concrete dates for scheduling.
    """
    meals: MealsContribution | None = contribs.get("meals")  # type: ignore[assignment]
    health: HealthContribution | None = contribs.get("health")  # type: ignore[assignment]
    home: HomeContribution | None = contribs.get("home")  # type: ignore[assignment]
    family: FamilyContribution | None = contribs.get("family")  # type: ignore[assignment]
    business: BusinessContribution | None = contribs.get("business")  # type: ignore[assignment]

    dinner_by_day = {d.day: d for d in meals.dinners} if meals else {}
    workout_by_day = {w.day: w for w in health.workouts} if health else {}
    family_by_day = {f.day: f for f in family.family_time} if family else {}
    deepwork_by_day = {b.day: b for b in business.deep_work} if business else {}
    chores_by_day: dict[str, list[ChoreItem]] = {}
    for c in home.chores if home else []:
        chores_by_day.setdefault(c.day, []).append(c)

    days = []
    for i, name in enumerate(DAYS):
        day_date = week_start + timedelta(days=i)
        dinner = dinner_by_day.get(name)
        workout = workout_by_day.get(name)
        fam = family_by_day.get(name)
        dw = deepwork_by_day.get(name)
        days.append(
            {
                "day": name,
                "date": day_date.isoformat(),
                "dinner": dinner.meal if dinner else None,
                "dinner_prep": dinner.prep_notes if dinner else None,
                "workout": _workout_str(workout) if workout else None,
                "chores": [c.task for c in chores_by_day.get(name, [])],
                "family": fam.activity if fam else None,
                "deep_work": _deepwork_str(dw) if dw else None,
            }
        )

    prep_notes = []
    if meals and meals.prep_block:
        prep_notes.append(meals.prep_block)
    flags: list[str] = []
    for c in (health, home, family, business):
        if c:
            flags += list(c.flags)

    structured = {
        "week_start": week_start.isoformat(),
        "days": days,
        "grocery_list": [g.model_dump() for g in meals.grocery_list] if meals else [],
        "prep_notes": prep_notes,
        "flags": flags,
    }
    if business and business.one_big_thing:
        structured["one_big_thing"] = business.one_big_thing
    return structured


def _workout_str(w: WorkoutItem) -> str:
    parts = [w.activity]
    if w.time:
        parts.append(f"@ {w.time}")
    if w.duration_min:
        parts.append(f"({w.duration_min}m)")
    return " ".join(parts)


def _deepwork_str(b: BusinessBlock) -> str:
    return f"{b.focus} @ {b.time}" if b.time else b.focus
