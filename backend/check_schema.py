import asyncio
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
import asyncpg

async def main():
    db_url = settings.DATABASE_URL
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(db_url)
    
    cols = await conn.fetch("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'assessment_logs'")
    for c in cols:
        print(f"{c['column_name']}: {c['data_type']}")
        
    await conn.close()

asyncio.run(main())
