from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_token
from app.db.session import get_db
from app.flows.finance import import_csv, monthly_summary
from app.schemas import FinanceImportResult, FinanceSummary

router = APIRouter(prefix="/finance", tags=["finance"], dependencies=[Depends(require_token)])


@router.post("/import", response_model=FinanceImportResult)
async def import_transactions(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """Upload a bank/card CSV → normalized transactions + a month summary (spec §6.4)."""
    raw = (await file.read()).decode("utf-8", errors="replace")
    return await import_csv(db, raw)


@router.get("/summary", response_model=FinanceSummary)
async def summary(
    month: str | None = Query(default=None, description="YYYY-MM (defaults to latest)"),
    db: AsyncSession = Depends(get_db),
):
    return await monthly_summary(db, month)
