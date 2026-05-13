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
        print("Adding columns to learner_profiles...")
        try:
            await conn.execute(text("ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0;"))
            await conn.execute(text("ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 0;"))
            await conn.execute(text("ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS last_interaction_date DATE;"))
            await conn.execute(text("ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS streak_freeze_status BOOLEAN DEFAULT FALSE;"))
            await conn.execute(text("ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS fcm_token TEXT;"))
            await conn.execute(text("ALTER TABLE learner_profiles ADD COLUMN IF NOT EXISTS web_notifications_enabled BOOLEAN DEFAULT TRUE;"))
            print("Successfully updated learner_profiles table.")
        except Exception as e:
            print(f"Error updating learner_profiles: {e}")

        print("Creating user_notifications_log table...")
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS user_notifications_log (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                    notification_type TEXT NOT NULL,
                    sent_at TIMESTAMPTZ DEFAULT NOW(),
                    is_read BOOLEAN DEFAULT FALSE
                );
            """))
            print("Successfully created user_notifications_log table.")
        except Exception as e:
            print(f"Error creating user_notifications_log: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
