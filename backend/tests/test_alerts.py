from datetime import date

from app.db.models import Entity, Task
from app.flows.alerts import (
    add_months,
    bills_due,
    maintenance_due,
    upcoming_birthdays,
)


def _entity(type_, name, attributes):
    return Entity(type=type_, name=name, attributes=attributes)


def test_add_months_clamps_day():
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert add_months(date(2026, 3, 1), 6) == date(2026, 9, 1)
    assert add_months(date(2026, 12, 15), 1) == date(2027, 1, 15)


def test_maintenance_due_within_horizon():
    hvac = _entity("home_system", "HVAC", {"last_serviced": "2026-03-01", "service_interval_months": 6})
    # Due 2026-09-01. Two weeks before -> flagged.
    alerts = maintenance_due([hvac], date(2026, 8, 25), horizon_days=14)
    assert len(alerts) == 1
    assert "due" in alerts[0].title


def test_maintenance_not_due_far_out():
    hvac = _entity("home_system", "HVAC", {"last_serviced": "2026-03-01", "service_interval_months": 6})
    assert maintenance_due([hvac], date(2026, 1, 1)) == []


def test_maintenance_overdue_label():
    hvac = _entity("home_system", "HVAC", {"last_serviced": "2026-03-01", "service_interval_months": 6})
    alerts = maintenance_due([hvac], date(2026, 10, 1))
    assert alerts and "overdue" in alerts[0].title


def test_vehicle_oil_change_proximity():
    car = _entity("vehicle", "Odyssey", {"current_miles": 49800, "oil_change_due_miles": 52000})
    alerts = maintenance_due([car], date(2026, 7, 1))
    assert any("oil change" in a.title for a in alerts)


def test_upcoming_birthday_window():
    sarah = _entity("person", "Sarah", {"birthday": "1988-04-02"})
    assert upcoming_birthdays([sarah], date(2026, 3, 25), within_days=14)  # 8 days away
    assert upcoming_birthdays([sarah], date(2026, 1, 1), within_days=14) == []


def test_bills_due_window():
    bill = Task(title="Pay electric", domain="finance", status="open", priority=2, due_date=date(2026, 7, 6))
    other = Task(title="Deep work", domain="business", status="open", priority=1, due_date=date(2026, 7, 6))
    alerts = bills_due([bill, other], date(2026, 7, 4), within_days=3)
    assert len(alerts) == 1
    assert alerts[0].kind == "bill"
