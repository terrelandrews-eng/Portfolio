"""Hybrid knowledge search (spec §6.2 `search_knowledge`).

Combines:
  1. pgvector cosine similarity over document chunks and active observations
  2. ILIKE keyword match over entity names + attributes (JSONB cast to text)

Results are merged, deduped, and returned top-N with their source type so the caller
(API or, later, an agent tool) can cite where each hit came from.
"""

from __future__ import annotations

import re
from typing import TypedDict

from sqlalchemy import cast, func, or_, select
from sqlalchemy.dialects.postgresql import TEXT
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Chunk, Document, Entity, Observation
from app.knowledge.embeddings import EmbeddingProvider

# Common words stripped from keyword matching so natural-language questions
# ("when was the HVAC serviced") match on their content words, not filler.
_STOPWORDS = {
    "the", "was", "were", "when", "what", "which", "who", "whom", "how", "why",
    "and", "for", "are", "did", "does", "has", "have", "had", "with", "from",
    "this", "that", "these", "those", "you", "your", "our", "his", "her",
    "get", "got", "any", "all", "can", "will", "into", "about", "last",
}
_WORD_RE = re.compile(r"[a-z0-9]{2,}")


def _keywords(query: str) -> list[str]:
    return [w for w in _WORD_RE.findall(query.lower()) if w not in _STOPWORDS]


class SearchHit(TypedDict):
    source: str  # 'chunk' | 'observation' | 'entity'
    id: str
    title: str
    snippet: str
    score: float
    domain: str | None


def _snippet(text: str, limit: int = 240) -> str:
    text = " ".join(text.split())
    return text if len(text) <= limit else text[:limit] + "…"


async def hybrid_search(
    db: AsyncSession,
    query: str,
    embedder: EmbeddingProvider,
    domain: str | None = None,
    limit: int = 8,
) -> list[SearchHit]:
    query = (query or "").strip()
    if not query:
        return []

    qvec = await embedder.embed_one(query)
    hits: list[SearchHit] = []

    # --- Vector: document chunks (joined to their document for title/domain) ---
    chunk_stmt = (
        select(
            Chunk.id,
            Chunk.content,
            Document.title,
            Document.domain,
            Chunk.embedding.cosine_distance(qvec).label("dist"),
        )
        .join(Document, Chunk.document_id == Document.id)
        .where(Chunk.embedding.is_not(None))
    )
    if domain:
        chunk_stmt = chunk_stmt.where(Document.domain == domain)
    chunk_stmt = chunk_stmt.order_by("dist").limit(limit)
    for cid, content, title, dom, dist in (await db.execute(chunk_stmt)).all():
        hits.append(
            SearchHit(
                source="chunk",
                id=str(cid),
                title=title,
                snippet=_snippet(content),
                score=round(1.0 - float(dist), 4),
                domain=dom,
            )
        )

    # --- Vector: active observations ---
    obs_stmt = select(
        Observation.id,
        Observation.content,
        Observation.domain,
        Observation.embedding.cosine_distance(qvec).label("dist"),
    ).where(Observation.embedding.is_not(None), Observation.status == "active")
    if domain:
        obs_stmt = obs_stmt.where(Observation.domain == domain)
    obs_stmt = obs_stmt.order_by("dist").limit(limit)
    for oid, content, dom, dist in (await db.execute(obs_stmt)).all():
        hits.append(
            SearchHit(
                source="observation",
                id=str(oid),
                title=f"observation ({dom})",
                snippet=_snippet(content),
                score=round(1.0 - float(dist), 4),
                domain=dom,
            )
        )

    # --- Keyword: entities matching any content word of the query ---
    keywords = _keywords(query)
    if keywords:
        conditions = []
        for kw in keywords:
            like = f"%{kw}%"
            conditions.extend(
                [
                    Entity.name.ilike(like),
                    cast(Entity.attributes, TEXT).ilike(like),
                    func.coalesce(Entity.notes, "").ilike(like),
                ]
            )
        ent_stmt = select(Entity).where(or_(*conditions))
        if domain:
            ent_stmt = ent_stmt.where(Entity.attributes["domain"].astext == domain)
        ent_stmt = ent_stmt.limit(limit)
        entities = list((await db.scalars(ent_stmt)).all())
    else:
        entities = []

    for ent in entities:
        detail = ent.notes or ", ".join(f"{k}: {v}" for k, v in (ent.attributes or {}).items())
        hits.append(
            SearchHit(
                source="entity",
                id=str(ent.id),
                title=f"{ent.name} ({ent.type})",
                snippet=_snippet(detail or ent.name),
                # Direct keyword match ranks high; it's an exact-substring signal.
                score=0.9,
                domain=(ent.attributes or {}).get("domain"),
            )
        )

    hits.sort(key=lambda h: h["score"], reverse=True)
    return hits[:limit]
