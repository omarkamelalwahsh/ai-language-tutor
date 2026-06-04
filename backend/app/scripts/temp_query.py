import asyncio
from sqlalchemy import text
from app.db.database import AsyncSessionLocal

async def run():
    async with AsyncSessionLocal() as s:
        result = await s.execute(text("SELECT stage_id, cefr_band, order_index FROM curriculum_stage ORDER BY order_index"))
        print("Stages:", result.all())
        
        result2 = await s.execute(text("SELECT module_id, stage_id, module_order, module_title FROM curriculum_module WHERE stage_id LIKE 'B2%' ORDER BY module_order"))
        print("Modules:", result2.all())

if __name__ == '__main__':
    asyncio.run(run())
