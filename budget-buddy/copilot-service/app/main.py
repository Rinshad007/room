import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.dependencies.lifespan import lifespan
from app.routers.chat_routers import router as chat_router
from app.routers.messages_router import router as messages_router

app = FastAPI(
    title="Expense Copilot",
    description="AI-Powered Expense Tracker Copilot",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat_router)
app.include_router(messages_router)

# Mount frontend static files (must be last - catches all unmatched routes)
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontent")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
