import asyncio
from sqlalchemy import text
from app.db.database import engine

async def reload_schema():
    async with engine.begin() as conn:
        await conn.execute(text("NOTIFY pydantic, 'reload schema';"))
        print("✅ Schema reload notification sent.")
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(reload_schema())
