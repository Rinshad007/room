from sqlalchemy.ext.asyncio import AsyncSession

from app.api.expenses.repository import ExpenseRepository
from app.api.expenses.schemas import (
    ExpenseCreate,
    ExpenseListResponse,
    ExpensePublic,
    ExpenseSplitPublic,
    UpdateSplitStatus,
)
from app.api.notifications.service import NotificationService
from app.api.users.repository import UserRepository
from app.core.exceptions import ForbiddenException, NotFoundException
from app.core.logging import logger
from app.models.user import User
from app.utils.splits import compute_splits


class ExpenseService:
    def __init__(self, db: AsyncSession):
        self.repo = ExpenseRepository(db)
        self.user_repo = UserRepository(db)
        self.notif_service = NotificationService(db)

    async def create_expense(self, current_user: User, data: ExpenseCreate) -> ExpensePublic:
        expense = await self.repo.create(
            title=data.title,
            description=data.description,
            amount=float(data.amount),
            paid_by=current_user.id,
            payment_method=data.payment_method,
            category=data.category,
            split_type=data.split_type,
            group_id=data.group_id,
            expense_date=data.expense_date,
        )

        # Compute splits
        split_amounts = compute_splits(
            total=float(data.amount),
            split_type=data.split_type,
            participants=data.participants,
            details=data.split_details,
        )

        for user_id, share in split_amounts.items():
            await self.repo.add_split(expense.id, user_id, share)

            # Notify each participant (except the payer)
            if user_id != current_user.id:
                await self.notif_service.create(
                    user_id=user_id,
                    title="New expense added",
                    message=f"{current_user.name} added '{data.title}'. You owe ₹{share:.2f}",
                    notification_type="expense_added",
                )

        expense = await self.repo.get_by_id(expense.id)
        logger.info(f"Expense created: {expense.title} by {current_user.email}")
        return ExpensePublic.model_validate(expense)

    async def get_expense(self, current_user: User, expense_id: str) -> ExpensePublic:
        expense = await self.repo.get_by_id(expense_id)
        if not expense:
            raise NotFoundException("Expense not found")
        # Check user is payer or split participant
        participant_ids = [s.user_id for s in expense.splits]
        if current_user.id != expense.paid_by and current_user.id not in participant_ids:
            raise ForbiddenException("Not authorized to view this expense")
        return ExpensePublic.model_validate(expense)

    async def list_my_expenses(self, current_user: User) -> ExpenseListResponse:
        expenses = await self.repo.get_user_expenses(current_user.id)
        return ExpenseListResponse(
            expenses=[ExpensePublic.model_validate(e) for e in expenses],
            total=len(expenses),
        )

    async def list_group_expenses(self, current_user: User, group_id: str) -> ExpenseListResponse:
        expenses = await self.repo.get_group_expenses(group_id)
        return ExpenseListResponse(
            expenses=[ExpensePublic.model_validate(e) for e in expenses],
            total=len(expenses),
        )

    async def update_split_status(
        self, current_user: User, split_id: str, data: UpdateSplitStatus
    ) -> ExpenseSplitPublic:
        split = await self.repo.get_split(split_id)
        if not split:
            raise NotFoundException("Split not found")
        if split.user_id != current_user.id:
            raise ForbiddenException("Can only update your own splits")

        updated = await self.repo.update_split_status(split, data.status)

        if data.status == "accepted":
            expense = await self.repo.get_by_id(split.expense_id)
            await self.notif_service.create(
                user_id=expense.paid_by,
                title="Expense accepted",
                message=f"{current_user.name} accepted their share of '{expense.title}'",
                notification_type="expense_accepted",
            )

        return ExpenseSplitPublic.model_validate(updated)

    async def delete_expense(self, current_user: User, expense_id: str) -> None:
        expense = await self.repo.get_by_id(expense_id)
        if not expense:
            raise NotFoundException("Expense not found")
        if expense.paid_by != current_user.id:
            raise ForbiddenException("Only the payer can delete this expense")
        await self.repo.delete(expense)
