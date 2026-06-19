import uuid
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    learnings = relationship("Learning", back_populates="user", cascade="all, delete-orphan")


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
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="learnings")
