-- Migration: drop `state` column from user_contexts
-- The FSM concept it supported is being removed from the dialogue
-- engine (see openspec/changes/remove-fsm-and-document-rules). The
-- column was never read back — only written — so no data is lost.
--
-- Idempotent: safe to run on fresh databases that never had the
-- column (DROP COLUMN IF EXISTS is a no-op).

ALTER TABLE user_contexts DROP COLUMN IF EXISTS state;
