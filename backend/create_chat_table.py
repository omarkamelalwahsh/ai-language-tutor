"""Create the chat_history table."""
import asyncio
from sqlalchemy import text
from app.db.database import AsyncSessionLocal

SQL = """
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_chat_history_user_id ON chat_history(user_id);
CREATE INDEX IF NOT EXISTS ix_chat_history_created_at ON chat_history(user_id, created_at DESC);
"""

async def main():
    async with AsyncSessionLocal() as session:
        for stmt in SQL.strip().split(";"):
            stmt = stmt.strip()
            if stmt:
                await session.execute(text(stmt))
        await session.commit()
        print("✅ chat_history table created successfully!")

if __name__ == "__main__":
    asyncio.run(main())
