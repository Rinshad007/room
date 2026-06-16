import uuid
from datetime import datetime, timezone
from sqlalchemy import ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base

class Budget(Base):
    __tablename__ = "budgets"
    __table_args__ = (
        UniqueConstraint("user_id", "month", "year", name="uq_user_monthly_budget"),
    )

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    month: Mapped[int] = mapped_column(nullable=False)
    year: Mapped[int] = mapped_column(nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def __init__(self, **kwargs):
        super().__init__()
        self.id = kwargs.get("id") or kwargs.get("_id") or str(uuid.uuid4())
        self.user_id = kwargs.get("user_id")
        self.month = int(kwargs.get("month") or 1)
        self.year = int(kwargs.get("year") or 2026)
        self.amount = float(kwargs.get("amount") or 0.0)
        self.created_at = kwargs.get("created_at") or datetime.now(timezone.utc)
        self.updated_at = kwargs.get("updated_at") or datetime.now(timezone.utc)
