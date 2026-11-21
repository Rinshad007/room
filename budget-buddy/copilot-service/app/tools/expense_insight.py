from datetime import datetime, timedelta, timezone
from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from sqlmodel import Session, func, select
from app.dependencies.db import engine
from app.models.expenses_model import ExpenseModel


@tool
def expense_insight(*, config: RunnableConfig) -> str:
    """Analyze the user's spending trends, category breakdowns, averages, and monthly changes.
    Use this tool whenever the user asks for insights, summaries, analytics, or spending advice.
    """
    configurable = config.get("configurable", {}) if config else {}
    user_id = str(configurable.get("user_id") or configurable.get("thread_id") or "demo_user")

    with Session(engine) as db:
        expenses = db.exec(
            select(ExpenseModel).where(ExpenseModel.user_id == user_id)
        ).all()

        if not expenses:
            return "No expenses recorded yet. Start logging expenses to see insights!"

        total_amount = sum(e.amount for e in expenses if e.amount is not None)
        total_count = len(expenses)
        average_amount = round(total_amount / total_count, 2) if total_count > 0 else 0.0

        # Top spending categories
        category_breakdown = db.exec(
            select(
                ExpenseModel.category,
                func.sum(ExpenseModel.amount).label("cat_sum"),
                func.count(ExpenseModel.id).label("cat_count"),
            )
            .where(ExpenseModel.user_id == user_id)
            .group_by(ExpenseModel.category)
            .order_by(func.sum(ExpenseModel.amount).desc())
            .limit(4)
        ).all()

        cat_summary = [
            f"{cat}: ₹{round(c_sum, 2)} ({count} items)"
            for cat, c_sum, count in category_breakdown
        ]

        # Highest single expense
        highest_expense = max(expenses, key=lambda x: x.amount or 0.0)

        # Month-over-month calculation
        now = datetime.now(timezone.utc)
        first_of_this_month = datetime(now.year, now.month, 1, tzinfo=timezone.utc)
        first_of_prev_month = (first_of_this_month - timedelta(days=1)).replace(day=1)

        this_month_total = db.exec(
            select(func.coalesce(func.sum(ExpenseModel.amount), 0.0)).where(
                ExpenseModel.user_id == user_id,
                ExpenseModel.date >= first_of_this_month,
            )
        ).one()

        prev_month_total = db.exec(
            select(func.coalesce(func.sum(ExpenseModel.amount), 0.0)).where(
                ExpenseModel.user_id == user_id,
                ExpenseModel.date >= first_of_prev_month,
                ExpenseModel.date < first_of_this_month,
            )
        ).one()

        diff = round(this_month_total - prev_month_total, 2)
        if prev_month_total > 0:
            pct_change = round((diff / prev_month_total) * 100, 1)
            diff_msg = f"Change from last month: {'+' if diff >= 0 else '-'}₹{abs(diff)} ({'+' if pct_change >= 0 else ''}{pct_change}%)"
        else:
            diff_msg = f"This month's spending: ₹{this_month_total:.2f} (no previous month data to compare)"

        return (
            f"Financial Overview for User #{user_id}:\n"
            f"- Total Recorded Spending: ₹{round(total_amount, 2)} across {total_count} transactions\n"
            f"- Average Transaction: ₹{average_amount}\n"
            f"- Top Spending Categories: {', '.join(cat_summary)}\n"
            f"- Highest Single Expense: '{highest_expense.title}' at ₹{highest_expense.amount}\n"
            f"- {diff_msg}"
        )
