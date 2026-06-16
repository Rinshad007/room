import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import ForeignKey, Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base

class Settlement(Base):
    __tablename__ = "settlements"

    id: Mapped[str] = mapped_column(primary_key=True, default=lambda: str(uuid.uuid4()))
    payer_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    receiver_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[str] = mapped_column(default="Cash", nullable=False)
    status: Mapped[str] = mapped_column(default="pending", nullable=False)
    settled_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=lambda: datetime.now(timezone.utc))

    def __init__(self, **kwargs):
        super().__init__()
        self.id = kwargs.get("id") or kwargs.get("_id") or str(uuid.uuid4())
        self.payer_id = kwargs.get("payer_id")
        self.receiver_id = kwargs.get("receiver_id")
        self.amount = float(kwargs.get("amount") or 0.0)
        self.payment_method = kwargs.get("payment_method") or "Cash"
        self.status = kwargs.get("status") or "pending"
        self.settled_at = kwargs.get("settled_at")
        self.created_at = kwargs.get("created_at") or datetime.now(timezone.utc)
