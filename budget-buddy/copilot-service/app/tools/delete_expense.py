from typing import Optional
from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from langgraph.types import interrupt
from sqlmodel import Session, select
from app.dependencies.db import engine
from app.models.expenses_model import ExpenseModel


@tool
def delete_expense(expense_id: int, config: Optional[RunnableConfig] = None) -> str:
    """Delete an existing expense record. This action requires human approval.
    Args:
        expense_id: The unique ID of the expense to delete.
    """
    configurable = config.get("configurable", {}) if config else {}
    user_id = configurable.get("user_id") or configurable.get("thread_id")
    if not user_id:
        return "Error: User is not authenticated."
    user_id = str(user_id)

    with Session(engine) as db:
        expense = db.exec(
            select(ExpenseModel).where(
                ExpenseModel.id == expense_id,
                ExpenseModel.user_id == user_id,
            )
        ).first()

        if not expense:
            return f"Expense #{expense_id} not found or not owned by you."

        # Request user confirmation through Human-in-the-Loop
        decision = interrupt({
            "name": "delete_expense",
            "args": {"expense_id": expense_id, "title": expense.title, "amount": expense.amount},
            "description": f"Are you sure you want to delete expense #{expense_id} ('{expense.title}', ₹{expense.amount})?",
        })

        is_approved = decision == "approve" or (isinstance(decision, dict) and decision.get("action") == "approve")
        if not is_approved:
            return f"Deletion of expense #{expense_id} was rejected."

        db.delete(expense)
        db.commit()
        return f"Expense #{expense_id} ('{expense.title}', ₹{expense.amount}) was deleted successfully."
