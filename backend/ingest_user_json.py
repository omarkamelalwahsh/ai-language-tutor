import asyncio
import os
import json
from uuid import UUID, uuid4
from dotenv import load_dotenv

# Load env from backend folder
load_dotenv('.env')

from app.db.database import AsyncSessionLocal
from app.models.domain import LearningJourney, JourneyStep, LearnerProfile
from sqlalchemy import select, delete

# The JSON data provided by the user
RAW_USER_DATA = [
    {
        "id": "00000000-0000-4000-8000-00000a53d904",
        "title": "Master the Present Perfect and Past Perfect Tenses",
        "description": "Develop a strong understanding of verb tenses to express completed actions and their relevance to the present.",
        "status": "current",
        "order_index": 0,
        "icon_type": "vocabulary",
        "skill_focus": "remediation"
    },
    {
        "id": "e9d5bea9-cf28-4097-b7b9-193a989946f3",
        "title": "The Lexical Expansion Initiative",
        "description": "Embark on a journey to enhance your vocabulary by learning prefixes, suffixes, and roots, focusing on word families and contextual usage.",
        "status": "active",
        "order_index": 1,
        "icon_type": "lesson",
        "skill_focus": "Vocabulary Building"
    },
    {
        "id": "f9c0183d-9346-4e5f-a97a-3f389990ba7f",
        "title": "Grammar: Temporal Relationships",
        "description": "Deep dive into temporal relationships and perfective aspects in English.",
        "status": "locked",
        "order_index": 2,
        "icon_type": "lesson",
        "skill_focus": "grammar"
    },
    {
        "id": "00000000-0000-4000-8000-000028a3c16d",
        "title": "Refine Lexical Nuance",
        "description": "Master the subtlety of idiomatic expressions and nuanced vocabulary to enhance your C2-level communication.",
        "status": "locked",
        "order_index": 3,
        "icon_type": "vocabulary",
        "skill_focus": "remediation"
    },
    {
        "id": "632e3669-a7b4-4f24-b7be-c2e67308fff7",
        "title": "Foundations of Reading Comprehension",
        "description": "Strategies for identifying main ideas, recognizing context clues, and making inferences.",
        "status": "locked",
        "order_index": 4,
        "icon_type": "lesson",
        "skill_focus": "reading"
    },
    {
        "id": "7e40533b-e580-49e0-891b-b694859936ca",
        "title": "The Foundational Grammar Gateway",
        "description": "In this lesson, we will delve into the nuances of subject-verb agreement and tense consistency.",
        "status": "locked",
        "order_index": 5,
        "icon_type": "lesson",
        "skill_focus": "Grammar"
    },
    {
        "id": "2e27ebec-bcdf-4868-bdf9-2425bf5be6a1",
        "title": "Vocabulary Expansion Through Context",
        "description": "Reinforce vocabulary building by providing learners with contextual examples.",
        "status": "locked",
        "order_index": 6,
        "icon_type": "drill",
        "skill_focus": "vocabulary"
    }
]

async def sync_data():
    async with AsyncSessionLocal() as session:
        # 1. Get the first user profile
        res = await session.execute(select(LearnerProfile))
        profile = res.scalars().first()
        
        if not profile:
            print("No learner profile found.")
            return
            
        user_id = profile.id
        print(f"Syncing data for user: {user_id}")
        
        # 2. Aggressive Cleanup by ID list (across all users to avoid collision)
        target_ids = [UUID(item['id']) for item in RAW_USER_DATA]
        await session.execute(delete(JourneyStep).where(JourneyStep.id.in_(target_ids)))
        
        # 3. Clean existing journey for THIS user
        res_j = await session.execute(select(LearningJourney).where(LearningJourney.user_id == user_id))
        existing_j = res_j.scalars().first()
        if existing_j:
            # Delete steps for this specific journey too, just in case
            await session.execute(delete(JourneyStep).where(JourneyStep.journey_id == existing_j.id))
            await session.execute(delete(LearningJourney).where(LearningJourney.id == existing_j.id))
        
        await session.flush()

        # 4. Create fresh journey
        journey = LearningJourney(
            id=uuid4(),
            user_id=user_id,
            current_node_id=RAW_USER_DATA[0]['id'],
            metadata_json={"journey_title": "Custom Master Path"}
        )
        session.add(journey)
        await session.flush()

        # 5. Add steps
        for item in RAW_USER_DATA:
            step = JourneyStep(
                id=UUID(item['id']),
                journey_id=journey.id,
                title=item['title'],
                description=item['description'],
                order_index=item['order_index'],
                status=item['status'],
                icon_type=item['icon_type'],
                skill_focus=item['skill_focus'],
                is_locked=(item['status'] == 'locked'),
                content_payload={}
            )
            session.add(step)
            
        await session.commit()
        print(f"Successfully ingested {len(RAW_USER_DATA)} nodes for user {user_id}.")

if __name__ == "__main__":
    asyncio.run(sync_data())
