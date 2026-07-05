from fastapi import APIRouter, Depends, Query
from sqlalchemy import Integer, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_token
from app.db.models import AgentRun
from app.db.session import get_db
from app.schemas import AgentRunOut

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_token)])


@router.get("/runs", response_model=list[AgentRunOut])
async def recent_runs(limit: int = Query(default=50, ge=1, le=500), db: AsyncSession = Depends(get_db)):
    stmt = select(AgentRun).order_by(AgentRun.created_at.desc()).limit(limit)
    return list((await db.scalars(stmt)).all())


@router.get("/cost")
async def cost_summary(db: AsyncSession = Depends(get_db)):
    """Aggregate token usage across all logged runs (spec §14 cost guardrail)."""
    row = (
        await db.execute(
            select(
                func.count(AgentRun.id),
                func.coalesce(func.sum(AgentRun.tokens_in), 0),
                func.coalesce(func.sum(AgentRun.tokens_out), 0),
                func.coalesce(func.sum(AgentRun.error.is_not(None).cast(Integer)), 0),
            )
        )
    ).one()

    by_agent_rows = (
        await db.execute(
            select(
                AgentRun.agent,
                func.count(AgentRun.id),
                func.coalesce(func.sum(AgentRun.tokens_in + AgentRun.tokens_out), 0),
            )
            .group_by(AgentRun.agent)
            .order_by(func.count(AgentRun.id).desc())
        )
    ).all()

    return {
        "runs": row[0],
        "tokens_in": int(row[1]),
        "tokens_out": int(row[2]),
        "errors": int(row[3]),
        "by_agent": [
            {"agent": a, "runs": int(n), "tokens": int(tok)} for a, n, tok in by_agent_rows
        ],
    }
