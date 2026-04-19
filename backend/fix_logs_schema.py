import asyncio
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
import asyncpg

async def main():
    db_url = settings.DATABASE_URL
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(db_url)
    
    print("Adding default to assessment_logs.id")
    await conn.execute("ALTER TABLE assessment_logs ALTER COLUMN id SET DEFAULT gen_random_uuid()")
    
    # Also for user_error_analysis, user_error_profiles, skill_states just in case
    tables = ["user_error_analysis", "user_error_profiles", "skill_states", "learner_profiles"]
    for t in tables:
        try:
            await conn.execute(f"ALTER TABLE {t} ALTER COLUMN id SET DEFAULT gen_random_uuid()")
            print(f"Added to {t}")
        except Exception as e:
            print(f"Skipped {t} or error: {e}")

    await conn.close()

asyncio.run(main())
