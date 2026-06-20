"""
DSPy-based structured extractors for voice learning processing.

Replaces raw JSON prompt engineering with typed DSPy Signatures
for reliable, optimizable, and testable LLM extraction.
"""

import dspy
import logging

from app.config import settings

logger = logging.getLogger(__name__)


def _get_dspy_lm() -> dspy.LM:
    """Initialize and return a configured DSPy LM for Gemini."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set in environment variables")

    model_name = f"gemini/{settings.GEMINI_MODEL}"
    lm = dspy.LM(model_name, api_key=api_key)
    return lm


# ── DSPy Signatures ─────────────────────────────────────────────────────────

class ExtractLearning(dspy.Signature):
    """Extract structured learning data from a voice transcript."""

    transcript: str = dspy.InputField(desc="The full verbatim transcript text from a voice recording")

    title: str = dspy.OutputField(desc="A concise, descriptive title under 8 words")
    summary: str = dspy.OutputField(
        desc="A clear bulleted summary of the key points and learnings. "
             "Use the bullet character '•' to separate each point. "
             "Each point on its own line."
    )
    category: str = dspy.OutputField(
        desc="A single-word category tag such as: Technology, Backend, "
             "AI, Psychology, Business, Personal, Health, Education, "
             "Science, Finance, Engineering, DSA"
    )
    key_concepts: str = dspy.OutputField(
        desc="A bulleted list of important terminology, principles, or key topics "
             "extracted from the transcript. Use '•' for bullet points. "
             "Each concept on its own line. Return empty string if none found."
    )
    action_items: str = dspy.OutputField(
        desc="A bulleted list of actionable steps or follow-ups the listener should take. "
             "Use '•' for bullet points. Each item on its own line. "
             "Return empty string if none found."
    )


# ── DSPy Module ─────────────────────────────────────────────────────────────

class LearningExtractor(dspy.Module):
    """DSPy module that extracts structured learning data from a transcript."""

    def __init__(self):
        super().__init__()
        self.extract = dspy.Predict(ExtractLearning)

    def forward(self, transcript: str) -> dspy.Prediction:
        return self.extract(transcript=transcript)


# ── Public API ──────────────────────────────────────────────────────────────

def extract_learning_from_transcript(transcript: str) -> dict:
    """
    Use DSPy + Gemini to extract structured learning data from a transcript.

    Returns a dict with keys: title, transcript, summary, category,
    key_concepts, action_items.
    """
    lm = _get_dspy_lm()
    dspy.configure(lm=lm)

    extractor = LearningExtractor()
    result = extractor(transcript=transcript)

    extracted = {
        "title": result.title,
        "transcript": transcript,  # Keep original transcript unchanged
        "summary": result.summary,
        "category": result.category,
        "key_concepts": result.key_concepts,
        "action_items": result.action_items,
    }

    logger.info(f"DSPy extraction complete: title='{extracted['title']}', category='{extracted['category']}'")
    return extracted
