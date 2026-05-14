import asyncio
from sqlalchemy import text
from app.db.database import AsyncSessionLocal

async def main():
    async with AsyncSessionLocal() as s:
        r = await s.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='chat_history'"))
        cols = [row[0] for row in r.fetchall()]
        print("Columns:", cols)

asyncio.run(main())
