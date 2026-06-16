from typing import Annotated

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.auth.dependencies import CurrentUser
from app.api.users.schemas import UserPublic, UserUpdateRequest, UserSearchResponse
from app.api.users.service import UserService
from app.db.session import get_db

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserPublic)
async def get_my_profile(current_user: CurrentUser):
    """Return authenticated user's profile."""
    return UserPublic.model_validate(current_user)


@router.patch("/me", response_model=UserPublic)
async def update_my_profile(
    data: UserUpdateRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    """Update authenticated user's profile."""
    service = UserService(db)
    return await service.update_profile(current_user, data)


@router.get("/search", response_model=UserSearchResponse)
async def search_users(
    q: str = Query(..., min_length=1, description="Search query (name or email)"),
    current_user: CurrentUser = None,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)] = None,
):
    """Search for users by name or email."""
    service = UserService(db)
    return await service.search_users(q, current_user)


@router.get("/{user_id}", response_model=UserPublic)
async def get_user(
    user_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    """Get a user's public profile by ID."""
    service = UserService(db)
    return await service.get_profile(user_id)
