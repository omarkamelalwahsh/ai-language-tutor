import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.domain import UserErrorAnalysis
from app.core.config import settings

async def check_categories():
    DATABASE_URL = settings.DATABASE_URL
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        stmt = select(UserErrorAnalysis.category).distinct()
        result = await session.execute(stmt)
        cats = result.scalars().all()
        print(f"Categories in DB: {cats}")

if __name__ == "__main__":
    asyncio.run(check_categories())
