import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func
from app.models.domain import AssessmentLog
from app.core.config import settings
from uuid import UUID

async def check_sessions():
    DATABASE_URL = settings.DATABASE_URL
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    user_id = UUID("9cb9e031-97ce-4a8b-b714-9f8c4a5fdbfe")
    
    async with async_session() as session:
        # Count unique assessment_ids
        stmt = select(func.count(func.distinct(AssessmentLog.assessment_id))).where(AssessmentLog.user_id == user_id)
        sessions_count = (await session.execute(stmt)).scalar() or 0
        
        # Breakdown by session
        stmt2 = select(AssessmentLog.assessment_id, func.count(AssessmentLog.id)).where(AssessmentLog.user_id == user_id).group_by(AssessmentLog.assessment_id)
        results = (await session.execute(stmt2)).all()
        
        print(f"User: {user_id}")
        print(f"Total Unique Sessions: {sessions_count}")
        print("Session Breakdown (Session ID : Questions answered):")
        for aid, count in results:
            print(f"- {aid}: {count} questions")

if __name__ == "__main__":
    asyncio.run(check_sessions())
