import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

db_url = os.environ.get("DATABASE_URL")
engine = create_engine(db_url)

def inspect_emails():
    with engine.connect() as conn:
        res = conn.execute(text("SELECT id, email, full_name, role FROM profiles"))
        rows = res.mappings().all()
        print(f"Total profiles: {len(rows)}")
        for r in rows:
            print(f"ID: {r['id']}, Email: {r['email']}, Name: {r['full_name']}, Role: {r['role']}")

if __name__ == "__main__":
    inspect_emails()
