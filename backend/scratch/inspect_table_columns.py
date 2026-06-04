import os
import asyncio
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

db_url = os.environ.get("DATABASE_URL")
engine = create_engine(db_url)

def inspect_columns():
    with engine.connect() as conn:
        res = conn.execute(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'user_notifications_log'
        """))
        columns = res.all()
        print("Columns in 'user_notifications_log':")
        for col in columns:
            print(f"- {col[0]}: {col[1]}")

if __name__ == "__main__":
    inspect_columns()
