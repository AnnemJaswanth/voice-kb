import logging
from typing import TypedDict, Optional, Any
from sqlalchemy.orm import Session
from langgraph.graph import StateGraph, START, END

from app.models import Learning
from app.services.ai import generate_embedding, _get_client
from app.config import settings

logger = logging.getLogger(__name__)

# ── LangGraph Chat State ───────────────────────────────────────────────────

class ChatState(TypedDict):
    user_id: Any
    query: str
    history: list[dict]  # list of message dicts: [{"role": "user"|"assistant", "content": str}]
    retrieved_learnings: list[Learning]
    answer: str
    sources: list[dict]  # list of dicts: [{"id": str, "title": str}]
    db: Session


# ── Graph Nodes ─────────────────────────────────────────────────────────────

async def retrieve_node(state: ChatState) -> dict:
    """
    Generate an embedding of the query and fetch relevant learnings from the DB
    using pgvector cosine distance.
    """
    user_id = state["user_id"]
    query = state["query"]
    db = state.get("db")  # Pass Session in state or retrieve from context

    if not db:
        logger.error("Database session not found in state context")
        return {"retrieved_learnings": [], "sources": []}

    try:
        # Generate query embedding
        query_embedding = await generate_embedding(query)

        # Retrieve top 5 most similar learnings for this user
        # pgvector-sqlalchemy provides the .cosine_distance() method on Vector columns
        # Added a distance threshold (< 0.4) so it only retrieves actually relevant notes
        similar_learnings = (
            db.query(Learning)
            .filter(Learning.user_id == user_id, Learning.embedding.isnot(None))
            .filter(Learning.embedding.cosine_distance(query_embedding) < 0.4)
            .order_by(Learning.embedding.cosine_distance(query_embedding))
            .limit(5)
            .all()
        )

        sources = [{"id": str(l.id), "title": l.title} for l in similar_learnings]
        logger.info(f"Retrieved {len(similar_learnings)} similar learnings for user {user_id}")
        return {"retrieved_learnings": similar_learnings, "sources": sources}

    except Exception as e:
        logger.error(f"Retrieval node failed: {e}")
        return {"retrieved_learnings": [], "sources": []}


async def generate_node(state: ChatState) -> dict:
    """
    Build the prompt with retrieved learnings context and conversation history,
    then invoke Gemini to get the conversational response.
    """
    query = state["query"]
    history = state["history"]
    learnings = state["retrieved_learnings"]

    # Format the retrieved notes context
    context_blocks = []
    for idx, l in enumerate(learnings, 1):
        block = (
            f"Source [{idx}]: {l.title}\n"
            f"Category: {l.category or 'Uncategorized'}\n"
            f"Summary: {l.summary}\n"
            f"Transcript: {l.transcript}\n"
        )
        context_blocks.append(block)

    context_str = "\n---\n".join(context_blocks) if context_blocks else "No relevant learnings found."

    # Build system/developer instructions
    system_prompt = (
        "You are VoiceKB, a helpful and intelligent AI learning coach and knowledge assistant.\n"
        "Your goal is to answer the user's questions based on their saved voice recordings/learnings.\n\n"
        "Here are the relevant learning notes retrieved from the user's database:\n"
        "=========================================\n"
        f"{context_str}\n"
        "=========================================\n\n"
        "Instructions:\n"
        "1. Answer the user's question accurately using the provided learning notes.\n"
        "2. If the notes do not contain the answer, politely let the user know, but try to answer "
        "using general knowledge while explicitly stating that it is not in their saved notes.\n"
        "3. Keep your response clear, structured, and helpful. Use markdown formatting.\n"
        "4. Refer to the sources naturally by name if relevant."
    )

    # Format history and current message into Gemini contents list
    # The client.models.generate_content expects standard messages
    client = _get_client()

    contents = []
    # Add history
    for msg in history:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(
            {"role": role, "parts": [{"text": msg["content"]}]}
        )
    # Add current query
    contents.append(
        {"role": "user", "parts": [{"text": query}]}
    )

    try:
        # Call Gemini model
        # We pass developer_instruction (system prompt) inside config
        from google.genai import types
        config = types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.7,
        )

        logger.info("Calling Gemini for chatbot response...")
        response = client.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=contents,
            config=config,
        )

        answer = response.text.strip()
        return {"answer": answer}

    except Exception as e:
        logger.error(f"Generation node failed: {e}")
        return {"answer": "I'm sorry, I encountered an error while processing your request. Please try again."}


# ── Graph Construction ─────────────────────────────────────────────────────

builder = StateGraph(ChatState)

builder.add_node("retrieve", retrieve_node)
builder.add_node("generate", generate_node)

builder.add_edge(START, "retrieve")
builder.add_edge("retrieve", "generate")
builder.add_edge("generate", END)

chatbot_graph = builder.compile()


# ── Public API ──────────────────────────────────────────────────────────────

async def ask_chatbot(user_id: Any, query: str, history: list[dict], db: Session) -> dict:
    """
    Run the LangGraph RAG flow.

    Args:
        user_id: UUID of the authenticated user
        query: User's chat message
        history: Conversation history list of dicts: [{"role": "user"|"assistant", "content": str}]
        db: SQLAlchemy DB Session

    Returns:
        dict: {"answer": str, "sources": list[dict]}
    """
    initial_state = {
        "user_id": user_id,
        "query": query,
        "history": history,
        "retrieved_learnings": [],
        "answer": "",
        "sources": [],
        "db": db  # Pass DB session in the state dictionary
    }

    logger.info(f"Invoking chatbot LangGraph for user {user_id} with query: '{query}'")
    result = await chatbot_graph.ainvoke(initial_state)

    return {
        "answer": result.get("answer", "No response generated."),
        "sources": result.get("sources", [])
    }
