import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

db_url = os.environ.get("DATABASE_URL")
engine = create_engine(db_url)

def inspect_profile():
    user_id = "9cb9e031-97ce-4a8b-b714-9f8c4a5fdbfe"
    with engine.connect() as conn:
        res = conn.execute(text("SELECT * FROM learner_profiles WHERE id = :uid"), {"uid": user_id})
        row = res.mappings().first()
        if row:
            for k, v in row.items():
                print(f"{k}: {v}")
        else:
            print("No profile found")

if __name__ == "__main__":
    inspect_profile()
