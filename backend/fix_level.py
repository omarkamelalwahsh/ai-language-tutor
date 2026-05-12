import asyncio
from app.db.session import async_session
from app.models.models import LearnerProfile
from sqlalchemy import update

async def fix():
    async with async_session() as db:
        await db.execute(
            update(LearnerProfile)
            .where(LearnerProfile.id == '98b50e2ddc9943efb387052637738f61')
            .values(current_proficiency_level='C1', overall_level='C1', level='C1')
        )
        await db.commit()
    print("User level fixed to C1")

if __name__ == "__main__":
    asyncio.run(fix())
