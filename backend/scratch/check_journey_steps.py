
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def run():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
    
    # Check what IDs exist
    print("--- Journey Steps ---")
    rows = await conn.fetch("SELECT id, title FROM journey_steps LIMIT 10")
    for r in rows:
        print(dict(r))
        
    print("\n--- Any 13e9c431 IDs? ---")
    rows2 = await conn.fetch("SELECT id FROM journey_steps WHERE id::text LIKE '%13e9c431%'")
    for r in rows2:
        print(dict(r))
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(run())
