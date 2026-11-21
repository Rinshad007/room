from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from sqlmodel import Session, select
from app.dependencies.db import engine
from app.models.expenses_model import ExpenseModel


@tool
def fetch_expenses(limit: int = 10, offset: int = 0, *, config: RunnableConfig) -> str:
    """Fetch the authenticated user's recorded expenses with pagination."""
    configurable = config.get("configurable", {}) if config else {}
    user_id = str(configurable.get("user_id") or configurable.get("thread_id") or "demo_user")

    with Session(engine) as db:
        expenses = db.exec(
            select(ExpenseModel)
            .where(ExpenseModel.user_id == user_id)
            .order_by(ExpenseModel.date.desc())
            .offset(offset)
            .limit(limit)
        ).all()

        if not expenses:
            return "No expenses found."

        serialized = [
            {
                "id": e.id,
                "title": e.title,
                "amount": e.amount,
                "category": e.category,
                "date": e.date.strftime("%Y-%m-%d %H:%M") if e.date else None,
            }
            for e in expenses
        ]
        return f"Expenses found: {serialized}"
