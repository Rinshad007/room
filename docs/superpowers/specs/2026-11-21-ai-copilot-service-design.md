# AI Expense Copilot — Standalone Service Design Spec

**Date**: 2026-11-21
**Location**: `budget-buddy/copilot-service/`
**Status**: Approved (architecture + data flow + frontend interaction)

---

## 1. Overview

A standalone FastAPI service that provides an AI-powered expense tracking assistant via LangGraph tool-calling agents. Users interact through a vanilla HTML/JS web UI with real-time SSE streaming and human-in-the-loop (HITL) approval gates for destructive actions.

### Key Properties
- **Standalone**: Runs independently from the existing Budget Buddy backend. Own database, own models, own auth.
- **LLM Backend**: Groq LPU (`llama-3.3-70b-versatile`) via OpenAI-compatible API, with httpx connection pooling for sub-400ms TTFT.
- **State Persistence**: LangGraph `AsyncPostgresSaver` (or `MemorySaver`/`AsyncSqliteSaver` fallback for local dev).
- **HITL Safety**: `delete_expense` and `edit_expense` trigger interrupt pauses requiring explicit user approval in the UI.

---

## 2. Directory Structure

```text
budget-buddy/
└── copilot-service/
    ├── .agent/
    │   ├── rules/
    │   │   ├── expense-assistant-rules.md
    │   │   └── safety-and-hitl.md
    │   ├── skills/
    │   │   ├── expense-management/
    │   │   │   └── SKILL.md
    │   │   └── financial-insights/
    │   │       └── SKILL.md
    │   └── system_prompt.md
    ├── app/
    │   ├── dependencies/
    │   │   ├── auth.py
    │   │   ├── db.py
    │   │   ├── lifespan.py
    │   │   └── load_Agent.py
    │   ├── models/
    │   │   ├── expenses_model.py
    │   │   └── messages_model.py
    │   ├── reposetory/
    │   │   └── chat_repo.py
    │   ├── routers/
    │   │   ├── chat_routers.py
    │   │   └── messages_router.py
    │   ├── schemas/
    │   │   └── chat_schemas.py
    │   ├── services/
    │   │   ├── chat_services.py
    │   │   └── tool_approve_service.py
    │   ├── tools/
    │   │   ├── add_expense_tool.py
    │   │   ├── delete_expense.py
    │   │   ├── edit_expense.py
    │   │   ├── expense_insight.py
    │   │   └── read_expense_tool.py
    │   └── main.py
    ├── frontent/
    │   ├── app.js
    │   ├── index.html
    │   └── response.js
    ├── .env.example
    ├── GEMINI.md
    ├── pyproject.toml
    └── start.ps1
```

---

## 3. Data Models

### 3.1 ExpenseModel (SQLModel)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | `int` | PK, auto-increment | |
| `user_id` | `int` | NOT NULL | Tenant isolation key — always from JWT, never from user input |
| `title` | `str` | NOT NULL | Short name (e.g. "Lunch", "Petrol") |
| `amount` | `float` | NOT NULL, > 0 | Rounded to 2 decimals |
| `category` | `str` | NOT NULL, default "Other" | One of: Food, Transport, Shopping, Bills, Entertainment, Health, Education, Other |
| `date` | `datetime` | NOT NULL | Defaults to `datetime.now()` if omitted |

### 3.2 MessageModel (SQLModel)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| `id` | `int` | PK, auto-increment | |
| `user_id` | `int` | NOT NULL | |
| `role` | `str` | NOT NULL | "user" or "assistant" |
| `content` | `JSON` | NOT NULL | `{"content": "..."}` |
| `timestamp` | `datetime` | NOT NULL | Auto-set on creation |

---

## 4. API Endpoints

### 4.1 Chat Endpoints (`/api/chat`)

| Method | Path | Auth | Streaming | Description |
|--------|------|------|-----------|-------------|
| `POST` | `/api/chat` | JWT | No | Standard synchronous agent invocation |
| `POST` | `/api/chat/stream` | JWT | SSE | Real-time token streaming with <400ms TTFT |
| `POST` | `/api/chat/microphone` | JWT | No | Speech-to-text via Groq Whisper → agent |
| `POST` | `/api/chat/approve` | JWT | No | HITL interrupt resolution (approve/reject) |

### 4.2 Messages Endpoint (`/api/messages`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/messages` | JWT | Retrieve chat history for the authenticated user |

### 4.3 Static Files

The `frontent/` directory is mounted at `/` via `StaticFiles` with `html=True`, serving the web UI.

---

## 5. Agent Architecture

### 5.1 Lifespan Initialization

During FastAPI lifespan startup:
1. Create SQLModel tables via `SQLModel.metadata.create_all(engine)`.
2. Initialize `AsyncPostgresSaver` (or fallback checkpointer) for LangGraph state persistence.
3. Create a persistent `httpx.AsyncClient` with connection pooling (50 keepalive, 200 max connections).
4. Instantiate `ChatOpenAI` pointing to Groq (or configurable `OPENAI_BASE_URL`), temperature 0.1, max_tokens 800.
5. Load system prompt from `.agent/system_prompt.md`.
6. Compile `create_react_agent` with all 5 tools, the checkpointer, and an interrupt-before list for `edit_expense` and `delete_expense`.
7. Store agent and http_client on `app.state`.

