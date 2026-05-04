import os
from sqlalchemy import create_engine, inspect
from dotenv import load_dotenv

load_dotenv()
db_url = os.getenv("DATABASE_URL")
sync_url = db_url.replace("postgresql+asyncpg://", "postgresql://")
engine = create_engine(sync_url)
inspector = inspect(engine)

target_tables = ["skill_states", "user_skills", "assessment_responses"]
for table in target_tables:
    if table in inspector.get_table_names():
        print(f"\nTable: {table}")
        for col in inspector.get_columns(table):
            print(f"  - {col['name']} ({col['type']})")
    else:
        print(f"\nTable {table} NOT found.")

print("\nFinal check complete.")
