from typing import TypedDict, Any
from sqlalchemy.orm import Session
from app.models import Learning

class ChatState(TypedDict):
    user_id: Any
    query: str
    history: list[dict]  # list of message dicts: [{"role": "user"|"assistant", "content": str}]
    intent: str # "general" or "knowledge"
    search_query: str
    retrieved_learnings: list[Learning]
    distances: list[float]
    answer: str
    sources: list[dict]  # list of dicts: [{"id": str, "title": str, "category": str, "created_at": str, "similarity": float}]
    follow_up_questions: list[str]
    db: Session
