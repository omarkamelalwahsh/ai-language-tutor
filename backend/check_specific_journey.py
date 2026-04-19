import asyncio
from app.core.config import settings
import asyncpg
import json

async def check_journey(journey_id):
    db_url = settings.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://')
    conn = await asyncpg.connect(db_url)
    
    journey = await conn.fetchrow('SELECT * FROM learning_journeys WHERE id = $1', journey_id)
    steps = await conn.fetch('SELECT * FROM journey_steps WHERE journey_id = $1 ORDER BY order_index', journey_id)
    
    result = {
        "exists": journey is not None,
        "journey_data": dict(journey) if journey else None,
        "steps_count": len(steps),
        "steps": [dict(s) for s in steps]
    }
    
    print(json.dumps(result, indent=2, default=str))
    await conn.close()

if __name__ == "__main__":
    jid = "0eec9571-f08b-4bac-99a7-adbf0d828e71"
    asyncio.run(check_journey(jid))
