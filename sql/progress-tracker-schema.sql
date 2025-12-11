-- Progress Tracker Database Schema for Neon PostgreSQL
-- This schema mirrors the Dexie IndexedDB structure for cloud sync

-- App Data table (singleton configuration)
CREATE TABLE IF NOT EXISTS app_data (
    id TEXT PRIMARY KEY,
    start_date DATE NOT NULL,
    cycle_length INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Goals table
CREATE TABLE IF NOT EXISTS goals (
    id TEXT PRIMARY KEY,
    discipline TEXT NOT NULL CHECK (discipline IN ('Spins', 'Jumps', 'Edges')),
    type TEXT NOT NULL CHECK (type IN ('primary', 'working')),
    content TEXT NOT NULL,
    container_id TEXT,            -- For primary goals: container_id === id. For working goals: references primary goal id
    created_at BIGINT NOT NULL,  -- Unix timestamp
    archived_at BIGINT,          -- Unix timestamp (nullable)
    week_start_date DATE,        -- ISO date string for the week this goal belongs to (nullable)
    created_at_db TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at_db TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_goals_discipline ON goals(discipline);
CREATE INDEX IF NOT EXISTS idx_goals_type ON goals(type);
CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals(created_at);
CREATE INDEX IF NOT EXISTS idx_goals_archived_at ON goals(archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_goals_discipline_type_active ON goals(discipline, type) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_goals_container_id ON goals(container_id) WHERE container_id IS NOT NULL;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at_db = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_app_data_updated_at BEFORE UPDATE ON app_data
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON goals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
