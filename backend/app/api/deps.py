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

async def get_current_user_id(res: HTTPAuthorizationCredentials = Depends(security)):
    """
    Validates the Supabase JWT using PyJWT.
    Supports ES256 (Asymmetric/ECC) via dynamic JWKS and HS256 (Symmetric) fallback.
    """
    token = res.credentials.strip()
    try:
        # 1. Peek at the header to determine the algorithm
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg")
        
        # 2. Case: ES256 (Modern Supabase ECC Signature)
        if alg == "ES256":
            try:
                # Fetch the correct Public Key from Supabase JWKS
                signing_key = jwks_client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["ES256"],
                    audience="authenticated"
                )
            except Exception as e:
                # If key not found or error, it might be an older HS256 token 
                # or a truly invalid token.
                raise PyJWTError(f"ES256 Validation Failed: {str(e)}")
        
        # 3. Case: HS256 (Legacy Supabase Shared Secret)
        else:
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                audience="authenticated"
            )
            
        user_id = payload.get("sub") or payload.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID missing in token payload")
        
        return user_id

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


