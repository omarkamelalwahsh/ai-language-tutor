from fastapi import APIRouter, HTTPException, Depends
import logging
from supabase import create_client, Client
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize Supabase client with service role for administrative tasks
supabase: Client = create_client(settings.VITE_SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

@router.get("/verify/{token}")
async def verify_invite(token: str):
    """
    Verifies a team invite token and returns associated metadata.
    Requirement 1 & 4.
    """
    logger.info(f"Verifying invite token: {token}")
    
    try:
        # Query the team_invites table
        # Note: Database column is 'role', not 'role_level_to_assign'
        # Database column for tracking usage is 'used_at'
        response = supabase.table("team_invites") \
            .select("team_id, role, expires_at, used_at") \
            .eq("token", token) \
            .execute()
        
        if not response.data:
            logger.warning(f"Token not found: {token}")
            raise HTTPException(status_code=404, detail="Invite token not found")
        
        invite = response.data[0]
        
        if invite.get("used_at"):
            logger.warning(f"Token already used at: {invite['used_at']}")
            raise HTTPException(status_code=400, detail="Invite token already used")
            
        logger.info(f"Token verified successfully. Team ID: {invite['team_id']}, Role Level: {invite['role']}")
        
        return {
            "team_id": invite["team_id"],
            "role_level": invite["role"]
        }
        
    except Exception as e:
        logger.error(f"Error verifying token {token}: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/assign-to-user")
async def assign_to_user(payload: dict):
    """
    Updates the user's profile and marks the token as used.
    Requirement 2 & 3.
    """
    token = payload.get("token")
    user_id = payload.get("current_user_id") or payload.get("user_id")
    email = payload.get("email") # To check for Root Admin
    
    if not token or not user_id:
        raise HTTPException(status_code=400, detail="Missing token or user_id")
        
    logger.info(f"Assigning invite for user {user_id} with token {token}")
    
    try:
        # 1. Fetch invite data again to be sure
        response = supabase.table("team_invites") \
            .select("team_id, role, used_at") \
            .eq("token", token) \
            .execute()
            
        if not response.data:
             raise HTTPException(status_code=404, detail="Invite token not found")
             
        invite = response.data[0]
        if invite.get("used_at"):
             raise HTTPException(status_code=400, detail="Invite token already used")
             
        team_id = invite["team_id"]
        role_level = invite["role"]
        
        # 2. Root Admin Protection (Requirement 3)
        if email == "omaralwahsh8719@gmail.com":
            logger.info("Root Admin detected. Forcing role_level = 2.")
            role_level = 2
            
        # 3. Update Profile (Requirement 2)
        logger.info(f"Upserting profile for user {user_id}: team_id={team_id}, requested_role={role_level}")
        
        # Get existing profile
        existing_profile = supabase.table("profiles").select("full_name, email, role").eq("id", user_id).execute()
        
        # Prevent downgrading an Admin to a Member
        if existing_profile.data:
            current_role = existing_profile.data[0].get("role", 0)
            if current_role == 1 and role_level == 0:
                logger.info(f"Prevented downgrade for user {user_id} from Admin (1) to Member (0).")
                role_level = 1
            if current_role == 2:
                role_level = 2
                
        profile_data = {
            "id": user_id,
            "team_id": team_id,
            "role": role_level
        }
        
        if not existing_profile.data:
            logger.info(f"No existing profile for {user_id}. Creating new entry.")
            if email:
                profile_data["email"] = email
                profile_data["full_name"] = email.split('@')[0]
        
        profile_update = supabase.table("profiles") \
            .upsert(profile_data) \
            .execute()
            
        if not profile_update.data:
             logger.error(f"Critical: Failed to upsert profile for {user_id}")
             raise HTTPException(status_code=500, detail="Profile update failed")
             
        # 4. Cleanup: Mark token as used (Requirement 2)
        from datetime import datetime, timezone
        logger.info(f"Marking token {token} as used by {user_id}")
        supabase.table("team_invites") \
            .update({
                "used_at": datetime.now(timezone.utc).isoformat(),
                "used_by": user_id
            }) \
            .eq("token", token) \
            .execute()
            
        logger.info(f"Invite consumed successfully for user {user_id}")
        return {"status": "success", "role_assigned": role_level}
        
    except Exception as e:
        logger.error(f"Error consuming invite: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
