"""Write-path helpers: (re)chunk + embed documents, embed observations.

Kept separate from search so both the API routers and the seed script share one
implementation. Re-chunking on update is delete + reinsert (spec §5.4).
"""

from __future__ import annotations

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Chunk, Document, Observation
from app.knowledge.chunking import chunk_markdown
from app.knowledge.embeddings import EmbeddingProvider


async def reindex_document(
    db: AsyncSession, document: Document, embedder: EmbeddingProvider
) -> int:
    """Delete existing chunks for a document and recreate them with embeddings."""
    await db.execute(delete(Chunk).where(Chunk.document_id == document.id))

    chunks = chunk_markdown(document.content)
    if not chunks:
        return 0

    vectors = await embedder.embed([c.content for c in chunks])
    for c, vec in zip(chunks, vectors, strict=True):
        db.add(
            Chunk(
                document_id=document.id,
                content=c.content,
                embedding=vec,
                chunk_index=c.index,
            )
        )
    return len(chunks)


async def embed_observation(
    obs: Observation, embedder: EmbeddingProvider
) -> None:
    obs.embedding = await embedder.embed_one(obs.content)
