import asyncio
import os
import sys

from app.core.config import settings
import asyncpg

async def main():
    db_url = settings.DATABASE_URL
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    print("Connecting to", db_url)
    conn = await asyncpg.connect(db_url)
    
    # 1. Add missing columns to assessment_responses
    cols_to_add = [
        ("question_level", "VARCHAR(50)"),
        ("answer_level", "VARCHAR(50)"),
        ("response_time_ms", "INTEGER"),
        ("status", "VARCHAR(50)"),
        ("category", "VARCHAR(100)"),
        ("difficulty", "NUMERIC"),
    ]
    for col, typ in cols_to_add:
        try:
            await conn.execute(f"ALTER TABLE assessment_responses ADD COLUMN {col} {typ}")
            print(f"Added column {col} to assessment_responses")
        except asyncpg.exceptions.DuplicateColumnError:
            print(f"Column {col} already exists in assessment_responses")
        except Exception as e:
            print(f"Error adding {col}: {e}")

    # 2. Fix the foreign key constraint on journey_steps
    try:
        # First drop the existing constraint
        # We need to find the exact constraint name. usually it's journey_steps_journey_id_fkey
        await conn.execute("ALTER TABLE journey_steps DROP CONSTRAINT IF EXISTS journey_steps_journey_id_fkey")
        
        # Add it back with ON DELETE CASCADE
        await conn.execute("""
            ALTER TABLE journey_steps 
            ADD CONSTRAINT journey_steps_journey_id_fkey 
            FOREIGN KEY (journey_id) REFERENCES learning_journeys(id) ON DELETE CASCADE
        """)
        print("Updated foreign key constraint on journey_steps successfully.")
    except Exception as e:
        print(f"Error updating foreign key constraint: {e}")

    # Tell postgrest to reload its schema cache!
    try:
        await conn.execute("NOTIFY pgrst, 'reload schema'")
        print("Notified PostgREST to reload schema.")
    except Exception as e:
        print(f"Error notifying PostgREST: {e}")

    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
