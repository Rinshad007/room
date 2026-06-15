# Budget Buddy — Backend

A production-ready Bill Splitter & Budget Management REST API built with **FastAPI + PostgreSQL**, inspired by Splitwise.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.11+ (3.14 supported)
- PostgreSQL 15+
- Docker & Docker Compose (optional)

### Option 1 — Docker (Recommended)

```bash
cd backend
docker-compose up --build
```

API will be available at `http://localhost:8000`  
Swagger docs at `http://localhost:8000/docs`

### Option 2 — Local Development

```bash
cd backend

# 1. Create virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate    # Linux/Mac

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy env file
copy .env.example .env         # Windows
# cp .env.example .env         # Linux/Mac

# 4. Create PostgreSQL database
# (start PostgreSQL and create database named budget_buddy)

# 5. Run migrations
alembic upgrade head

# 6. Start the server
uvicorn app.main:app --reload
```

---

## 📁 Project Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── auth/           # Authentication (register, login, JWT)
│   │   ├── users/          # User profiles & search
│   │   ├── friends/        # Friend requests & management
│   │   ├── groups/         # Group management
│   │   ├── expenses/       # Expense creation with splits
│   │   ├── settlements/    # Payments & balance engine
│   │   ├── budgets/        # Monthly budget tracking
│   │   ├── analytics/      # Charts & reporting APIs
│   │   └── notifications/  # In-app notifications
│   ├── models/             # SQLAlchemy ORM models
│   ├── core/               # Config, security, logging, exceptions
│   ├── db/                 # Database session & base
│   └── utils/              # Split engine, balance calculator
├── alembic/                # Database migrations
├── tests/                  # Pytest test suite
├── .env                    # Environment variables
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

---

## 🔑 API Endpoints

### Authentication (`/api/v1/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register new user |
| POST | `/login` | Login with email & password |
| POST | `/refresh` | Refresh access token |
| POST | `/logout` | Logout (client-side) |
| GET | `/me` | Get current user |

### Users (`/api/v1/users`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/me` | My profile |
| PATCH | `/me` | Update profile |
| GET | `/search?q=...` | Search users |
| GET | `/{id}` | Get user by ID |

### Friends (`/api/v1/friends`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List friends |
| POST | `/request` | Send friend request |
| GET | `/pending` | Pending requests |
| POST | `/{id}/accept` | Accept request |
| POST | `/{id}/reject` | Reject request |
| DELETE | `/{id}` | Remove friend |

### Groups (`/api/v1/groups`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | My groups |
| POST | `/` | Create group |
| GET | `/{id}` | Get group |
| PATCH | `/{id}` | Update group |
| DELETE | `/{id}` | Delete group |
| POST | `/{id}/members` | Add member |
| DELETE | `/{id}/members/{uid}` | Remove member |

### Expenses (`/api/v1/expenses`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create expense (with auto-split) |
| GET | `/` | My expenses |
| GET | `/{id}` | Get expense |
| GET | `/group/{group_id}` | Group expenses |
| DELETE | `/{id}` | Delete expense |
| PATCH | `/splits/{id}/status` | Accept or dispute split |

### Settlements (`/api/v1/settlements`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Record settlement |
| GET | `/` | My settlements |
| GET | `/balances` | Balance summary + per-user |

### Budgets (`/api/v1/budgets`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create monthly budget |
| GET | `/` | All budgets |
| GET | `/{month}/{year}` | Get specific budget |
| PATCH | `/{month}/{year}` | Update budget |

### Analytics (`/api/v1/analytics`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Total expenses + balance |
| GET | `/monthly?year=2024` | Monthly totals |
| GET | `/categories?month=6&year=2024` | Category breakdown |
| GET | `/trends?months=6` | Spending trends |

### Notifications (`/api/v1/notifications`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List notifications |
| POST | `/read-all` | Mark all as read |

---

## 💡 Split Types

### Equal Split
```json
{
  "title": "Dinner",
  "amount": 1000,
  "split_type": "equal",
  "participants": ["user1_id", "user2_id", "user3_id", "user4_id"]
}
```

### Percentage Split
```json
{
  "title": "Trip",
  "amount": 5000,
  "split_type": "percentage",
  "participants": ["userA", "userB", "userC"],
  "split_details": [
    {"user_id": "userA", "value": 40},
    {"user_id": "userB", "value": 35},
    {"user_id": "userC", "value": 25}
  ]
}
```

### Custom Split
```json
{
  "title": "Groceries",
  "amount": 1000,
  "split_type": "custom",
  "participants": ["userA", "userB", "userC"],
  "split_details": [
    {"user_id": "userA", "value": 500},
    {"user_id": "userB", "value": 300},
    {"user_id": "userC", "value": 200}
  ]
}
```

---

## 🧪 Running Tests

```bash
# Activate venv first
pytest tests/ -v
```

---

## 📚 API Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## 🏗 Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full system design.

## 🗄 Database Schema

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for all tables and relationships.
