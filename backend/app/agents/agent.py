"""One generic Agent class instantiated with different configs (spec §6.1, §15.2).

Phase 2 uses only the Chief of Staff, with no tool-use loop — briefings pre-gather
all context and make a single completion (spec §15.3). The class also supports
streaming for chat. Domain agents and the tool registry arrive in Phase 3/4.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from pathlib import Path

from app import llm
from app.config import get_settings

PROMPT_DIR = Path(__file__).resolve().parent.parent / "prompts"


def load_prompt(name: str) -> str:
    return (PROMPT_DIR / f"{name}.md").read_text()


@dataclass
class AgentConfig:
    name: str
    system_template: str
    model: str
    tools: list = field(default_factory=list)
    max_context_observations: int = 12


class Agent:
    def __init__(self, config: AgentConfig) -> None:
        self.config = config

    def render_system(self, **kwargs) -> str:
        return self.config.system_template.format(**kwargs)

    async def complete(self, *, trigger: str, system: str, user: str, max_tokens: int = 2000) -> llm.LLMResult:
        return await llm.complete(
            agent=self.config.name,
            trigger=trigger,
            system=system,
            user=user,
            model=self.config.model,
            max_tokens=max_tokens,
        )

    def stream(self, *, trigger: str, system: str, user: str, max_tokens: int = 1500) -> AsyncIterator[str]:
        return llm.stream(
            agent=self.config.name,
            trigger=trigger,
            system=system,
            user=user,
            model=self.config.model,
            max_tokens=max_tokens,
        )


def chief_of_staff() -> Agent:
    settings = get_settings()
    return Agent(
        AgentConfig(
            name="chief_of_staff",
            system_template=load_prompt("chief_of_staff"),
            model=settings.model_main,
        )
    )


# Weekly-plan fan-out roster (spec §7.2 names these five). Faith/Finance are chat-
# routable domain agents but contribute to the plan differently, so they're not here.
DOMAIN_AGENTS = ("meals", "health", "home", "family", "business")

# Every domain that has a persona prompt and is routable in chat (spec §6.3, §6.4).
CHAT_DOMAINS = ("meals", "health", "home", "family", "faith", "finance", "business")


def domain_agent(domain: str) -> Agent:
    """A domain assistant driven by its own prompt (spec §6.1) — one class, many configs.

    Domain contributions are lightweight and structured, so they run on MODEL_FAST.
    """
    settings = get_settings()
    return Agent(
        AgentConfig(
            name=domain,
            system_template=load_prompt(domain),
            model=settings.model_fast,
        )
    )
