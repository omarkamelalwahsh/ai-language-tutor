import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def migrate():
    DATABASE_URL = settings.DATABASE_URL
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(DATABASE_URL)
    
    async with engine.begin() as conn:
        print("Patching user_notifications_log table...")
        try:
            # Add title column if missing
            await conn.execute(text(
                "ALTER TABLE user_notifications_log ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';"
            ))
            print("  [OK] title column")
        except Exception as e:
            print(f"  [ERR] title: {e}")

        try:
            # Add body column if missing
            await conn.execute(text(
                "ALTER TABLE user_notifications_log ADD COLUMN IF NOT EXISTS body TEXT NOT NULL DEFAULT '';"
            ))
            print("  [OK] body column")
        except Exception as e:
            print(f"  [ERR] body: {e}")

        try:
            # Add created_at column if missing (table may use sent_at instead)
            await conn.execute(text(
                "ALTER TABLE user_notifications_log ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();"
            ))
            # Back-fill from sent_at if that column exists
            await conn.execute(text("""
                UPDATE user_notifications_log
                SET created_at = sent_at
                WHERE created_at IS NULL AND sent_at IS NOT NULL;
            """))
            print("  [OK] created_at column")
        except Exception as e:
            print(f"  [ERR] created_at: {e}")

        print("Done.")

if __name__ == "__main__":
    asyncio.run(migrate())
