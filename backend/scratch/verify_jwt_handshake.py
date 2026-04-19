
import jwt
from jwt import PyJWKClient
import os

# Mock settings
VITE_SUPABASE_URL = "https://ucrcrrqktybczualmsdw.supabase.co"
JWKS_URL = f"{VITE_SUPABASE_URL}/auth/v1/.well-known/jwks.json"

def test_pyjwt_jwks():
    print(f"Testing PyJWKClient connection to: {JWKS_URL}")
    try:
        client = PyJWKClient(JWKS_URL)
        # We can't easily test getting a key without a real token RID, 
        # but we can try to fetch the JWKS metadata.
        print("Fetching JWKS signing keys...")
        # get_signing_keys() will actually hit the network
        keys = client.get_signing_keys()
        print(f"Successfully fetched {len(keys)} signing keys.")
        for k in keys:
            print(f" - Key ID (kid): {k.kid}, Alg: {k.algorithm}")
    except Exception as e:
        print(f"Failed to fetch JWKS: {e}")

if __name__ == "__main__":
    test_pyjwt_jwks()
