"""Telegram delivery (spec §10, optional/feature-flagged).

Sends a message when a bot token + chat id are configured and we're online; otherwise
writes to the outbox so pushes are inspectable offline. Delivery failures are swallowed
by callers — a briefing must never be lost because Telegram is down.
"""

from __future__ import annotations

import os
from pathlib import Path

import httpx

from app.config import get_settings

OUTBOX = Path(os.environ.get("OUTBOX_DIR", "/app/outbox"))


def is_configured() -> bool:
    s = get_settings()
    return bool(s.telegram_bot_token and s.telegram_chat_id)


async def send_message(text: str) -> dict:
    settings = get_settings()

    if settings.mock_integrations or not is_configured():
        OUTBOX.mkdir(parents=True, exist_ok=True)
        path = OUTBOX / "telegram.log"
        with path.open("a") as fh:
            fh.write(text.strip() + "\n---\n")
        return {"delivered": "mock", "path": str(path)}

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage",
            json={"chat_id": settings.telegram_chat_id, "text": text[:4000], "parse_mode": "Markdown"},
        )
        resp.raise_for_status()
        return {"delivered": "telegram", "message_id": resp.json().get("result", {}).get("message_id")}
