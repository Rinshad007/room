# Safety & Human-in-the-Loop (HITL) Standards

## 1. Action Permissions
| Tool Name | Interrupt / Approval Required | Description |
| :--- | :---: | :--- |
| `add_expense` | **No** (Auto-Approved) | Adding a record is safe and needs instant feedback. |
| `fetch_expenses` | **No** (Auto-Approved) | Read-only operation. |
| `expense_insight` | **No** (Auto-Approved) | Read-only statistical calculations. |
| `edit_expense` | **YES** (Requires Approval) | Modifies existing financial records. |
| `delete_expense` | **YES** (Requires Approval) | Permanent deletion of financial data. |

## 2. Interruption Lifecycle
1. When a destructive tool is triggered, the agent issues an interrupt.
2. The API returns an approval request object with an `interrupt_id`.
3. The frontend displays an Action Approval Card.
4. The client submits `POST /approve` with `approve: true` or `approve: false`.
5. The agent resumes with `Command(resume=...)` and completes the action.
