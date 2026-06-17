from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, computed_field


class BudgetCreate(BaseModel):
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2020)
    amount: float = Field(..., gt=0)


class BudgetPublic(BaseModel):
    id: str
    user_id: str
    month: int
    year: int
    amount: float
    spent: float = 0.0
    remaining: float = 0.0

    model_config = {"from_attributes": True}


class BudgetUpdate(BaseModel):
    amount: float = Field(..., gt=0)


class CategorySpend(BaseModel):
    category: str
    spent: float


class BudgetSummary(BaseModel):
    month: int
    year: int
    total_budget: float
    total_spent: float
    remaining: float
    percentage_used: float
    is_over_budget: bool
    categories: List[CategorySpend]

