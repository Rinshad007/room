from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.auth.dependencies import CurrentUser
from app.api.expenses.schemas import (
    ExpenseCreate,
    ExpenseListResponse,
    ExpensePublic,
    ExpenseSplitPublic,
    UpdateSplitStatus,
)
from app.api.expenses.service import ExpenseService
from app.db.session import get_db

router = APIRouter(prefix="/expenses", tags=["Expenses"])


@router.post("/", response_model=ExpensePublic, status_code=201)
async def create_expense(
    data: ExpenseCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    """Create a new expense with automatic split calculation."""
    service = ExpenseService(db)
    return await service.create_expense(current_user, data)


@router.get("/", response_model=ExpenseListResponse)
async def list_my_expenses(
    current_user: CurrentUser,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    """List all expenses where the user is a payer or participant."""
    service = ExpenseService(db)
    return await service.list_my_expenses(current_user)


@router.get("/group/{group_id}", response_model=ExpenseListResponse)
async def list_group_expenses(
    group_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    """List all expenses for a specific group."""
    service = ExpenseService(db)
    return await service.list_group_expenses(current_user, group_id)


@router.get("/{expense_id}", response_model=ExpensePublic)
async def get_expense(
    expense_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    """Get a single expense by ID."""
    service = ExpenseService(db)
    return await service.get_expense(current_user, expense_id)


@router.delete("/{expense_id}", status_code=204)
async def delete_expense(
    expense_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    """Delete an expense (payer only)."""
    service = ExpenseService(db)
    await service.delete_expense(current_user, expense_id)


@router.patch("/splits/{split_id}/status", response_model=ExpenseSplitPublic)
async def update_split_status(
    split_id: str,
    data: UpdateSplitStatus,
    current_user: CurrentUser,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    """Accept or dispute your share of an expense."""
    service = ExpenseService(db)
    return await service.update_split_status(current_user, split_id, data)
