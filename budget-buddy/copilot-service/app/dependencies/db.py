import os
from dotenv import load_dotenv
from sqlmodel import SQLModel, create_engine, Session

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./copilot.db")

# SQLModel sync engine for tool operations
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, echo=False, connect_args=connect_args)


def get_db():
    with Session(engine) as session:
        yield session
