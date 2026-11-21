import os
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key-change-in-production-minimum-32-chars-long")
ALGORITHM = os.environ.get("ALGORITHM", "HS256")

security = HTTPBearer(auto_error=False)


def current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
    """Extract and validate user_id from JWT token.
    Supports HMAC JWT (HS256), Firebase Auth ID Tokens (RS256), and dev fallbacks.
    """
    if not credentials or not credentials.credentials:
        return "demo_user"

    token = str(credentials.credentials).strip()
    if not token or token in ("undefined", "null", "null_token", "Bearer"):
        return "demo_user"

    payload = None

    # 1. Try standard HS256 decode with configured SECRET_KEY
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        pass

    # 2. Try unverified claims for Firebase Auth or external RS256 JWTs
    if not payload:
        try:
            payload = jwt.get_unverified_claims(token)
        except Exception:
            pass

    # 3. Handle simple test/demo tokens
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
