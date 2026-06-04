from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import Dict, Any

from app.api.deps import get_db, get_current_user_id
from app.services.journey_service import JourneyService

router = APIRouter()

@router.post("/tasks/{task_id}/submit")
async def submit_task(
    task_id: UUID,
    answer: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id)
):
    service = JourneyService(db)
    return await service.submit_task_evaluation(user_id=user_id, task_id=task_id, answer=answer)

@router.post("/journey/initialize")
async def initialize_journey(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id)
):
    service = JourneyService(db)
    return await service.initialize_catchup_chain(user_id=user_id)

@router.post("/graduation/check")
async def check_graduation(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id)
):
    service = JourneyService(db)
    return await service.check_graduation(user_id=user_id)

@router.post("/admin/user/{user_id}/reset-journey")
async def reset_journey(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """
    Admin-only endpoint: Wipes all legacy journey data for a user and
    bootstraps the new 20-node architecture with automatic Catch-Up injection.
    """
    service = JourneyService(db)
    return await service.reset_and_upgrade_journey(user_id=user_id)
