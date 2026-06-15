from datetime import datetime, timezone
from typing import Optional
from app.models.budget import Budget

class BudgetRepository:
    def __init__(self, db):
        self.db = db
        self.collection = db["budgets"]

    async def create(self, user_id: str, month: int, year: int, amount: float) -> Budget:
        budget = Budget(user_id=user_id, month=month, year=year, amount=amount)
        await self.collection.insert_one({
            "_id": budget.id,
            "user_id": budget.user_id,
            "month": budget.month,
            "year": budget.year,
            "amount": budget.amount,
            "created_at": budget.created_at,
            "updated_at": budget.updated_at
        })
        return budget

    async def get_by_month(self, user_id: str, month: int, year: int) -> Optional[Budget]:
        doc = await self.collection.find_one({"user_id": user_id, "month": month, "year": year})
        return Budget(**doc) if doc else None

    async def get_all(self, user_id: str) -> list[Budget]:
        cursor = self.collection.find({"user_id": user_id}).sort([("year", -1), ("month", -1)])
        docs = await cursor.to_list(length=1000)
        return [Budget(**doc) for doc in docs]

    async def update(self, budget: Budget, amount: float) -> Budget:
        budget.amount = amount
        await self.collection.update_one(
            {"_id": budget.id},
            {"$set": {"amount": amount, "updated_at": datetime.now(timezone.utc)}}
        )
        return budget

    async def get_monthly_spent(self, user_id: str, month: int, year: int) -> float:
        """Sum of expense splits share_amount for given month (accepted splits only)."""
        pipeline = [
            {
                "$match": {
                    "splits": {
                        "$elemMatch": {
                            "user_id": user_id,
                            "status": "accepted"
                        }
                    }
                }
            },
            {
                "$project": {
                    "year": {"$year": "$expense_date"},
                    "month": {"$month": "$expense_date"},
                    "splits": 1
                }
            },
            {
                "$match": {
                    "year": year,
                    "month": month
                }
            },
            {
                "$unwind": "$splits"
            },
            {
                "$match": {
                    "splits.user_id": user_id,
                    "splits.status": "accepted"
                }
            },
            {
                "$group": {
                    "_id": None,
                    "total": {"$sum": "$splits.share_amount"}
                }
            }
        ]
        cursor = self.db["expenses"].aggregate(pipeline)
        result = await cursor.to_list(length=1)
        if result:
            return float(result[0]["total"])
        return 0.0
