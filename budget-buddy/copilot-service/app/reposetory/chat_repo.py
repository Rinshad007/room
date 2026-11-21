from datetime import datetime
from sqlmodel import Session
from app.models.messages_model import MessageModel


def chat_repo(content: dict, role: str, user_id: int, db: Session):
    """Log a chat message to the audit trail."""
    message = MessageModel(
        user_id=user_id,
        role=role,
        content=content,
        timestamp=datetime.now(),
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message
