from typing import Annotated

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.api.auth.dependencies import CurrentUser
from app.api.settlements.schemas import (
    BalanceDetail,
    SettlementCreate,
    SettlementListResponse,
    SettlementPublic,
)
from app.api.settlements.service import SettlementService
from app.db.session import get_db

router = APIRouter(prefix="/settlements", tags=["Settlements"])


@router.post("/", response_model=SettlementPublic, status_code=201)
async def create_settlement(
    data: SettlementCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    """Record a settlement payment."""
    service = SettlementService(db)
    return await service.create_settlement(current_user, data)


@router.get("/", response_model=SettlementListResponse)
async def list_settlements(
    current_user: CurrentUser,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    """List all settlements for the current user."""
    service = SettlementService(db)
    return await service.list_settlements(current_user)


@router.get("/balances", response_model=BalanceDetail)
async def get_balances(
    current_user: CurrentUser,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    """Get balance summary and per-user breakdown."""
    service = SettlementService(db)
    return await service.get_balance_detail(current_user)


@router.post("/{settlement_id}/approve", response_model=SettlementPublic)
async def approve_settlement(
    settlement_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncIOMotorDatabase, Depends(get_db)],
):
    """Approve a pending settlement payment."""
    service = SettlementService(db)
    return await service.approve_settlement(current_user, settlement_id)
