import strawberry
from typing import List, Optional
from sqlalchemy.orm import Session

from app.schemas.types import UserType, LearningType, ConversationType, ChatMessageType, SourceType
from app.models import User as UserModel, Learning as LearningModel, Conversation as ConversationModel, ChatMessage as ChatMessageModel


def _message_to_type(m: ChatMessageModel) -> ChatMessageType:
    """Convert a SQLAlchemy ChatMessage to a Strawberry ChatMessageType."""
    sources_data = m.sources or []
    sources = [SourceType(id=s.get("id", ""), title=s.get("title", "")) for s in sources_data]
    return ChatMessageType(
        id=str(m.id),
        conversation_id=str(m.conversation_id),
        role=m.role,
        content=m.content,
        sources=sources,
        created_at=m.created_at,
    )


def _conversation_to_type(c: ConversationModel, include_messages: bool = False) -> ConversationType:
    """Convert a SQLAlchemy Conversation to a Strawberry ConversationType."""
    messages = []
    if include_messages:
        messages = [_message_to_type(m) for m in c.messages]
    return ConversationType(
        id=str(c.id),
        user_id=str(c.user_id),
        title=c.title,
        created_at=c.created_at,
        messages=messages,
    )


def _learning_to_type(l: LearningModel) -> LearningType:
    """Convert a SQLAlchemy Learning to a Strawberry LearningType."""
    return LearningType(
        id=str(l.id),
        user_id=str(l.user_id),
        title=l.title,
        transcript=l.transcript,
        summary=l.summary,
        category=l.category,
        audio_url=l.audio_url,
        audio_duration=l.audio_duration,
        key_concepts=l.key_concepts,
        action_items=l.action_items,
        created_at=l.created_at,
    )


def _user_to_type(u: UserModel, include_learnings: bool = False) -> UserType:
    """Convert a SQLAlchemy User to a Strawberry UserType."""
    learnings = []
    if include_learnings:
        learnings = [_learning_to_type(l) for l in u.learnings]
    return UserType(
        id=str(u.id),
        name=u.name,
        email=u.email,
        created_at=u.created_at,
        learnings=learnings,
    )


@strawberry.type
class Query:
    @strawberry.field
    def health(self) -> str:
        return "healthy"

    @strawberry.field
    def me(self, info: strawberry.types.Info) -> Optional[UserType]:
        """Return the currently authenticated user, or None if unauthenticated."""
        db: Session = info.context.get("db")
        user = info.context.get("user")
        if not db or not user:
            return None
        return _user_to_type(user, include_learnings=True)

    @strawberry.field
    def learnings(self, info: strawberry.types.Info) -> List[LearningType]:
        """Return all learnings for the authenticated user."""
        db: Session = info.context.get("db")
        user = info.context.get("user")
        if not db or not user:
            return []
        results = (
            db.query(LearningModel)
            .filter(LearningModel.user_id == user.id)
            .order_by(LearningModel.created_at.desc())
            .all()
        )
        return [_learning_to_type(l) for l in results]

    @strawberry.field
    def learning(self, info: strawberry.types.Info, learning_id: str) -> Optional[LearningType]:
        """Return a single learning by UUID (must belong to authenticated user)."""
        db: Session = info.context.get("db")
        user = info.context.get("user")
        if not db or not user:
            return None
        l = (
            db.query(LearningModel)
            .filter(LearningModel.id == learning_id, LearningModel.user_id == user.id)
            .first()
        )
        if not l:
            return None
        return _learning_to_type(l)

    @strawberry.field
    def conversations(self, info: strawberry.types.Info) -> List[ConversationType]:
        """Return all conversations for the authenticated user."""
        db: Session = info.context.get("db")
        user = info.context.get("user")
        if not db or not user:
            return []
        results = (
            db.query(ConversationModel)
            .filter(ConversationModel.user_id == user.id)
            .order_by(ConversationModel.created_at.desc())
            .all()
        )
        return [_conversation_to_type(c, include_messages=True) for c in results]

    @strawberry.field
    def messages(self, info: strawberry.types.Info, conversation_id: str) -> List[ChatMessageType]:
        """Return message history for a given conversation."""
        db: Session = info.context.get("db")
        user = info.context.get("user")
        if not db or not user:
            return []
        # Verify ownership
        conv = (
            db.query(ConversationModel)
            .filter(ConversationModel.id == conversation_id, ConversationModel.user_id == user.id)
            .first()
        )
        if not conv:
            return []
        results = (
            db.query(ChatMessageModel)
            .filter(ChatMessageModel.conversation_id == conversation_id)
            .order_by(ChatMessageModel.created_at.asc())
            .all()
        )
        return [_message_to_type(m) for m in results]
