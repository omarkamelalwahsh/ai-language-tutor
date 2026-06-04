import logging
from uuid import UUID
from datetime import datetime, timedelta, timezone
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.domain import LearnerProfile, UserNotificationLog, JourneyStep
from app.services.learner_service import LearnerService

class NotificationService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_and_send_reminders(self):
        """
        Main logic for daily reminders.
        """
        try:
            today = datetime.now(timezone.utc).date()
            
            # 1. Fetch users with FCM tokens who haven't interacted today
            stmt = select(LearnerProfile).where(
                and_(
                    LearnerProfile.fcm_token != None,
                    LearnerProfile.web_notifications_enabled == True,
                    (LearnerProfile.last_interaction_date < today) | (LearnerProfile.last_interaction_date == None)
                )
            )
            result = await self.db.execute(stmt)
            users = result.scalars().all()
            
            for user in users:
                notification_type = await self._determine_notification_type(user)
                await self._send_and_log_notification(user, notification_type)
            
            await self.db.commit()
            logging.info(f"[NotificationService] Sent reminders to {len(users)} users.")
        except Exception as e:
            logging.error(f"[NotificationService] Error in check_and_send_reminders: {str(e)}")
            await self.db.rollback()

    async def _determine_notification_type(self, user: LearnerProfile) -> str:
        """
        Logic:
        - "Comeback": If last_interaction_date > 48h ago.
        - "Spark": If 0/4 cards viewed today (already filtered for not interacted today).
        - "Halfway": If interacted but no node completed (this would be if last_interaction_date == today, 
          but our main query filters those out. Wait, let's rethink.)
        """
        today = datetime.now(timezone.utc).date()
        
        # Comeback logic
        if user.last_interaction_date:
            if today - user.last_interaction_date >= timedelta(days=2):
                return "Comeback"
        else:
            return "Spark" # New user or never interacted

        # If they haven't interacted today, it's a Spark reminder
        return "Spark"

    async def _send_and_log_notification(self, user: LearnerProfile, n_type: str):
        messages = {
            "Spark": {
                "title": "Don't lose your spark! 🔥",
                "body": "Your daily words are waiting for you. Open your dashboard to keep the momentum."
            },
            "Halfway": {
                "title": "Great start! 🚀",
                "body": "You've checked your daily cards. Complete one learning node to boost your XP today."
            },
            "Comeback": {
                "title": "Your streak is waiting! ⏳",
                "body": "It's been a couple of days. Come back and pick up where you left off!"
            }
        }
        
        msg = messages.get(n_type, messages["Spark"])
        logging.info(f"[FCM MOCK] Sending {n_type} to {user.id} ({user.fcm_token}): {msg['title']} - {msg['body']}")
        log = UserNotificationLog(
            user_id=user.id,
            notification_type=n_type,
            title=msg['title'],
            body=msg['body'],
            created_at=datetime.now(timezone.utc)
        )
        self.db.add(log)

    async def get_user_notifications(self, user_id: UUID, limit: int = 20, offset: int = 0):
        stmt = (
            select(UserNotificationLog)
            .where(UserNotificationLog.user_id == user_id)
            .order_by(UserNotificationLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def mark_notifications_as_read(self, user_id: UUID, notification_ids: list[UUID] | None = None):
        if notification_ids:
            stmt = (
                select(UserNotificationLog)
                .where(UserNotificationLog.user_id == user_id, UserNotificationLog.id.in_(notification_ids))
            )
        else:
            stmt = select(UserNotificationLog).where(UserNotificationLog.user_id == user_id)
        result = await self.db.execute(stmt)
        notifications = result.scalars().all()
        for n in notifications:
            n.is_read = True
        await self.db.commit()

    async def update_fcm_token(self, user_id: UUID, token: str):
        prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
        profile = (await self.db.execute(prof_stmt)).scalar_one_or_none()
        if profile:
            profile.fcm_token = token
            await self.db.commit()
