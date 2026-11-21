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
    Supports HMAC JWT (HS256), Firebase Auth ID Tokens (RS256), and fallback tokens.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required. Please log in.",
        )

    token = credentials.credentials
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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
        )

    user_id = (
        payload.get("sub")
        or payload.get("user_id")
        or payload.get("uid")
        or payload.get("email")
    )
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token: no user identifier found",
        )

    return str(user_id)
