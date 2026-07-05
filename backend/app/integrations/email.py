"""Email delivery (spec §10). Resend when keyed; otherwise write rendered HTML to an
outbox directory so briefings are inspectable offline.

Markdown is rendered to a minimal, single-column, phone-readable HTML template.
"""

from __future__ import annotations

import os
from pathlib import Path

import httpx
import markdown as md

from app.config import get_settings

OUTBOX = Path(os.environ.get("OUTBOX_DIR", "/app/outbox"))

_TEMPLATE = """<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  body {{ font-family: -apple-system, Segoe UI, Roboto, sans-serif; color:#2b2b2b;
         background:#faf9f6; margin:0; padding:24px; }}
  .card {{ max-width:640px; margin:0 auto; background:#fff; border-radius:12px;
          padding:28px; line-height:1.5; }}
  h1,h2 {{ color:#4b6b5a; }}
  h1 {{ font-size:20px; }} h2 {{ font-size:15px; margin-top:20px; }}
  ul {{ padding-left:20px; }} code {{ background:#f2f2ef; padding:1px 4px; border-radius:4px; }}
</style></head>
<body><div class="card">{body}</div></body></html>"""


def render_html(markdown_text: str) -> str:
    body = md.markdown(markdown_text, extensions=["extra", "sane_lists"])
    return _TEMPLATE.format(body=body)


async def send_briefing(subject: str, markdown_text: str) -> dict:
    settings = get_settings()
    html = render_html(markdown_text)

    if settings.mock_integrations or not settings.resend_api_key:
        OUTBOX.mkdir(parents=True, exist_ok=True)
        safe = subject.replace(" ", "_").replace("/", "-")
        path = OUTBOX / f"{safe}.html"
        path.write_text(html)
        return {"delivered": "mock", "path": str(path)}

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": "LifeOS <briefing@lifeos.local>",
                "to": [settings.briefing_email_to],
                "subject": subject,
                "html": html,
            },
        )
        resp.raise_for_status()
        return {"delivered": "resend", "id": resp.json().get("id")}
