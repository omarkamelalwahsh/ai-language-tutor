import sqlite3
import os

# Assuming it's a local sqlite for dev, or I can use the Supabase client
# But wait, we are using Supabase.

from supabase import create_client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

res = supabase.table("learner_profiles").update({
    "current_proficiency_level": "C1",
    "overall_level": "C1",
    "level": "C1"
}).eq("id", "98b50e2ddc9943efb387052637738f61").execute()

print("User level fixed to C1 in Supabase")
