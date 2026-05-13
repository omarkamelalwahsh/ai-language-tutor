from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from pydantic import BaseModel

from app.db.database import get_db
from app.api.deps import get_current_user_id
from app.services.notification_service import NotificationService

router = APIRouter()

class TokenUpdate(BaseModel):
    token: str

@router.post("/fcm-token")
async def update_fcm_token(
    data: TokenUpdate,
    db: AsyncSession = Depends(get_db),
    current_user_id: str = Depends(get_current_user_id)
):
    """
    Updates the FCM token for the current user.
    """
    try:
        service = NotificationService(db)
        await service.update_fcm_token(UUID(current_user_id), data.token)
        return {"status": "success", "message": "FCM token updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/trigger-test-reminders")
async def trigger_test_reminders(
    db: AsyncSession = Depends(get_db),
    # In a real app, this would be admin-only
):
    """
    Manually trigger the reminder logic for testing.
    """
    try:
        service = NotificationService(db)
        await service.check_and_send_reminders()
        return {"status": "success", "message": "Reminders triggered"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
