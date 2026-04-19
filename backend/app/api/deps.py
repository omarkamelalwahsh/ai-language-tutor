import jwt
from jwt import PyJWTError, PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings

security = HTTPBearer()

# 🎯 Supabase JWKS Client (Dynamic Key Fetching)
# Standard Supabase JWKS endpoint for asymmetric (ES256) validation
JWKS_URL = f"{settings.VITE_SUPABASE_URL}/auth/v1/.well-known/jwks.json"
jwks_client = PyJWKClient(JWKS_URL)

async def get_current_user_payload(res: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Validates the Supabase JWT and returns the full payload.
    """
    token = res.credentials.strip()
    try:
        # 1. Peek at the header to determine the algorithm
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg")
        
        # 2. Case: ES256 (Modern Supabase ECC Signature)
        if alg == "ES256":
            try:
                signing_key = jwks_client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["ES256"],
                    audience="authenticated"
                )
            except Exception as e:
                raise PyJWTError(f"ES256 Validation Failed: {str(e)}")
        
        # 3. Case: HS256 (Legacy Supabase Shared Secret)
        else:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated"
            )
            
        if not (payload.get("sub") or payload.get("id")):
            raise HTTPException(status_code=401, detail="User ID missing in token payload")
        
        return payload

    except PyJWTError as e:
        print(f"Auth Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authorization Failed: {str(e)}"
        )
    except Exception as e:
        print(f"Unexpected Auth Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

async def get_current_user_id(payload: dict = Depends(get_current_user_payload)) -> str:
    """
    Returns only the user_id from the validated token payload.
    """
    return payload.get("sub") or payload.get("id")


