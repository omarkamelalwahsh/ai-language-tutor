import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

db_url = os.environ.get("DATABASE_URL")
engine = create_engine(db_url)

def check_completions():
    user_id = "9cb9e031-97ce-4a8b-b714-9f8c4a5fdbfe"
    with engine.connect() as conn:
        res = conn.execute(text("SELECT * FROM user_daily_bite_completion WHERE user_id = :uid"), {"uid": user_id})
        rows = res.fetchall()
        print(f"Total completions for user {user_id}: {len(rows)}")
        for r in rows:
            print(f"  Bite Type: {r[2]}, Completed Date: {r[3]}, Created At: {r[4]}")

if __name__ == "__main__":
    check_completions()
