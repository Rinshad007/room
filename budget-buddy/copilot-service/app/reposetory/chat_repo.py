from datetime import datetime, timezone
from sqlmodel import Session
from app.models.messages_model import MessageModel


def chat_repo(content: dict, role: str, user_id: str, db: Session):
    """Log a chat message to the audit trail."""
    message = MessageModel(
        user_id=str(user_id),
        role=role,
        content=content,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message
