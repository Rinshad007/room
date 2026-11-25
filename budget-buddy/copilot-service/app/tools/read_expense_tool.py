from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from app.dependencies.firebase import get_user_expenses


@tool
def fetch_expenses(limit: int = 10, offset: int = 0, *, config: RunnableConfig) -> str:
    """Fetch the authenticated user's recorded expenses from Firebase RTDB with pagination."""
    configurable = config.get("configurable", {}) if config else {}
    user_id = str(configurable.get("user_id") or configurable.get("thread_id") or "demo_user")

    user_expenses = get_user_expenses(user_id)
    if not user_expenses:
        return "No expenses found in Budget Buddy."

    paged = user_expenses[offset : offset + limit]
    if not paged:
        return "No expenses found for this page."

    serialized = [
        {
            "id": e.get("id"),
            "title": e.get("title"),
            "amount": e.get("amount"),
            "category": e.get("category"),
            "date": (e.get("expense_date") or e.get("created_at") or "")[:16].replace("T", " "),
        }
        for e in paged
    ]
    return f"Expenses found: {serialized}"
