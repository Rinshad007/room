from typing import Optional
from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from langgraph.types import interrupt
from sqlmodel import Session, select
from app.dependencies.db import engine
from app.models.expenses_model import ExpenseModel


@tool
def edit_expense(
    expense_id: int,
    title: str,
    amount: float,
    category: str,
    config: Optional[RunnableConfig] = None,
) -> str:
    """Edit an existing expense record. This action requires human approval.
    Args:
        expense_id: The ID of the expense to edit.
        title: The updated title.
        amount: The updated positive amount.
        category: The updated category.
    """
    configurable = config.get("configurable", {}) if config else {}
    user_id = configurable.get("user_id")
    if user_id is None and str(configurable.get("thread_id", "")).isdigit():
        user_id = int(configurable["thread_id"])
    if user_id is None:
        return "Error: User is not authenticated."

    with Session(engine) as db:
        expense = db.exec(
            select(ExpenseModel).where(
                ExpenseModel.id == expense_id,
                ExpenseModel.user_id == user_id,
            )
        ).first()

        if not expense:
            return f"Expense with ID #{expense_id} not found or not owned by you."

        # Request user confirmation through Human-in-the-Loop
        decision = interrupt({
            "name": "edit_expense",
            "args": {
                "expense_id": expense_id,
                "old_title": expense.title,
                "new_title": title,
                "old_amount": expense.amount,
                "new_amount": amount,
                "category": category,
            },
            "description": f"Are you sure you want to update expense #{expense_id} to '{title}', ₹{amount} under {category}?",
        })

        is_approved = decision == "approve" or (isinstance(decision, dict) and decision.get("action") == "approve")
        if not is_approved:
            return f"Update of expense #{expense_id} was rejected."

        expense.title = title.strip()
        expense.amount = round(float(amount), 2)
        expense.category = category.strip().capitalize()
        db.add(expense)
        db.commit()
        return f"Expense #{expense_id} successfully updated to '{expense.title}', ₹{expense.amount} under {expense.category}."
