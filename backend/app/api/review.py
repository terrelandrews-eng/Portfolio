from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_token
from app.db.models import Review
from app.db.session import get_db
from app.flows.weekly_review import REVIEW_QUESTIONS, review_week_start, run_weekly_review
from app.schemas import ReviewAnswers, ReviewOut, ReviewQuestions

router = APIRouter(prefix="/review", tags=["review"], dependencies=[Depends(require_token)])


@router.get("/questions", response_model=ReviewQuestions)
async def questions():
    """The 3–5 short review questions for the current (ending) week (spec §7.3)."""
    return ReviewQuestions(week_start=review_week_start(), questions=REVIEW_QUESTIONS)


@router.post("/answers", response_model=ReviewOut)
async def submit_answers(payload: ReviewAnswers, db: AsyncSession = Depends(get_db)):
    """Submit review answers → generate insights + proposed observations (spec §7.3)."""
    return await run_weekly_review(db, payload.week_start, payload.answers)


@router.get("/{week_start}", response_model=ReviewOut)
async def by_week(week_start: date, db: AsyncSession = Depends(get_db)):
    review = await db.scalar(select(Review).where(Review.week_start == week_start))
    if not review:
        raise HTTPException(404, "No review for that week")
    return review
