import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

def check_completions():
    user_id = "9cb9e031-97ce-4a8b-b714-9f8c4a5fdbfe"
    completions = supabase.table("user_daily_bite_completion").select("*").eq("user_id", user_id).execute().data
    print(f"Total completions for user {user_id}: {len(completions)}")
    for c in completions:
        print(f"  Bite Type: {c.get('bite_type')}, Completed Date: {c.get('completed_date')}, Created At: {c.get('created_at')}")

if __name__ == "__main__":
    check_completions()
