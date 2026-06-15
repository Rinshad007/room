from datetime import date, datetime
from typing import Optional, Literal
from pydantic import BaseModel, Field, model_validator


CATEGORIES = Literal["Food", "Travel", "Shopping", "Rent", "Entertainment", "Others"]
PAYMENT_METHODS = Literal["GPay", "Cash"]
SPLIT_TYPES = Literal["equal", "percentage", "custom"]
SPLIT_STATUS = Literal["pending", "accepted", "disputed"]


class SplitEntry(BaseModel):
    user_id: str
    value: float  # amount for custom, percentage for percentage split


class ExpenseCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    amount: float = Field(..., gt=0)
    payment_method: PAYMENT_METHODS = "Cash"
    category: CATEGORIES = "Others"
    split_type: SPLIT_TYPES = "equal"
    group_id: Optional[str] = None
    expense_date: date = Field(default_factory=date.today)
    participants: list[str] = Field(..., min_length=1, description="List of user IDs to split with")
    # For percentage/custom splits — list of {user_id, value}
    split_details: Optional[list[SplitEntry]] = None

    @model_validator(mode="after")
    def validate_splits(self) -> "ExpenseCreate":
        if self.split_type in ("percentage", "custom") and not self.split_details:
            raise ValueError(f"split_details is required for {self.split_type} split type")

        if self.split_type == "percentage" and self.split_details:
            total = sum(e.value for e in self.split_details)
            if abs(total - 100.0) > 0.01:
                raise ValueError("Percentage splits must sum to 100")

        if self.split_type == "custom" and self.split_details:
            total = sum(e.value for e in self.split_details)
            if abs(total - self.amount) > 0.01:
                raise ValueError("Custom split amounts must sum to the total expense amount")

        return self


class ExpenseSplitPublic(BaseModel):
    id: str
    user_id: str
    share_amount: float
    status: str

    model_config = {"from_attributes": True}


class ExpensePublic(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    amount: float
    paid_by: str
    payment_method: str
    category: str
    split_type: str
    group_id: Optional[str] = None
    expense_date: date
    created_at: datetime
    splits: list[ExpenseSplitPublic] = []

    model_config = {"from_attributes": True}


class ExpenseListResponse(BaseModel):
    expenses: list[ExpensePublic]
    total: int


class UpdateSplitStatus(BaseModel):
    status: SPLIT_STATUS
