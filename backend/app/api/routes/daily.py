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
@router.get("/daily-word")
async def get_daily_word(
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Returns the single vocabulary word for TODAY's slot in the weekly cycle.
    """
    try:
        learner_service = LearnerService(db)
        profile_data = await learner_service.get_dashboard_data(UUID(current_user_id))
        target_level = profile_data.get("profile", {}).get("current_level", "B1")
        field = "AI Engineering"
        
        daily_service = DailyService(db)
        word = await daily_service.get_daily_word(
            target_level=target_level,
            field=field
        )
        return word or {"error": "No word available for today"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/weekly-vocab")
async def get_weekly_vocab(
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Returns the full 7-day weekly vocabulary log with current_day_index
    and countdown timer for next word unlock.
    """
    try:
        learner_service = LearnerService(db)
        profile_data = await learner_service.get_dashboard_data(UUID(current_user_id))
        target_level = profile_data.get("profile", {}).get("current_level", "B1")
        field = "AI Engineering"
        
        daily_service = DailyService(db)
        # Ensure today's word is generated before returning the log
        await daily_service.get_daily_word(target_level=target_level, field=field)
        weekly_data = await daily_service.get_weekly_log(
            user_id=UUID(current_user_id),
            target_level=target_level,
            field=field
        )
        return weekly_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/record-interaction")
async def record_interaction(
    xp: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Triggered when user interacts with a Daily Card.
    Updates streak and grants XP.
    """
    try:
        learner_service = LearnerService(db)
        await learner_service.update_daily_interaction(UUID(current_user_id), xp_reward=xp)
        return {"status": "success", "message": f"Interaction recorded. {xp} XP granted."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

from pydantic import BaseModel
class BiteCompletionRequest(BaseModel):
    bite_type: str

@router.post("/bites/complete")
async def complete_daily_bite(
    req: BiteCompletionRequest,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Records that the user completed a specific daily bite type.
    """
    try:
        daily_service = DailyService(db)
        await daily_service.record_bite_completion(UUID(current_user_id), req.bite_type)
        
        # Also grant XP
        learner_service = LearnerService(db)
        await learner_service.update_daily_interaction(UUID(current_user_id), xp_reward=5)
        
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
