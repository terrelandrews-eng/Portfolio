"""Quick knowledge capture (spec §7.5).

A free-text note → one or more staged proposals (task / observation / document /
entity) for the user to confirm. Deterministic classification so it runs offline; the
real path can use MODEL_FAST for richer extraction. Nothing is written until the user
approves the resulting proposal(s).
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Entity, Proposal
from app.flows.proposals import create_proposal
from app.flows.routing import _keyword_classify

_TASK_SIGNALS = ("remember to", "need to", "have to", "todo", "to-do", "buy ", "call ",
                 "email ", "schedule ", "pick up", "don't forget", "must ")
_OBSERVATION_SIGNALS = ("mentioned", "wants", "prefers", "likes", "loves", "hates",
                        "always", "usually", "tends to", "enjoys", "hates", "favorite")


async def _known_person(db: AsyncSession, text: str) -> Entity | None:
    people = list((await db.scalars(select(Entity).where(Entity.type == "person"))).all())
    lower = text.lower()
    for p in people:
        if p.name.lower() in lower:
            return p
    return None


def _strip_prefix(text: str) -> str:
    t = text.strip()
    if t.lower().startswith("note:"):
        return t[5:].strip()
    return t


async def capture(db: AsyncSession, text: str) -> list[Proposal]:
    """Extract proposals from a captured note. Always returns at least one."""
    text = _strip_prefix(text)
    lower = text.lower()
    domain = _keyword_classify(text)["domain"]
    if domain == "chief":
        domain = "general"

    proposals: list[Proposal] = []

    if any(sig in lower for sig in _TASK_SIGNALS):
        proposals.append(
            await create_proposal(
                db, kind="task",
                summary=f"Create task: {text[:80]}",
                payload={"title": text[:120], "domain": domain, "source": "capture"},
                source="capture",
            )
        )
    elif any(sig in lower for sig in _OBSERVATION_SIGNALS):
        person = await _known_person(db, text)
        obs_domain = "family" if person else domain
        proposals.append(
            await create_proposal(
                db, kind="observation",
                summary=f"Remember: {text[:80]}",
                payload={"domain": obs_domain, "kind": "preference", "content": text[:400]},
                source="capture",
            )
        )
    elif len(text) > 220:
        proposals.append(
            await create_proposal(
                db, kind="document",
                summary=f"Save note as document: {text[:60]}…",
                payload={"title": text[:60], "domain": domain, "content": text},
                source="capture",
            )
        )
    else:
        proposals.append(
            await create_proposal(
                db, kind="observation",
                summary=f"Remember: {text[:80]}",
                payload={"domain": domain, "kind": "fact", "content": text[:400]},
                source="capture",
            )
        )

    return proposals
