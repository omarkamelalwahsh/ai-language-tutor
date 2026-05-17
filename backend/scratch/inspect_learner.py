import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def check_learner():
    profiles = supabase.table("learner_profiles").select("*").execute().data
    print(f"Total Learner Profiles: {len(profiles)}")
    for p in profiles:
        print(f"ID: {p.get('id')}")
        print(f"  Full Name: {p.get('full_name')}")
        print(f"  Current Streak: {p.get('current_streak')}")
        print(f"  Longest Streak: {p.get('longest_streak')}")
        print(f"  Last Interaction Date: {p.get('last_interaction_date')}")
        print(f"  Last Active At: {p.get('last_active_at')}")
        print(f"  XP Points: {p.get('xp_points')}")
        print(f"  Level: {p.get('current_proficiency_level')}")

if __name__ == "__main__":
    check_learner()
