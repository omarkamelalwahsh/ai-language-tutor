from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
import logging

from app.db.database import get_db
from app.api.deps import get_current_user_payload
from app.models.domain import LearnerProfile
from app.schemas.auth import UserMe

router = APIRouter()

@router.get("/me", response_model=UserMe)
async def get_me(
    db: AsyncSession = Depends(get_db),
    payload: dict = Depends(get_current_user_payload)
):
    """
    Checks if the authenticated user exists in the local database.
    Returns user details and onboarding status.
    Returns 404 if the user profile is not found.
    """
    user_id = payload.get("sub") or payload.get("id")
    email = payload.get("email")
    
    if not user_id:
        raise HTTPException(status_code=401, detail="User ID missing in token")
    
    try:
        # Check if learner profile exists
        stmt = select(LearnerProfile).where(LearnerProfile.id == UUID(user_id))
        result = await db.execute(stmt)
        profile = result.scalar_one_or_none()
        
        if not profile:
            logging.info(f"User {user_id} not found in learner_profiles. Returning 404.")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Profile not initialized"
            )
        
        return UserMe(
            id=profile.id,
            email=email,
            full_name=profile.full_name,
            is_onboarded=profile.onboarding_complete,
            native_language=profile.native_language,
            target_level=profile.current_proficiency_level
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Error in /auth/me: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal Server Error during auth check")
