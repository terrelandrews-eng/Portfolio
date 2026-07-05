"""Staged actions awaiting approval (spec §6.2, §8).

Agents and quick-capture never write externally in v1 — they stage a Proposal, and the
user approves it here. On approval the staged action is executed and `result` records
what was created (an event, task, entity, observation, or document).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Document, Entity, Observation, Proposal, Task
from app.integrations import gcal
from app.knowledge.embeddings import get_embedding_provider
from app.knowledge.indexing import embed_observation, reindex_document

VALID_KINDS = {"calendar_event", "task", "entity", "observation", "document"}


async def create_proposal(
    db: AsyncSession,
    *,
    kind: str,
    summary: str,
    payload: dict,
    source: str | None = None,
    agent: str | None = None,
) -> Proposal:
    if kind not in VALID_KINDS:
        raise HTTPException(400, f"Unknown proposal kind: {kind}")
    proposal = Proposal(kind=kind, summary=summary, payload=payload, source=source, agent=agent)
    db.add(proposal)
    await db.commit()
    await db.refresh(proposal)
    return proposal


async def list_proposals(db: AsyncSession, status: str | None = "pending") -> list[Proposal]:
    stmt = select(Proposal)
    if status:
        stmt = stmt.where(Proposal.status == status)
    stmt = stmt.order_by(Proposal.created_at.desc())
    return list((await db.scalars(stmt)).all())


async def approve_proposal(db: AsyncSession, proposal_id: uuid.UUID) -> Proposal:
    proposal = await _require(db, proposal_id)
    if proposal.status != "pending":
        return proposal  # idempotent — already resolved
    executor = _EXECUTORS[proposal.kind]
    result = await executor(db, proposal.payload)
    proposal.status = "approved"
    proposal.result = result
    proposal.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(proposal)
    return proposal


async def reject_proposal(db: AsyncSession, proposal_id: uuid.UUID) -> Proposal:
    proposal = await _require(db, proposal_id)
    proposal.status = "rejected"
    proposal.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(proposal)
    return proposal


# ---- Executors (one per kind) ----
async def _exec_calendar_event(db: AsyncSession, payload: dict) -> dict:
    return await gcal.create_event(
        db,
        summary=payload["summary"],
        start=_parse_dt(payload["start"]),
        end=_parse_dt(payload["end"]),
        location=payload.get("location"),
    )


async def _exec_task(db: AsyncSession, payload: dict) -> dict:
    task = Task(
        title=payload["title"],
        domain=payload.get("domain", "general"),
        description=payload.get("description"),
        due_date=_parse_date(payload.get("due_date")),
        priority=payload.get("priority", 3),
        source=payload.get("source", "proposal"),
    )
    db.add(task)
    await db.flush()
    return {"task_id": str(task.id), "title": task.title}


async def _exec_entity(db: AsyncSession, payload: dict) -> dict:
    entity = Entity(
        type=payload.get("type", "note"),
        name=payload["name"],
        attributes=payload.get("attributes", {}),
        notes=payload.get("notes"),
    )
    db.add(entity)
    await db.flush()
    return {"entity_id": str(entity.id), "name": entity.name}


async def _exec_observation(db: AsyncSession, payload: dict) -> dict:
    obs = Observation(
        domain=payload.get("domain", "general"),
        kind=payload.get("kind", "fact"),
        content=payload["content"],
        status="active",
    )
    await embed_observation(obs, get_embedding_provider())
    db.add(obs)
    await db.flush()
    return {"observation_id": str(obs.id)}


async def _exec_document(db: AsyncSession, payload: dict) -> dict:
    doc = Document(
        title=payload["title"],
        domain=payload.get("domain"),
        content=payload["content"],
    )
    db.add(doc)
    await db.flush()
    n = await reindex_document(db, doc, get_embedding_provider())
    return {"document_id": str(doc.id), "chunks": n}


_EXECUTORS = {
    "calendar_event": _exec_calendar_event,
    "task": _exec_task,
    "entity": _exec_entity,
    "observation": _exec_observation,
    "document": _exec_document,
}


async def _require(db: AsyncSession, proposal_id: uuid.UUID) -> Proposal:
    proposal = await db.get(Proposal, proposal_id)
    if not proposal:
        raise HTTPException(404, "Proposal not found")
    return proposal


def _parse_dt(value) -> datetime:
    if isinstance(value, datetime):
        return value
    dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _parse_date(value):
    if not value:
        return None
    from datetime import date

    try:
        return date.fromisoformat(str(value))
    except ValueError:
        return None
