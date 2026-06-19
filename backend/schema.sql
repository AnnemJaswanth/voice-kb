-- ============================================================================
-- Voice Learning Knowledge Platform – Phase 1 Database Schema (UUID)
-- Run these queries in your Neon Postgres SQL Editor
-- ============================================================================

-- Enable UUID extension (Neon supports this out of the box)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);


-- 2. Learnings table
CREATE TABLE IF NOT EXISTS learnings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title           VARCHAR(500) NOT NULL,
    transcript      TEXT NOT NULL,
    summary         TEXT NOT NULL,
    category        VARCHAR(100),
    audio_url       VARCHAR(1000),
    audio_public_id VARCHAR(500),
    audio_duration  VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learnings_user_id ON learnings (user_id);
CREATE INDEX IF NOT EXISTS idx_learnings_created_at ON learnings (created_at DESC);
