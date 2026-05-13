import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, update
from app.models.domain import LearnerProfile, UserSkill
from app.core.config import settings
from uuid import UUID

async def wipe_xp():
    DATABASE_URL = settings.DATABASE_URL
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    user_id = UUID("9cb9e031-97ce-4a8b-b714-9f8c4a5fdbfe")
    
    async with async_session() as session:
        # Wipe profile XP and Streak
        prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
        profile = (await session.execute(prof_stmt)).scalar_one_or_none()
        
        if profile:
            profile.xp_points = 0
            profile.current_level_xp = 0
            profile.current_streak = 0
            profile.last_interaction_date = None
        
        # Wipe skills XP
        await session.execute(
            update(UserSkill).where(UserSkill.user_id == user_id).values(xp_points=0)
        )
        
        await session.commit()
        print("Successfully wiped XP and Streak for a fresh start!")

if __name__ == "__main__":
    asyncio.run(wipe_xp())
