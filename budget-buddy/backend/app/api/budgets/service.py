from sqlalchemy.ext.asyncio import AsyncSession

from app.api.budgets.repository import BudgetRepository
from app.api.budgets.schemas import BudgetCreate, BudgetPublic, BudgetUpdate
from app.core.exceptions import ConflictException, NotFoundException
from app.models.user import User


class BudgetService:
    def __init__(self, db: AsyncSession):
        self.repo = BudgetRepository(db)

    async def create_budget(self, current_user: User, data: BudgetCreate) -> BudgetPublic:
        existing = await self.repo.get_by_month(current_user.id, data.month, data.year)
        if existing:
            raise ConflictException(f"Budget already exists for {data.month}/{data.year}")

        budget = await self.repo.create(
            user_id=current_user.id, month=data.month, year=data.year, amount=data.amount
        )
        spent = await self.repo.get_monthly_spent(current_user.id, data.month, data.year)
        return BudgetPublic(
            id=budget.id,
            user_id=budget.user_id,
            month=budget.month,
            year=budget.year,
            amount=float(budget.amount),
            spent=spent,
            remaining=max(0.0, float(budget.amount) - spent),
        )

    async def get_budget(self, current_user: User, month: int, year: int) -> BudgetPublic:
        budget = await self.repo.get_by_month(current_user.id, month, year)
        if not budget:
            raise NotFoundException(f"No budget found for {month}/{year}")
        spent = await self.repo.get_monthly_spent(current_user.id, month, year)
        return BudgetPublic(
            id=budget.id,
            user_id=budget.user_id,
            month=budget.month,
            year=budget.year,
            amount=float(budget.amount),
            spent=spent,
            remaining=max(0.0, float(budget.amount) - spent),
        )

    async def list_budgets(self, current_user: User) -> list[BudgetPublic]:
        budgets = await self.repo.get_all(current_user.id)
        result = []
        for b in budgets:
            spent = await self.repo.get_monthly_spent(current_user.id, b.month, b.year)
            result.append(
                BudgetPublic(
                    id=b.id,
                    user_id=b.user_id,
                    month=b.month,
                    year=b.year,
                    amount=float(b.amount),
                    spent=spent,
                    remaining=max(0.0, float(b.amount) - spent),
                )
            )
        return result

    async def update_budget(self, current_user: User, month: int, year: int, data: BudgetUpdate) -> BudgetPublic:
        budget = await self.repo.get_by_month(current_user.id, month, year)
        if not budget:
            raise NotFoundException(f"No budget found for {month}/{year}")
        updated = await self.repo.update(budget, data.amount)
        spent = await self.repo.get_monthly_spent(current_user.id, month, year)
        return BudgetPublic(
            id=updated.id,
            user_id=updated.user_id,
            month=updated.month,
            year=updated.year,
            amount=float(updated.amount),
            spent=spent,
            remaining=max(0.0, float(updated.amount) - spent),
        )

    async def get_summary(self, current_user: User, month: int, year: int) -> dict:
        budget = await self.repo.get_by_month(current_user.id, month, year)
        amount = float(budget.amount) if budget else 0.0
        
        spent = await self.repo.get_monthly_spent(current_user.id, month, year)
        category_spent = await self.repo.get_monthly_spent_by_category(current_user.id, month, year)
        
        net_balance = await self.repo.get_monthly_net_balance(current_user.id, month, year)
        
        remaining = max(0.0, amount - spent)
        pct = (spent / amount) * 100 if amount > 0 else 0.0

        return {
            "month": month,
            "year": year,
            "total_budget": amount,
            "total_spent": spent,
            "monthly_net_balance": net_balance,
            "net_spent": spent,
            "remaining": remaining,
            "percentage_used": round(pct, 2),
            "is_over_budget": spent > amount and amount > 0,
            "categories": category_spent,
        }

