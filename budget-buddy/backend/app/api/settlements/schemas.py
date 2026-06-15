from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field


class SettlementCreate(BaseModel):
    receiver_id: str
    amount: float = Field(..., gt=0)
    payment_method: Literal["GPay", "Cash"] = "Cash"


class SettlementPublic(BaseModel):
    id: str
    payer_id: str
    receiver_id: str
    amount: float
    payment_method: str
    status: str
    settled_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SettlementListResponse(BaseModel):
    settlements: list[SettlementPublic]
    total: int


class BalanceSummary(BaseModel):
    total_payable: float
    total_receivable: float
    net_balance: float


class UserBalance(BaseModel):
    user_id: str
    balance: float  # positive = they owe me; negative = I owe them


class BalanceDetail(BaseModel):
    summary: BalanceSummary
    per_user: list[UserBalance]
