import asyncio
import os
import sys

# Force the current directory into sys.path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.db.session import async_session
from app.models.domain import LevelConfig
from sqlalchemy import insert, delete

async def seed_levels():
    levels = [
        {"level_name": "A1", "required_xp": 1000, "chapter_count": 5, "nodes_per_chapter": 4},
        {"level_name": "A2", "required_xp": 2500, "chapter_count": 6, "nodes_per_chapter": 4},
        {"level_name": "B1", "required_xp": 5000, "chapter_count": 8, "nodes_per_chapter": 5},
        {"level_name": "B2", "required_xp": 10000, "chapter_count": 10, "nodes_per_chapter": 5},
        {"level_name": "C1", "required_xp": 20000, "chapter_count": 12, "nodes_per_chapter": 6},
        {"level_name": "C2", "required_xp": 40000, "chapter_count": 15, "nodes_per_chapter": 6},
    ]
    
    async with async_session() as db:
        try:
            # Clear existing to avoid conflicts
            await db.execute(delete(LevelConfig))
            for level_data in levels:
                await db.execute(insert(LevelConfig).values(**level_data))
            await db.commit()
            print("✅ LevelConfig seeded successfully!")
        except Exception as e:
            print(f"❌ Seeding failed: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(seed_levels())
