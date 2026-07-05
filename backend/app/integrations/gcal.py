"""Google Calendar read-through cache (spec §10).

events_cache read-through with a 15-minute TTL. In MOCK_INTEGRATIONS mode returns a
deterministic set of events anchored to today so the briefing has calendar content
offline. The real path exchanges the stored refresh token for an access token and
lists events; it's exercised only when Google credentials are configured.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone

import httpx
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models import EventCache

_TTL = timedelta(minutes=15)


def _mock_events(start: date, end: date) -> list[dict]:
    """Deterministic events across the window (today + next 2 days)."""
    tz = timezone.utc
    out: list[dict] = []
    day = start
    templates = [
        [("Deep work block", 9, 12, "Home office"), ("Family dinner", 18, 19, "Home")],
        [("Client call — Q2 proposal", 10, 11, "Zoom"), ("Micah soccer", 17, 18, "Field 3")],
        [("Dentist", 8, 9, "Downtown"), ("Date night", 19, 21, "Local Thai")],
    ]
    idx = 0
    while day <= end:
        for title, sh, eh, loc in templates[idx % len(templates)]:
            out.append(
                {
                    "title": title,
                    "start": datetime.combine(day, time(sh, 0, tzinfo=tz)),
                    "end": datetime.combine(day, time(eh, 0, tzinfo=tz)),
                    "location": loc,
                }
            )
        day += timedelta(days=1)
        idx += 1
    return out


async def _access_token() -> str:
    settings = get_settings()
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "refresh_token": settings.google_refresh_token,
                "grant_type": "refresh_token",
            },
        )
        resp.raise_for_status()
        return resp.json()["access_token"]


async def _fetch_google_events(start: date, end: date) -> list[dict]:
    token = await _access_token()
    time_min = datetime.combine(start, time.min, tzinfo=timezone.utc).isoformat()
    time_max = datetime.combine(end + timedelta(days=1), time.min, tzinfo=timezone.utc).isoformat()
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            headers={"Authorization": f"Bearer {token}"},
            params={
                "timeMin": time_min,
                "timeMax": time_max,
                "singleEvents": "true",
                "orderBy": "startTime",
            },
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])

    events: list[dict] = []
    for it in items:
        s = it.get("start", {}).get("dateTime") or it.get("start", {}).get("date")
        e = it.get("end", {}).get("dateTime") or it.get("end", {}).get("date")
        events.append(
            {
                "title": it.get("summary", "(no title)"),
                "start": _parse_dt(s),
                "end": _parse_dt(e),
                "location": it.get("location"),
                "external_id": it.get("id"),
            }
        )
    return events


def _parse_dt(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        if len(value) == 10:  # all-day date
            return datetime.fromisoformat(value + "T00:00:00+00:00")
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


async def get_events(db: AsyncSession, start: date, end: date) -> list[dict]:
    """Return events for [start, end], refreshing the cache if stale."""
    settings = get_settings()

    fresh_since = datetime.now(timezone.utc) - _TTL
    cached = (
        await db.scalars(
            select(EventCache)
            .where(EventCache.synced_at >= fresh_since)
            .where(EventCache.start >= datetime.combine(start, time.min, tzinfo=timezone.utc))
            .order_by(EventCache.start)
        )
    ).all()
    if cached:
        return [_row_to_dict(r) for r in cached]

    events = _mock_events(start, end) if settings.mock_integrations else await _fetch_google_events(start, end)

    # Refresh cache window.
    await db.execute(
        delete(EventCache).where(
            EventCache.start >= datetime.combine(start, time.min, tzinfo=timezone.utc)
        )
    )
    for ev in events:
        db.add(
            EventCache(
                external_id=ev.get("external_id"),
                calendar_id="primary",
                title=ev["title"],
                start=ev["start"],
                end=ev["end"],
                location=ev.get("location"),
                raw={},
            )
        )
    await db.commit()
    return events


def _row_to_dict(r: EventCache) -> dict:
    return {"title": r.title, "start": r.start, "end": r.end, "location": r.location}


async def create_event(
    db: AsyncSession,
    *,
    summary: str,
    start: datetime,
    end: datetime,
    location: str | None = None,
) -> dict:
    """Create a calendar event (proposals-only write path, spec §10).

    Mock mode records it in events_cache so it shows up in reads; the real path
    inserts into Google Calendar and then caches the returned event.
    """
    settings = get_settings()

    if settings.mock_integrations or not settings.google_refresh_token:
        external_id = f"mock-{int(datetime.now(timezone.utc).timestamp())}"
    else:
        external_id = await _insert_google_event(summary=summary, start=start, end=end, location=location)

    row = EventCache(
        external_id=external_id,
        calendar_id="primary",
        title=summary,
        start=start,
        end=end,
        location=location,
        raw={"created_via": "proposal"},
    )
    db.add(row)
    await db.commit()
    return {
        "external_id": external_id,
        "title": summary,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "location": location,
        "delivered": "mock" if (settings.mock_integrations or not settings.google_refresh_token) else "google",
    }


async def _insert_google_event(
    *, summary: str, start: datetime, end: datetime, location: str | None
) -> str:
    token = await _access_token()
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "summary": summary,
                "location": location,
                "start": {"dateTime": start.isoformat()},
                "end": {"dateTime": end.isoformat()},
            },
        )
        resp.raise_for_status()
        return resp.json().get("id", "")
