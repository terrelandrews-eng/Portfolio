from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_token
from app.db.models import Briefing
from app.db.session import get_db
from app.flows.daily_briefing import generate_briefing
from app.schemas import BriefingOut

router = APIRouter(prefix="/briefing", tags=["briefing"], dependencies=[Depends(require_token)])


@router.post("/generate", response_model=BriefingOut)
async def force_generate(deliver: bool = True, db: AsyncSession = Depends(get_db)):
    """Force-generate today's briefing on demand (spec §7.1 trigger)."""
    return await generate_briefing(db, date.today(), deliver=deliver)


@router.get("/today", response_model=BriefingOut)
async def today(db: AsyncSession = Depends(get_db)):
    briefing = await db.scalar(select(Briefing).where(Briefing.date == date.today()))
    if not briefing:
        raise HTTPException(404, "No briefing for today yet — POST /briefing/generate")
    return briefing


@router.get("/{on_date}", response_model=BriefingOut)
async def by_date(on_date: date, db: AsyncSession = Depends(get_db)):
    briefing = await db.scalar(select(Briefing).where(Briefing.date == on_date))
    if not briefing:
        raise HTTPException(404, "No briefing for that date")
    return briefing
