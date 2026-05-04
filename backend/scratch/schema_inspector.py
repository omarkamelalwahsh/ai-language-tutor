import os
from sqlalchemy import create_engine, inspect
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("❌ DATABASE_URL not found in .env")
    exit(1)

# Ensure synchronous driver for inspector
sync_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

engine = create_engine(sync_url)
inspector = inspect(engine)

print(f"Connected to: {sync_url.split('@')[-1]}")
print("-" * 50)

tables = inspector.get_table_names()
for table in tables:
    print(f"Table: {table}")
    columns = inspector.get_columns(table)
    for col in columns:
        print(f"  - {col['name']} ({col['type']})")
print("\n" + "-" * 50)
print("Inspection complete.")
