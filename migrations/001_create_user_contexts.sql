-- Migration: create user_contexts table
-- Used by the NLP dialogue engine to persist user state and variables.

CREATE TABLE IF NOT EXISTS user_contexts (
  user_id     TEXT PRIMARY KEY,
  state       TEXT,
  variables   JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_contexts_updated_at
  ON user_contexts(updated_at);
