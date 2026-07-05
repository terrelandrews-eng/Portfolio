import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_token
from app.db.models import Entity
from app.db.session import get_db
from app.schemas import EntityCreate, EntityOut, EntityUpdate

router = APIRouter(prefix="/entities", tags=["entities"], dependencies=[Depends(require_token)])


@router.get("", response_model=list[EntityOut])
async def list_entities(
    type: str | None = Query(default=None),
    name: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Entity)
    if type:
        stmt = stmt.where(Entity.type == type)
    if name:
        stmt = stmt.where(Entity.name.ilike(f"%{name}%"))
    stmt = stmt.order_by(Entity.name)
    return list((await db.scalars(stmt)).all())


@router.post("", response_model=EntityOut, status_code=201)
async def create_entity(payload: EntityCreate, db: AsyncSession = Depends(get_db)):
    entity = Entity(**payload.model_dump())
    db.add(entity)
    await db.commit()
    await db.refresh(entity)
    return entity


@router.get("/{entity_id}", response_model=EntityOut)
async def get_entity(entity_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    entity = await db.get(Entity, entity_id)
    if not entity:
        raise HTTPException(404, "Entity not found")
    return entity


@router.put("/{entity_id}", response_model=EntityOut)
async def update_entity(
    entity_id: uuid.UUID, payload: EntityUpdate, db: AsyncSession = Depends(get_db)
):
    entity = await db.get(Entity, entity_id)
    if not entity:
        raise HTTPException(404, "Entity not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(entity, k, v)
    await db.commit()
    await db.refresh(entity)
    return entity


@router.delete("/{entity_id}", status_code=204)
async def delete_entity(entity_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    entity = await db.get(Entity, entity_id)
    if not entity:
        raise HTTPException(404, "Entity not found")
    await db.delete(entity)
    await db.commit()
