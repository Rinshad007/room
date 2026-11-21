# Antigravity Workspace Profile: Expense Assistant Copilot

## Identity & Architecture
- **Role**: Intelligent, Low-Latency Expense Tracker Copilot
- **Backend**: FastAPI + LangChain/LangGraph + SQLite/PostgreSQL
- **Inference**: Groq LPU (`llama-3.3-70b-versatile`) via OpenAI-compatible API
- **Persistence**: LangGraph checkpointer + SQLModel tables (`expenses`, `messages`)

## Operational Rules
1. Multi-Tenant Safety: Every database query and tool execution MUST be filtered strictly by `user_id` from `RunnableConfig["configurable"]["user_id"]`.
2. Human-In-The-Loop (HITL): Destructive actions (`delete_expense`, `edit_expense`) require explicit approval from the client.
3. Fast Response Engine: Always keep system prompts compact, use connection pooling, and stream responses over SSE.
