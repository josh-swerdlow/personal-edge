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
    updated_at BIGINT NOT NULL,     -- Unix timestamp
    created_at_db TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at_db TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_decks_name ON decks(name);
CREATE INDEX IF NOT EXISTS idx_decks_discipline ON decks(discipline);
CREATE INDEX IF NOT EXISTS idx_decks_updated_at ON decks(updated_at);
CREATE INDEX IF NOT EXISTS idx_decks_tags ON decks USING GIN(tags);  -- GIN index for JSONB array queries
CREATE INDEX IF NOT EXISTS idx_decks_sections ON decks USING GIN(sections);  -- GIN index for JSONB queries

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at_db = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_decks_updated_at BEFORE UPDATE ON decks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
