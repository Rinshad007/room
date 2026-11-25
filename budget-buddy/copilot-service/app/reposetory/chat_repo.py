from app.dependencies.firebase import save_chat_message


def chat_repo(content: dict, role: str, user_id: str, db=None):
    """Log a chat message to Firebase Realtime Database."""
    text_content = content.get("content", "") if isinstance(content, dict) else str(content)
    try:
        return save_chat_message(user_id=str(user_id), role=role, content=text_content)
    except Exception as e:
        print("[chat_repo] Failed to log message to Firebase:", e)
        return {"content": text_content, "role": role, "user_id": str(user_id)}
