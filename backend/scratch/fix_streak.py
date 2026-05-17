import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

db_url = os.environ.get("DATABASE_URL")
engine = create_engine(db_url)

def fix_streak():
    user_id = "9cb9e031-97ce-4a8b-b714-9f8c4a5fdbfe"
    with engine.connect() as conn:
        # Check current values
        res = conn.execute(text("SELECT current_streak, longest_streak, last_interaction_date FROM learner_profiles WHERE id = :uid"), {"uid": user_id})
        row = res.fetchone()
        if row:
            print(f"Before fix -> Current Streak: {row[0]}, Longest Streak: {row[1]}, Last Interaction Date: {row[2]}")
            
            # Update current_streak to 1
            conn.execute(text("UPDATE learner_profiles SET current_streak = 1, longest_streak = 2 WHERE id = :uid"), {"uid": user_id})
            conn.commit()
            print("Successfully updated user streak to 1 (new streak starting today after missed days).")
            
            # Verify new values
            res = conn.execute(text("SELECT current_streak, longest_streak, last_interaction_date FROM learner_profiles WHERE id = :uid"), {"uid": user_id})
            row = res.fetchone()
            print(f"After fix -> Current Streak: {row[0]}, Longest Streak: {row[1]}, Last Interaction Date: {row[2]}")

if __name__ == "__main__":
    fix_streak()
