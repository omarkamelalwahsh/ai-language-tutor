import asyncio
from sqlalchemy import text
from app.db.database import AsyncSessionLocal

async def list_tables():
    async with AsyncSessionLocal() as db:
        r = await db.execute(text("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'"))
        print("Tables in 'public' schema:")
        for row in r.scalars().all():
            print(f"- {row}")

if __name__ == "__main__":
    asyncio.run(list_tables())
