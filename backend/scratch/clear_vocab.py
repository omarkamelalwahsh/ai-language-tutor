import asyncio
import os
import sys

sys.path.append(os.getcwd())

from app.db.database import AsyncSessionLocal
from sqlalchemy import text

async def clear():
    async with AsyncSessionLocal() as db:
        await db.execute(text("DELETE FROM weekly_vocabulary"))
        await db.commit()
        print("Cleared weekly_vocabulary table.")

if __name__ == "__main__":
    asyncio.run(clear())
