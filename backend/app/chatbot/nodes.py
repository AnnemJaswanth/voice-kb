import logging
import json
from app.models import Learning
from app.services.ai import generate_embedding, _get_client
from app.config import settings
from google.genai import types
from app.chatbot.state import ChatState

logger = logging.getLogger(__name__)

async def detect_intent_node(state: ChatState) -> dict:
    """Classify the user's query intent."""
    query = state["query"]
    client = _get_client()
    
    prompt = f"""You are an intent classifier for VoiceKB, a personal knowledge base.
User query: "{query}"

Classify this query into one of two categories:
- "general": Greetings, conversational pleasantries, or questions about who you are and what you can do (e.g., "Hi", "Thanks", "Who are you?").
- "knowledge": Questions asking for information, summarization, or recall from the user's notes and learnings.

Return ONLY a JSON object with a single key "intent" and value either "general" or "knowledge".
"""
    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.0
            )
        )
        result = json.loads(response.text)
        intent = result.get("intent", "knowledge")
    except Exception as e:
        logger.error(f"Intent detection failed: {e}")
        intent = "knowledge" # default fallback
        
    return {"intent": intent}


async def rewrite_query_node(state: ChatState) -> dict:
    """Rewrite the user query into optimized search terms."""
    query = state["query"]
    client = _get_client()
    
    prompt = f"""You are a search query optimizer. 
Given the user's question, extract the core topics and generate a concise list of keywords that would be ideal for vector similarity search.
Do NOT use conversational filler.

User question: "{query}"

Return ONLY a JSON object with a key "search_query" containing the space-separated keywords."""
    
    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2
            )
        )
        result = json.loads(response.text)
        search_query = result.get("search_query", query)
    except Exception as e:
        logger.error(f"Query rewriting failed: {e}")
        search_query = query
        
    logger.info(f"Rewritten query: '{query}' -> '{search_query}'")
    return {"search_query": search_query}


# Minimum similarity thresholds
# Cosine distance threshold: only pass notes below this to the reranker (distance 0 = perfect, 1 = unrelated)
MAX_DISTANCE_THRESHOLD = 0.50  # ~50% similarity minimum
# LLM reranker score: 0-100, only show notes the LLM considers >= this
MIN_RERANK_SCORE = 60

async def retrieve_node(state: ChatState) -> dict:
    """
    Generate an embedding of the search_query, fetch top 15 from DB,
    pre-filter by cosine distance, rerank with LLM, then filter by
    LLM relevance score. Only truly relevant notes are returned.
    """
    user_id = state["user_id"]
    search_query = state.get("search_query", state["query"])
    db = state.get("db")

    if not db:
        logger.error("Database session not found in state context")
        return {"retrieved_learnings": [], "distances": []}

    try:
        query_embedding = await generate_embedding(search_query)

        # Retrieve top 15 most similar learnings
        results = (
            db.query(Learning, Learning.embedding.cosine_distance(query_embedding).label("distance"))
            .filter(Learning.user_id == user_id, Learning.embedding.isnot(None))
            .order_by("distance")
            .limit(15)
            .all()
        )
        
        if not results:
            return {"retrieved_learnings": [], "distances": []}

        # ── Guard 1: Pre-filter by cosine distance ─────────────────────────
        # Only pass notes that are at least loosely relevant (distance < MAX_DISTANCE_THRESHOLD)
        relevant_results = [(l, d) for l, d in results if float(d) < MAX_DISTANCE_THRESHOLD]
        logger.info(f"Pre-filter: {len(results)} results -> {len(relevant_results)} passed distance threshold ({MAX_DISTANCE_THRESHOLD})")

        if not relevant_results:
            logger.info("No results passed the distance threshold. Returning empty.")
            return {"retrieved_learnings": [], "distances": []}

        client = _get_client()
        id_to_learning = {}
        id_to_distance = {}
        rerank_prompt = f"User search query: '{search_query}'\n\nFor each note below, rate its relevance to the query from 0 to 100. Be strict: only give high scores (>60) to notes that directly relate to the query topic. Return ONLY a JSON list of objects with 'id' and 'score' keys.\n\n"
        for l, d in relevant_results:
            id_to_learning[str(l.id)] = l
            id_to_distance[str(l.id)] = d
            rerank_prompt += f"ID: {str(l.id)}\nTitle: {l.title}\nSummary: {l.summary}\n\n"

        try:
            rerank_response = client.models.generate_content(
                model=settings.GEMINI_MODEL,
                contents=rerank_prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.0
                )
            )
            scores = json.loads(rerank_response.text)

            # ── Guard 2: Post-rerank filter by LLM relevance score ─────────
            # Only keep notes the LLM considers genuinely relevant
            relevant_scores = [item for item in scores if item.get("score", 0) >= MIN_RERANK_SCORE]
            relevant_scores.sort(key=lambda x: x.get("score", 0), reverse=True)
            logger.info(f"Post-rerank: {len(scores)} scores -> {len(relevant_scores)} passed score threshold ({MIN_RERANK_SCORE})")

            top_ids = [
                str(item["id"]) for item in relevant_scores[:5]
                if str(item["id"]) in id_to_learning
            ]
            similar_learnings = [id_to_learning[uid] for uid in top_ids]
            distances = [id_to_distance[uid] for uid in top_ids]

        except Exception as e:
            logger.error(f"Reranking failed: {e}. Falling back to distance-filtered results.")
            similar_learnings = [r[0] for r in relevant_results[:5]]
            distances = [r[1] for r in relevant_results[:5]]

        logger.info(f"Final: returning {len(similar_learnings)} relevant learnings.")
        return {"retrieved_learnings": similar_learnings, "distances": distances}

    except Exception as e:
        logger.error(f"Retrieval node failed: {e}")
        return {"retrieved_learnings": [], "distances": []}


