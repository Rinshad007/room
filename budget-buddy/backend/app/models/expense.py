import uuid
from datetime import datetime, date, timezone
from typing import Optional, List
from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base

class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    title: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[Optional[str]] = mapped_column(nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    paid_by: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    payment_method: Mapped[str] = mapped_column(default="Cash", nullable=False)
    category: Mapped[str] = mapped_column(default="Others", nullable=False)
    split_type: Mapped[str] = mapped_column(default="equal", nullable=False)
    group_id: Mapped[Optional[str]] = mapped_column(ForeignKey("groups.id", ondelete="SET NULL"), nullable=True)
    expense_date: Mapped[date] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    splits: Mapped[List["ExpenseSplit"]] = relationship(
        back_populates="expense", cascade="all, delete-orphan", lazy="selectin"
    )

    def __init__(self, **kwargs):
        super().__init__()
        self.id = kwargs.get("id") or kwargs.get("_id") or str(uuid.uuid4())
        self.title = kwargs.get("title")
        self.description = kwargs.get("description")
        self.amount = float(kwargs.get("amount") or 0.0)
        self.paid_by = kwargs.get("paid_by")
        self.payment_method = kwargs.get("payment_method") or "Cash"
        self.category = kwargs.get("category") or "Others"
        self.split_type = kwargs.get("split_type") or "equal"
        self.group_id = kwargs.get("group_id")
        
        raw_date = kwargs.get("expense_date")
        if isinstance(raw_date, str):
            try:
                self.expense_date = date.fromisoformat(raw_date.split("T")[0])
            except ValueError:
                self.expense_date = date.today()
        elif isinstance(raw_date, datetime):
            self.expense_date = raw_date.date()
        elif isinstance(raw_date, date):
            self.expense_date = raw_date
        else:
            self.expense_date = date.today()
            
        self.created_at = kwargs.get("created_at") or datetime.now(timezone.utc)
        self.updated_at = kwargs.get("updated_at") or datetime.now(timezone.utc)
        if "splits" in kwargs:
            self.splits = kwargs["splits"]

class ExpenseSplit(Base):
    __tablename__ = "expense_splits"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    expense_id: Mapped[str] = mapped_column(ForeignKey("expenses.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    share_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    expense: Mapped["Expense"] = relationship(back_populates="splits")

    def __init__(self, **kwargs):
        super().__init__()
        self.id = kwargs.get("id") or kwargs.get("_id") or str(uuid.uuid4())
        self.expense_id = kwargs.get("expense_id")
        self.user_id = kwargs.get("user_id")
        self.share_amount = float(kwargs.get("share_amount") or 0.0)
        self.status = kwargs.get("status") or "pending"
        self.created_at = kwargs.get("created_at") or datetime.now(timezone.utc)
        self.updated_at = kwargs.get("updated_at") or datetime.now(timezone.utc)
