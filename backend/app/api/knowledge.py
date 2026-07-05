from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_token
from app.db.session import get_db
from app.knowledge.embeddings import get_embedding_provider
from app.knowledge.search import hybrid_search
from app.schemas import SearchResponse, SearchResult

router = APIRouter(prefix="/knowledge", tags=["knowledge"], dependencies=[Depends(require_token)])


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1),
    domain: str | None = Query(default=None),
    limit: int = Query(default=8, ge=1, le=25),
    db: AsyncSession = Depends(get_db),
):
    hits = await hybrid_search(db, q, get_embedding_provider(), domain=domain, limit=limit)
    return SearchResponse(query=q, results=[SearchResult(**h) for h in hits])
