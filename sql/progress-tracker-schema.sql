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
    created_at BIGINT NOT NULL,   -- Unix timestamp (ms) used by the client
    updated_at BIGINT NOT NULL,   -- Unix timestamp (ms) used by the client
    archived_at BIGINT,           -- Unix timestamp (ms, nullable)
    week_start_date DATE          -- ISO date string for the week this goal belongs to (nullable)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_goals_discipline ON goals(discipline);
CREATE INDEX IF NOT EXISTS idx_goals_type ON goals(type);
CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals(created_at);
CREATE INDEX IF NOT EXISTS idx_goals_archived_at ON goals(archived_at) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_goals_discipline_type_active ON goals(discipline, type) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_goals_container_id ON goals(container_id) WHERE container_id IS NOT NULL;

-- Goal submissions table (one per container/week)
CREATE TABLE IF NOT EXISTS goal_submissions (
    id TEXT PRIMARY KEY,
    container_id TEXT NOT NULL,
    primary_goal_id TEXT NOT NULL,
    discipline TEXT NOT NULL CHECK (discipline IN ('Spins', 'Jumps', 'Edges')),
    week_start_date DATE,
    notes TEXT,
    submitted_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_goal_submissions_container_week ON goal_submissions(container_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_goal_submissions_primary_goal ON goal_submissions(primary_goal_id);

-- Goal feedback table (multiple entries per goal/week)
CREATE TABLE IF NOT EXISTS goal_feedback (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    container_id TEXT NOT NULL,
    discipline TEXT NOT NULL CHECK (discipline IN ('Spins', 'Jumps', 'Edges')),
    week_start_date DATE,
    rating INTEGER CHECK (rating BETWEEN 1 AND 5),
    feedback TEXT,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at BIGINT NOT NULL,
    updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goal_feedback_goal_week ON goal_feedback(goal_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_goal_feedback_container_week ON goal_feedback(container_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_goal_feedback_completed_week ON goal_feedback(discipline, week_start_date) WHERE completed = TRUE;
CREATE INDEX IF NOT EXISTS idx_goal_feedback_created_at ON goal_feedback(created_at);

