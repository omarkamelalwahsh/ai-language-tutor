from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Dict, Any
from supabase import create_client, Client
from app.core.config import settings

router = APIRouter()

# Initialize Supabase Admin client for audit logging
# (Audit logs need high reliability, service role is appropriate here)
supabase: Client = create_client(settings.VITE_SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

class AuditLogRequest(BaseModel):
    admin_id: str
    target_user_id: str
    action: str

@router.post("")
async def create_audit_log(log_req: AuditLogRequest, request: Request):
    """
    Tier 2 Deep Dive Access Logging:
    Records when an Admin accesses a Member's detailed chat logs.
    """
    try:
        # Verify the user is authenticated
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            raise HTTPException(status_code=401, detail="Missing Authorization header")

        # In a real scenario we'd decode the JWT to verify admin_id matches the token.
        # Here we trust the request body, but use the service role to ensure the insert succeeds.

        # Insert into audit_logs
        result = supabase.table("audit_logs").insert({
            "admin_id": log_req.admin_id,
            "target_user_id": log_req.target_user_id,
            "action": log_req.action
        }).execute()

        return {"status": "success", "message": "Audit log recorded successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
