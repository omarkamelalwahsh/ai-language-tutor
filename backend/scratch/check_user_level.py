import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.models.domain import LearnerProfile

async def check_user():
    async with AsyncSessionLocal() as db:
        uid = "9cb9e031-97ce-4a8b-b714-9f8c4a5fdbfe" # From logs
        stmt = select(LearnerProfile).where(LearnerProfile.id == uid)
        result = await db.execute(stmt)
        p = result.scalar_one_or_none()
        
        if p:
            print(f"User: {uid}")
            print(f"overall_level: {p.overall_level}")
            print(f"current_proficiency_level: {p.current_proficiency_level}")
            print(f"xp_points: {p.xp_points}")
        else:
            print(f"User {uid} not found.")

if __name__ == "__main__":
    asyncio.run(check_user())
