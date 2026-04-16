import asyncio
from sqlalchemy import create_engine, inspect
from app.core.config import settings

def inspect_db():
    try:
        engine = create_engine(settings.DATABASE_URL)
        inspector = inspect(engine)
        
        tables = ['assessments', 'assessment_responses', 'user_error_analysis', 'learner_profiles']
        for table in tables:
            print(f"--- Table: {table} ---")
            try:
                columns = inspector.get_columns(table)
                for c in columns:
                    print(f"  {c['name']} ({c['type']})")
            except Exception as e:
                print(f"  Error: {e}")
            print()
            
    except Exception as e:
        print(f"Global Error: {e}")

if __name__ == "__main__":
    inspect_db()
