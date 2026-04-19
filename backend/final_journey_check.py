import asyncio
from app.core.config import settings
import asyncpg
import json

async def debug_all():
    db_url = settings.DATABASE_URL.replace('postgresql+asyncpg://', 'postgresql://')
    conn = await asyncpg.connect(db_url)
    
    # 1. Inspect table columns for learning_journeys
    columns = await conn.fetch("SELECT column_name FROM information_schema.columns WHERE table_name = 'learning_journeys'")
    col_names = [c['column_name'] for c in columns]
    print(f"Columns in learning_journeys: {col_names}")
    
    # 2. Find the journey we talked about
    target_jid = "0eec9571-f08b-4bac-99a7-adbf0d828e71"
    match = await conn.fetchrow("SELECT * FROM learning_journeys WHERE id = $1", target_jid)
    if match:
        print(f"\nTarget Journey Found: {target_jid}")
        print(f"Owner (user_id): {match['user_id']}")
    else:
        print(f"\nTarget Journey NOT FOUND in DB: {target_jid}")

    # 3. Check for the user the user mentioned
    user_id = "f9b1e493-5943-4585-bd3d-b6abd33b76c9"
    user_match = await conn.fetch("SELECT * FROM learning_journeys WHERE user_id = $1", user_id)
    print(f"\nJourneys for User {user_id}: {len(user_match)}")
    for j in user_match:
        print(f" - ID: {j['id']}")

    # 4. Check if there are any other journeys at all
    all_count = await conn.fetchval("SELECT count(*) FROM learning_journeys")
    print(f"\nTotal Journeys in DB: {all_count}")
    
    await conn.close()

if __name__ == "__main__":
    asyncio.run(debug_all())
