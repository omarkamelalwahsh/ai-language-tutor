import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import update
from app.db.database import AsyncSessionLocal
from app.models.domain import LearnerProfile

async def restore_user():
    async with AsyncSessionLocal() as db:
        uid = "9cb9e031-97ce-4a8b-b714-9f8c4a5fdbfe"
        stmt = update(LearnerProfile).where(LearnerProfile.id == uid).values(
            overall_level="B2", 
            current_proficiency_level="B2"
        )
        await db.execute(stmt)
        await db.commit()
        print(f"User {uid} restored to B2.")

if __name__ == "__main__":
    asyncio.run(restore_user())
