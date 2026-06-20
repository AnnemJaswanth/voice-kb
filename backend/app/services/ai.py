"""
AI services for voice learning processing.

- Audio transcription: Uses Gemini's native audio API (DSPy cannot handle audio).
- Structured extraction (title, summary, category, concepts, actions):
  Uses DSPy Signatures for type-safe, reliable extraction.
"""

from google import genai
import logging
import tempfile
import os

from app.config import settings
from app.dspy.extractors import extract_learning_from_transcript

logger = logging.getLogger(__name__)


def _get_client() -> genai.Client:
    """Get a configured Gemini client."""
    if not settings.GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set in environment variables")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


async def transcribe_audio(audio_bytes: bytes, filename: str) -> str:
    """
    Send an audio file to Gemini for verbatim transcription only.
    Returns the raw transcript text.
    """
    client = _get_client()

    suffix = os.path.splitext(filename)[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        logger.info(f"Uploading audio file '{filename}' ({len(audio_bytes)} bytes) to Gemini for transcription...")
        audio_file = client.files.upload(file=tmp_path)

        prompt = """You are a transcription assistant. 
Listen to the audio carefully and produce a full, accurate, verbatim transcription.
Return ONLY the transcript text, nothing else. No JSON, no formatting, no labels."""

        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=[prompt, audio_file],
        )

        transcript = response.text.strip()
        logger.info(f"Transcription complete: {len(transcript)} characters")
        return transcript

    finally:
        os.unlink(tmp_path)


async def process_audio(audio_bytes: bytes, filename: str) -> dict:
    """
    Full pipeline: Transcribe audio with Gemini, then extract structured
    learning data with DSPy.

    Returns a dict with keys: title, transcript, summary, category,
    key_concepts, action_items.
    """
    # Step 1: Transcribe audio using Gemini's native audio API
    transcript = await transcribe_audio(audio_bytes, filename)

    if not transcript:
        raise ValueError("Gemini returned an empty transcript for the audio file.")

    # Step 2: Extract structured data using DSPy
    result = extract_learning_from_transcript(transcript)
    logger.info(f"Successfully processed audio: title='{result.get('title')}'")
    return result


async def summarize_text(transcript: str) -> dict:
    """
    Extract structured learning data from a pre-existing transcript
    using DSPy.

    Returns a dict with keys: title, transcript, summary, category,
    key_concepts, action_items.
    """
    result = extract_learning_from_transcript(transcript)
    logger.info(f"Successfully processed transcript text: title='{result.get('title')}'")
    return result


# ── Embedding Generation ────────────────────────────────────────────────────

EMBEDDING_MODEL = "gemini-embedding-2"


def build_embedding_text(learning_data: dict) -> str:
    """
    Combine learning fields into a single text block for embedding.
    This ensures the vector captures title, summary, concepts, and transcript.
    """
    parts = [
        learning_data.get("title", ""),
        learning_data.get("category", ""),
        learning_data.get("summary", ""),
        learning_data.get("key_concepts", ""),
        learning_data.get("transcript", ""),
    ]
    return "\n".join(p for p in parts if p)


async def generate_embedding(text: str) -> list[float]:
    """
    Generate a 768-dimensional embedding vector using Google's
    gemini-embedding-2 model.
    """
    client = _get_client()
    from google.genai import types

    logger.info(f"Generating embedding for text of length {len(text)} using {EMBEDDING_MODEL}...")
    config = types.EmbedContentConfig(
        output_dimensionality=768
    )
    response = client.models.embed_content(
        model=EMBEDDING_MODEL,
        contents=text,
        config=config,
    )

    embedding = response.embeddings[0].values
    logger.info(f"Embedding generated: {len(embedding)} dimensions")
    return embedding
