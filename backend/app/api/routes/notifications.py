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

@router.get("")
async def get_notifications(limit: int = 20, offset: int = 0, db: AsyncSession = Depends(get_db), current_user_id: str = Depends(get_current_user_id)):
    """Return a list of notifications for the current user."""
    try:
        service = NotificationService(db)
        notifications = await service.get_user_notifications(UUID(current_user_id), limit=limit, offset=offset)
        # Convert ORM objects to dicts
        return [
            {
                "id": str(n.id),
                "type": n.notification_type,
                "title": n.title,
                "body": n.body,
                "created_at": n.created_at.isoformat(),
                "is_read": n.is_read,
            }
            for n in notifications
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class MarkReadRequest(BaseModel):
    notification_ids: list[UUID] | None = None

@router.post("/read")
async def mark_notifications_read(req: MarkReadRequest, db: AsyncSession = Depends(get_db), current_user_id: str = Depends(get_current_user_id)):
    """Mark specified notifications as read, or all if none specified."""
    try:
        service = NotificationService(db)
        await service.mark_notifications_as_read(UUID(current_user_id), notification_ids=req.notification_ids)
        return {"status": "success", "message": "Notifications marked as read"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
