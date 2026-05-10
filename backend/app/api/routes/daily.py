from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.db.database import get_db
from app.api.deps import get_current_user_id
from app.services.daily_service import DailyService
from app.services.learner_service import LearnerService

router = APIRouter()

@router.get("/bites")
async def get_daily_bites(
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Fetches the personalized daily micro-learning bites.
    """
    try:
        # Get user profile for level/field context
        learner_service = LearnerService(db)
        profile_data = await learner_service.get_dashboard_data(UUID(current_user_id))
        
        target_level = profile_data.get("profile", {}).get("current_level", "B1")
        # In a real app, 'field' would be stored in the profile. Defaulting for now.
        field = "AI Engineering"
        
        daily_service = DailyService(db)
        bites = await daily_service.get_daily_bites(
            user_id=UUID(current_user_id),
            target_level=target_level,
            field=field
        )
        return bites
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
