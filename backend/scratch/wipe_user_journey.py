import sys, os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import asyncio
from app.db.database import AsyncSessionLocal
from app.models.domain import User, JourneyMap, LearningJourney, JourneyStep, ErrorProfile, JourneyNode, JourneyTask
from app.services.journey_service import JourneyService
from uuid import UUID

async def main():
    async with AsyncSessionLocal() as db:
        # Find user by email
        email = "omaralwahsh07555@gmail.com"
        from sqlalchemy import text
        result = await db.execute(
            text("SELECT id FROM auth.users WHERE email = :email"),
            {"email": email}
        )
        row = result.fetchone()
        if not row:
            print(f"User with email {email} not found.")
            return
        user_id = row[0]
        # Close current session and start a new one for reset to avoid nested transaction
        await db.commit()
        async with AsyncSessionLocal() as new_db:
            service = JourneyService(new_db)
            res = await service.reset_and_upgrade_journey(user_id)
            print("Wipe and upgrade result:", res)

if __name__ == "__main__":
    asyncio.run(main())
