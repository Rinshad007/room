<div align="center">

# 💸 Budget Buddy

### Track expenses. Split bills. Settle up — effortlessly.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Online-brightgreen?style=for-the-badge&logo=vercel&logoColor=white)](https://budget-buddy4.vercel.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

**Budget Buddy** is a full-stack bill-splitting and personal finance app inspired by Splitwise — built from scratch with a production-ready FastAPI backend and a React + TypeScript frontend. Manage shared expenses, track personal budgets, and settle debts with zero friction.

[🚀 Live Demo](https://budget-buddy4.vercel.app) · [📖 API Docs](https://budget-buddy-backend.onrender.com/docs) · [🐛 Report a Bug](https://github.com/Rinshad007/room/issues) · [💡 Request a Feature](https://github.com/Rinshad007/room/issues)

</div>

---

## 📸 Screenshots

<p align="center">
  <img src="./screenshots/analytics.jpeg" alt="Analytics Dashboard" width="30%"/>
  &nbsp;&nbsp;
  <img src="./screenshots/add-expense.jpeg" alt="Add Expense" width="30%"/>
  &nbsp;&nbsp;
  <img src="./screenshots/add-expense-split.jpeg" alt="Split Method" width="30%"/>
</p>

<p align="center">
  <img src="./screenshots/settle-up.jpeg" alt="Settle Up" width="30%"/>
  &nbsp;&nbsp;
  <img src="./screenshots/friends.jpeg" alt="Friends" width="30%"/>
</p>


---

## 📋 Table of Contents

- [✨ Features](#-features)
- [🛠 Tech Stack](#-tech-stack)
- [🏗 Architecture](#-architecture)
- [⚡ Getting Started](#-getting-started)
- [🔐 Environment Variables](#-environment-variables)
- [🔌 API Reference](#-api-reference)
- [📁 Folder Structure](#-folder-structure)
- [🗺 Roadmap](#-roadmap)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [📬 Contact](#-contact)

---

## ✨ Features

- ✅ **Authentication** — Secure JWT-based login/signup with access & refresh tokens
- ✅ **Personal Expenses** — Add, categorize, and track personal spending
- ✅ **Group Management** — Create groups, add/remove members, manage shared expenses
- ✅ **Flexible Bill Splitting** — Split bills equally, by percentage, or with custom amounts
- ✅ **Smart Settlement Engine** — Auto-calculates who owes whom across all shared expenses
- ✅ **Record Settlements** — Mark debts as paid; balances update in real-time
- ✅ **Monthly Budgets** — Set per-category spending limits with live progress tracking
- ✅ **Analytics Dashboard** — Charts for monthly trends, category breakdowns, and spending insights
- ✅ **Friend System** — Send/accept/reject friend requests; search users by name or email
- ✅ **In-App Notifications** — Get notified on new expenses, settlements, and friend requests
- ✅ **Multi-Currency Support** — Default currency configurable (INR by default)
- ✅ **Expense History** — Full paginated log of personal and group expenses
- ✅ **Interactive API Docs** — Swagger UI + ReDoc auto-generated from FastAPI schemas
- ✅ **Docker-Ready** — One-command Docker Compose setup for local development

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19 + TypeScript + Vite | UI framework & build tool |
| **Styling** | Tailwind CSS v4 | Utility-first styling |
| **State / Data** | TanStack Query (React Query) | Server-state caching & sync |
| **Charts** | Recharts | Analytics visualizations |
| **HTTP Client** | Axios | API communication |
| **Routing** | React Router v7 | Client-side navigation |
| **Backend** | FastAPI 0.115 | Async Python REST API |
| **ORM** | SQLAlchemy 2.0 (async) | Database abstraction |
| **Database** | PostgreSQL 15 | Primary data store |
| **Auth** | JWT (HS256) via `python-jose` | Stateless authentication |
| **Validation** | Pydantic v2 | Request/response schemas |
| **Passwords** | `passlib` + `bcrypt` | Secure password hashing |
| **Frontend Deploy** | Netlify | CDN + SPA routing |
| **Backend Deploy** | Render (Blueprint) | Managed web service + PostgreSQL |
| **Containerization** | Docker + Docker Compose | Local dev environment |

---

## 🏗 Architecture

Budget Buddy follows **Clean Architecture** with strict layered separation of concerns:

```
Browser (React SPA)
        │  HTTPS / REST
        ▼
┌─────────────────────────────────────────┐
│         FastAPI — HTTP Layer            │
│    Route handlers, Pydantic schemas     │
└──────────────────┬──────────────────────┘
                   │ calls
┌──────────────────▼──────────────────────┐
│       Service Layer — Business Logic    │
│  Validation, split math, notifications  │
└──────────────────┬──────────────────────┘
                   │ calls
┌──────────────────▼──────────────────────┐
│     Repository Layer — Data Access      │
│    Pure DB queries, no business logic   │
└──────────────────┬──────────────────────┘
                   │ uses
┌──────────────────▼──────────────────────┐
│   SQLAlchemy Async ORM + asyncpg        │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│            PostgreSQL Database          │
└─────────────────────────────────────────┘
```

**Key design decisions:**
- **On-the-fly balance calculation** — No cached balance table; always reflects the latest data
- **Split engine** (`utils/splits.py`) — Handles equal, percentage, and custom splits with rounding safety
- **Dependency injection** — `get_db()` and `get_current_user` provided by FastAPI's DI system
- **Auto table creation** — SQLAlchemy creates all tables on startup; no manual migrations needed on Render

---

## ⚡ Getting Started

### Prerequisites

- **Node.js** 20+ and **npm**
- **Python** 3.11+
- **PostgreSQL** 15+ _or_ **Docker** & **Docker Compose**

---

### Option 1 — Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/Rinshad007/room.git
cd room

# Start backend + database with one command
cd budget-buddy/backend
docker-compose up --build
```

API: `http://localhost:8000` | Swagger docs: `http://localhost:8000/docs`

---

### Option 2 — Manual Setup

#### 1. Clone the repo

```bash
git clone https://github.com/Rinshad007/room.git
cd room
```

#### 2. Backend setup

```bash
cd budget-buddy/backend

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux / macOS

# Install Python dependencies
pip install -r requirements.txt

# Copy the environment template and fill in your values
copy .env.example .env         # Windows
# cp .env.example .env         # Linux / macOS

# Start the API server
uvicorn app.main:app --reload
```

Backend: `http://localhost:8000` | Swagger: `http://localhost:8000/docs`

#### 3. Frontend setup

```bash
cd budget-buddy/frontend

# Install Node dependencies
npm install

# Point the frontend to your local backend
echo "VITE_API_URL=http://localhost:8000/api/v1" > .env.local

# Start the Vite dev server
npm run dev
```

Frontend: `http://localhost:5173`

---

## 🔐 Environment Variables

All backend variables live in `budget-buddy/backend/.env`. Copy from `.env.example` to get started.

| Variable | Description | Example / Default |
|----------|-------------|-------------------|
| `APP_NAME` | Application display name | `Budget Buddy` |
| `APP_ENV` | Runtime environment | `development` |
| `DEBUG` | Enable debug mode | `true` |
| `SECRET_KEY` | JWT signing secret — **32+ chars in prod** | `openssl rand -hex 32` |
| `ALGORITHM` | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token TTL | `30` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL | `7` |
| `DATABASE_URL` | Async PostgreSQL connection string | `postgresql+asyncpg://user:pass@localhost:5432/budget_buddy` |
| `POSTGRES_USER` | PostgreSQL username | `budgetbuddy` |
| `POSTGRES_PASSWORD` | PostgreSQL password | `budgetbuddy123` |
| `POSTGRES_DB` | PostgreSQL database name | `budget_buddy` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | `http://localhost:5173` |
| `DEFAULT_CURRENCY` | Default currency code | `INR` |

> ⚠️ **Never commit your `.env` file.** It is already in `.gitignore`.

---

## 🔌 API Reference

All endpoints are prefixed with `/api/v1`. Full interactive docs at `/docs` (Swagger) or `/redoc`.

### 🔑 Auth — `/api/v1/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/register` | ❌ | Register a new user |
| `POST` | `/login` | ❌ | Login; returns JWT access + refresh tokens |
| `POST` | `/refresh` | ❌ | Exchange refresh token for new access token |
| `POST` | `/logout` | ✅ | Logout (client-side token invalidation) |
| `GET` | `/me` | ✅ | Get the currently authenticated user |

### 👤 Users — `/api/v1/users`

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/me` | ✅ | Get my profile |
| `PATCH` | `/me` | ✅ | Update my profile |
| `GET` | `/search?q=` | ✅ | Search users by name or email |
| `GET` | `/{id}` | ✅ | Get any user by ID |

### 🤝 Friends — `/api/v1/friends`

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/` | ✅ | List all friends |
| `POST` | `/request` | ✅ | Send a friend request |
| `GET` | `/pending` | ✅ | View pending incoming requests |
| `POST` | `/{id}/accept` | ✅ | Accept a friend request |
| `POST` | `/{id}/reject` | ✅ | Reject a friend request |
| `DELETE` | `/{id}` | ✅ | Remove a friend |

### 👥 Groups — `/api/v1/groups`

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/` | ✅ | List my groups |
| `POST` | `/` | ✅ | Create a new group |
| `GET` | `/{id}` | ✅ | Get group details |
| `PATCH` | `/{id}` | ✅ | Update group info |
| `DELETE` | `/{id}` | ✅ | Delete a group |
| `POST` | `/{id}/members` | ✅ | Add a member to a group |
| `DELETE` | `/{id}/members/{uid}` | ✅ | Remove a member from a group |

### 💰 Expenses — `/api/v1/expenses`

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/` | ✅ | Create an expense with auto-split |
| `GET` | `/` | ✅ | List my expenses |
| `GET` | `/{id}` | ✅ | Get expense details |
| `GET` | `/group/{group_id}` | ✅ | List all expenses in a group |
| `DELETE` | `/{id}` | ✅ | Delete an expense |
| `PATCH` | `/splits/{id}/status` | ✅ | Accept or dispute a split |

### 💳 Settlements — `/api/v1/settlements`

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/` | ✅ | Record a payment/settlement |
| `GET` | `/` | ✅ | List my settlements |
| `GET` | `/balances` | ✅ | Full balance summary — who owes whom |

### 📊 Budgets — `/api/v1/budgets`

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/` | ✅ | Create a monthly budget |
| `GET` | `/` | ✅ | List all budgets |
| `GET` | `/{month}/{year}` | ✅ | Get budget for a specific month |
| `PATCH` | `/{month}/{year}` | ✅ | Update a budget |

### 📈 Analytics — `/api/v1/analytics`

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/dashboard` | ✅ | Dashboard summary: totals + net balance |
| `GET` | `/monthly?year=2024` | ✅ | Month-by-month expense totals for a year |
| `GET` | `/categories?month=6&year=2024` | ✅ | Category breakdown for a given month |
| `GET` | `/trends?months=6` | ✅ | Spending trend over the last N months |

### 🔔 Notifications — `/api/v1/notifications`

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/` | ✅ | List all notifications |
| `POST` | `/read-all` | ✅ | Mark all notifications as read |

---

## 📁 Folder Structure

<details>
<summary>Click to expand the full project tree</summary>

```
room/                                   ← Monorepo root
├── budget-buddy/
│   ├── backend/                        ← FastAPI application
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── auth/               # Register, login, token refresh
│   │   │   │   ├── users/              # Profile CRUD & user search
│   │   │   │   ├── friends/            # Friend request lifecycle
│   │   │   │   ├── groups/             # Group CRUD + member management
│   │   │   │   ├── expenses/           # Expense creation + split engine
│   │   │   │   ├── settlements/        # Payment recording + balance queries
│   │   │   │   ├── budgets/            # Monthly budget tracking
│   │   │   │   ├── analytics/          # Chart-ready JSON endpoints
│   │   │   │   └── notifications/      # In-app notification CRUD
│   │   │   ├── models/                 # SQLAlchemy ORM models
│   │   │   ├── core/                   # Config, security, logging, exceptions
│   │   │   ├── db/                     # Async DB session & base class
│   │   │   └── utils/
│   │   │       ├── splits.py           # Equal / percentage / custom split math
│   │   │       └── balance.py          # Async balance aggregation engine
│   │   ├── tests/                      # Pytest test suite
│   │   ├── .env.example                # Environment variable template
│   │   ├── requirements.txt            # Python dependencies
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml
│   │   ├── ARCHITECTURE.md             # Detailed system design doc
│   │   └── DATABASE_SCHEMA.md          # All tables & relationships
│   │
│   └── frontend/                       ← React + TypeScript SPA
│       ├── src/
│       │   ├── api/                    # Axios API client modules
│       │   ├── components/             # Reusable UI components
│       │   ├── pages/
│       │   │   ├── DashboardPage.tsx
│       │   │   ├── AddExpensePage.tsx
│       │   │   ├── GroupsPage.tsx
│       │   │   ├── FriendsPage.tsx
│       │   │   ├── SettlementsPage.tsx
│       │   │   ├── AnalyticsPage.tsx
│       │   │   ├── BudgetPage.tsx
│       │   │   ├── HistoryPage.tsx
│       │   │   ├── ProfilePage.tsx
│       │   │   ├── LoginPage.tsx
│       │   │   └── RegisterPage.tsx
│       │   ├── store/                  # Global state (auth context, etc.)
│       │   ├── types/                  # TypeScript interfaces & types
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── package.json
│       ├── tailwind.config.js
│       ├── vite.config.ts
│       └── netlify.toml
│
├── render.yaml                         ← Render Blueprint (backend + DB)
├── netlify.toml                        ← Netlify build config (frontend)
├── DEPLOYMENT.md                       ← Step-by-step deployment guide
└── readme.md                           ← You are here
```

</details>

---

## 🗺 Roadmap

- [ ] **Push Notifications** — Browser/mobile push via Web Push API
- [ ] **Recurring Expenses** — Auto-create monthly/weekly bills
- [ ] **Multi-Currency FX** — Live exchange rate conversion
- [ ] **Export to CSV/PDF** — Download expense history and reports
- [ ] **Simplify Debts Algorithm** — Minimise the number of transactions to settle a group
- [ ] **Mobile App** — React Native client sharing the same backend
- [ ] **OAuth Login** — Google / GitHub social sign-in
- [ ] **Expense Attachments** — Upload receipts (S3 / Cloudflare R2)
- [ ] **Email Reminders** — Automated nudges for unsettled balances

---

## 🤝 Contributing

Contributions are welcome! Here's how to get involved:

1. **Fork** this repository
2. **Create** a feature branch: `git checkout -b feature/your-feature-name`
3. **Commit** your changes: `git commit -m 'feat: add some feature'`
4. **Push** to the branch: `git push origin feature/your-feature-name`
5. **Open a Pull Request** with a clear description of what changed and why

Please make sure your code:
- Passes existing tests (`pytest tests/ -v` for the backend)
- Follows the existing architecture patterns (route → service → repository)
- Includes tests for any new features or bug fixes

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.

---

## 👨‍💻 Authors

Built with ❤️ by:

[![Rinshad007](https://img.shields.io/badge/GitHub-Rinshad007-181717?style=for-the-badge&logo=github)](https://github.com/Rinshad007)
[![safvenn](https://img.shields.io/badge/GitHub-safvenn-181717?style=for-the-badge&logo=github)](https://github.com/safvenn)

---

<div align="center">

⭐ If Budget Buddy saved you from the hassle of splitting bills, consider giving the repo a star!

</div>
