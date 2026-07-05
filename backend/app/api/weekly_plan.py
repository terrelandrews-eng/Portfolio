import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_token
from app.db.models import WeeklyPlan
from app.db.session import get_db
from app.flows.weekly_plan import confirm_weekly_plan, generate_weekly_plan
from app.schemas import WeeklyPlanConfirm, WeeklyPlanConfirmResult, WeeklyPlanOut

router = APIRouter(prefix="/weekly-plan", tags=["weekly-plan"], dependencies=[Depends(require_token)])


@router.post("/generate", response_model=WeeklyPlanOut)
async def generate(
    week_start: date | None = Query(default=None, description="Monday of the target week"),
    db: AsyncSession = Depends(get_db),
):
    """Generate (or regenerate) a draft plan for the upcoming week (spec §7.2)."""
    return await generate_weekly_plan(db, week_start)


@router.get("/current", response_model=WeeklyPlanOut)
async def current(db: AsyncSession = Depends(get_db)):
    plan = await db.scalar(select(WeeklyPlan).order_by(WeeklyPlan.week_start.desc()).limit(1))
    if not plan:
        raise HTTPException(404, "No weekly plan yet — POST /weekly-plan/generate")
    return plan


@router.get("/{week_start}", response_model=WeeklyPlanOut)
async def by_week(week_start: date, db: AsyncSession = Depends(get_db)):
    plan = await db.scalar(select(WeeklyPlan).where(WeeklyPlan.week_start == week_start))
    if not plan:
        raise HTTPException(404, "No plan for that week")
    return plan


@router.post("/{plan_id}/confirm", response_model=WeeklyPlanConfirmResult)
async def confirm(
    plan_id: uuid.UUID,
    payload: WeeklyPlanConfirm | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Confirm a draft (body may include edited `structured`); creates tasks (spec §7.2)."""
    structured = payload.structured if payload else None
    return await confirm_weekly_plan(db, plan_id, structured)
