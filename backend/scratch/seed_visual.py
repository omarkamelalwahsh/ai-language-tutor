import os
import sys
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from dotenv import load_dotenv

# Add backend to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from app.models.domain import QuestionBankItem

load_dotenv(BASE_DIR / ".env")
raw_url = os.getenv("DATABASE_URL", "")
if raw_url.startswith("postgres://"):
    raw_url = raw_url.replace("postgres://", "postgresql://", 1)
SYNC_URL = raw_url.replace("postgresql://", "postgresql+psycopg2://", 1)
engine = create_engine(SYNC_URL)

ITEMS = [
    {
        "skill": "reading",
        "task_type": "visual_vocabulary",
        "level": "A1",
        "difficulty": 0.2,
        "prompt": "Select the correct word for the object shown.",
        "stimulus": "https://images.unsplash.com/photo-1557800636-894a64c1696f?q=80&w=1000&auto=format&fit=crop",
        "options": ["Orange", "Apple", "Banana", "Grape"],
        "answer_key": {
            "options": ["Orange", "Apple", "Banana", "Grape"],
            "correct_index": 0,
            "correct": "Orange",
            "explanation": "The image clearly shows an orange."
        }
    },
    {
        "skill": "reading",
        "task_type": "visual_vocabulary",
        "level": "B2",
        "difficulty": 0.6,
        "prompt": "Identify the architectural style in the image.",
        "stimulus": "https://images.unsplash.com/photo-1518780664697-55e3ad937233?q=80&w=1000&auto=format&fit=crop",
        "options": ["Gothic", "Modern", "Victorian", "Classical"],
        "answer_key": {
            "options": ["Gothic", "Modern", "Victorian", "Classical"],
            "correct_index": 2,
            "correct": "Victorian",
            "explanation": "The building features typical Victorian architecture."
        }
    }
]

def seed():
    with Session(engine) as session:
        for data in ITEMS:
            item = QuestionBankItem(**data)
            session.add(item)
        session.commit()
        print("Successfully seeded A1 and B2 items.")

if __name__ == "__main__":
    seed()
