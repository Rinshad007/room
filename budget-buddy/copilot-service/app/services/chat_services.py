import os
from langchain_core.messages import HumanMessage
from sqlmodel import Session
from app.reposetory.chat_repo import chat_repo


def chat_services(user_prompt: str, thread_id: str, agent, db: Session):
    """Synchronous agent invocation (non-streaming)."""
    # Log user message
    chat_repo(content={"content": user_prompt}, role="user", user_id=int(thread_id) if thread_id.isdigit() else thread_id, db=db)

    config = {
        "configurable": {
            "thread_id": thread_id,
            "user_id": int(thread_id) if thread_id.isdigit() else thread_id,
        }
    }

    response = agent.invoke(
        {"messages": [HumanMessage(content=user_prompt)]},
        config=config,
    )

    # Extract last AI message
    ai_message = response["messages"][-1].content if response.get("messages") else "I couldn't process your request."

    # Log assistant response
    chat_repo(content={"content": ai_message}, role="assistant", user_id=int(thread_id) if thread_id.isdigit() else thread_id, db=db)

    return {"content": ai_message, "role": "assistant"}


def spech_to_text_service(audio_file) -> str:
    """Convert speech audio to text using Groq Whisper."""
    try:
        from groq import Groq

        client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        transcription = client.audio.transcriptions.create(
            file=(audio_file.filename, audio_file.file.read()),
            model="whisper-large-v3-turbo",
            response_format="text",
            language="en",
        )
        return transcription
    except Exception as e:
        return f"Speech-to-text failed: {str(e)}"
