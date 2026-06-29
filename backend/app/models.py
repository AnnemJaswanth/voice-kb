import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Table
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from pgvector.sqlalchemy import Vector
from app.database import Base


# ── Association table for many-to-many Learning ↔ Topic ─────────────────────
learning_topics = Table(
    "learning_topics",
    Base.metadata,
    Column("learning_id", UUID(as_uuid=True), ForeignKey("learnings.id", ondelete="CASCADE"), primary_key=True),
    Column("topic_id", UUID(as_uuid=True), ForeignKey("topics.id", ondelete="CASCADE"), primary_key=True),
)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    learnings = relationship("Learning", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")


class Topic(Base):
    __tablename__ = "topics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(200), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    learnings = relationship("Learning", secondary=learning_topics, back_populates="topics")


class Learning(Base):
    __tablename__ = "learnings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    transcript = Column(Text, nullable=False)
    summary = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    audio_url = Column(String(1000), nullable=True)        # Cloudinary URL
    audio_public_id = Column(String(500), nullable=True)   # Cloudinary public_id for deletion
    audio_duration = Column(String(50), nullable=True)      # Duration from Cloudinary metadata
    key_concepts = Column(Text, nullable=True)
    action_items = Column(Text, nullable=True)
    embedding = Column(Vector(768), nullable=True)          # pgvector embedding (Gemini text-embedding-004)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="learnings")
    topics = relationship("Topic", secondary=learning_topics, back_populates="learnings")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False, server_default="New Conversation")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan",
                            order_by="ChatMessage.created_at")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(50), nullable=False)      # "user" or "assistant"
    content = Column(Text, nullable=False)
    sources = Column(JSONB, nullable=True)          # JSON array of learning IDs referenced
    follow_up_questions = Column(JSONB, nullable=True) # JSON array of suggested follow-ups
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
