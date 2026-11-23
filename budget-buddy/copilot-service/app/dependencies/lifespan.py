import os
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from sqlmodel import SQLModel

from app.dependencies.db import engine
from app.tools.add_expense_tool import add_expense
from app.tools.delete_expense import delete_expense
from app.tools.edit_expense import edit_expense
from app.tools.expense_insight import expense_insight
from app.tools.read_expense_tool import fetch_expenses

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./copilot.db")


def _get_checkpointer_context(db_url: str):
    """Return an async context manager for the appropriate checkpointer."""
    if db_url.startswith("postgresql"):
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
        return AsyncPostgresSaver.from_conn_string(db_url)
    else:
        # SQLite / local dev fallback — use v2 to avoid stale poisoned history
        from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver
        return AsyncSqliteSaver.from_conn_string("./copilot_checkpoints_v2.db")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Initialize SQLModel tables
    SQLModel.metadata.create_all(engine)

    # 2. Async checkpointer for LangGraph state persistence
    async with _get_checkpointer_context(DATABASE_URL) as checkpointer:
        await checkpointer.setup()

        # 3. Persistent HTTP connection pool for sub-350ms TTFT
        http_client = httpx.AsyncClient(
            limits=httpx.Limits(
                max_keepalive_connections=50,
                max_connections=200,
                keepalive_expiry=60.0,
            ),
            timeout=httpx.Timeout(connect=3.0, read=20.0, write=5.0, pool=5.0),
        )

        # 4. LLM model configuration (Groq LPU or any OpenAI-compatible)
        model = ChatOpenAI(
            model=os.getenv("OPENAI_MODEL", "llama-3.3-70b-versatile"),
            api_key=os.getenv("OPENAI_API_KEY"),
            base_url=os.getenv("OPENAI_BASE_URL", "https://api.groq.com/openai/v1"),
            temperature=0.1,
            max_tokens=800,
            http_async_client=http_client,
        )

        # 5. Load system prompt from .agent/ directory
        system_prompt_path = os.path.join(
            os.path.dirname(__file__), "..", "..", ".agent", "system_prompt.md"
        )
        if os.path.exists(system_prompt_path):
            with open(system_prompt_path, "r", encoding="utf-8") as f:
                system_prompt = f.read()
        else:
            system_prompt = (
                "You are an AI Expense Tracker Copilot. "
                "Manage, record, and analyze user expenses."
            )

        # 6. Compile LangGraph ReAct agent with HITL interrupts
        tools = [add_expense, fetch_expenses, expense_insight, edit_expense, delete_expense]

        agent = create_react_agent(
            model=model,
            tools=tools,
            checkpointer=checkpointer,
            prompt=system_prompt,
        )

        app.state.agent = agent
        app.state.http_client = http_client
        print("✅ Expense Copilot Agent initialized successfully.")

        yield

        await http_client.aclose()
        print("🛑 Expense Copilot Agent gracefully shut down.")
