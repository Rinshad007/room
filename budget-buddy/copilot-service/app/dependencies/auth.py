import os
from typing import Optional
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production-minimum-32-chars-long")
ALGORITHM = os.environ.get("ALGORITHM", "HS256")

security = HTTPBearer(auto_error=False)


def current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """Extract and validate user_id.
    Prioritizes:
    1. Explicit X-User-Id header sent by client.
    2. Query parameter 'user_id' if present.
    3. JWT claims (sub, user_id, uid) from Authorization Bearer token (HS256 or Firebase RS256).
    4. Dev token or fallback to demo_user.
    """
    # 1. Direct X-User-Id header
    custom_uid = request.headers.get("x-user-id")
    if custom_uid and custom_uid.strip() and custom_uid.strip() not in ("undefined", "null", ""):
        return custom_uid.strip()

    # 2. Query parameter user_id
    query_uid = request.query_params.get("user_id")
    if query_uid and query_uid.strip() and query_uid.strip() not in ("undefined", "null", ""):
        return query_uid.strip()

    if not credentials or not credentials.credentials:
        return "demo_user"

    token = str(credentials.credentials).strip()
    if not token or token in ("undefined", "null", "null_token", "Bearer"):
        return "demo_user"

    payload = None

    # Try standard HS256 decode with configured SECRET_KEY
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        pass

    # Try unverified claims for Firebase Auth or external RS256 JWTs
    if not payload:
        try:
            payload = jwt.get_unverified_claims(token)
        except Exception:
            pass

    # Handle raw user ID passed as token
    if not payload:
        if token and len(token) < 128 and token.count(".") != 2:
            return token
        return "demo_user"

    user_id = (
        payload.get("sub")
        or payload.get("user_id")
        or payload.get("uid")
        or payload.get("email")
    )
    if not user_id:
        return "demo_user"

    return str(user_id)
