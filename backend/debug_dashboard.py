import asyncio
from uuid import UUID
from app.db.database import AsyncSessionLocal
from app.services.learner_service import LearnerService

async def test_dashboard():
    user_id = UUID('e82c9ba5-6989-44d0-b092-02d9471df90f')
    async with AsyncSessionLocal() as db:
        service = LearnerService(db)
        try:
            data = await service.get_dashboard_data(user_id)
            print(f"--- Dashboard Data for {user_id} ---")
            print(f"Profile: {data['profile']}")
            print("Skills:")
            for s in data['skills']:
                print(f"  - {s['name']}: Score={s['score']}, Level={s['level']}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_dashboard())
