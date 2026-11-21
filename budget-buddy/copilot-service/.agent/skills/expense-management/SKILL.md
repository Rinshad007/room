---
name: expense-management
description: Manage CRUD expense operations through tool-calling with parameter extraction and transaction validation.
---

# Expense Management Skill

## Intent Recognition
- **Add Intent**: "Spent 300 on pizza", "Bought petrol for 500", "Paid electricity bill 1400".
  - Tool: `add_expense`
  - Parameters: `title: str`, `amount: float`, `category: str`.
- **Fetch Intent**: "Show my expenses", "List my food spending this week", "What did I buy yesterday?".
  - Tool: `fetch_expenses`
  - Parameters: `limit: int = 10`, `offset: int = 0`.
- **Edit Intent**: "Change my last coffee expense to 80", "Update expense 12 title to Subway".
  - Tool: `edit_expense`
  - Requires HITL approval from the client.
- **Delete Intent**: "Delete my last expense", "Remove expense id 45".
  - Tool: `delete_expense`
  - Requires HITL approval from the client.
