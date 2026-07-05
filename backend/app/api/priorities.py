"""Priorities: exactly one active version; PUT creates a new version (spec §5.5)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_token
from app.db.models import Priority
from app.db.session import get_db
from app.schemas import PriorityOut, PriorityUpdate

router = APIRouter(prefix="/priorities", tags=["priorities"], dependencies=[Depends(require_token)])


@router.get("", response_model=PriorityOut)
async def get_active_priorities(db: AsyncSession = Depends(get_db)):
    active = await db.scalar(select(Priority).where(Priority.active.is_(True)))
    if not active:
        raise HTTPException(404, "No active priorities document")
    return active


@router.get("/history", response_model=list[PriorityOut])
async def priority_history(db: AsyncSession = Depends(get_db)):
    stmt = select(Priority).order_by(Priority.version.desc())
    return list((await db.scalars(stmt)).all())


@router.put("", response_model=PriorityOut)
async def update_priorities(payload: PriorityUpdate, db: AsyncSession = Depends(get_db)):
    current_max = await db.scalar(select(Priority.version).order_by(Priority.version.desc()))
    next_version = (current_max or 0) + 1
    # Deactivate all prior versions so exactly one row stays active.
    await db.execute(update(Priority).values(active=False))
    new = Priority(version=next_version, content=payload.content, active=True)
    db.add(new)
    await db.commit()
    await db.refresh(new)
    return new
