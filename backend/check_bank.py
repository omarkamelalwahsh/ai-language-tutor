import asyncio
import os
import sys
from app.core.config import settings
import asyncpg

async def main():
    db_url = settings.DATABASE_URL
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    print(f"Connecting to database...")
    conn = await asyncpg.connect(db_url)
    
    total = await conn.fetchval("SELECT count(*) FROM question_bank_items")
    print(f"\n[Question Bank Analysis]")
    print(f"Total Questions: {total}")
    
    skills = await conn.fetch("SELECT skill, count(*) as count FROM question_bank_items GROUP BY skill")
    print("\nBreakdown by Skill:")
    for row in skills:
        print(f" - {row['skill']}: {row['count']}")
        
    levels = await conn.fetch("SELECT level, count(*) as count FROM question_bank_items GROUP BY level")
    print("\nBreakdown by Level:")
    for row in levels:
        print(f" - {row['level']}: {row['count']}")
        
    # Check if there are duplicate IDs or issues
    duplicates = await conn.fetch("SELECT id, count(*) FROM question_bank_items GROUP BY id HAVING count(*) > 1")
    if duplicates:
        print(f"\n[WARNING] Found {len(duplicates)} duplicate IDs in question_bank_items!")
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
