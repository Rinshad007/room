import json
from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import StreamingResponse
from sqlmodel import Session
from langchain_core.messages import HumanMessage

from app.dependencies.auth import current_user
from app.dependencies.db import get_db
from app.dependencies.load_Agent import load_agent
from app.reposetory.chat_repo import chat_repo
from app.schemas.chat_schemas import ApprovalRequest
from app.services.chat_services import chat_services, spech_to_text_service
from app.services.tool_approve_service import handle_interrupt

router = APIRouter(prefix="/api/chat", tags=["AI Copilot"])


@router.post("")
def chat(
    prompt: str = Query(..., description="User prompt"),
    db: Session = Depends(get_db),
    agent=Depends(load_agent),
    user_id: int = Depends(current_user),
):
    """Standard non-streaming chat endpoint."""
    return chat_services(user_prompt=prompt, thread_id=str(user_id), agent=agent, db=db)


@router.post("/stream")
async def chat_stream(
    prompt: str = Query(..., description="User prompt"),
    agent=Depends(load_agent),
    user_id: int = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Server-Sent Events (SSE) streaming endpoint for <400ms TTFT."""
    chat_repo(content={"content": prompt}, role="user", user_id=user_id, db=db)

    async def event_generator():
        config = {"configurable": {"thread_id": str(user_id), "user_id": user_id}}
        accumulated_text = []

        try:
            async for chunk in agent.astream(
                {"messages": [HumanMessage(content=prompt)]},
                config=config,
                stream_mode=["messages", "updates"],
            ):
                mode, payload = chunk

                # 1. Handle Human-in-the-Loop Interrupt
                if mode == "updates" and isinstance(payload, dict) and "__interrupt__" in str(payload):
                    # Extract interrupt info from the state
                    state = await agent.aget_state(config)
                    if hasattr(state, "tasks") and state.tasks:
                        for task in state.tasks:
                            if hasattr(task, "interrupts") and task.interrupts:
                                interrupt_obj = task.interrupts[0]
                                val = interrupt_obj.value
                                is_dict = isinstance(val, dict)
                                interrupt_event = {
                                    "type": "interrupt",
                                    "id": str(getattr(interrupt_obj, "id", "action-1")),
                                    "name": val.get("name", "action") if is_dict else "action",
                                    "args": val.get("args", {}) if is_dict else {},
                                    "description": val.get("description", "This action requires your confirmation.") if is_dict else "This action requires your confirmation.",
                                }
                                yield f"event: interrupt\ndata: {json.dumps(interrupt_event)}\n\n"
                                return

                # 2. Stream tokens in real time
                if mode == "messages":
                    message_chunk, metadata = payload
                    if getattr(message_chunk, "content", None) and isinstance(message_chunk.content, str):
                        delta = message_chunk.content
                        accumulated_text.append(delta)
                        yield f"event: token\ndata: {json.dumps({'delta': delta})}\n\n"

            # Log final response to DB audit trail
            final_content = "".join(accumulated_text)
            if final_content:
                chat_repo(content={"content": final_content}, role="assistant", user_id=user_id, db=db)
            yield f"event: done\ndata: {json.dumps({'status': 'complete'})}\n\n"

        except Exception as exc:
            yield f"event: error\ndata: {json.dumps({'error': str(exc)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/microphone")
def microphone(
    audio: UploadFile = File(...),
    db: Session = Depends(get_db),
    agent=Depends(load_agent),
    user_id: int = Depends(current_user),
):
    """Voice input via speech-to-text then agent invocation."""
    user_prompt = spech_to_text_service(audio)
    return chat_services(user_prompt=user_prompt, thread_id=str(user_id), agent=agent, db=db)


@router.post("/approve")
def interrupt_approve(
    request: ApprovalRequest,
    agent=Depends(load_agent),
    user_id: int = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Approve or reject a HITL-interrupted action."""
    return handle_interrupt(agent=agent, user_id=user_id, request=request, db=db)
