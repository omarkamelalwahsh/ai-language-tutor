import asyncio
import os
import sys

# Add the current directory to sys.path
sys.path.append(os.getcwd())

from app.db.database import AsyncSessionLocal
from sqlalchemy import text

async def check():
    try:
        async with AsyncSessionLocal() as session:
            # Check if table exists
            res = await session.execute(text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'weekly_vocabulary')"))
            exists = res.scalar()
            print(f"Table 'weekly_vocabulary' exists: {exists}")
            
            if not exists:
                print("Creating table 'weekly_vocabulary' manually...")
                await session.execute(text("""
                    CREATE TABLE weekly_vocabulary (
                        id UUID PRIMARY KEY,
                        target_level VARCHAR NOT NULL,
                        field VARCHAR NOT NULL,
                        content JSONB NOT NULL,
                        week_start_date TIMESTAMP WITH TIME ZONE NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                    )
                """))
                await session.commit()
                print("Table created.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check())
