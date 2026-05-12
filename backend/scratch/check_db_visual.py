import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.models.domain import QuestionBankItem

async def check_db():
    async with AsyncSessionLocal() as db:
        stmt = select(QuestionBankItem).where(QuestionBankItem.task_type == 'visual_vocabulary')
        result = await db.execute(stmt)
        items = result.scalars().all()
        
        print(f"Found {len(items)} visual_vocabulary items.")
        for i in items[:5]:
            print(f"ID: {i.id}")
            print(f"Level: {i.level}")
            print(f"Prompt: {i.prompt}")
            print(f"Stimulus: {i.stimulus}")
            print(f"Answer: {i.answer_key}")
            print("-" * 20)

if __name__ == "__main__":
    asyncio.run(check_db())
