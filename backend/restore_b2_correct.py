import asyncio
import os
import sys

# Add the current directory to sys.path to find 'app'
sys.path.append(os.getcwd())

from app.db.session import async_session
from app.models.models import LearnerProfile
from sqlalchemy import update

async def fix():
    async with async_session() as db:
        # Corrected User ID from the JSON provided by the user
        user_id = '9cb9e031-97ce-4a8b-b714-9f8c4a5fdbfe'
        await db.execute(
            update(LearnerProfile)
            .where(LearnerProfile.id == user_id)
            .values(current_proficiency_level='B2', overall_level='B2', level='B2')
        )
        await db.commit()
    print(f"User level for {user_id} manually restored to B2")

if __name__ == "__main__":
    asyncio.run(fix())
