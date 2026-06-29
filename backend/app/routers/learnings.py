import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, Learning, Topic, learning_topics
from app.services.ai import process_audio, summarize_text, generate_embedding, build_embedding_text
from app.services.storage import upload_audio_to_cloudinary

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["Upload"])


@router.post("/upload-audio", status_code=status.HTTP_201_CREATED)
async def upload_audio(
    file: UploadFile = File(...),
    transcript: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload an audio file for transcription and summarisation.

    Flow:
    1. Upload audio to Cloudinary for permanent storage.
    2. Send audio to Gemini for transcription + summary + topics.
    3. Store the result in PostgreSQL.
    4. Create/reuse topic records and link to learning.
    5. Generate embedding.
    """
    # Validate file type
    base_content_type = file.content_type.split(";")[0].strip() if file.content_type else None
    allowed_types = {"audio/wav", "audio/mpeg", "audio/webm", "audio/mp4", "audio/ogg", "audio/flac"}
    if base_content_type and base_content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported audio type: {file.content_type}. Allowed: {', '.join(allowed_types)}",
        )

    # Read file bytes
    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty",
        )

    logger.info(
        f"User {current_user.id} uploading audio: {file.filename} "
        f"({len(audio_bytes)} bytes, {file.content_type})"
    )

    # 1. Upload to Cloudinary
    cloud_result = {}
    try:
        cloud_result = await upload_audio_to_cloudinary(audio_bytes, file.filename or "recording.webm")
    except Exception as e:
        logger.error(f"Cloudinary upload failed: {e}. Proceeding without audio playback.")

    # 2. Process with Gemini
    try:
        if transcript and transcript.strip():
            logger.info(f"Using client-side transcript of length {len(transcript)} for AI summarization.")
            ai_result = await summarize_text(transcript)
        else:
            logger.info("No client-side transcript provided. Processing audio bytes with Gemini...")
            ai_result = await process_audio(audio_bytes, file.filename or "recording.webm")
    except Exception as e:
        logger.error(f"AI processing failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process learning: {str(e)}",
        )

    # 3. Generate embedding for semantic search
    embedding = None
    try:
        embedding_text = build_embedding_text(ai_result)
        embedding = await generate_embedding(embedding_text)
    except Exception as e:
        logger.error(f"Embedding generation failed: {e}. Saving without embedding.")

    # 4. Store learning in database
    learning = Learning(
        user_id=current_user.id,
        title=ai_result.get("title", "Untitled"),
        transcript=ai_result.get("transcript", ""),
        summary=ai_result.get("summary", ""),
        category=ai_result.get("category"),
        key_concepts=ai_result.get("key_concepts"),
        action_items=ai_result.get("action_items"),
        embedding=embedding,
        audio_url=cloud_result.get("url"),
        audio_public_id=cloud_result.get("public_id"),
        audio_duration=cloud_result.get("duration"),
    )
    db.add(learning)
    db.commit()
    db.refresh(learning)

    # 5. Create/reuse topic records and link to learning
    topics_str = ai_result.get("topics", "")
    if topics_str:
        topic_names = [t.strip() for t in topics_str.split(",") if t.strip()]
        for topic_name in topic_names:
            # Find or create topic
            topic = db.query(Topic).filter(Topic.name == topic_name).first()
            if not topic:
                topic = Topic(name=topic_name)
                db.add(topic)
                db.flush()
            # Link learning to topic
            existing_link = db.execute(
                learning_topics.select().where(
                    learning_topics.c.learning_id == learning.id,
                    learning_topics.c.topic_id == topic.id,
                )
            ).first()
            if not existing_link:
                db.execute(
                    learning_topics.insert().values(
                        learning_id=learning.id,
                        topic_id=topic.id,
                    )
                )
        db.commit()
        logger.info(f"Linked learning {learning.id} to topics: {topic_names}")

    return {
        "id": str(learning.id),
        "title": learning.title,
        "transcript": learning.transcript,
        "summary": learning.summary,
        "category": learning.category,
        "key_concepts": learning.key_concepts,
        "action_items": learning.action_items,
        "audio_url": learning.audio_url,
        "audio_duration": learning.audio_duration,
        "topics": [t.name for t in learning.topics],
        "created_at": learning.created_at.isoformat(),
    }
