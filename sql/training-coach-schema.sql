-- Training Coach Database Schema for Neon PostgreSQL
-- This schema mirrors the Dexie IndexedDB structure for cloud sync
-- Uses JSONB for nested structures (sections and cards) to match Dexie model
-- Structure: Decks -> Sections -> Cards (notes)

-- Decks table
-- Sections are stored as JSONB array within decks
CREATE TABLE IF NOT EXISTS decks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tags JSONB,                     -- Array of strings stored as JSONB
    discipline TEXT CHECK (discipline IN ('Spins', 'Jumps', 'Edges')),
    sections JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of Section objects (each containing cards)
    created_at BIGINT NOT NULL,     -- Unix timestamp
    updated_at BIGINT NOT NULL      -- Unix timestamp
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_decks_name ON decks(name);
CREATE INDEX IF NOT EXISTS idx_decks_discipline ON decks(discipline);
CREATE INDEX IF NOT EXISTS idx_decks_updated_at ON decks(updated_at);
CREATE INDEX IF NOT EXISTS idx_decks_tags ON decks USING GIN(tags);  -- GIN index for JSONB array queries
CREATE INDEX IF NOT EXISTS idx_decks_sections ON decks USING GIN(sections);  -- GIN index for JSONB queries

