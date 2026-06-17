from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select, func, extract
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.budget import Budget
from app.models.expense import Expense, ExpenseSplit

class BudgetRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: str, month: int, year: int, amount: float) -> Budget:
        budget = Budget(user_id=user_id, month=month, year=year, amount=amount)
        self.db.add(budget)
        await self.db.commit()
        return budget

    async def get_by_month(self, user_id: str, month: int, year: int) -> Optional[Budget]:
        stmt = select(Budget).where(Budget.user_id == user_id, Budget.month == month, Budget.year == year)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def get_all(self, user_id: str) -> list[Budget]:
        stmt = select(Budget).where(Budget.user_id == user_id).order_by(Budget.year.desc(), Budget.month.desc())
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update(self, budget: Budget, amount: float) -> Budget:
        budget.amount = amount
        budget.updated_at = datetime.now(timezone.utc)
        self.db.add(budget)
        await self.db.commit()
        return budget

    async def get_monthly_spent(self, user_id: str, month: int, year: int) -> float:
        """Sum of expense splits share_amount for given month (accepted splits only)."""
        stmt = (
            select(func.sum(ExpenseSplit.share_amount))
            .join(Expense)
            .where(
                ExpenseSplit.user_id == user_id,
                ExpenseSplit.status == "accepted",
                extract("month", Expense.expense_date) == month,
                extract("year", Expense.expense_date) == year
            )
        )
        result = await self.db.execute(stmt)
        val = result.scalar()
        return float(val) if val is not None else 0.0

    async def get_monthly_spent_by_category(self, user_id: str, month: int, year: int) -> list[dict]:
        """Returns list of {category, spent} for all categories in the given month."""
        stmt = (
            select(Expense.category, func.sum(ExpenseSplit.share_amount).label("total"))
            .join(ExpenseSplit, ExpenseSplit.expense_id == Expense.id)
            .where(
                ExpenseSplit.user_id == user_id,
                ExpenseSplit.status == "accepted",
                extract("month", Expense.expense_date) == month,
                extract("year", Expense.expense_date) == year
            )
            .group_by(Expense.category)
            .order_by(func.sum(ExpenseSplit.share_amount).desc())
        )
        result = await self.db.execute(stmt)
        rows = result.all()
        return [{"category": row.category, "spent": float(row.total)} for row in rows]

