import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import AsyncSessionLocal
from sqlalchemy import text

async def clear_daily_content():
    async with AsyncSessionLocal() as session:
        await session.execute(text("DELETE FROM daily_content"))
        await session.commit()
        print("Cleared daily_content table successfully.")

if __name__ == "__main__":
    asyncio.run(clear_daily_content())
