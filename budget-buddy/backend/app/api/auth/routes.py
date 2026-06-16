from typing import Annotated

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.auth.dependencies import CurrentUser
from app.api.auth.schemas import (
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    UserPublic,
)
from app.api.auth.service import AuthService
from app.db.session import get_db

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse, status_code=201)
async def register(
    data: RegisterRequest,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    """Register a new user and return JWT tokens."""
    service = AuthService(db)
    return await service.register(data)


@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    """Login with email and password."""
    service = AuthService(db)
    return await service.login(data)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    data: RefreshRequest,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    """Exchange a refresh token for a new access token."""
    service = AuthService(db)
    return await service.refresh(data.refresh_token)


@router.post("/logout", status_code=204)
async def logout(current_user: CurrentUser):
    """Logout — client should discard tokens (stateless JWT)."""
    return None


@router.get("/me", response_model=UserPublic)
async def me(current_user: CurrentUser):
    """Return the currently authenticated user's profile."""
    return current_user
