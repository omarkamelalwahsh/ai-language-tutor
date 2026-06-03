import os
import asyncio
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from uuid import UUID

load_dotenv()

# We need to construct the async database url
db_url = os.environ.get("DATABASE_URL")
if db_url.startswith("postgresql://"):
    async_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif db_url.startswith("postgres://"):
    async_url = db_url.replace("postgres://", "postgresql+asyncpg://", 1)
else:
    async_url = db_url

engine = create_async_engine(async_url, echo=True)
AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

async def test_endpoint():
    from app.services.daily_service import DailyService
    from app.services.learner_service import LearnerService
    
    user_id = UUID("9cb9e031-97ce-4a8b-b714-9f8c4a5fdbfe")
    bite_type = "vocabulary"
    
    async with AsyncSessionLocal() as db:
        print("--- Starting completion test ---")
        daily_service = DailyService(db)
        await daily_service.record_bite_completion(user_id, bite_type)
        
        learner_service = LearnerService(db)
        await learner_service.update_daily_interaction(user_id, xp_reward=5)
        print("--- Test completed ---")

if __name__ == "__main__":
    asyncio.run(test_endpoint())
