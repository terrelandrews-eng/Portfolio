"""Observation lifecycle — the memory that compounds (spec §5.3, §7.3 step 4).

- Proposed observations from the weekly review are deduped against existing *active*
  observations in the same domain by cosine similarity > 0.88: a match reinforces the
  existing one (evidence_count +1, confidence +0.1 capped at 0.95) instead of inserting.
- Genuinely new observations are inserted as status='proposed' for the user to
  accept/reject in the UI; accepting flips them to 'active'.
- Contradiction lowers confidence by 0.2; below 0.2 the observation retires.
- Only status='active' observations with confidence >= 0.5 are injected into prompts
  (enforced by the context gatherers / search).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Observation
from app.knowledge.embeddings import EmbeddingProvider
from app.knowledge.indexing import embed_observation

DEDUP_SIMILARITY = 0.88
CONFIDENCE_STEP = 0.1
CONFIDENCE_CAP = 0.95
CONTRADICTION_PENALTY = 0.2
RETIRE_BELOW = 0.2
ACTIVE_MIN_CONFIDENCE = 0.5


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _nearest_active(
    db: AsyncSession, domain: str, vector: list[float]
) -> tuple[Observation | None, float]:
    """Return the most similar active observation in `domain` and its cosine similarity."""
    stmt = (
        select(
            Observation,
            Observation.embedding.cosine_distance(vector).label("dist"),
        )
        .where(
            Observation.status == "active",
            Observation.domain == domain,
            Observation.embedding.is_not(None),
        )
        .order_by("dist")
        .limit(1)
    )
    row = (await db.execute(stmt)).first()
    if not row:
        return None, 0.0
    obs, dist = row
    return obs, 1.0 - float(dist)


def _reinforce(obs: Observation) -> None:
    obs.evidence_count += 1
    obs.confidence = min(CONFIDENCE_CAP, obs.confidence + CONFIDENCE_STEP)
    obs.last_confirmed_at = _now()


async def apply_proposed_observations(
    db: AsyncSession,
    proposals: list[dict],
    embedder: EmbeddingProvider,
) -> dict:
    """Apply the §5.3 dedup/confidence logic to a list of {domain, kind, content}.

    Returns a summary with the reinforced + newly-proposed observation ids. Does not
    commit — the caller owns the transaction.
    """
    reinforced: list[str] = []
    proposed: list[str] = []

    for p in proposals:
        domain = p.get("domain", "general")
        content = (p.get("content") or "").strip()
        if not content:
            continue
        kind = p.get("kind", "pattern")

        vector = await embedder.embed_one(content)
        match, similarity = await _nearest_active(db, domain, vector)

        if match and similarity > DEDUP_SIMILARITY:
            _reinforce(match)
            reinforced.append(str(match.id))
            continue

        obs = Observation(
            domain=domain,
            kind=kind,
            content=content,
            confidence=0.5,
            evidence_count=1,
            status="proposed",
            embedding=vector,
        )
        db.add(obs)
        await db.flush()  # assign id
        proposed.append(str(obs.id))

    return {"reinforced": reinforced, "proposed": proposed}


async def accept_observation(db: AsyncSession, obs_id: uuid.UUID) -> Observation:
    obs = await _require(db, obs_id)
    obs.status = "active"
    obs.last_confirmed_at = _now()
    await db.commit()
    await db.refresh(obs)
    return obs


async def reject_observation(db: AsyncSession, obs_id: uuid.UUID) -> Observation:
    obs = await _require(db, obs_id)
    obs.status = "rejected"
    await db.commit()
    await db.refresh(obs)
    return obs


async def retire_observation(db: AsyncSession, obs_id: uuid.UUID) -> Observation:
    obs = await _require(db, obs_id)
    obs.status = "retired"
    await db.commit()
    await db.refresh(obs)
    return obs


async def contradict_observation(db: AsyncSession, obs_id: uuid.UUID) -> Observation:
    """Lower confidence by the contradiction penalty; retire if it falls below floor."""
    obs = await _require(db, obs_id)
    obs.confidence = round(obs.confidence - CONTRADICTION_PENALTY, 4)
    if obs.confidence < RETIRE_BELOW:
        obs.status = "retired"
    await db.commit()
    await db.refresh(obs)
    return obs


async def _require(db: AsyncSession, obs_id: uuid.UUID) -> Observation:
    obs = await db.get(Observation, obs_id)
    if not obs:
        from fastapi import HTTPException

        raise HTTPException(404, "Observation not found")
    return obs
