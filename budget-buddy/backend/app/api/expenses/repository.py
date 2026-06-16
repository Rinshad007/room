from datetime import datetime, date, timezone
from typing import Optional
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.expense import Expense, ExpenseSplit

class ExpenseRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> Expense:
        expense = Expense(**kwargs)
        self.db.add(expense)
        await self.db.commit()
        return await self.get_by_id(expense.id)

    async def add_split(
        self, expense_id: str, user_id: str, share_amount: float
    ) -> ExpenseSplit:
        split = ExpenseSplit(
            expense_id=expense_id,
            user_id=user_id,
            share_amount=share_amount,
            status="pending"
        )
        self.db.add(split)
        await self.db.commit()
        return split

    async def get_by_id(self, expense_id: str) -> Optional[Expense]:
        from sqlalchemy.orm import selectinload
        stmt = (
            select(Expense)
            .where(Expense.id == expense_id)
            .options(selectinload(Expense.splits))
        )
        result = await self.db.execute(stmt)
        expense = result.scalars().first()
        if expense:
            await self.db.refresh(expense, ["splits"])
        return expense

    async def get_user_expenses(self, user_id: str) -> list[Expense]:
        stmt = (
            select(Expense)
            .outerjoin(ExpenseSplit)
            .where(
                or_(
                    Expense.paid_by == user_id,
                    ExpenseSplit.user_id == user_id
                )
            )
            .distinct()
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_group_expenses(self, group_id: str) -> list[Expense]:
        stmt = select(Expense).where(Expense.group_id == group_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_split(self, split_id: str) -> Optional[ExpenseSplit]:
        return await self.db.get(ExpenseSplit, split_id)

    async def update_split_status(self, split: ExpenseSplit, status: str) -> ExpenseSplit:
        split.status = status
        split.updated_at = datetime.now(timezone.utc)
        self.db.add(split)
        await self.db.commit()
        return split

    async def delete(self, expense: Expense) -> None:
        await self.db.delete(expense)
        await self.db.commit()