### 5.2 Tools

| Tool | Auto-Approved | Description |
|------|---------------|-------------|
| `add_expense` | Yes | Extract title/amount/category, insert into DB, return confirmation |
| `fetch_expenses` | Yes | Paginated read (limit/offset) with tenant isolation |
| `expense_insight` | Yes | Category breakdown, average, top spend, month-over-month delta |
| `edit_expense` | No (HITL) | Update existing record by ID — requires user approval |
| `delete_expense` | No (HITL) | Delete record by ID — requires user approval |

All tools extract `user_id` from `RunnableConfig["configurable"]["user_id"]`, never from user input. This guarantees multi-tenant isolation.

### 5.3 System Prompt

Located at `.agent/system_prompt.md`. Key behaviors:
- Immediately record expenses from natural language ("Ate lunch for 220") — never ask for confirmation before adding.
- Use the fixed category taxonomy (Food, Transport, Shopping, Bills, Entertainment, Health, Education, Other).
- Default currency is INR (₹).
- Strictly refuse non-expense-related questions.
- Never expose internal tool names, JSON, or code to the user.

---

## 6. SSE Streaming Protocol

The `/api/chat/stream` endpoint returns `text/event-stream` with these event types:

| Event | Payload | Description |
|-------|---------|-------------|
| `token` | `{"delta": "..."}` | Incremental text token from the LLM |
| `interrupt` | `{"type": "interrupt", "id": "...", "name": "...", "args": {...}, "description": "...", "allowed_decisions": [...]}` | HITL pause — destructive tool triggered |
| `done` | `{"status": "complete"}` | Stream finished successfully |
| `error` | `{"error": "..."}` | Error during processing |

---

## 7. Human-in-the-Loop (HITL) Flow

```
1. User: "Delete my last coffee expense"
2. Agent selects delete_expense tool → LangGraph interrupt fires
3. SSE emits event: interrupt with tool name, args, interrupt_id
4. Frontend renders Approval Card with [Approve] / [Reject] buttons
5. User clicks → POST /api/chat/approve with {interrupt_id, approve: bool}
6. Backend: Command(resume=approve/reject) → agent resumes
7. If approved: DB delete → stream confirmation
   If rejected: stream "Action cancelled" message
```

---

## 8. Frontend

### 8.1 Structure
- **AI Copilot Tab**: Primary section with chat composer (text input + mic button + send)
- **Conversation Feed**: Messages rendered as user/assistant bubbles
- **Approval Cards**: Inline cards for HITL interrupts with tool name, args preview, and action buttons

### 8.2 SSE Client Logic
- `fetch()` with `ReadableStream` reader for SSE parsing
- Accumulates `token` deltas into the assistant bubble in real-time
- On `interrupt` event: removes placeholder bubble, renders approval card
- On `done`: logs final message, re-enables input

### 8.3 Approval Resolution
- `resolveApproval(interruptId, approved)` → POST to `/api/chat/approve`
- Removes the approval card, appends the agent's response as a new assistant bubble

---

## 9. Configuration

### 9.1 Environment Variables (`.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes | — | Groq API key (or OpenAI-compatible) |
| `OPENAI_MODEL` | No | `llama-3.3-70b-versatile` | Model identifier |
| `OPENAI_BASE_URL` | No | `https://api.groq.com/openai/v1` | API base URL |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (or SQLite for local dev) |
| `SECRET_KEY` | Yes | — | JWT signing secret |
| `ALGORITHM` | No | `HS256` | JWT algorithm |
| `GROQ_API_KEY` | No | — | For speech-to-text (Whisper) |

### 9.2 Dependencies (pyproject.toml)

Core: `fastapi`, `uvicorn`, `sqlmodel`, `langchain`, `langgraph`, `langchain-openai`, `httpx`, `python-dotenv`, `python-jose[cryptography]`, `passlib[bcrypt]`, `psycopg[binary]` (for PostgreSQL checkpointer), `langgraph-checkpoint-postgres`.

---

## 10. Antigravity Agent Configuration

### 10.1 GEMINI.md (project root)
Declares workspace identity, architecture summary, and operational rules (multi-tenant safety, HITL, fast response engine).

### 10.2 .agent/rules/
- `expense-assistant-rules.md`: Category taxonomy, multi-tenant isolation mandate.
- `safety-and-hitl.md`: Tool permission table, interruption lifecycle documentation.

### 10.3 .agent/skills/
- `expense-management/SKILL.md`: Intent recognition patterns for CRUD operations.
- `financial-insights/SKILL.md`: Analytical capabilities and response formulation guidelines.

---

## 11. Startup

```powershell
cd budget-buddy/copilot-service
# Configure .env with API keys
uv run uvicorn app.main:app --reload --port 8000
# Open http://localhost:8000
```

---

## 12. Out of Scope

- Mobile app integration (Budget Buddy React Native app is separate).
- Shared database with the existing Budget Buddy backend.
- Production deployment configuration (Docker, CI/CD).
- User registration UI (auth endpoints exist but registration is API-only for now).

