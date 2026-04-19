
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def run():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
    
    print("--- Conflicting Row ---")
    row = await conn.fetchrow("SELECT * FROM journey_steps WHERE id='00000000-0000-4000-8000-000013e9c431'")
    if row:
        print(dict(row))
    else:
        print("Not found")
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(run())
