import asyncio
import os
import sys
from app.core.config import settings
import asyncpg

async def main():
    db_url = settings.DATABASE_URL
    db_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
    conn = await asyncpg.connect(db_url)
    
    # Check RLS
    rls_status = await conn.fetchrow("""
        SELECT relrowsecurity 
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'question_bank_items'
    """)
    print(f"RLS Enabled on question_bank_items: {rls_status['relrowsecurity']}")
    
    # Check Policies
    policies = await conn.fetch("""
        SELECT * FROM pg_policies WHERE tablename = 'question_bank_items'
    """)
    print("\nPolicies:")
    for p in policies:
        print(f" - {p['policyname']}: {p['cmd']} for {p['roles']} using {p['qual']}")
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
