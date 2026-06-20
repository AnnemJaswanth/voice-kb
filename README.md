# VoiceKB Roadmap & Checklist (Updated)

## 🟢 Phase 1: Capture & Summarize (MVP) – Done

### Audio Input

* [✓] Record audio from browser
* [✓] Upload audio files

### AI Processing

* [✓] Speech-to-text transcription
* [✓] AI-generated title
* [✓] AI-generated summary
* [✓] AI-generated category
* [✓] Concept extraction
* [✓] Action item extraction

### Storage

* [✓] Save learnings in PostgreSQL

---

# 🟡 Phase 2: Search, Embeddings & Personal Chatbot (RAG)

## Search

* [✓] Full-text / keyword search
* [✓] Category filtering
* [✓] Date filtering

## Knowledge Extraction

* [✓] Topic extraction
* [✓] Generate embeddings for:

  * Transcript
  * Summary
  * Concepts

## Vector Search

* [✓] Setup pgvector or Qdrant
* [✓] Semantic search
* [✓] Related note retrieval

## Personal Chatbot

* [✓] Personal RAG chatbot
* [✓] Chat history persistence
* [✓] Conversation management
* [✓] Source references in answers

Example:

User:
"What did I learn about PostgreSQL?"

VoiceKB:

* Retrieved 5 relevant learnings
* Generated answer from stored knowledge
* Linked source notes

---

# 🔵 Phase 3: Knowledge Organization & Discovery

## Topic Organization

* [ ] Topics table
* [ ] Learning-to-topic mapping
* [ ] Hierarchical topics

Example:

Backend
├── FastAPI
├── GraphQL
└── PostgreSQL

## Discovery

* [ ] Related learning detection
* [ ] Similar learning suggestions
* [ ] Topic-based browsing

## Future Graph Support

* [ ] Concept relationships table
* [ ] Topic relationships table

Example:

FastAPI → GraphQL
GraphQL → Resolvers

---

# 🔵 Phase 4: Shared Workspaces

## Workspaces

* [ ] Create workspaces
* [ ] Join workspaces
* [ ] Invite members

## Permissions

* [ ] Owner role
* [ ] Editor role
* [ ] Viewer role

## Sharing

* [ ] Share learnings
* [ ] Workspace search

## Database

* [ ] workspaces
* [ ] workspace_members
* [ ] workspace_learnings

---

# 🔵 Phase 5: Collaborative Knowledge Foundation

## Collaboration

* [ ] Duplicate detection
* [ ] Similar note detection
* [ ] Source attribution

Example:

GraphQL Resolvers

Sources:

* Jaswanth
* Ravi
* Arjun

## Team Discovery

* [ ] Related team learnings
* [ ] Contributor insights

---

# 🟣 Phase 6: Team Q&A Chatbot (Collaborative RAG)

## Workspace Chatbot

* [ ] Query across workspace knowledge
* [ ] Team knowledge retrieval
* [ ] Workspace conversation history

## Answer Generation

* [ ] Source citations
* [ ] Related learning recommendations

Example:

Answer:
"GraphQL resolvers are functions that..."

Sources:

* GraphQL Basics
* Backend Session 2
* Team Recording 5

---

# 🟣 Phase 7: Live Learning Mode

## Real-Time Processing

* [ ] Live transcription
* [ ] Live summary generation
* [ ] Live concept extraction
* [ ] Live topic detection

## Streaming

* [ ] WebSocket support
* [ ] Real-time updates

---

# 🔴 Phase 8: Learning Intelligence

## Revision Engine

* [ ] Revision reminders
* [ ] Spaced repetition

## Knowledge Intelligence

* [ ] Knowledge gap detection
* [ ] Related concept recommendations
* [ ] Topic mastery tracking

## User Analytics

* [ ] Learning streaks
* [ ] Progress tracking
* [ ] Revision history

## Infrastructure

* [ ] Notification service
* [ ] Reminder scheduler
* [ ] Background jobs

---

# 🔴 Phase 9: Knowledge Graph

## Graph Construction

* [ ] Build graph from concepts
* [ ] Build graph from topics
* [ ] Auto-generated relationships

## Visualization

* [ ] Interactive graph view
* [ ] Node navigation
* [ ] Topic exploration

Example:

Backend
|
FastAPI
|
GraphQL
|
Resolvers

---

# 🔴 Phase 10: AI Learning Coach

## Study Assistance

* [ ] Personalized study plans
* [ ] Learning recommendations

## Interview Preparation

* [ ] Interview question generation
* [ ] Mock interviews

## Assessments

* [ ] Quiz generation
* [ ] Practice tests

## Learning Tools

* [ ] Flashcard generation
* [ ] Revision notes
* [ ] Topic summaries

---

# Recommended Technology Stack

Frontend

* Next.js
* TypeScript
* Tailwind

Backend

* FastAPI

Database

* PostgreSQL

Storage

* Cloudinary

Embeddings

* Gemini Embeddings

Vector Search

* pgvector (initially)
* Qdrant (later)

LLM

* Gemini

Future Agent Framework

* LangGraph

Deployment

* Vercel
* Render
* Neon PostgreSQL

---

# Version Mapping

V1

* Phase 1

V2

* Phase 2

V3

* Phase 3

V4

* Phase 4

V5

* Phase 5 + Phase 6

V6

* Phase 7

V7

* Phase 8

V8

* Phase 9

V9

* Phase 10
