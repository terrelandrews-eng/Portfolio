import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_token
from app.db.models import Document
from app.db.session import get_db
from app.knowledge.embeddings import get_embedding_provider
from app.knowledge.indexing import reindex_document
from app.schemas import DocumentCreate, DocumentOut, DocumentUpdate

router = APIRouter(prefix="/documents", tags=["documents"], dependencies=[Depends(require_token)])


@router.get("", response_model=list[DocumentOut])
async def list_documents(
    domain: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Document)
    if domain:
        stmt = stmt.where(Document.domain == domain)
    stmt = stmt.order_by(Document.updated_at.desc())
    return list((await db.scalars(stmt)).all())


@router.post("", response_model=DocumentOut, status_code=201)
async def create_document(payload: DocumentCreate, db: AsyncSession = Depends(get_db)):
    doc = Document(**payload.model_dump())
    db.add(doc)
    await db.flush()  # assign id before chunking
    await reindex_document(db, doc, get_embedding_provider())
    await db.commit()
    await db.refresh(doc)
    return doc


@router.get("/{document_id}", response_model=DocumentOut)
async def get_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


@router.put("/{document_id}", response_model=DocumentOut)
async def update_document(
    document_id: uuid.UUID, payload: DocumentUpdate, db: AsyncSession = Depends(get_db)
):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(doc, k, v)
    # Content change requires a re-chunk + re-embed.
    if "content" in data:
        await reindex_document(db, doc, get_embedding_provider())
    await db.commit()
    await db.refresh(doc)
    return doc


@router.delete("/{document_id}", status_code=204)
async def delete_document(document_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    doc = await db.get(Document, document_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    await db.delete(doc)  # chunks cascade
    await db.commit()
