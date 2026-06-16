from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.auth.repository import AuthRepository
from app.api.auth.schemas import RegisterRequest, LoginRequest, TokenResponse
from app.core.exceptions import ConflictException, UnauthorizedException
from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.core.logging import logger
from app.models.user import User


class AuthService:
    def __init__(self, db: AsyncIOMotorDatabase):
        self.repo = AuthRepository(db)

    async def register(self, data: RegisterRequest) -> TokenResponse:
        existing = await self.repo.get_by_email(data.email)
        if existing:
            raise ConflictException("Email already registered")

        hashed = get_password_hash(data.password)
        user = await self.repo.create(name=data.name, email=data.email, password_hash=hashed)
        logger.info(f"New user registered: {user.email}")

        return self._generate_tokens(user)

    async def login(self, data: LoginRequest) -> TokenResponse:
        user = await self.repo.get_by_email(data.email)
        if not user or not verify_password(data.password, user.password_hash):
            raise UnauthorizedException("Invalid email or password")

        logger.info(f"User logged in: {user.email}")
        return self._generate_tokens(user)

    async def refresh(self, refresh_token: str) -> TokenResponse:
        try:
            payload = decode_token(refresh_token)
            if payload.get("type") != "refresh":
                raise UnauthorizedException("Invalid token type")
            user_id: str = payload.get("sub")
        except Exception:
            raise UnauthorizedException("Invalid or expired refresh token")

        user = await self.repo.get_by_id(user_id)
        if not user:
            raise UnauthorizedException("User not found")

        return self._generate_tokens(user)

    async def get_current_user_by_token(self, token: str) -> User:
        try:
            payload = decode_token(token)
            if payload.get("type") != "access":
                raise UnauthorizedException("Invalid token type")
            user_id: str = payload.get("sub")
        except Exception:
            raise UnauthorizedException("Invalid or expired token")

        user = await self.repo.get_by_id(user_id)
        if not user:
            raise UnauthorizedException("User not found")
        return user

    @staticmethod
    def _generate_tokens(user: User) -> TokenResponse:
        access_token = create_access_token({"sub": user.id})
        refresh_token = create_refresh_token({"sub": user.id})
        return TokenResponse(access_token=access_token, refresh_token=refresh_token)
