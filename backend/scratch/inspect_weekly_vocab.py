import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

db_url = os.environ.get("DATABASE_URL")
engine = create_engine(db_url)

def inspect_weekly():
    with engine.connect() as conn:
        res = conn.execute(text("SELECT * FROM weekly_vocabulary ORDER BY week_start_date DESC, day_index ASC"))
        rows = res.fetchall()
        print(f"Total weekly vocab rows: {len(rows)}")
        for r in rows:
            print(f"ID: {r[0]}, Day: {r[1]}, C1: {r[2]}, A1: {r[3]}, Date: {r[6]}")

if __name__ == "__main__":
    inspect_weekly()
