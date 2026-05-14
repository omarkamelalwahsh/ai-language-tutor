import asyncio
from sqlalchemy import text
from app.db.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as s:
        await s.execute(text("DROP TABLE IF EXISTS chat_history CASCADE;"))
        await s.commit()
        print("Dropped chat_history")

asyncio.run(main())
