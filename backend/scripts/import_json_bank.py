import asyncio
import os
import sys
import json
from pathlib import Path
from sqlalchemy.orm import Session
from sqlalchemy import create_engine, select
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BASE_DIR))

from app.models.domain import QuestionBankItem

load_dotenv(BASE_DIR / ".env")
raw_url = os.getenv("DATABASE_URL", "")
if raw_url.startswith("postgres://"):
    raw_url = raw_url.replace("postgres://", "postgresql://", 1)
# Use sync driver for seeding script
SYNC_URL = raw_url.replace("postgresql://", "postgresql+psycopg2://", 1)
engine = create_engine(SYNC_URL)

def import_json(json_path: str):
    print(f"Reading from {json_path}...")
    if not os.path.exists(json_path):
        print(f"File not found: {json_path}")
        return

    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
        with Session(engine) as session:
            count = 0
            skipped = 0
            for row in data:
                level = row.get('level') or row.get('target_cefr', 'A1')
                prompt = row['prompt']
                skill = row['skill']
                task_type = row['task_type']
                
                # Duplicate check
                exists = session.execute(
                    select(QuestionBankItem).where(
                        QuestionBankItem.prompt == prompt,
                        QuestionBankItem.skill == skill,
                        QuestionBankItem.task_type == task_type
                    )
                ).first()
                
                if exists:
                    skipped += 1
                    continue
                
                options = row.get('options') or (row.get('answer_key', {}).get('options', []))
                
                item = QuestionBankItem(
                    skill=skill,
                    task_type=task_type,
                    level=level,
                    difficulty=float(row.get('difficulty', 0.5)),
                    prompt=prompt,
                    stimulus=row.get('stimulus', ''),
                    options=options,
                    answer_key=row.get('answer_key', {}),
                    rubric=row.get('rubric', '')
                )
                session.add(item)
                count += 1
            
            session.commit()
            print(f"Successfully imported {count} items. Skipped {skipped} duplicates.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        # Default path
        json_path = os.path.join(BASE_DIR, "question_banks", "C2_sheet.json")
        import_json(json_path)
    else:
        import_json(sys.argv[1])
