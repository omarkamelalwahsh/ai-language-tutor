import sys
import os
import csv
import json
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import create_engine
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from app.db.database import Base
from app.models.domain import QuestionBankItem

load_dotenv(BASE_DIR / ".env")
raw_url = os.getenv("DATABASE_URL", "")
# Ensure it uses postgresql and sync psycopg2 driver
if raw_url.startswith("postgres://"):
    raw_url = raw_url.replace("postgres://", "postgresql://", 1)
# Wait! Our FastAPI app uses async, but we can do sync for a script
SYNC_URL = raw_url.replace("postgresql://", "postgresql+psycopg2://", 1)
engine = create_engine(SYNC_URL, pool_pre_ping=True)

def import_csv(csv_path: str):
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        with Session(engine) as session:
            count = 0
            for row in reader:
                # Try to parse answer_key JSON to extract options if it exists
                answer_key_dict = {}
                options_list = []
                if row.get('answer_key'):
                    try:
                        answer_key_dict = json.loads(row['answer_key'])
                        options_list = answer_key_dict.get('options', [])
                    except json.JSONDecodeError:
                        pass
                
                # Extract difficulty safely
                try:
                    diff = float(row.get('difficulty', 0.5))
                except ValueError:
                    diff = 0.5
                
                item = QuestionBankItem(
                    id=row['id'],
                    skill=row['skill'],
                    task_type=row['task_type'],
                    level=row['level'],
                    difficulty=diff,
                    prompt=row['prompt'],
                    stimulus=row.get('stimulus', ''),
                    options=options_list,
                    answer_key=answer_key_dict,
                )
                session.merge(item)
                count += 1
            
            session.commit()
            print(f"Successfully imported {count} items.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python import_csv.py <path_to_csv>")
        sys.exit(1)
    
    import_csv(sys.argv[1])
