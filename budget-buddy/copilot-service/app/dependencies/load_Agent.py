from fastapi import Request


def load_agent(request: Request):
    """Retrieve the compiled LangGraph agent from app state."""
    return request.app.state.agent
