import asyncio
from sqlalchemy import text
from app.db.database import engine

async def check_duplicates():
    async with engine.connect() as conn:
        result = await conn.execute(text("""
            SELECT assessment_id, question_id, COUNT(*) 
            FROM assessment_responses 
            GROUP BY assessment_id, question_id 
            HAVING COUNT(*) > 1
        """))
        rows = result.fetchall()
        print(f"Duplicates found: {len(rows)}")
        for row in rows:
            print(row)

if __name__ == "__main__":
    asyncio.run(check_duplicates())
