from collections import defaultdict
from datetime import datetime, timezone
from langchain.tools import tool
from langchain_core.runnables import RunnableConfig
from app.dependencies.firebase import get_user_expenses


@tool
def expense_insight(*, config: RunnableConfig) -> str:
    """Analyze the user's spending trends, category breakdowns, averages, and monthly changes from Budget Buddy Firebase database.
    Use this tool whenever the user asks for insights, summaries, analytics, or spending advice.
    """
    configurable = config.get("configurable", {}) if config else {}
    user_id = str(configurable.get("user_id") or configurable.get("thread_id") or "demo_user")

    expenses = get_user_expenses(user_id)
    if not expenses:
        return "No expenses recorded in Budget Buddy yet. Start logging expenses to see insights!"

    total_amount = sum(float(e.get("amount") or 0.0) for e in expenses)
    total_count = len(expenses)
    average_amount = round(total_amount / total_count, 2) if total_count > 0 else 0.0

    # Top spending categories
    category_totals = defaultdict(float)
    category_counts = defaultdict(int)
    for e in expenses:
        cat = str(e.get("category") or "Other").strip().capitalize()
        amt = float(e.get("amount") or 0.0)
        category_totals[cat] += amt
        category_counts[cat] += 1

    sorted_categories = sorted(category_totals.items(), key=lambda x: x[1], reverse=True)[:4]
    cat_summary = [
        f"{cat}: ₹{round(tot, 2)} ({category_counts[cat]} items)"
        for cat, tot in sorted_categories
    ]

    # Highest single expense
    highest_expense = max(expenses, key=lambda x: float(x.get("amount") or 0.0))

    # Month-over-month calculation
    now = datetime.now(timezone.utc)
    this_month_prefix = now.strftime("%Y-%m")
    # Previous month
    prev_month_year = now.year if now.month > 1 else now.year - 1
    prev_month_num = now.month - 1 if now.month > 1 else 12
    prev_month_prefix = f"{prev_month_year}-{prev_month_num:02d}"

    this_month_total = 0.0
    prev_month_total = 0.0

    for e in expenses:
        date_str = str(e.get("expense_date") or e.get("created_at") or "")
        amt = float(e.get("amount") or 0.0)
        if date_str.startswith(this_month_prefix):
            this_month_total += amt
        elif date_str.startswith(prev_month_prefix):
            prev_month_total += amt

    diff = round(this_month_total - prev_month_total, 2)
    if prev_month_total > 0:
        pct_change = round((diff / prev_month_total) * 100, 1)
        diff_msg = f"Change from last month: {'+' if diff >= 0 else '-'}₹{abs(diff)} ({'+' if pct_change >= 0 else ''}{pct_change}%)"
    else:
        diff_msg = f"This month's spending: ₹{this_month_total:.2f} (no previous month data to compare)"

    return (
        f"Financial Overview for Budget Buddy User:\n"
        f"- Total Recorded Spending: ₹{round(total_amount, 2)} across {total_count} transactions\n"
        f"- Average Transaction: ₹{average_amount}\n"
        f"- Top Spending Categories: {', '.join(cat_summary)}\n"
        f"- Highest Single Expense: '{highest_expense.get('title')}' at ₹{highest_expense.get('amount')}\n"
        f"- {diff_msg}"
    )
