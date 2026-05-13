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
        
        # 1. Logic to send via Firebase (Mocked for now)
        # In a real app: firebase_admin.messaging.send(...)
        logging.info(f"[FCM MOCK] Sending {n_type} to {user.id} ({user.fcm_token}): {msg['title']} - {msg['body']}")
        
        # 2. Log in DB
        log = UserNotificationLog(
            user_id=user.id,
            notification_type=n_type
        )
        self.db.add(log)

    async def update_fcm_token(self, user_id: UUID, token: str):
        prof_stmt = select(LearnerProfile).where(LearnerProfile.id == user_id)
        profile = (await self.db.execute(prof_stmt)).scalar_one_or_none()
        if profile:
            profile.fcm_token = token
            await self.db.commit()
