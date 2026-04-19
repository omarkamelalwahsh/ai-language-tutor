from sqlalchemy import create_engine, text
from app.core.config import settings

def main():
    engine = create_engine(str(settings.DATABASE_URL))
    with engine.begin() as conn:
        try:
            conn.execute(text("ALTER TABLE user_error_profiles ADD CONSTRAINT uq_user_error_profile_user_id UNIQUE (user_id);"))
            print("Successfully added UNIQUE constraint to user_error_profiles.user_id!")
        except Exception as e:
            print(f"Error adding constraint: {e}")

if __name__ == "__main__":
    main()
