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
    key_concepts: Optional[str] = None
    action_items: Optional[str] = None
    created_at: datetime


@strawberry.type
class UserType:
    id: str  # UUID as string
    name: str
    email: str
    created_at: datetime
    learnings: List[LearningType]


@strawberry.type
class SourceType:
    id: str
    title: str


@strawberry.type
class ChatMessageType:
    id: str
    conversation_id: str
    role: str
    content: str
    sources: List[SourceType]
    created_at: datetime


@strawberry.type
class ConversationType:
    id: str
    user_id: str
    title: str
    created_at: datetime
    messages: List[ChatMessageType]
