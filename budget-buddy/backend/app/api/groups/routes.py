from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth.dependencies import CurrentUser
from app.api.groups.schemas import (
    AddMemberRequest,
    GroupCreate,
    GroupListResponse,
    GroupPublic,
    GroupUpdate,
)
from app.api.groups.service import GroupService
from app.db.session import get_db

router = APIRouter(prefix="/groups", tags=["Groups"])


@router.post("/", response_model=GroupPublic, status_code=201)
async def create_group(
    data: GroupCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = GroupService(db)
    return await service.create_group(current_user, data)


@router.get("/", response_model=GroupListResponse)
async def list_groups(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = GroupService(db)
    return await service.list_groups(current_user)


@router.get("/{group_id}", response_model=GroupPublic)
async def get_group(
    group_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = GroupService(db)
    return await service.get_group(current_user, group_id)


@router.patch("/{group_id}", response_model=GroupPublic)
async def update_group(
    group_id: str,
    data: GroupUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = GroupService(db)
    return await service.update_group(current_user, group_id, data)


@router.delete("/{group_id}", status_code=204)
async def delete_group(
    group_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = GroupService(db)
    await service.delete_group(current_user, group_id)


@router.post("/{group_id}/members", response_model=GroupPublic)
async def add_member(
    group_id: str,
    data: AddMemberRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = GroupService(db)
    return await service.add_member(current_user, group_id, data)


@router.delete("/{group_id}/members/{user_id}", response_model=GroupPublic)
async def remove_member(
    group_id: str,
    user_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    service = GroupService(db)
    return await service.remove_member(current_user, group_id, user_id)
