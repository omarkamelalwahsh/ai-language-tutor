from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Dict, Any
from supabase import create_client, Client
from app.core.config import settings
from app.api.deps import get_current_user_payload

router = APIRouter()

# Initialize Supabase Admin client for audit logging
# (Audit logs need high reliability, service role is appropriate here)
supabase: Client = create_client(settings.VITE_SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

class AuditLogRequest(BaseModel):
    target_user_id: str
    action: str


def _is_admin_claims(payload: Dict[str, Any]) -> bool:
    app_metadata = payload.get("app_metadata") or {}
    user_metadata = payload.get("user_metadata") or {}

    role_values = [
        payload.get("role"),
        payload.get("is_admin"),
        payload.get("admin"),
        app_metadata.get("role"),
        app_metadata.get("is_admin"),
        app_metadata.get("admin"),
        user_metadata.get("role"),
        user_metadata.get("is_admin"),
        user_metadata.get("admin"),
    ]

    for value in role_values:
        if isinstance(value, str) and value.lower() in {"admin", "superadmin", "super_admin", "staff"}:
            return True
        if isinstance(value, (int, float)) and value >= 2:
            return True
    return False


@router.post("")
async def create_audit_log(
    log_req: AuditLogRequest,
    payload: Dict[str, Any] = Depends(get_current_user_payload),
):
    """
    Tier 2 Deep Dive Access Logging:
    Records when an Admin accesses a Member's detailed chat logs.
    """
    try:
        admin_id = payload.get("sub") or payload.get("id")
        if not admin_id:
            raise HTTPException(status_code=401, detail="Invalid JWT identity")

        if not _is_admin_claims(payload):
            raise HTTPException(status_code=403, detail="Admin privileges required")

        supabase.table("audit_logs").insert({
            "admin_id": admin_id,
            "target_user_id": log_req.target_user_id,
            "action": log_req.action,
        }).execute()

        return {"status": "success", "message": "Audit log recorded successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to record audit log") from e
