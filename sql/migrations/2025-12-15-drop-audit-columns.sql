-- Migration: Drop legacy *_db audit columns and triggers
-- Run this against the Neon database after deploying the code changes.

-- Goals table cleanup
ALTER TABLE goals DROP COLUMN IF EXISTS created_at_db;
ALTER TABLE goals DROP COLUMN IF EXISTS updated_at_db;
DROP TRIGGER IF EXISTS update_goals_updated_at ON goals;

-- Decks table cleanup
ALTER TABLE decks DROP COLUMN IF EXISTS created_at_db;
ALTER TABLE decks DROP COLUMN IF EXISTS updated_at_db;
DROP TRIGGER IF EXISTS update_decks_updated_at ON decks;

-- Shared trigger function cleanup (only if nothing else uses it)
DROP FUNCTION IF EXISTS update_updated_at_column;




