# Architecture — Budget Buddy

## System Design

Budget Buddy follows **Clean Architecture** with layered separation of concerns:

```
┌─────────────────────────────────────────────────┐
│                  HTTP Layer                      │
│          FastAPI Routes (routes.py)              │
└──────────────────┬──────────────────────────────┘
                   │ calls
┌──────────────────▼──────────────────────────────┐
│              Service Layer (service.py)          │
│   Business logic, validation, notifications      │
└──────────────────┬──────────────────────────────┘
                   │ calls
┌──────────────────▼──────────────────────────────┐
│           Repository Layer (repository.py)       │
│     Pure database access — no business logic     │
└──────────────────┬──────────────────────────────┘
                   │ uses
┌──────────────────▼──────────────────────────────┐
│           SQLAlchemy ORM Models (models/)        │
│            Async engine + asyncpg                │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────┐
│              PostgreSQL Database                 │
└─────────────────────────────────────────────────┘
```

---

## Principles Applied

| Principle | How |
|-----------|-----|
| **Single Responsibility** | Each layer (route, service, repo) has one job |
| **Open/Closed** | Services can be extended without modifying routes |
| **Dependency Injection** | `get_db()` injected by FastAPI, services receive `db: AsyncSession` |
| **Repository Pattern** | Data access abstracted behind repository classes |
| **Service Layer Pattern** | Business logic lives in service, not routes or repos |

---

## Authentication Flow

```
1. POST /auth/register → hash password → store User → return JWT pair
2. POST /auth/login    → verify password → return JWT pair
3. Every protected request → Bearer token → decode → get_current_user dependency
4. POST /auth/refresh  → verify refresh token → issue new access token
```

**Tokens:**
- **Access token**: 30 min, type=`access`
- **Refresh token**: 7 days, type=`refresh`
- Algorithm: HS256, signed with `SECRET_KEY`

---

## Expense & Split Flow

```
POST /expenses/
    │
    ▼ Validate split totals (Pydantic validator)
    │
    ▼ Create Expense record
    │
    ▼ compute_splits() → splits.py
    │    ├── equal:      amount / N (remainder to first)
    │    ├── percentage: amount * pct / 100 (rounding-safe)
    │    └── custom:     use provided amounts (must sum)
    │
    ▼ Create ExpenseSplit records (status=pending)
    │
    ▼ Send notifications to participants
```

---

## Balance Calculation Engine

Located in `app/utils/balance.py`.

```
Balance(user) = Σ(accepted splits where they owe someone)
             - Σ(completed settlements where they paid someone)

Per-user:
  net[other] > 0  → they owe the current user
  net[other] < 0  → current user owes them
```

The engine is called **on-the-fly** (no cached balance table), ensuring it always reflects the latest data.

---

## Module Map

```
api/auth/         Register, login, refresh, JWT validation
api/users/        Profile CRUD, user search
api/friends/      Friend request lifecycle (pending→accepted/rejected)
api/groups/       Group CRUD, member management
api/expenses/     Expense creation + split computation + split status
api/settlements/  Payment recording + balance queries
api/budgets/      Monthly budget with real-time spent calculation
api/analytics/    Chart-ready JSON: monthly, category, trends, dashboard
api/notifications/ In-app notification CRUD
utils/splits.py   Pure split math (equal, percentage, custom)
utils/balance.py  Async balance aggregation from DB
```

---

## Error Handling

All errors use custom exception hierarchy from `core/exceptions.py`:

| Exception | HTTP Code | Use Case |
|-----------|-----------|----------|
| `NotFoundException` | 404 | Resource not found |
| `UnauthorizedException` | 401 | Invalid/expired token |
| `ForbiddenException` | 403 | Insufficient permissions |
| `ConflictException` | 409 | Duplicate resource |
| `BadRequestException` | 400 | Invalid input |

Unhandled exceptions return a generic 500 and are logged.

---

## Notification Events

| Trigger | Recipient | Type |
|---------|-----------|------|
| Friend request sent | Receiver | `friend_request` |
| Expense created | Each participant | `expense_added` |
| Split accepted | Expense payer | `expense_accepted` |
| Settlement completed | Receiver | `settlement_completed` |
