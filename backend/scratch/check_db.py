import asyncio
import os
import sys
from pathlib import Path

# Add backend to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.db.database import AsyncSessionLocal
from app.models.domain import QuestionBankItem, LearnerProfile
from sqlalchemy import select, func

async def check():
    async with AsyncSessionLocal() as db:
        # Check user level
        stmt_p = select(LearnerProfile)
        res_p = await db.execute(stmt_p)
        profile = res_p.scalars().first()
        if profile:
            print(f"User Overall Level: {profile.overall_level}")
        else:
            print("No learner profile found.")

        stmt = select(func.count()).select_from(QuestionBankItem).where(QuestionBankItem.task_type == 'visual_vocabulary')
        result = await db.execute(stmt)
        print(f"Visual Vocabulary Count: {result.scalar()}")

if __name__ == "__main__":
    asyncio.run(check())
