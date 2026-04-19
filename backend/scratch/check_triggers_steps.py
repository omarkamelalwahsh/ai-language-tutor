
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()

async def run():
    conn = await asyncpg.connect(os.getenv('DATABASE_URL'))
    
    print("--- Triggers on journey_steps ---")
    rows = await conn.fetch("SELECT trigger_name, action_statement FROM information_schema.triggers WHERE event_object_table = 'journey_steps'")
    for r in rows:
        print(dict(r))
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(run())