async def generate_node(state: ChatState) -> dict:
    """Build the prompt and get the conversational response."""
    query = state["query"]
    history = state["history"]
    learnings = state.get("retrieved_learnings", [])
    distances = state.get("distances", [])
    intent = state.get("intent", "general")
    
    if intent == "general":
        system_prompt = (
            "You are VoiceKB, a personal knowledge assistant.\n"
            "This is a general conversational turn. Answer politely and concisely."
        )
        sources = []
    else:
        # Confidence logic based on vector distances
        best_distance = distances[0] if distances else 1.0
        
        if best_distance < 0.25:
            confidence_instruction = "High confidence: Answer strictly from the provided notes."
        elif best_distance < 0.45:
            confidence_instruction = "Medium confidence: Answer cautiously. Mention that you are inferring from potentially related notes."
        else:
            confidence_instruction = "Low confidence: The retrieved notes are likely unrelated. Explicitly state 'I couldn't find this in your saved learnings.', then you may answer using general knowledge."
            learnings = [] # Clear learnings if low confidence

        context_blocks = []
        sources = []
        for idx, l in enumerate(learnings, 1):
            topic_names = ", ".join([t.name for t in l.topics]) if l.topics else "None"
            block = (
                f"Source [{idx}]: {l.title}\n"
                f"Category: {l.category or 'Uncategorized'}\n"
                f"Topics: {topic_names}\n"
                f"Concepts: {l.key_concepts or 'None'}\n"
                f"Summary: {l.summary}\n"
            )
            context_blocks.append(block)
            
            # Distance mapping to similarity percentage: max(0, (1 - distance) * 100)
            similarity = max(0.0, (1.0 - float(distances[idx-1])) * 100.0) if idx-1 < len(distances) else 0.0
            sources.append({
                "id": str(l.id),
                "title": l.title,
                "category": l.category or "Uncategorized",
                "created_at": l.created_at.isoformat() if l.created_at else None,
                "similarity": round(similarity, 1)
            })

        context_str = "\n---\n".join(context_blocks) if context_blocks else "No relevant learnings found."

        system_prompt = (
            "You are VoiceKB.\n"
            "You are answering questions about the user's own learning history.\n\n"
            "Priority:\n"
            "1. Use retrieved notes whenever they answer the question.\n"
            "2. If multiple notes discuss the same topic, merge them into a single coherent answer.\n"
            "3. Never invent facts supposedly from the user's notes.\n"
            "4. If the notes are insufficient, explicitly state: 'I couldn't find this in your saved learnings.'\n"
            "5. After that, you may answer using general knowledge.\n"
            "6. If sources exist, mention them naturally.\n"
            "7. Keep answers concise unless the user requests details.\n\n"
            f"Confidence Instruction: {confidence_instruction}\n\n"
            "Here are the retrieved learning notes:\n"
            "=========================================\n"
            f"{context_str}\n"
            "=========================================\n"
        )

    client = _get_client()
    contents = []
    for msg in history:
        role = "user" if msg["role"] == "user" else "model"
        contents.append({"role": role, "parts": [{"text": msg["content"]}]})
    contents.append({"role": "user", "parts": [{"text": query}]})

    try:
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.7,
        )
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=contents,
            config=config,
        )
        answer = response.text.strip()
        return {"answer": answer, "sources": sources}
    except Exception as e:
        logger.error(f"Generation node failed: {e}")
        return {"answer": "I'm sorry, an error occurred while processing your request.", "sources": sources}


async def suggest_followups_node(state: ChatState) -> dict:
    """Generate 3 follow up questions."""
    answer = state.get("answer", "")
    query = state["query"]
    client = _get_client()
    
    prompt = f"""Based on the user's question and your answer, suggest exactly 3 relevant follow-up questions the user might want to ask next. Keep them short and concise.
User: {query}
Answer: {answer}

Return ONLY a JSON list of strings."""
    
    try:
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.7
            )
        )
        follow_ups = json.loads(response.text)
        if not isinstance(follow_ups, list):
            follow_ups = []
    except Exception as e:
        logger.error(f"Follow up generation failed: {e}")
        follow_ups = []
        
    return {"follow_up_questions": follow_ups[:3]}
