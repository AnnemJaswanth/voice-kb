import cloudinary
import cloudinary.uploader
import logging
import tempfile
import os

from app.config import settings

logger = logging.getLogger(__name__)


def _configure_cloudinary():
    """Configure the Cloudinary SDK."""
    if not all([settings.CLOUDINARY_CLOUD_NAME, settings.CLOUDINARY_API_KEY, settings.CLOUDINARY_API_SECRET]):
        raise RuntimeError("Cloudinary credentials are not fully set in environment variables")
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )


async def upload_audio_to_cloudinary(audio_bytes: bytes, filename: str) -> dict:
    """
    Upload an audio file to Cloudinary.

    Returns a dict with keys: url, public_id, duration.
    """
    _configure_cloudinary()

    suffix = os.path.splitext(filename)[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        logger.info(f"Uploading '{filename}' ({len(audio_bytes)} bytes) to Cloudinary...")

        result = cloudinary.uploader.upload(
            tmp_path,
            resource_type="video",  # Cloudinary uses "video" resource_type for audio files
            folder="voice-kb/recordings",
            public_id=os.path.splitext(filename)[0],
            overwrite=False,
            unique_filename=True,
        )

        upload_info = {
            "url": result.get("secure_url"),
            "public_id": result.get("public_id"),
            "duration": str(result.get("duration", "")),
        }

        logger.info(f"Cloudinary upload success: {upload_info['public_id']}")
        return upload_info

    finally:
        os.unlink(tmp_path)


def delete_audio_from_cloudinary(public_id: str) -> bool:
    """Delete an audio file from Cloudinary by its public_id."""
    _configure_cloudinary()
    try:
        result = cloudinary.uploader.destroy(public_id, resource_type="video")
        return result.get("result") == "ok"
    except Exception as e:
        logger.error(f"Failed to delete from Cloudinary: {e}")
        return False
