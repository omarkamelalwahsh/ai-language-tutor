import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.domain import LearnerProfile
from app.core.config import settings
import os

async def test_db():
    DATABASE_URL = settings.DATABASE_URL
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        try:
            stmt = select(LearnerProfile).limit(1)
            result = await session.execute(stmt)
            print("Successfully queried LearnerProfile")
        except Exception as e:
            print(f"Error querying LearnerProfile: {e}")

if __name__ == "__main__":
    asyncio.run(test_db())
