from typing import Annotated

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.auth.dependencies import CurrentUser
from app.api.budgets.schemas import BudgetCreate, BudgetPublic, BudgetUpdate
from app.api.budgets.service import BudgetService
from app.db.session import get_db

router = APIRouter(prefix="/budgets", tags=["Budgets"])


@router.post("/", response_model=BudgetPublic, status_code=201)
async def create_budget(
    data: BudgetCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    service = BudgetService(db)
    return await service.create_budget(current_user, data)


@router.get("/", response_model=list[BudgetPublic])
async def list_budgets(
    current_user: CurrentUser,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    service = BudgetService(db)
    return await service.list_budgets(current_user)


@router.get("/{month}/{year}", response_model=BudgetPublic)
async def get_budget(
    month: int,
    year: int,
    current_user: CurrentUser,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    service = BudgetService(db)
    return await service.get_budget(current_user, month, year)


@router.patch("/{month}/{year}", response_model=BudgetPublic)
async def update_budget(
    month: int,
    year: int,
    data: BudgetUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    service = BudgetService(db)
    return await service.update_budget(current_user, month, year, data)
