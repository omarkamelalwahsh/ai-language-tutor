import os
from supabase import create_client, Client

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def check_data():
    # 1. Get all profiles
    profiles = supabase.table("profiles").select("*").execute().data
    print(f"Total Profiles: {len(profiles)}")
    
    # 2. Get teams
    teams = supabase.table("teams").select("*").execute().data
    print(f"Total Teams: {len(teams)}")
    
    # 3. Check all unique skill names in skill_states
    all_skills = supabase.table("skill_states").select("skill").execute().data
    unique_skills = set(s['skill'] for s in all_skills)
    print(f"Unique skills in DB: {unique_skills}")
    
    # 4. Check skill_states for a few users
    for p in profiles[:10]:
        skills = supabase.table("skill_states").select("*").eq("user_id", p['id']).execute().data
        if skills:
            print(f"User {p['full_name']} ({p['email']}) has {len(skills)} skill states.")
            for s in skills:
                print(f"  - {s['skill']}: {s['current_proficiency_level']} (XP: {s['xp_points']})")

if __name__ == "__main__":
    check_data()
