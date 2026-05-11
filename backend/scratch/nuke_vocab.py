import asyncio
from sqlalchemy import text
from app.db.database import AsyncSessionLocal

async def nuke_and_sync():
    async with AsyncSessionLocal() as db:
        print("Nuking old vocabulary data for a fresh start...")
        await db.execute(text("DELETE FROM weekly_vocabulary"))
        await db.execute(text("DELETE FROM daily_content"))
        await db.commit()
    print("DONE! All old data cleared. Now refresh your dashboard.")

if __name__ == "__main__":
    asyncio.run(nuke_and_sync())
