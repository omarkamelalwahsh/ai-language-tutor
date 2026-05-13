from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.models.domain import UserVocabularyLog
from datetime import datetime
import uuid

class VocabLogService:
    @staticmethod
    async def log_vocabulary_exposure(db: AsyncSession, user_id: uuid.UUID, word: str, context: dict = None):
        """Logs a word exposure for a user. Ignores duplicates due to unique constraint."""
        try:
            # Check if already exists to avoid unnecessary DB errors
            stmt = select(UserVocabularyLog).where(
                UserVocabularyLog.user_id == user_id,
                UserVocabularyLog.word == word
            )
            result = await db.execute(stmt)
            existing = result.scalars().first()
            
            if existing:
                return existing

            log_entry = UserVocabularyLog(
                user_id=user_id,
                word=word,
                context=context or {}
            )
            db.add(log_entry)
            await db.commit()
            await db.refresh(log_entry)
            return log_entry
        except Exception as e:
            await db.rollback()
            return None

    @staticmethod
    async def get_recent_user_vocabulary(db: AsyncSession, user_id: uuid.UUID, limit: int = 10):
        """Retrieves the most recently exposed words for a user."""
        stmt = select(UserVocabularyLog.word)\
            .where(UserVocabularyLog.user_id == user_id)\
            .order_by(desc(UserVocabularyLog.exposed_at))\
            .limit(limit)
        
        result = await db.execute(stmt)
        return result.scalars().all()
