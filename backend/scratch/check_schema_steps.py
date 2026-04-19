
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def run():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
    
    print("--- Journey Steps Table Schema ---")
    rows = await conn.fetch("SELECT column_name, column_default, data_type FROM information_schema.columns WHERE table_name = 'journey_steps'")
    for r in rows:
        print(dict(r))
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(run())
