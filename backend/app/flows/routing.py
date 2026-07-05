"""Chat message routing/classification (spec §6.3).

Real path: MODEL_FAST returns JSON {"domain","needs_multiple"}. Offline path: a
deterministic keyword classifier, so routing works with no API key. Single domain →
run that domain agent; multiple/ambiguous → Chief of Staff (who can call domain agents).
"""

from __future__ import annotations

import json
import re

from app.agents.agent import CHAT_DOMAINS
from app.config import get_settings

# Keyword signals per domain (deterministic fallback classifier).
_SIGNALS: dict[str, tuple[str, ...]] = {
    "family": ("family", "date night", "wife", "husband", "sarah", "kids", "kid", "birthday",
               "anniversary", "micah", "ada", "son", "daughter", "gift"),
    "meals": ("meal", "dinner", "lunch", "breakfast", "recipe", "grocery", "groceries", "cook", "eat", "food"),
    "health": ("workout", "exercise", "gym", "run", "running", "fitness", "sleep", "doctor",
               "checkup", "medical", "health"),
    "home": ("home", "chore", "chores", "maintenance", "hvac", "filter", "repair", "yard",
             "clean", "garage", "appliance", "oil change"),
    "faith": ("faith", "pray", "prayer", "church", "scripture", "reflection", "sabbath", "worship"),
    "finance": ("finance", "budget", "bill", "bills", "spend", "spending", "money", "invoice",
                "transaction", "subscription", "expense"),
    "business": ("work", "business", "client", "deep work", "proposal", "meeting", "invoice",
                 "project", "roadmap", "focus block"),
}

_CLASSIFY_PROMPT = (
    'Classify this message into one domain from {domains} (or "chief" if it spans several '
    'or is general). Reply ONLY with JSON: {{"domain": "...", "needs_multiple": true|false}}.\n\n'
    "Message: {message}"
)


def _matches(text: str, signal: str) -> bool:
    # Word-boundary match so short signals like "work" don't fire inside "workout".
    return re.search(rf"\b{re.escape(signal)}\b", text) is not None


def _keyword_classify(message: str) -> dict:
    text = message.lower()
    matched = [d for d, sigs in _SIGNALS.items() if any(_matches(text, s) for s in sigs)]
    if not matched:
        return {"domain": "chief", "needs_multiple": False}
    if len(matched) > 1:
        return {"domain": "chief", "needs_multiple": True}
    return {"domain": matched[0], "needs_multiple": False}


async def classify(message: str) -> dict:
    settings = get_settings()
    if not settings.use_real_llm:
        return _keyword_classify(message)

    from app import llm

    prompt = _CLASSIFY_PROMPT.format(domains=", ".join(CHAT_DOMAINS), message=message)
    result = await llm.complete(
        agent="router", trigger="classify", system="You are a fast intent classifier.",
        user=prompt, model=settings.model_fast, max_tokens=100,
    )
    if result.text:
        match = re.search(r"\{.*\}", result.text, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group(0))
                domain = data.get("domain", "chief")
                if domain not in CHAT_DOMAINS and domain != "chief":
                    domain = "chief"
                return {"domain": domain, "needs_multiple": bool(data.get("needs_multiple"))}
            except json.JSONDecodeError:
                pass
    return _keyword_classify(message)  # fail soft
