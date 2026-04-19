#!/usr/bin/env python3
"""Olympic DB Sync Script - ASCII safe version"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.stdout.reconfigure(encoding='utf-8')

from app.core.config import settings
import asyncpg

async def main():
    db_url = settings.DATABASE_URL
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://").replace("postgres+asyncpg://", "postgresql://")
    
    conn = await asyncpg.connect(db_url)
    print("Connected to database")
    
    try:
        # 1. ROLLBACK premature completions for test user
        print("\nRolling back premature completion flags for Test Learner B1...")
        r1 = await conn.execute("""
            UPDATE learner_profiles 
            SET has_completed_assessment = FALSE, onboarding_complete = FALSE
            WHERE full_name = 'Test Learner B1'
        """)
        print(f"  Profiles rollback: {r1}")
        
        r2 = await conn.execute("""
            UPDATE assessments a
            SET status = 'in_progress', completed_at = NULL
            FROM learner_profiles lp
            WHERE a.user_id = lp.id 
            AND lp.full_name = 'Test Learner B1'
            AND a.status = 'completed'
        """)
        print(f"  Assessments reset: {r2}")

        # 2. CHECK and FIX id column default on assessment_responses
        print("\nChecking assessment_responses id column...")
        id_col = await conn.fetchrow("""
            SELECT column_default FROM information_schema.columns
            WHERE table_name = 'assessment_responses' AND column_name = 'id'
        """)
        default_val = id_col['column_default'] if id_col else None
        print(f"  id default: {default_val}")
        
        if not default_val or 'random' not in str(default_val).lower():
            print("  Adding gen_random_uuid() server-side default to id...")
            await conn.execute("""
                ALTER TABLE assessment_responses 
                ALTER COLUMN id SET DEFAULT gen_random_uuid()
            """)
            print("  DONE: gen_random_uuid() added")
        else:
            print("  OK: id already has uuid default")

        # 3. ADD missing columns to learner_profiles
        print("\nChecking for missing columns in learner_profiles...")
        lp_cols = await conn.fetch("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_name = 'learner_profiles'
        """)
        lp_col_names = [c['column_name'] for c in lp_cols]
        
        required_cols = [
            ("skill_distribution", "JSONB", "'{}'::jsonb"),
            ("current_proficiency", "TEXT", "'A1'"),
            ("milestone_progress", "JSONB", "'{}'::jsonb"),
        ]
        
        for col_name, col_type, default in required_cols:
            if col_name not in lp_col_names:
                print(f"  Adding missing: {col_name} ({col_type})")
                await conn.execute(f"""
                    ALTER TABLE learner_profiles 
                    ADD COLUMN IF NOT EXISTS {col_name} {col_type} DEFAULT {default}
                """)
                print(f"  DONE: {col_name} added")
            else:
                print(f"  OK: {col_name} exists")

        # 4. REPORT test user state
        print("\nCurrent Test Learner B1 state:")
        user = await conn.fetchrow("""
            SELECT id, full_name, has_completed_assessment, onboarding_complete, overall_level
            FROM learner_profiles WHERE full_name = 'Test Learner B1'
        """)
        if user:
            print(f"  User: {user['full_name']}")
            print(f"  has_completed_assessment: {user['has_completed_assessment']}")
            print(f"  onboarding_complete: {user['onboarding_complete']}")
            print(f"  overall_level: {user['overall_level']}")
        else:
            print("  WARNING: Test user not found in learner_profiles")

        # 5. How many ASSESSMENT_TOTAL_QUESTIONS is set to?
        print("\nCurrent ASSESSMENT_TOTAL_QUESTIONS:", end=" ")
        from app.core.config import settings as s
        print(s.ASSESSMENT_TOTAL_QUESTIONS)

        print("\nOlympic DB Sync COMPLETE!")
        
    finally:
        await conn.close()

asyncio.run(main())
