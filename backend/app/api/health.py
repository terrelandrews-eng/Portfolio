from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.session import get_db
from app.scheduler import scheduler_status

router = APIRouter(tags=["health"])


@router.get("/healthz")
async def healthz(db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    db_ok = True
    try:
        await db.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001 — health check reports, never raises
        db_ok = False
    return {
        "status": "ok" if db_ok else "degraded",
        "db": db_ok,
        "mock_integrations": settings.mock_integrations,
        "embeddings": "voyage" if settings.use_real_embeddings else "mock",
        "llm": "anthropic" if settings.use_real_llm else "mock",
        "scheduler": scheduler_status(),
    }
