import asyncio
import os
from sqlalchemy import select, text
from app.db.database import AsyncSessionLocal
from app.services.journey_service import JourneyService
from app.models.domain import LearnerProfile

import sys

async def main():
    user_id = None
    email = None
    
    target_email = sys.argv[1] if len(sys.argv) > 1 else "%omar%"
    
    async with AsyncSessionLocal() as session:
        # Use exact or LIKE match based on whether there's a %
        query = "SELECT id, email FROM auth.users WHERE email LIKE :email LIMIT 1"
        result = await session.execute(text(query), {"email": target_email})
        user = result.first()
        if not user:
            print(f"No user found matching {target_email}")
            return
        user_id = user.id
        email = user.email
        
        # Ensure the user's LearnerProfile is set to B2 as requested
        prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
        profile = (await session.execute(prof_stmt)).scalar_one_or_none()
        if profile:
            profile.current_proficiency_level = "B2"
            await session.commit()
            print(f"Set {email}'s LearnerProfile to B2.")
        else:
            print(f"No LearnerProfile found for {email}, proceeding anyway.")

    print(f"Triggering migration for User: {email} (ID: {user_id})")
    
    # Use a fresh session so we don't have an open transaction
    async with AsyncSessionLocal() as session2:
        svc = JourneyService(session2)
        res = await svc.reset_and_upgrade_journey(user_id)
        
        print("Migration Result:")
        print(res)
        
    print("Migration and Real-Data Journey Initialization Complete")

if __name__ == "__main__":
    asyncio.run(main())
