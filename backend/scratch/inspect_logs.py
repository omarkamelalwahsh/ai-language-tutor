import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func
from app.models.domain import AssessmentLog
from app.core.config import settings
from uuid import UUID

async def inspect_logs():
    DATABASE_URL = settings.DATABASE_URL
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    user_id = UUID("9cb9e031-97ce-4a8b-b714-9f8c4a5fdbfe")
    
    async with async_session() as session:
        stmt = select(AssessmentLog.skill, func.count(AssessmentLog.id)).where(AssessmentLog.user_id == user_id).group_by(AssessmentLog.skill)
        results = (await session.execute(stmt)).all()
        
        print(f"Log breakdown for user {user_id}:")
        for skill, count in results:
            print(f"- {skill}: {count} tasks")
        
        # Check timestamps
        time_stmt = select(func.min(AssessmentLog.created_at), func.max(AssessmentLog.created_at)).where(AssessmentLog.user_id == user_id)
        start, end = (await session.execute(time_stmt)).one()
        print(f"Timeline: From {start} to {end}")

if __name__ == "__main__":
    asyncio.run(inspect_logs())
