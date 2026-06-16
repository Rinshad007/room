from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, or_, extract
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.auth.dependencies import CurrentUser
from app.db.session import get_db
from app.utils.balance import compute_balance_summary
from app.models.expense import Expense, ExpenseSplit

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/dashboard")
async def dashboard_summary(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """High-level dashboard: total expenses, balance summary."""
    # Total distinct expenses user is involved in (paid or split)
    stmt_count = (
        select(func.count(Expense.id.distinct()))
        .outerjoin(ExpenseSplit)
        .where(
            or_(
                Expense.paid_by == current_user.id,
                ExpenseSplit.user_id == current_user.id
            )
        )
    )
    result_count = await db.execute(stmt_count)
    total_expenses = result_count.scalar() or 0

    # Total amount spent (as payer)
    stmt_spent = (
        select(func.sum(Expense.amount))
        .where(Expense.paid_by == current_user.id)
    )
    result_spent = await db.execute(stmt_spent)
    total_spent_val = result_spent.scalar()
    total_spent = float(total_spent_val) if total_spent_val is not None else 0.0

    balance = await compute_balance_summary(db, current_user.id)

    return {
        "total_expenses": total_expenses,
        "total_spent": total_spent,
        **balance,
    }


@router.get("/monthly")
async def monthly_expenses(
    year: int = Query(..., description="Year e.g. 2024"),
    current_user: CurrentUser = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """Monthly expense totals for the given year."""
    stmt = (
        select(
            func.cast(extract("month", Expense.expense_date), func.Integer).label("month"),
            func.sum(ExpenseSplit.share_amount).label("total")
        )
        .join(Expense)
        .where(
            ExpenseSplit.user_id == current_user.id,
            ExpenseSplit.status == "accepted",
            extract("year", Expense.expense_date) == year
        )
        .group_by(extract("month", Expense.expense_date))
    )
    result = await db.execute(stmt)
    rows = result.all()
    monthly = {int(r.month): round(float(r.total), 2) for r in rows}
    
    return {
        "year": year,
        "data": [{"month": m, "total": monthly.get(m, 0.0)} for m in range(1, 13)]
    }


@router.get("/categories")
async def category_breakdown(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020),
    current_user: CurrentUser = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """Category-wise expense breakdown for a given month."""
    stmt = (
        select(
            Expense.category.label("category"),
            func.sum(ExpenseSplit.share_amount).label("total")
        )
        .join(Expense)
        .where(
            ExpenseSplit.user_id == current_user.id,
            ExpenseSplit.status == "accepted",
            extract("year", Expense.expense_date) == year,
            extract("month", Expense.expense_date) == month
        )
        .group_by(Expense.category)
    )
    result = await db.execute(stmt)
    rows = result.all()
    
    return {
        "month": month,
        "year": year,
        "data": [{"category": r.category, "total": round(float(r.total), 2)} for r in rows],
    }


@router.get("/trends")
async def spending_trends(
    months: int = Query(6, ge=1, le=12, description="Number of past months"),
    current_user: CurrentUser = None,
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    """Spending trend over the past N months."""
    stmt = (
        select(
            func.cast(extract("year", Expense.expense_date), func.Integer).label("year"),
            func.cast(extract("month", Expense.expense_date), func.Integer).label("month"),
            func.sum(ExpenseSplit.share_amount).label("total")
        )
        .join(Expense)
        .where(
            ExpenseSplit.user_id == current_user.id,
            ExpenseSplit.status == "accepted"
        )
        .group_by(
            extract("year", Expense.expense_date),
            extract("month", Expense.expense_date)
        )
        .order_by(
            extract("year", Expense.expense_date).asc(),
            extract("month", Expense.expense_date).asc()
        )
        .limit(months)
    )
    result = await db.execute(stmt)
    rows = result.all()
    
    return {
        "data": [
            {"year": int(r.year), "month": int(r.month), "total": round(float(r.total), 2)}
            for r in rows
        ]
    }
