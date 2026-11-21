from datetime import datetime, timezone
from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from sqlmodel import Session
from app.dependencies.db import engine
from app.models.expenses_model import ExpenseModel

VALID_CATEGORIES = {
    "Food", "Transport", "Shopping", "Bills",
    "Entertainment", "Health", "Education", "Other",
}


@tool
def add_expense(
    title: str,
    amount: float,
    category: str = "Other",
    *,
    config: RunnableConfig,
) -> str:
    """Record a new expense.
    Args:
        title: Short name of the expense (e.g. Biriyani, Petrol, Electricity Bill).
        amount: Numerical amount spent (must be positive, e.g. 230, 500.5).
        category: Category (Food, Transport, Shopping, Bills, Entertainment, Health, Education, Other).
    """
    configurable = config.get("configurable", {}) if config else {}
    user_id = str(configurable.get("user_id") or configurable.get("thread_id") or "demo_user")

    if amount <= 0:
        return "Error: Expense amount must be greater than zero."

    normalized_category = category.strip().capitalize()
    if normalized_category not in VALID_CATEGORIES:
        matched = next((c for c in VALID_CATEGORIES if c.lower() == category.strip().lower()), "Other")
        normalized_category = matched

    with Session(engine) as db:
        item = ExpenseModel(
            user_id=user_id,
            title=title.strip(),
            amount=round(float(amount), 2),
            category=normalized_category,
            date=datetime.now(timezone.utc),
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return f"Added ₹{item.amount:.2f} for '{item.title}' under {item.category} (ID: {item.id})."
