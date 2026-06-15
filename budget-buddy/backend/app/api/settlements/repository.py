from datetime import datetime, timezone
from typing import Optional
from app.models.settlement import Settlement

class SettlementRepository:
    def __init__(self, db):
        self.collection = db["settlements"]

    async def create(
        self,
        payer_id: str,
        receiver_id: str,
        amount: float,
        payment_method: str,
    ) -> Settlement:
        s = Settlement(
            payer_id=payer_id,
            receiver_id=receiver_id,
            amount=amount,
            payment_method=payment_method,
            status="pending",
        )
        await self.collection.insert_one({
            "_id": s.id,
            "payer_id": s.payer_id,
            "receiver_id": s.receiver_id,
            "amount": s.amount,
            "payment_method": s.payment_method,
            "status": s.status,
            "settled_at": s.settled_at,
            "created_at": s.created_at
        })
        return s

    async def get_by_id(self, settlement_id: str) -> Optional[Settlement]:
        doc = await self.collection.find_one({"_id": settlement_id})
        return Settlement(**doc) if doc else None

    async def complete(self, settlement: Settlement) -> Settlement:
        settled_at = datetime.now(timezone.utc)
        settlement.status = "completed"
        settlement.settled_at = settled_at
        await self.collection.update_one(
            {"_id": settlement.id},
            {"$set": {"status": "completed", "settled_at": settled_at}}
        )
        return settlement

    async def get_user_settlements(self, user_id: str) -> list[Settlement]:
        cursor = self.collection.find({
            "$or": [
                {"payer_id": user_id},
                {"receiver_id": user_id}
            ]
        })
        docs = await cursor.to_list(length=1000)
        return [Settlement(**doc) for doc in docs]
