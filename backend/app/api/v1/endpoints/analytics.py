from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.api.deps import get_current_user_id
from app.services.profile_aggregator import aggregator
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/user-stats")
async def get_user_stats(
    user_id: str = Depends(get_current_user_id), 
    db: Session = Depends(get_db)
):
    """
    Get aggregated user stats for dashboard and analytics.
    Triggers auto-recovery and write-back automatically.
    """
    logger.info(f"📊 [Analytics] Request received for user: {user_id}")
    
    try:
        # 1. Run Aggregator (includes Auto-Recovery and Write-Back)
        unified_profile = aggregator.get_unified_profile(user_id, db)
        
        # 2. Determine Sync Status
        meta = unified_profile.get("recovery_meta", {})
        confidence = meta.get("confidence_score", 0)
        
        sync_status = "new_user"
        if confidence > 80:
            sync_status = "fully_synced"
        elif confidence > 0:
            sync_status = "recovered_from_legacy"

        # 3. Return Professional Response
        return {
            "user_id": user_id,
            "profile": unified_profile,
            "sync_status": sync_status,
            "confidence_score": f"{confidence}%",
            "engine_version": "2.1.0-alpha",
            "last_sync": "Just now"
        }
    except Exception as e:
        logger.error(f"❌ [Analytics] Global Aggregation Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Linguistic Data Aggregator Failed")
