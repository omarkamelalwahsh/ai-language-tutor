import asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = "postgresql+asyncpg://postgres.ucrcrrqktybczualmsdw:KACbEs3tgJNhugEX@aws-1-eu-west-3.pooler.supabase.com:5432/postgres"

async def check_columns():
    engine = create_async_engine(DATABASE_URL)
    async with engine.connect() as conn:
        result = await conn.execute(text(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'learner_profiles'"
        ))
        columns = [row[0] for row in result.fetchall()]
        print(f"Columns in learner_profiles: {columns}")
    await engine.dispose()

asyncio.run(check_columns())
