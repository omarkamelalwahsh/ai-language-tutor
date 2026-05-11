import asyncio
from sqlalchemy import text
from app.db.database import AsyncSessionLocal

async def reset_user():
    async with AsyncSessionLocal() as db:
        # Reset all profiles to today so the Guard triggers for everyone currently testing
        await db.execute(text("UPDATE profiles SET created_at = CURRENT_TIMESTAMP"))
        await db.execute(text("UPDATE learner_profiles SET created_at = CURRENT_TIMESTAMP"))
        await db.commit()
    print("User registration dates reset to today. The 'New User Guard' will now hide past days.")

if __name__ == "__main__":
    asyncio.run(reset_user())
