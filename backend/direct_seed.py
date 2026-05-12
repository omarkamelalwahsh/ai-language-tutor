import os
import sqlalchemy
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load DB URL from .env
load_dotenv()
db_url = os.environ.get("DATABASE_URL")
if not db_url:
    print("❌ DATABASE_URL not found in .env")
    exit(1)

# Fix for older SQLAlchemy versions if using postgres://
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(db_url)

levels = [
    ("A1", 1000, 5, 4, 0.7),
    ("A2", 2500, 6, 4, 0.7),
    ("B1", 5000, 8, 5, 0.7),
    ("B2", 10000, 10, 5, 0.7),
    ("C1", 20000, 12, 6, 0.7),
    ("C2", 40000, 15, 6, 0.7),
]

def seed():
    with engine.connect() as conn:
        print("Cleaning existing config...")
        conn.execute(text("DELETE FROM levels_config"))
        
        print("Seeding levels...")
        for level in levels:
            conn.execute(
                text("INSERT INTO levels_config (level_name, required_xp, chapter_count, nodes_per_chapter, min_pass_score) VALUES (:name, :xp, :chapters, :nodes, :pass_score)"),
                {"name": level[0], "xp": level[1], "chapters": level[2], "nodes": level[3], "pass_score": level[4]}
            )
        conn.commit()
        print("Levels seeded successfully via Direct SQL!")

if __name__ == "__main__":
    seed()
