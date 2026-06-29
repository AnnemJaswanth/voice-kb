import logging
from typing import Any
from sqlalchemy.orm import Session
from langgraph.graph import StateGraph, START, END

from app.chatbot.state import ChatState
from app.chatbot.nodes import (
    detect_intent_node,
    rewrite_query_node,
    retrieve_node,
    generate_node,
    suggest_followups_node
)

logger = logging.getLogger(__name__)

# ── Graph Construction ─────────────────────────────────────────────────────

def route_after_intent(state: ChatState) -> str:
    if state.get("intent") == "general":
        return "generate"
    return "rewrite_query"

builder = StateGraph(ChatState)

builder.add_node("detect_intent", detect_intent_node)
builder.add_node("rewrite_query", rewrite_query_node)
builder.add_node("retrieve", retrieve_node)
builder.add_node("generate", generate_node)
builder.add_node("suggest_followups", suggest_followups_node)

builder.add_edge(START, "detect_intent")
builder.add_conditional_edges("detect_intent", route_after_intent)
builder.add_edge("rewrite_query", "retrieve")
builder.add_edge("retrieve", "generate")
builder.add_edge("generate", "suggest_followups")
builder.add_edge("suggest_followups", END)

chatbot_graph = builder.compile()

# ── Public API ──────────────────────────────────────────────────────────────

async def ask_chatbot(user_id: Any, query: str, history: list[dict], db: Session) -> dict:
    """
    Run the LangGraph RAG flow.
    """
    initial_state = {
        "user_id": user_id,
        "query": query,
        "history": history,
        "intent": "knowledge",
        "search_query": "",
        "retrieved_learnings": [],
        "distances": [],
        "answer": "",
        "sources": [],
        "follow_up_questions": [],
        "db": db
    }

    logger.info(f"Invoking enhanced chatbot LangGraph for user {user_id} with query: '{query}'")
    result = await chatbot_graph.ainvoke(initial_state)

    return {
        "answer": result.get("answer", "No response generated."),
        "sources": result.get("sources", []),
        "follow_up_questions": result.get("follow_up_questions", [])
    }
