from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
import logging
import traceback

from app.db.database import get_db
from app.api.deps import get_current_user_id
from app.services.learner_service import LearnerService
from app.services.journey_service import JourneyService

router = APIRouter()

@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Fetches aggregated dashboard data for the authenticated learner.
    """
    try:
        service = LearnerService(db)
        data = await service.get_dashboard_data(UUID(current_user_id))
        return data
    except Exception as e:
        logging.error(f"Error in get_dashboard: {str(e)}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard data")

@router.get("/journey")
async def get_journey(
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Fetches the learner's personalized roadmap nodes.
    Generates them if they don't exist.
    """
    try:
        service = JourneyService(db)
        data = await service.get_or_create_journey(UUID(current_user_id))
        return data
    except Exception as e:
        logging.error(f"Error in get_journey: {str(e)}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to fetch journey roadmap")
@router.get("/profile")
async def get_profile(
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Fetches the full AI Learner Intelligence Profile (5-model synthesis).
    """
    try:
        service = LearnerService(db)
        data = await service.get_intelligence_profile(UUID(current_user_id))
        return data
    except Exception as e:
        logging.error(f"Error in get_profile: {str(e)}")
        logging.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail="Failed to fetch intelligence profile")
