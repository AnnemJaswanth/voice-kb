import strawberry
from datetime import datetime
from typing import List, Optional


@strawberry.type
class LearningType:
    id: str  # UUID as string
    user_id: str
    title: str
    transcript: str
    summary: str
    category: Optional[str] = None
    audio_url: Optional[str] = None
    audio_duration: Optional[str] = None
    created_at: datetime


@strawberry.type
class UserType:
    id: str  # UUID as string
    name: str
    email: str
    created_at: datetime
    learnings: List[LearningType]
