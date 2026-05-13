import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func
from app.models.domain import LearnerProfile, UserErrorAnalysis, AssessmentLog, UserSkill
from app.core.config import settings
from uuid import UUID

async def backfill_xp():
    DATABASE_URL = settings.DATABASE_URL
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    user_id = UUID("9cb9e031-97ce-4a8b-b714-9f8c4a5fdbfe")
    
    async with async_session() as session:
        # 1. Count unique interaction days from logs
        days_stmt = select(func.count(func.distinct(func.date(AssessmentLog.created_at)))).where(AssessmentLog.user_id == user_id)
        interaction_days = (await session.execute(days_stmt)).scalar() or 0
        
        # 2. Count total tasks attempted (Logs)
        tasks_stmt = select(func.count(AssessmentLog.id)).where(AssessmentLog.user_id == user_id)
        total_tasks = (await session.execute(tasks_stmt)).scalar() or 0
        
        # 3. Calculate expected XP
        # 10 XP per day + 50 XP per task
        expected_xp = (interaction_days * 10) + (total_tasks * 50)
        
        print(f"User: {user_id}")
        print(f"Interaction Days: {interaction_days}")
        print(f"Total Tasks: {total_tasks}")
        print(f"Calculated XP: {expected_xp}")
        
        # 4. Update Profile
        prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
        profile = (await session.execute(prof_stmt)).scalar_one_or_none()
        
        if profile:
            profile.xp_points = expected_xp
            profile.current_level_xp = expected_xp  # Update reservoir progress
            # Also set a starting streak of 1 if he has any data
            if interaction_days > 0 and (profile.current_streak or 0) == 0:
                profile.current_streak = 1
            
            # 5. Update Skills (Distribute XP)
            skills_stmt = select(UserSkill).where(UserSkill.user_id == user_id)
            skills = (await session.execute(skills_stmt)).scalars().all()
            if skills:
                xp_per_skill = expected_xp // len(skills)
                for s in skills:
                    s.xp_points = (s.xp_points or 0) + xp_per_skill
            
            await session.commit()
            print("Successfully backfilled XP and Streak!")
        else:
            print("Profile not found.")

if __name__ == "__main__":
    asyncio.run(backfill_xp())
