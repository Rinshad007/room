import uuid
from datetime import datetime, date, timezone
from typing import Optional
from app.models.expense import Expense, ExpenseSplit

class ExpenseRepository:
    def __init__(self, db):
        self.db = db
        self.collection = db["expenses"]

    async def create(self, **kwargs) -> Expense:
        expense = Expense(**kwargs)
        # Convert date to datetime if necessary for MongoDB serialization
        exp_date = expense.expense_date
        if isinstance(exp_date, date) and not isinstance(exp_date, datetime):
            exp_date = datetime.combine(exp_date, datetime.min.time())
        await self.collection.insert_one({
            "_id": expense.id,
            "title": expense.title,
            "description": expense.description,
            "amount": expense.amount,
            "paid_by": expense.paid_by,
            "payment_method": expense.payment_method,
            "category": expense.category,
            "split_type": expense.split_type,
            "group_id": expense.group_id,
            "expense_date": exp_date,
            "created_at": expense.created_at,
            "updated_at": expense.updated_at,
            "splits": []
        })
        return expense

    async def add_split(
        self, expense_id: str, user_id: str, share_amount: float
    ) -> ExpenseSplit:
        split_id = str(uuid.uuid4())
        split = ExpenseSplit(
            id=split_id,
            expense_id=expense_id,
            user_id=user_id,
            share_amount=share_amount,
            status="pending"
        )
        await self.collection.update_one(
            {"_id": expense_id},
            {"$push": {"splits": {
                "id": split_id,
                "expense_id": expense_id,
                "user_id": user_id,
                "share_amount": share_amount,
                "status": "pending",
                "created_at": split.created_at,
                "updated_at": split.updated_at
            }}}
        )
        return split

    async def get_by_id(self, expense_id: str) -> Optional[Expense]:
        doc = await self.collection.find_one({"_id": expense_id})
        if not doc:
            return None
        expense = Expense(**doc)
        expense.splits = [ExpenseSplit(**s) for s in doc.get("splits", [])]
        return expense

    async def get_user_expenses(self, user_id: str) -> list[Expense]:
        cursor = self.collection.find({
            "$or": [
                {"paid_by": user_id},
                {"splits.user_id": user_id}
            ]
        })
        docs = await cursor.to_list(length=1000)
        expenses = []
        for doc in docs:
            expense = Expense(**doc)
            expense.splits = [ExpenseSplit(**s) for s in doc.get("splits", [])]
            expenses.append(expense)
        return expenses

    async def get_group_expenses(self, group_id: str) -> list[Expense]:
        cursor = self.collection.find({"group_id": group_id})
        docs = await cursor.to_list(length=1000)
        expenses = []
        for doc in docs:
            expense = Expense(**doc)
            expense.splits = [ExpenseSplit(**s) for s in doc.get("splits", [])]
            expenses.append(expense)
        return expenses

    async def get_split(self, split_id: str) -> Optional[ExpenseSplit]:
        doc = await self.collection.find_one({"splits.id": split_id})
        if doc:
            for s in doc.get("splits", []):
                if s["id"] == split_id:
                    return ExpenseSplit(**s)
        return None

    async def update_split_status(self, split: ExpenseSplit, status: str) -> ExpenseSplit:
        split.status = status
        await self.collection.update_one(
            {"splits.id": split.id},
            {"$set": {
                "splits.$.status": status,
                "splits.$.updated_at": datetime.now(timezone.utc)
            }}
        )
        return split

    async def delete(self, expense: Expense) -> None:
        await self.collection.delete_one({"_id": expense.id})
