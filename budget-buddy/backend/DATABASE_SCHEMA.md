# Database Schema — Budget Buddy

## Entity Relationship Overview

```
users ──< friendships >── users
users ──< group_members >── groups
users ──< expenses (paid_by)
expenses ──< expense_splits >── users
users ──< settlements (payer_id, receiver_id)
users ──< budgets
users ──< notifications
groups ──< expenses
```

---

## Tables

### `users`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK, UUID | User identifier |
| name | VARCHAR(100) | NOT NULL | Display name |
| email | VARCHAR(255) | UNIQUE, NOT NULL | Login email |
| password_hash | VARCHAR(255) | NOT NULL | bcrypt hash |
| avatar_url | VARCHAR(500) | NULL | Profile picture URL |
| created_at | TIMESTAMP TZ | NOT NULL | Registration time |
| updated_at | TIMESTAMP TZ | NOT NULL | Last update |

---

### `friendships`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | |
| sender_id | VARCHAR(36) | FK → users.id | Who sent the request |
| receiver_id | VARCHAR(36) | FK → users.id | Who received the request |
| status | VARCHAR(20) | NOT NULL | `pending`, `accepted`, `rejected` |
| created_at | TIMESTAMP TZ | NOT NULL | |
| updated_at | TIMESTAMP TZ | NOT NULL | |

**Indexes**: `sender_id`, `receiver_id`

---

### `groups`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | |
| name | VARCHAR(100) | NOT NULL | Group display name |
| description | TEXT | NULL | Optional description |
| created_by | VARCHAR(36) | FK → users.id | Creator/admin |
| created_at | TIMESTAMP TZ | NOT NULL | |
| updated_at | TIMESTAMP TZ | NOT NULL | |

---

### `group_members`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | |
| group_id | VARCHAR(36) | FK → groups.id CASCADE | |
| user_id | VARCHAR(36) | FK → users.id CASCADE | |
| joined_at | TIMESTAMP TZ | NOT NULL | |

---

### `expenses`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | |
| title | VARCHAR(200) | NOT NULL | Expense name |
| description | TEXT | NULL | Optional notes |
| amount | NUMERIC(12,2) | NOT NULL | Total amount |
| paid_by | VARCHAR(36) | FK → users.id | Payer |
| payment_method | VARCHAR(20) | NOT NULL | `GPay`, `Cash` |
| category | VARCHAR(50) | NOT NULL | `Food`, `Travel`, `Shopping`, `Rent`, `Entertainment`, `Others` |
| split_type | VARCHAR(20) | NOT NULL | `equal`, `percentage`, `custom` |
| group_id | VARCHAR(36) | FK → groups.id NULL | Optional group |
| expense_date | DATE | NOT NULL | When expense occurred |
| created_at | TIMESTAMP TZ | NOT NULL | |
| updated_at | TIMESTAMP TZ | NOT NULL | |

---

### `expense_splits`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | |
| expense_id | VARCHAR(36) | FK → expenses.id CASCADE | |
| user_id | VARCHAR(36) | FK → users.id CASCADE | Person owing |
| share_amount | NUMERIC(12,2) | NOT NULL | Their portion |
| status | VARCHAR(20) | NOT NULL | `pending`, `accepted`, `disputed` |
| created_at | TIMESTAMP TZ | NOT NULL | |
| updated_at | TIMESTAMP TZ | NOT NULL | |

---

### `settlements`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | |
| payer_id | VARCHAR(36) | FK → users.id | Who paid |
| receiver_id | VARCHAR(36) | FK → users.id | Who received |
| amount | NUMERIC(12,2) | NOT NULL | Settlement amount |
| payment_method | VARCHAR(20) | NOT NULL | `GPay`, `Cash` |
| status | VARCHAR(20) | NOT NULL | `pending`, `completed` |
| settled_at | TIMESTAMP TZ | NULL | When completed |
| created_at | TIMESTAMP TZ | NOT NULL | |

---

### `budgets`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | |
| user_id | VARCHAR(36) | FK → users.id CASCADE | Owner |
| month | INTEGER | NOT NULL | 1–12 |
| year | INTEGER | NOT NULL | e.g. 2024 |
| amount | NUMERIC(12,2) | NOT NULL | Budget limit |
| created_at | TIMESTAMP TZ | NOT NULL | |
| updated_at | TIMESTAMP TZ | NOT NULL | |

**Unique**: `(user_id, month, year)`

---

### `notifications`
| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | VARCHAR(36) | PK | |
| user_id | VARCHAR(36) | FK → users.id CASCADE | Recipient |
| title | VARCHAR(200) | NOT NULL | Notification title |
| message | TEXT | NOT NULL | Full message |
| notification_type | VARCHAR(50) | NOT NULL | `friend_request`, `expense_added`, `expense_accepted`, `settlement_completed`, `info` |
| is_read | BOOLEAN | NOT NULL, default false | Read status |
| created_at | TIMESTAMP TZ | NOT NULL | |

---

## Key Relationships

- A **User** can be a **payer** in many Expenses
- A **User** appears in many **ExpenseSplits** (what they owe)
- **Settlements** reduce net balances between user pairs
- **Budgets** track per-user monthly spending limits against actual **ExpenseSplit** amounts
- **Notifications** are created automatically on: expense creation, split acceptance, settlement completion
