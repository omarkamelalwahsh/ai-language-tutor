import os
import sqlalchemy
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

db_url = os.environ.get("DATABASE_URL")
if db_url and db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(db_url)
user_id = '9cb9e031-97ce-4a8b-b714-9f8c4a5fdbfe'

with engine.connect() as conn:
    conn.execute(text(f"UPDATE learner_profiles SET current_proficiency_level = 'B2', overall_level = 'B2', level = 'B2' WHERE id = '{user_id}'"))
    conn.commit()
    
print(f"Direct SQL fix successful for user {user_id}")
