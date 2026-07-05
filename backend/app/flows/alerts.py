"""Entity/task alert computations (spec §6.4, §7.1 step 1).

All computed in Python, never by the LLM (spec §15.4). Pure functions over plain
entity/task data so they can be tested exhaustively (spec §13).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date


@dataclass
class Alert:
    kind: str  # 'maintenance' | 'birthday' | 'bill'
    title: str
    detail: str
    due_date: date | None = None


def _parse_date(value) -> date | None:
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None
    return None


def add_months(d: date, months: int) -> date:
    """Add months to a date, clamping day-of-month to the target month's length."""
    total = d.month - 1 + months
    year = d.year + total // 12
    month = total % 12 + 1
    # Clamp day (e.g. Jan 31 + 1 month -> Feb 28/29).
    for day in (d.day, 30, 29, 28):
        try:
            return date(year, month, day)
        except ValueError:
            continue
    return date(year, month, 28)


def _next_birthday(birthday: date, today: date) -> date:
    """The next occurrence of a month/day on or after today."""
    try:
        candidate = birthday.replace(year=today.year)
    except ValueError:  # Feb 29 birthday in a non-leap year
        candidate = date(today.year, 3, 1)
    if candidate < today:
        try:
            candidate = birthday.replace(year=today.year + 1)
        except ValueError:
            candidate = date(today.year + 1, 3, 1)
    return candidate


def maintenance_due(entities, today: date, horizon_days: int = 14) -> list[Alert]:
    """Detect home systems/appliances/vehicles due (or overdue) for service."""
    alerts: list[Alert] = []
    for e in entities:
        attrs = e.attributes or {}

        # Interval-based service (last_serviced/last_filter + interval months).
        last = _parse_date(attrs.get("last_serviced") or attrs.get("last_filter"))
        interval = attrs.get("service_interval_months") or attrs.get("water_filter_interval_months")
        if last and isinstance(interval, int):
            due = add_months(last, interval)
            if due <= today + _days(horizon_days):
                overdue = due < today
                alerts.append(
                    Alert(
                        kind="maintenance",
                        title=f"{e.name} service {'overdue' if overdue else 'due'}",
                        detail=f"{e.name}: last done {last.isoformat()}, next due {due.isoformat()}.",
                        due_date=due,
                    )
                )

        # Mileage-based service (vehicles).
        cur = attrs.get("current_miles")
        due_miles = attrs.get("oil_change_due_miles")
        if isinstance(cur, (int, float)) and isinstance(due_miles, (int, float)):
            if cur >= due_miles - 2500:  # within ~2.5k miles
                alerts.append(
                    Alert(
                        kind="maintenance",
                        title=f"{e.name} oil change approaching",
                        detail=f"{e.name}: {int(cur)} mi, due at {int(due_miles)} mi.",
                    )
                )
    return alerts


def upcoming_birthdays(entities, today: date, within_days: int = 14) -> list[Alert]:
    alerts: list[Alert] = []
    for e in entities:
        attrs = e.attributes or {}
        bday = _parse_date(attrs.get("birthday"))
        if not bday:
            continue
        nxt = _next_birthday(bday, today)
        days_away = (nxt - today).days
        if 0 <= days_away <= within_days:
            rel = (attrs.get("relationship") or e.type)
            alerts.append(
                Alert(
                    kind="birthday",
                    title=f"{e.name}'s birthday in {days_away} day(s)",
                    detail=f"{e.name} ({rel}) — {nxt.isoformat()}.",
                    due_date=nxt,
                )
            )
    return alerts


def bills_due(tasks, today: date, within_days: int = 3) -> list[Alert]:
    """Finance tasks with a due date inside the window (spec §6.4)."""
    alerts: list[Alert] = []
    for t in tasks:
        if t.domain != "finance" or t.status != "open" or not t.due_date:
            continue
        days_away = (t.due_date - today).days
        if days_away <= within_days:
            when = "overdue" if days_away < 0 else f"in {days_away} day(s)"
            alerts.append(
                Alert(
                    kind="bill",
                    title=f"{t.title} {when}",
                    detail=f"{t.title} — due {t.due_date.isoformat()}.",
                    due_date=t.due_date,
                )
            )
    return alerts


def _days(n: int):
    from datetime import timedelta

    return timedelta(days=n)
