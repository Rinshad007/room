from langgraph.types import Command
from sqlmodel import Session
from app.reposetory.chat_repo import chat_repo
from app.schemas.chat_schemas import ApprovalRequest


def handle_interrupt(agent, user_id: str, request: ApprovalRequest, db: Session):
    """Resume a paused agent after HITL approval/rejection."""
    config = {
        "configurable": {
            "thread_id": str(user_id),
            "user_id": str(user_id),
        }
    }

    if request.approve:
        # Resume the agent - allow the tool to execute
        response = agent.invoke(
            Command(resume={"action": "approve"}),
            config=config,
        )
    else:
        # Resume the agent - reject the tool execution
        response = agent.invoke(
            Command(resume={"action": "reject"}),
            config=config,
        )

    # Extract the last AI message
    ai_message = ""
    if response.get("messages"):
        ai_message = response["messages"][-1].content

    if not ai_message:
        ai_message = "Action approved and completed." if request.approve else "Action was cancelled by you."

    # Log to audit trail
    chat_repo(
        content={"content": ai_message},
        role="assistant",
        user_id=user_id,
        db=db,
    )

    return {"content": ai_message, "role": "assistant"}
