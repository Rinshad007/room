from fastapi import APIRouter, Depends
from app.dependencies.auth import current_user
from app.dependencies.firebase import fetch_chat_messages

router = APIRouter(prefix="/api/messages", tags=["Messages"])


@router.get("")
def get_messages(
    user_id: str = Depends(current_user),
    limit: int = 50,
):
    """Retrieve chat history for the authenticated user from Firebase Realtime Database."""
    return fetch_chat_messages(user_id=str(user_id), limit=limit)
