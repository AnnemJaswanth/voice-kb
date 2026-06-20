import strawberry
from sqlalchemy.orm import Session

from app.schemas.types import LearningType, ConversationType, ChatMessageType
from app.models import Learning as LearningModel, Conversation as ConversationModel, ChatMessage as ChatMessageModel
from app.chatbot import ask_chatbot
from app.schemas.queries import _conversation_to_type, _message_to_type
from typing import Optional


@strawberry.type
class Mutation:
    @strawberry.mutation
    def delete_learning(self, info: strawberry.types.Info, learning_id: str) -> bool:
        """Delete a learning by UUID. Returns True if deleted, False if not found."""
        from app.services.storage import delete_audio_from_cloudinary

        db: Session = info.context.get("db")
        user = info.context.get("user")
        if not db or not user:
            return False

        learning = (
            db.query(LearningModel)
            .filter(LearningModel.id == learning_id, LearningModel.user_id == user.id)
            .first()
        )
        if not learning:
            return False

        # Delete audio from Cloudinary
        if learning.audio_public_id:
            delete_audio_from_cloudinary(learning.audio_public_id)

        db.delete(learning)
        db.commit()
        return True

    @strawberry.mutation
    def create_conversation(self, info: strawberry.types.Info, title: Optional[str] = "New Conversation") -> Optional[ConversationType]:
        """Create a new chat conversation session."""
        db: Session = info.context.get("db")
        user = info.context.get("user")
        if not db or not user:
            return None

        conv = ConversationModel(
            user_id=user.id,
            title=title or "New Conversation"
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

        return _conversation_to_type(conv, include_messages=False)

    @strawberry.mutation
    async def send_message(self, info: strawberry.types.Info, conversation_id: str, content: str) -> Optional[ChatMessageType]:
        """Send a message in a conversation, trigger LangGraph RAG, and return the assistant response."""
        db: Session = info.context.get("db")
        user = info.context.get("user")
        if not db or not user or not content.strip():
            return None

        # Verify conversation belongs to current user
        conv = (
            db.query(ConversationModel)
            .filter(ConversationModel.id == conversation_id, ConversationModel.user_id == user.id)
            .first()
        )
        if not conv:
            return None

        # Get existing message history
        past_messages = (
            db.query(ChatMessageModel)
            .filter(ChatMessageModel.conversation_id == conversation_id)
            .order_by(ChatMessageModel.created_at.asc())
            .all()
        )
        history = [{"role": msg.role, "content": msg.content} for msg in past_messages]

        # 1. Save user message to database
        user_msg = ChatMessageModel(
            conversation_id=conversation_id,
            role="user",
            content=content
        )
        db.add(user_msg)
        db.commit()

        # Update conversation title if this is the first message
        if not past_messages or len(past_messages) == 0:
            title_text = content.strip()
            conv.title = title_text[:40] + "..." if len(title_text) > 40 else title_text
            db.add(conv)
            db.commit()

        # 2. Run the LangGraph RAG chatbot
        result = await ask_chatbot(user_id=user.id, query=content, history=history, db=db)
        answer = result.get("answer", "I couldn't generate a response.")
        sources = result.get("sources", [])

        # 3. Save assistant message response to database
        assistant_msg = ChatMessageModel(
            conversation_id=conversation_id,
            role="assistant",
            content=answer,
            sources=sources
        )
        db.add(assistant_msg)
        db.commit()
        db.refresh(assistant_msg)

        return _message_to_type(assistant_msg)
