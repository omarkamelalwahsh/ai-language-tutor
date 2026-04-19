from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.database import get_db
from app.models.domain import LearnerProfile
from typing import List

router = APIRouter()

@router.get("")
async def get_leaderboard(db: AsyncSession = Depends(get_db)):
    try:
        # Fetch profiles sorted by xp_points (Primary Rank) then streak
        stmt = select(LearnerProfile).where(
            LearnerProfile.onboarding_complete == True
        ).order_by(
            desc(LearnerProfile.xp_points),
            desc(LearnerProfile.streak)
        ).limit(50)
        
        result = await db.execute(stmt)
        profiles = result.scalars().all()

        leaderboard = []
        for index, profile in enumerate(profiles):
            leaderboard.append({
                "userId": str(profile.id),
                "displayName": profile.full_name or "Anonymous Learner",
                "rank": index + 1,
                "score": profile.xp_points or 0,
                "streak": profile.streak or 0,
                "completedModules": profile.total_questions_answered or 0,
                "level": profile.overall_level or "A1",
                "lastActivityAt": "Active" if profile.last_active_at else "Member",
                "teamName": "Global Academy"
            })
        
        return leaderboard
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
