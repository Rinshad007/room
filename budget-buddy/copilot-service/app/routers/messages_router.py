from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.dependencies.auth import current_user
from app.dependencies.db import get_db
from app.models.messages_model import MessageModel

router = APIRouter(prefix="/api/messages", tags=["Messages"])


@router.get("")
def get_messages(
    user_id: int = Depends(current_user),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
):
    """Retrieve chat history for the authenticated user."""
    messages = db.exec(
        select(MessageModel)
        .where(MessageModel.user_id == user_id)
        .order_by(MessageModel.timestamp.asc())
        .offset(offset)
        .limit(limit)
    ).all()

    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content.get("content", "") if isinstance(m.content, dict) else str(m.content),
            "timestamp": m.timestamp.isoformat() if m.timestamp else None,
        }
        for m in messages
    ]
