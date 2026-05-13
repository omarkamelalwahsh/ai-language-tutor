import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.domain import UserErrorProfile
from app.core.config import settings
from uuid import UUID

async def check_report():
    DATABASE_URL = settings.DATABASE_URL
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    user_id = UUID("9cb9e031-97ce-4a8b-b714-9f8c4a5fdbfe")
    
    async with async_session() as session:
        stmt = select(UserErrorProfile).where(UserErrorProfile.user_id == user_id)
        result = await session.execute(stmt)
        profile = result.scalar_one_or_none()
        if profile:
            print(f"Full Report: {profile.full_report}")
        else:
            print("No profile found for user.")

if __name__ == "__main__":
    asyncio.run(check_report())
