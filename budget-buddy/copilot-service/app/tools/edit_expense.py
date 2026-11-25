from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from langgraph.types import interrupt
from app.dependencies.firebase import get_user_expenses, update_user_expense


@tool
def edit_expense(
    expense_id: str,
    title: str,
    amount: float,
    category: str,
    *,
    config: RunnableConfig,
) -> str:
    """Edit an existing expense record in Budget Buddy Firebase database. This action requires human approval.
    Args:
        expense_id: The ID of the expense to edit.
        title: The updated title.
        amount: The updated positive amount.
        category: The updated category.
    """
    configurable = config.get("configurable", {}) if config else {}
    user_id = str(configurable.get("user_id") or configurable.get("thread_id") or "demo_user")
    expense_id_str = str(expense_id).strip()

    expenses = get_user_expenses(user_id)
    expense = next((e for e in expenses if str(e.get("id")) == expense_id_str), None)

    if not expense:
        return f"Expense with ID #{expense_id_str} not found or not owned by you."

    # Request user confirmation through Human-in-the-Loop
    decision = interrupt({
        "name": "edit_expense",
        "args": {
            "expense_id": expense_id_str,
            "old_title": expense.get("title"),
            "new_title": title,
            "old_amount": expense.get("amount"),
            "new_amount": amount,
            "category": category,
        },
        "description": f"Are you sure you want to update expense #{expense_id_str} to '{title}', ₹{amount} under {category}?",
    })

    is_approved = decision == "approve" or (isinstance(decision, dict) and decision.get("action") == "approve")
    if not is_approved:
        return f"Update of expense #{expense_id_str} was rejected."

    updated = update_user_expense(
        user_id=user_id,
        expense_id=expense_id_str,
        updates={"title": title, "amount": amount, "category": category},
    )
    if not updated:
        return f"Failed to update expense #{expense_id_str} in Firebase."

    return f"Expense #{expense_id_str} successfully updated to '{updated.get('title')}', ₹{updated.get('amount')} under {updated.get('category')}."
