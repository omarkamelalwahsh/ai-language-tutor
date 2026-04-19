import asyncio
from app.core.config import settings
import asyncpg
import json

async def check_user_journey(user_id):
    db_url = settings.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://')
    conn = await asyncpg.connect(db_url)
    
    # 1. Check current journeys for this user
    journeys = await conn.fetch('SELECT * FROM learning_journeys WHERE user_id = $1', user_id)
    
    # 2. Check all journeys to see if they belong to a different user
    all_journeys = await conn.fetch('SELECT id, user_id, title FROM learning_journeys LIMIT 5')
    
    # 3. Check specific journey ID from previous message
    target_jid = "0eec9571-f08b-4bac-99a7-adbf0d828e71"
    specific_journey = await conn.fetchrow('SELECT * FROM learning_journeys WHERE id = $1', target_jid)
    
    result = {
        "user_id_searched": user_id,
        "found_for_user": [dict(j) for j in journeys],
        "sample_of_all_journeys": [dict(j) for j in all_journeys],
        "is_target_jid_present": specific_journey is not None,
        "target_jid_owner": specific_journey['user_id'] if specific_journey else None
    }
    
    print(json.dumps(result, indent=2, default=str))
    await conn.close()

if __name__ == "__main__":
    uid = "f9b1e493-5943-4585-bd3d-b6abd33b76c9"
    asyncio.run(check_user_journey(uid))
