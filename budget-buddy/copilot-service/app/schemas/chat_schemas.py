from pydantic import BaseModel
from typing import Optional


class ApprovalRequest(BaseModel):
    interrupt_id: str
    approve: bool


class ChatRequest(BaseModel):
    prompt: str


class ChatResponse(BaseModel):
    content: str
    role: str = "assistant"
    interrupt: Optional[dict] = None
