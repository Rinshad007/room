<div align="center">

# 💸 Budget Buddy

### Track expenses. Split bills. Settle up — effortlessly.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Online-brightgreen?style=for-the-badge&logo=vercel&logoColor=white)](https://budget-buddy4.vercel.app)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%26%20DB-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com)
[![License](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

**Budget Buddy** is a full-stack bill-splitting and personal finance app inspired by Splitwise — powered by **Firebase Authentication** and **Firebase Realtime Database** in production, with a React + TypeScript frontend. Manage shared expenses, track personal budgets, and settle debts with zero friction.

[🚀 Live Demo](https://budget-buddy4.vercel.app) · [🐛 Report a Bug](https://github.com/Rinshad007/room/issues) · [💡 Request a Feature](https://github.com/Rinshad007/room/issues)

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
- [📁 Folder Structure](#-folder-structure)
- [🗺 Roadmap](#-roadmap)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)
- [👨‍💻 Authors](#-authors)

---

## ✨ Features

- ✅ **Authentication** — Secure login/signup powered by **Firebase Authentication** (Email/Password)
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
- ✅ **Real-time Sync** — Data updates instantly across all sessions via **Firebase Realtime Database**

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
| **Authentication** | Firebase Authentication | User sign-up, login & session management (live) |
| **Database** | Firebase Realtime Database | Live data storage & real-time sync (live) |
| **Frontend Deploy** | Vercel | CDN + SPA routing |
| **Containerization** | Docker + Docker Compose | Local dev environment |

---

## 🏗 Architecture

Budget Buddy uses a **Firebase-first architecture** — the React frontend communicates directly with Firebase services with no intermediate backend server required in production:

```
Browser (React SPA)
        │
        ▼
┌─────────────────────────────────────────┐
│         Firebase Authentication         │
│   Email/Password sign-up & login        │
│   Session tokens managed client-side    │
└──────────────────┬──────────────────────┘
                   │ UID used for DB access
┌──────────────────▼──────────────────────┐
│      Firebase Realtime Database         │
│  Users, Groups, Expenses, Settlements   │
│  Notifications, Budgets — live sync     │
└──────────────────┬──────────────────────┘
                   │ enforced by
┌──────────────────▼──────────────────────┐
│         Firebase Security Rules         │
│  Auth-gated reads & writes per path     │
└─────────────────────────────────────────┘
```

**Key design decisions:**
- **Firebase Auth** — Manages user identity, tokens, and session lifecycle with zero backend overhead
- **Realtime Database** — NoSQL JSON tree; data pushes to all connected clients instantly
- **Client-side split engine** (`utils/splits.ts`) — Handles equal, percentage, and custom splits with rounding safety
- **Firebase Security Rules** — All DB paths protected by `auth.uid` checks; no unauthenticated access
- **On-the-fly balance calculation** — Balances computed from raw expense data; always reflects the latest state

---

## ⚡ Getting Started

### Prerequisites

- **Node.js** 20+ and **npm**
- A **Firebase project** (free Spark plan is sufficient)

---

### 1. Clone the repo

```bash
git clone https://github.com/Rinshad007/room.git
cd room
```

### 2. Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Enable **Authentication** → Sign-in method → **Email/Password**.
3. Enable **Realtime Database** → Start in **test mode** (configure security rules before going live).
4. In **Project Settings → Your apps**, register a Web app and copy the Firebase config object.

### 3. Frontend setup

```bash
cd budget-buddy/frontend

# Install Node dependencies
npm install

# Copy the environment template and fill in your Firebase config
copy .env.example .env.local         # Windows
# cp .env.example .env.local         # Linux / macOS

# Start the Vite dev server
npm run dev
```

Frontend: `http://localhost:5173`

---

## 🔐 Environment Variables

All frontend variables live in `budget-buddy/frontend/.env.local`. Copy from `.env.example` to get started.

| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain (e.g. `your-app.firebaseapp.com`) |
| `VITE_FIREBASE_DATABASE_URL` | Firebase Realtime Database URL |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase App ID |
| `VITE_DEFAULT_CURRENCY` | Default currency code (e.g. `INR`) |

> ⚠️ **Never commit your `.env.local` file.** It is already in `.gitignore`.

---

## 📁 Folder Structure

<details>
<summary>Click to expand the full project tree</summary>

```
room/                                   ← Monorepo root
├── budget-buddy/
│   └── frontend/                       ← React + TypeScript SPA
│       ├── src/
│       │   ├── firebase/               # Firebase app init & service exports
│       │   │   ├── config.ts           # Firebase config & app initialization
│       │   │   ├── auth.ts             # Firebase Auth helpers (login, register, logout)
│       │   │   └── db.ts               # Firebase Realtime DB helpers (read/write/listen)
│       │   ├── api/                    # High-level data access modules (wrap firebase/db.ts)
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
│       │   ├── utils/
│       │   │   ├── splits.ts           # Equal / percentage / custom split math
│       │   │   └── balance.ts          # Balance aggregation helpers
│       │   ├── types/                  # TypeScript interfaces & types
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── package.json
│       ├── tailwind.config.js
│       ├── vite.config.ts
│       └── vercel.json
│
├── vercel.json                         ← Vercel build config (frontend)
├── DEPLOYMENT.md                       ← Step-by-step deployment guide
└── readme.md                           ← You are here
```

</details>

---

## 🗺 Roadmap

- [ ] **Push Notifications** — Browser/mobile push via Firebase Cloud Messaging
- [ ] **Recurring Expenses** — Auto-create monthly/weekly bills
- [ ] **Multi-Currency FX** — Live exchange rate conversion
- [ ] **Export to CSV/PDF** — Download expense history and reports
- [ ] **Simplify Debts Algorithm** — Minimise the number of transactions to settle a group
- [ ] **Mobile App** — React Native client sharing the same Firebase backend
- [ ] **Google OAuth** — Firebase Google sign-in
- [ ] **Expense Attachments** — Upload receipts via Firebase Storage
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
- Follows the existing Firebase patterns (auth → db read/write via helper modules)
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
