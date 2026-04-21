import asyncio
from uuid import uuid4
from sqlalchemy import select, delete
from app.db.database import AsyncSessionLocal
from app.models.domain import LearningJourney, JourneyStep, LearnerProfile

async def ingest_data():
    async with AsyncSessionLocal() as db:
        # 1. Get the primary user
        res = await db.execute(select(LearnerProfile).limit(1))
        profile = res.scalar_one_or_none()
        if not profile:
            print("Error: No learner profile found. Please complete the assessment first.")
            return
        
        user_id = profile.id
        print(f"Ingesting real data for User: {user_id}")

        # 2. Cleanup old journeys
        # We find journeys for this user and delete them (and their steps via cascade or manual)
        journey_stmt = select(LearningJourney).where(LearningJourney.user_id == user_id)
        existing_journeys = (await db.execute(journey_stmt)).scalars().all()
        for j in existing_journeys:
            await db.execute(delete(JourneyStep).where(JourneyStep.journey_id == j.id))
            await db.execute(delete(LearningJourney).where(LearningJourney.id == j.id))
        
        # 3. Create New "Real" Journey
        new_journey_id = uuid4()
        new_journey = LearningJourney(
            id=new_journey_id,
            user_id=user_id,
            metadata={"source": "manual_ingestion_turn_1"}
        )
        db.add(new_journey)
        await db.flush() # Ensure journey exists for FK constraints

        # 4. Insert Specific Nodes
        real_nodes = [
            {
                "title": "Master the Present Perfect and Past Perfect Tenses",
                "description": "Deep dive into temporal relationships and perfective aspects in English.",
                "type": "lesson",
                "skill_focus": "grammar"
            },
            {
                "title": "The Lexical Expansion Initiative",
                "description": "Advanced academic vocabulary acquisition and contextual usage.",
                "type": "drill",
                "skill_focus": "vocabulary"
            },
            {
                "title": "Structural Syntax Optimization",
                "description": "Refining sentence architecture for clarity and impact.",
                "type": "lesson",
                "skill_focus": "writing"
            },
            {
                "title": "Contextual Pragmatics Mastery",
                "description": "Understanding nuance and social context in professional discourse.",
                "type": "lesson",
                "skill_focus": "speaking"
            },
            {
                "title": "Fluid Discourse Integration",
                "description": "Connecting ideas seamlessly in long-form verbal and written output.",
                "type": "drill",
                "skill_focus": "writing"
            },
            {
                "title": "Final Linguistic Calibration",
                "description": "Comprehensive audit of all core linguistic models.",
                "type": "audit",
                "skill_focus": "general"
            }
        ]

        for i, node in enumerate(real_nodes):
            step = JourneyStep(
                id=uuid4(),
                journey_id=new_journey_id,
                title=node["title"],
                description=node["description"],
                order_index=i,
                status="current" if i == 0 else "locked",
                icon_type=node["type"],
                skill_focus=node["skill_focus"],
                is_locked=(i > 0),
                content_payload=node
            )
            db.add(step)
        
        await db.commit()
        print(f"Successfully ingested {len(real_nodes)} real nodes for journey {new_journey_id}")

if __name__ == "__main__":
    asyncio.run(ingest_data())
