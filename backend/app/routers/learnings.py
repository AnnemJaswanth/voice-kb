import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, Learning
from app.services.ai import process_audio, summarize_text
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

    This is the only REST endpoint for learnings — all reads and deletes
    go through GraphQL.

    Flow:
    1. Upload audio to Cloudinary for permanent storage.
    2. Send audio to Gemini for transcription + summary.
    3. Store the result in PostgreSQL.
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

    # 3. Store in database
    learning = Learning(
        user_id=current_user.id,
        title=ai_result.get("title", "Untitled"),
        transcript=ai_result.get("transcript", ""),
        summary=ai_result.get("summary", ""),
        category=ai_result.get("category"),
        audio_url=cloud_result.get("url"),
        audio_public_id=cloud_result.get("public_id"),
        audio_duration=cloud_result.get("duration"),
    )
    db.add(learning)
    db.commit()
    db.refresh(learning)

    return {
        "id": str(learning.id),
        "title": learning.title,
        "transcript": learning.transcript,
        "summary": learning.summary,
        "category": learning.category,
        "audio_url": learning.audio_url,
        "audio_duration": learning.audio_duration,
        "created_at": learning.created_at.isoformat(),
    }
