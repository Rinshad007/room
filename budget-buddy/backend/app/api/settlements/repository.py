from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.settlement import Settlement

class SettlementRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        payer_id: str,
        receiver_id: str,
        amount: float,
        payment_method: str,
        status: str = "pending",
    ) -> Settlement:
        s = Settlement(
            payer_id=payer_id,
            receiver_id=receiver_id,
            amount=amount,
            payment_method=payment_method,
            status=status,
            settled_at=datetime.now(timezone.utc) if status == "completed" else None,
        )
        self.db.add(s)
        await self.db.commit()
        return s

    async def get_by_id(self, settlement_id: str) -> Optional[Settlement]:
        return await self.db.get(Settlement, settlement_id)

    async def complete(self, settlement: Settlement) -> Settlement:
        settled_at = datetime.now(timezone.utc)
        settlement.status = "completed"
        settlement.settled_at = settled_at
        self.db.add(settlement)
        await self.db.commit()
        return settlement

    async def get_user_settlements(self, user_id: str) -> list[Settlement]:
        stmt = select(Settlement).where(
            or_(
                Settlement.payer_id == user_id,
                Settlement.receiver_id == user_id
            )
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
