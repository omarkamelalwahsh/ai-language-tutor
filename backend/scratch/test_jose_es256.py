
# import json
# from jose import jwt, jwk, JWTError

# def test_es256():
#     # Mock ES256 key data from Supabase
#     key_data = {
#         "kty": "EC",
#         "crv": "P-256",
#         "x": "abc", # mock
#         "y": "def", # mock
#         "alg": "ES256",
#         "use": "sig",
#         "kid": "test"
#     }
    
#     try:
#         print("Attempting to construct JWK...")
#         key = jwk.construct(key_data)
#         print("Successfully constructed JWK.")
#     except Exception as e:
#         print(f"Failed to construct JWK: {e}")

# if __name__ == "__main__":
#     test_es256()
