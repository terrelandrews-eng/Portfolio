"""Anthropic client wrapper (spec §4, §5.7, §15).

Every call is logged to `agent_runs` (tokens, latency, error) for cost tracking and
debugging. When `use_real_llm` is false (offline / no key), `complete()` returns a
result with `text=None` and `mocked=True` so callers fall back to their deterministic
renderer — this keeps the whole briefing/chat flow demoable with no API key.

Model IDs come from settings (MODEL_MAIN / MODEL_FAST), never hardcoded.
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator
from dataclasses import dataclass

from app.config import get_settings
from app.db.models import AgentRun
from app.db.session import SessionLocal


@dataclass
class LLMResult:
    text: str | None
    tokens_in: int = 0
    tokens_out: int = 0
    latency_ms: int = 0
    error: str | None = None
    mocked: bool = False


async def _log_run(
    *, agent: str, trigger: str, system: str, user: str, result: LLMResult
) -> None:
    """Persist an agent_runs row in its own session, decoupled from the caller."""
    async with SessionLocal() as db:
        db.add(
            AgentRun(
                agent=agent,
                trigger=trigger,
                input={"system_chars": len(system), "user_chars": len(user)},
                output=(result.text[:4000] if result.text else None),
                tokens_in=result.tokens_in,
                tokens_out=result.tokens_out,
                latency_ms=result.latency_ms,
                error=result.error,
            )
        )
        await db.commit()


def _client():  # imported lazily so the SDK isn't required for offline runs
    import anthropic

    return anthropic.AsyncAnthropic(api_key=get_settings().anthropic_api_key)


async def complete(
    *,
    agent: str,
    trigger: str,
    system: str,
    user: str,
    model: str | None = None,
    max_tokens: int = 2000,
) -> LLMResult:
    """Single non-streaming completion. Logs to agent_runs regardless of outcome."""
    settings = get_settings()
    model = model or settings.model_main
    start = time.monotonic()

    if not settings.use_real_llm:
        result = LLMResult(text=None, mocked=True, latency_ms=0)
        await _log_run(agent=agent, trigger=trigger, system=system, user=user, result=result)
        return result

    try:
        resp = await _client().messages.create(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
        result = LLMResult(
            text=text,
            tokens_in=resp.usage.input_tokens,
            tokens_out=resp.usage.output_tokens,
            latency_ms=int((time.monotonic() - start) * 1000),
        )
    except Exception as exc:  # noqa: BLE001 — fail soft; caller uses fallback
        result = LLMResult(
            text=None,
            error=f"{type(exc).__name__}: {exc}",
            latency_ms=int((time.monotonic() - start) * 1000),
        )

    await _log_run(agent=agent, trigger=trigger, system=system, user=user, result=result)
    return result


async def stream(
    *,
    agent: str,
    trigger: str,
    system: str,
    user: str,
    model: str | None = None,
    max_tokens: int = 1500,
) -> AsyncIterator[str]:
    """Stream text deltas. Logs a single agent_runs row after the stream ends.

    In mock mode this yields nothing; the caller streams its own fallback text and
    is responsible for logging that path.
    """
    settings = get_settings()
    model = model or settings.model_main
    start = time.monotonic()

    if not settings.use_real_llm:
        return

    collected: list[str] = []
    error: str | None = None
    tokens_in = tokens_out = 0
    try:
        async with _client().messages.stream(
            model=model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        ) as s:
            async for delta in s.text_stream:
                collected.append(delta)
                yield delta
            final = await s.get_final_message()
            tokens_in = final.usage.input_tokens
            tokens_out = final.usage.output_tokens
    except Exception as exc:  # noqa: BLE001
        error = f"{type(exc).__name__}: {exc}"

    await _log_run(
        agent=agent,
        trigger=trigger,
        system=system,
        user=user,
        result=LLMResult(
            text="".join(collected),
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            latency_ms=int((time.monotonic() - start) * 1000),
            error=error,
        ),
    )
