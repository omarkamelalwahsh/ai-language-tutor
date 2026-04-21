
import asyncio
from app.db.database import SessionLocal
from app.models.domain import LearningJourney, JourneyStep, LearnerProfile
from sqlalchemy import select

async def check_data():
    async with SessionLocal() as db:
        # Get one profile to see user_id
        res = await db.execute(select(LearnerProfile).limit(1))
        profile = res.scalar_one_or_none()
        if not profile:
            print("No profiles found.")
            return
        
        user_id = profile.id
        print(f"Checking data for User: {user_id}")
        
        # Check Journey
        res = await db.execute(select(LearningJourney).where(LearningJourney.user_id == user_id))
        journey = res.scalar_one_or_none()
        if not journey:
            print("No journey found for this user.")
            return
        
        print(f"Journey ID: {journey.id}")
        
        # Check Steps
        res = await db.execute(select(JourneyStep).where(JourneyStep.journey_id == journey.id).order_by(JourneyStep.order_index))
        steps = res.scalars().all()
        print(f"Found {len(steps)} steps:")
        for s in steps:
            print(f"- {s.order_index}: {s.title} ({s.status})")

if __name__ == "__main__":
    asyncio.run(check_data())
