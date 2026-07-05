from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_token
from app.db.session import get_db
from app.flows.capture import capture
from app.schemas import CaptureRequest, CaptureResponse

router = APIRouter(prefix="/capture", tags=["capture"], dependencies=[Depends(require_token)])


@router.post("", response_model=CaptureResponse)
async def quick_capture(payload: CaptureRequest, db: AsyncSession = Depends(get_db)):
    """Free-text note → staged proposals to confirm (spec §7.5)."""
    proposals = await capture(db, payload.text)
    return CaptureResponse(proposals=proposals)
