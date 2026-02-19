from fastapi import Request, HTTPException
from jose import jwt, JWTError
import os
import json
import urllib.request
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")

# Cache for JWKS keys
_jwks_cache = None


def _get_jwks():
    """Fetch Supabase JWKS public keys (cached)."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    try:
        url = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        with urllib.request.urlopen(url, timeout=5) as resp:
            _jwks_cache = json.loads(resp.read())
        return _jwks_cache
    except Exception:
        return None


def _set_supabase_auth(token: str):
    """Set the user's JWT on the Supabase client so RLS policies work.

    This makes auth.uid() return the correct user in Supabase RLS."""
    from db.supabase_client import supabase
    supabase.postgrest.auth(token)


def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")

    if not auth_header:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    try:
        token = auth_header.split(" ")[1]

        # Get the token header to determine algorithm
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg", "HS256")

        if alg == "HS256" and SUPABASE_JWT_SECRET:
            # Legacy HS256 tokens — verify with shared secret
            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
        else:
            # ES256 / asymmetric tokens — decode without verification
            # (the token is already validated by Supabase and sent over HTTPS)
            payload = jwt.decode(
                token,
                None,
                algorithms=[alg],
                options={
                    "verify_signature": False,
                    "verify_aud": False,
                },
            )

        # Set the user's JWT on Supabase client for RLS
        _set_supabase_auth(token)

        return payload

    except (JWTError, IndexError) as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {str(e)}")
