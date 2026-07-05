"""Weather via Open-Meteo (no API key). Spec §10.

1-hour in-process cache. In MOCK_INTEGRATIONS mode returns a deterministic canned
forecast so the briefing is demoable offline. Raises on real network failure so the
briefing flow can note the gap and continue (fail-soft, spec §2.5).
"""

from __future__ import annotations

import time
from datetime import date, timedelta

import httpx

from app.config import get_settings

_CACHE: dict[str, tuple[float, list[dict]]] = {}
_TTL_SECONDS = 3600


def _mock_forecast(days: int) -> list[dict]:
    base = date.today()
    presets = [
        {"high": 78, "low": 61, "precip_prob": 10, "summary": "Sunny and mild"},
        {"high": 74, "low": 58, "precip_prob": 55, "summary": "Afternoon showers likely"},
        {"high": 70, "low": 55, "precip_prob": 20, "summary": "Partly cloudy"},
    ]
    return [
        {"date": (base + timedelta(days=i)).isoformat(), **presets[i % len(presets)]}
        for i in range(days)
    ]


async def get_weather(days: int = 2) -> list[dict]:
    """Return per-day forecast dicts: {date, high, low, precip_prob, summary}."""
    settings = get_settings()
    if settings.mock_integrations:
        return _mock_forecast(days)

    key = f"{settings.latitude},{settings.longitude},{days}"
    cached = _CACHE.get(key)
    if cached and (time.time() - cached[0]) < _TTL_SECONDS:
        return cached[1]

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": settings.latitude,
                "longitude": settings.longitude,
                "daily": "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code",
                "temperature_unit": "fahrenheit",
                "timezone": settings.timezone,
                "forecast_days": days,
            },
        )
        resp.raise_for_status()
        daily = resp.json()["daily"]

    out = [
        {
            "date": daily["time"][i],
            "high": round(daily["temperature_2m_max"][i]),
            "low": round(daily["temperature_2m_min"][i]),
            "precip_prob": daily["precipitation_probability_max"][i],
            "summary": _wmo_summary(daily["weather_code"][i]),
        }
        for i in range(len(daily["time"]))
    ]
    _CACHE[key] = (time.time(), out)
    return out


def _wmo_summary(code: int) -> str:
    if code == 0:
        return "Clear"
    if code in (1, 2, 3):
        return "Partly cloudy"
    if code in (45, 48):
        return "Foggy"
    if 51 <= code <= 67:
        return "Rain"
    if 71 <= code <= 77:
        return "Snow"
    if 80 <= code <= 82:
        return "Showers"
    if code >= 95:
        return "Thunderstorm"
    return "Mixed conditions"
