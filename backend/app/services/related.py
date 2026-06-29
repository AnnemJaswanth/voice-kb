"""
Related Learnings service using pgvector similarity.
"""
import logging
from sqlalchemy.orm import Session
from app.models import Learning

logger = logging.getLogger(__name__)

RELATED_DISTANCE_THRESHOLD = 0.50  # cosine distance threshold


def get_related_learnings(
    learning_id: str,
    user_id,
    db: Session,
    threshold: float = RELATED_DISTANCE_THRESHOLD,
    limit: int = 5,
) -> list[dict]:
    """
    Find the top N most similar learnings to a given learning,
    excluding the learning itself.
    
    Returns list of dicts: [{id, title, category, similarity}]
    """
    # Fetch the source learning's embedding
    source = (
        db.query(Learning)
        .filter(Learning.id == learning_id, Learning.user_id == user_id)
        .first()
    )
    if not source or source.embedding is None:
        return []

    # Query for similar learnings
    results = (
        db.query(
            Learning,
            Learning.embedding.cosine_distance(source.embedding).label("distance"),
        )
        .filter(
            Learning.user_id == user_id,
            Learning.embedding.isnot(None),
            Learning.id != learning_id,
        )
        .order_by("distance")
        .limit(limit * 2)  # Fetch extra, then filter by threshold
        .all()
    )

    related = []
    for learning, distance in results:
        dist = float(distance)
        if dist >= threshold:
            continue
        similarity = round(max(0.0, (1.0 - dist) * 100.0), 1)
        related.append({
            "id": str(learning.id),
            "title": learning.title,
            "category": learning.category or "Uncategorized",
            "similarity": similarity,
        })
        if len(related) >= limit:
            break

    logger.info(f"Found {len(related)} related learnings for {learning_id}")
    return related
