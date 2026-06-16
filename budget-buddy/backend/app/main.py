from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging import logger

# API Routers
from app.api.auth.routes import router as auth_router
from app.api.users.routes import router as users_router
from app.api.friends.routes import router as friends_router
from app.api.groups.routes import router as groups_router
from app.api.expenses.routes import router as expenses_router
from app.api.settlements.routes import router as settlements_router
from app.api.budgets.routes import router as budgets_router
from app.api.analytics.routes import router as analytics_router
from app.api.notifications.routes import router as notifications_router


from app.db.session import async_engine, Base

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"[START] {settings.APP_NAME} starting up...")
    try:
        logger.info("Verifying and creating PostgreSQL tables...")
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("PostgreSQL tables verified and created.")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
    yield
    logger.info(f"[STOP] {settings.APP_NAME} shutting down...")


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Production-ready Bill Splitter & Budget Management API. "
        "Similar to Splitwise — supports expense splitting, groups, "
        "settlements, budgets, and analytics."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ─── CORS ────────────────────────────────────────────────────────────────────
origins = settings.cors_origins
if "*" in origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# ─── Global Exception Handler ─────────────────────────────────────────────────
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "app": settings.APP_NAME}


# ─── API Routes ───────────────────────────────────────────────────────────────
API_PREFIX = "/api/v1"

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(users_router, prefix=API_PREFIX)
app.include_router(friends_router, prefix=API_PREFIX)
app.include_router(groups_router, prefix=API_PREFIX)
app.include_router(expenses_router, prefix=API_PREFIX)
app.include_router(settlements_router, prefix=API_PREFIX)
app.include_router(budgets_router, prefix=API_PREFIX)
app.include_router(analytics_router, prefix=API_PREFIX)
app.include_router(notifications_router, prefix=API_PREFIX)
