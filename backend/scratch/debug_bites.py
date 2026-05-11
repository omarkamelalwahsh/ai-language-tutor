import asyncio
from uuid import UUID
from app.db.database import AsyncSessionLocal
from app.services.daily_service import DailyService

async def test_bites():
    async with AsyncSessionLocal() as db:
        service = DailyService(db)
        # Use a dummy UUID or a real one if you have it
        user_id = UUID("00000000-0000-0000-0000-000000000000") 
        try:
            print("Calling get_daily_bites...")
            res = await service.get_daily_bites(user_id)
            if res is None:
                print("FAILED: Result is None. Check logs for exceptions.")
            else:
                print("SUCCESS: Result received.")
                import json
                print(json.dumps(res, indent=2))
        except Exception as e:
            print(f"CRASH: {str(e)}")

if __name__ == "__main__":
    asyncio.run(test_bites())
