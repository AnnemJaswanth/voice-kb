from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from strawberry.fastapi import GraphQLRouter
from sqlalchemy.orm import Session
import logging

from app.schemas.schema import schema
from app.database import get_db
from app.models import User
from app.services.auth import decode_access_token
from app.routers import auth, learnings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Voice Learning Knowledge Platform API",
    description="Phase 1 – Capture & Summarize: audio recording, transcription, and AI summary",
    version="0.1.0",
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST Routers (auth + file upload only) ──────────────────────────────────

app.include_router(auth.router)       # POST /api/auth/register, /api/auth/login
app.include_router(learnings.router)  # POST /api/upload-audio


# ── GraphQL Router (primary data layer) ─────────────────────────────────────

async def get_graphql_context(request: Request) -> dict:
    """
    Build the Strawberry context dict.
    Extracts the Bearer token (if present), resolves the user, and
    provides a database session to all resolvers.
    """
    db: Session = next(get_db())
    user = None

    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        payload = decode_access_token(token)
        if payload:
            user_id = payload.get("sub")
            if user_id:
                user = db.query(User).filter(User.id == user_id).first()

    return {"db": db, "user": user, "request": request}


graphql_app = GraphQLRouter(schema, context_getter=get_graphql_context)
app.include_router(graphql_app, prefix="/graphql")


# ── Root ────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {
        "message": "Voice Learning Knowledge Platform API",
        "version": "0.1.0",
        "rest_endpoints": {
            "register": "POST /api/auth/register",
            "login": "POST /api/auth/login",
            "upload_audio": "POST /api/upload-audio",
        },
        "graphql": {
            "playground": "/graphql",
            "queries": ["health", "me", "learnings", "learning(id)"],
            "mutations": ["deleteLearning(id)"],
        },
        "docs": "/docs",
    }
