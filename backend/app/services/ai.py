from google import genai
import json
import logging
import tempfile
import os

from app.config import settings

logger = logging.getLogger(__name__)


def _get_client() -> genai.Client:
    """Get a configured Gemini client."""
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set in environment variables")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


async def process_audio(audio_bytes: bytes, filename: str) -> dict:
    """
    Send an audio file to Gemini 2.0 Flash for transcription and summarisation.

    Returns a dict with keys: title, transcript, summary, category.
    """
    client = _get_client()

    # Write audio bytes to a temporary file so Gemini SDK can read it
    suffix = os.path.splitext(filename)[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        # Upload the audio file to Gemini
        logger.info(f"Uploading audio file '{filename}' ({len(audio_bytes)} bytes) to Gemini...")
        audio_file = client.files.upload(file=tmp_path)

        prompt = """You are an AI assistant that processes voice recordings for a knowledge platform.

Listen to the audio carefully and produce the following in valid JSON format (no markdown, no code fences):

{
  "title": "A concise, descriptive title for this recording (max 10 words)",
  "transcript": "The full verbatim transcription of the audio",
  "summary": "A clear, bulleted summary of the key points and learnings. Use '•' for bullet points.",
  "category": "A single-word category tag, e.g. Technology, Business, Personal, Health, Education, Science, Finance, Engineering"
}

Rules:
- The transcript must be accurate and verbatim.
- The summary should capture all important ideas in a concise format.
- Return ONLY valid JSON, nothing else."""

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[prompt, audio_file],
        )

        # Parse the response
        text = response.text.strip()
        # Remove potential markdown code fences
        if text.startswith("```"):
            text = text.split("\n", 1)[1]
            text = text.rsplit("```", 1)[0]
            text = text.strip()

        result = json.loads(text)
        logger.info(f"Successfully processed audio: title='{result.get('title')}'")
        return result

    finally:
        # Clean up temporary file
        os.unlink(tmp_path)
