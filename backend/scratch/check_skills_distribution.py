
import asyncio
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# 🎯 Database URL from common env
DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/ai_tutor"

def check_skills():
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        result = conn.execute(text("SELECT skill, count(*) FROM question_bank_items GROUP BY skill;"))
        for row in result:
            print(f"Skill: {row[0]}, Count: {row[1]}")

if __name__ == "__main__":
    check_skills()
