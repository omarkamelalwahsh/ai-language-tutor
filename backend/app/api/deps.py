import httpx
from jose import jwt, JWTError, jwk
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings

security = HTTPBearer()

# Simple in-memory cache for JWKS
_jwks_cache = None

async def get_jwks():
    global _jwks_cache
    if _jwks_cache is None:
        jwks_url = f"{settings.VITE_SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(jwks_url)
                response.raise_for_status()
                _jwks_cache = response.json()
        except Exception as e:
            print(f"Failed to fetch JWKS: {e}")
            _jwks_cache = {"keys": []}
    return _jwks_cache

async def get_current_user_id(res: HTTPAuthorizationCredentials = Depends(security)):
    """
    Validates the Supabase JWT using JWKS for ES256 (newer projects) 
    or fallbacks to HS256 using the symmetric secret.
    """
    token = res.credentials.strip()
    try:
        # 1. Get header to find the algorithm and Key ID (kid)
        header = jwt.get_unverified_header(token)
        alg = header.get("alg")
        kid = header.get("kid")
        
        # 2. Case: ES256 (Asymmetric - needs JWKS)
        if alg == "ES256" and kid:
            jwks = await get_jwks()
            key_data = next((k for k in jwks.get("keys", []) if k["kid"] == kid), None)
            
            if not key_data:
                # Refresh cache once if key not found
                global _jwks_cache
                _jwks_cache = None
                jwks = await get_jwks()
                key_data = next((k for k in jwks.get("keys", []) if k["kid"] == kid), None)
            
            if key_data:
                public_key = jwk.construct(key_data)
                payload = jwt.decode(
                    token, 
                    public_key, 
                    algorithms=["ES256"], 
                    audience="authenticated"
                )
            else:
                raise JWTError("Could not find matching key in JWKS")
        
        # 3. Case: Fallback to Symmetric HS256 (Legacy projects)
        else:
            payload = jwt.decode(
                token, 
                settings.SUPABASE_JWT_SECRET, 
                algorithms=["HS256"], 
                audience="authenticated"
            )
        
        user_id = payload.get("sub") or payload.get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID missing")
        return user_id

    except JWTError as e:
        print(f"Auth Error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Auth Failed: {str(e)}"
        )


