import asyncio
from sqlalchemy import text
from app.db.database import AsyncSessionLocal

async def clear_daily():
    async with AsyncSessionLocal() as db:
        await db.execute(text("DELETE FROM daily_content WHERE day_date >= CURRENT_DATE"))
        await db.commit()
    print("Cleared today's daily_content.")

if __name__ == "__main__":
    asyncio.run(clear_daily())
