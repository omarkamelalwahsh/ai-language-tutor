import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func
from app.models.domain import AssessmentLog
from app.core.config import settings
from uuid import UUID

async def check_ghost_tasks():
    DATABASE_URL = settings.DATABASE_URL
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    user_id = UUID("9cb9e031-97ce-4a8b-b714-9f8c4a5fdbfe")
    
    async with async_session() as session:
        print("Checking tasks with assessment_id = None")
        stmt = select(AssessmentLog.created_at, AssessmentLog.skill).where(
            AssessmentLog.user_id == user_id,
            AssessmentLog.assessment_id == None
        ).order_by(AssessmentLog.created_at)
        results = (await session.execute(stmt)).all()
        
        for created_at, skill in results:
            print(f"- {created_at}: {skill}")

if __name__ == "__main__":
    asyncio.run(check_ghost_tasks())
