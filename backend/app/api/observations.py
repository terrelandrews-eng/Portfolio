import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_token
from app.db.models import Observation
from app.db.session import get_db
from app.knowledge.embeddings import get_embedding_provider
from app.knowledge.indexing import embed_observation
from app.knowledge.observations import (
    accept_observation,
    contradict_observation,
    reject_observation,
    retire_observation,
)
from app.schemas import ObservationCreate, ObservationOut

router = APIRouter(prefix="/observations", tags=["observations"], dependencies=[Depends(require_token)])


@router.get("", response_model=list[ObservationOut])
async def list_observations(
    status: str | None = Query(default=None),
    domain: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Observation)
    if status:
        stmt = stmt.where(Observation.status == status)
    if domain:
        stmt = stmt.where(Observation.domain == domain)
    stmt = stmt.order_by(Observation.confidence.desc(), Observation.created_at.desc())
    return list((await db.scalars(stmt)).all())


@router.post("", response_model=ObservationOut, status_code=201)
async def create_observation(payload: ObservationCreate, db: AsyncSession = Depends(get_db)):
    """Manually add an active observation (embedded for dedup/search)."""
    obs = Observation(domain=payload.domain, kind=payload.kind, content=payload.content, status="active")
    await embed_observation(obs, get_embedding_provider())
    db.add(obs)
    await db.commit()
    await db.refresh(obs)
    return obs


@router.post("/{obs_id}/accept", response_model=ObservationOut)
async def accept(obs_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await accept_observation(db, obs_id)


@router.post("/{obs_id}/reject", response_model=ObservationOut)
async def reject(obs_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await reject_observation(db, obs_id)


@router.post("/{obs_id}/retire", response_model=ObservationOut)
async def retire(obs_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await retire_observation(db, obs_id)


@router.post("/{obs_id}/contradict", response_model=ObservationOut)
async def contradict(obs_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Lower confidence by 0.2; retire if it drops below the floor (spec §5.3)."""
    return await contradict_observation(db, obs_id)
