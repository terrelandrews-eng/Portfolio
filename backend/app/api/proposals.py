import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_token
from app.db.session import get_db
from app.flows.proposals import approve_proposal, list_proposals, reject_proposal
from app.schemas import ProposalOut

router = APIRouter(prefix="/proposals", tags=["proposals"], dependencies=[Depends(require_token)])


@router.get("", response_model=list[ProposalOut])
async def get_proposals(
    status: str | None = Query(default="pending"),
    db: AsyncSession = Depends(get_db),
):
    return await list_proposals(db, status)


@router.post("/{proposal_id}/approve", response_model=ProposalOut)
async def approve(proposal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Execute the staged action (spec §6.2 — writes happen only on approval)."""
    return await approve_proposal(db, proposal_id)


@router.post("/{proposal_id}/reject", response_model=ProposalOut)
async def reject(proposal_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await reject_proposal(db, proposal_id)
