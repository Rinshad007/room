from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from langgraph.types import interrupt
from app.dependencies.firebase import get_user_expenses, delete_user_expense


@tool
def delete_expense(expense_id: str, *, config: RunnableConfig) -> str:
    """Delete an existing expense record from Budget Buddy Firebase database. This action requires human approval.
    Args:
        expense_id: The unique ID of the expense to delete.
    """
    configurable = config.get("configurable", {}) if config else {}
    user_id = str(configurable.get("user_id") or configurable.get("thread_id") or "demo_user")
    expense_id_str = str(expense_id).strip()

    expenses = get_user_expenses(user_id)
    expense = next((e for e in expenses if str(e.get("id")) == expense_id_str), None)

    if not expense:
        return f"Expense #{expense_id_str} not found or not owned by you."

    # Request user confirmation through Human-in-the-Loop
    decision = interrupt({
        "name": "delete_expense",
        "args": {
            "expense_id": expense_id_str,
            "title": expense.get("title"),
            "amount": expense.get("amount"),
        },
        "description": f"Are you sure you want to delete expense #{expense_id_str} ('{expense.get('title')}', ₹{expense.get('amount')})?",
    })

    is_approved = decision == "approve" or (isinstance(decision, dict) and decision.get("action") == "approve")
    if not is_approved:
        return f"Deletion of expense #{expense_id_str} was rejected."

    success = delete_user_expense(user_id=user_id, expense_id=expense_id_str)
    if not success:
        return f"Failed to delete expense #{expense_id_str} in Firebase."

    return f"Expense #{expense_id_str} ('{expense.get('title')}', ₹{expense.get('amount')}) was deleted successfully from Budget Buddy."
