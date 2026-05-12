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
        await db.execute(
            update(LearnerProfile)
            .where(LearnerProfile.id == '98b50e2ddc9943efb387052637738f61')
            .values(current_proficiency_level='B2', overall_level='B2', level='B2')
        )
        await db.commit()
    print("User level manually restored to B2")

if __name__ == "__main__":
    asyncio.run(fix())
