import asyncio
from sqlalchemy import text
from app.db.database import engine

async def verify_columns():
    async with engine.connect() as conn:
        result = await conn.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'learner_profiles'
            ORDER BY column_name;
        """))
        columns = result.fetchall()
        print("Columns in learner_profiles:")
        for col in columns:
            print(f"- {col[0]}: {col[1]}")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(verify_columns())
