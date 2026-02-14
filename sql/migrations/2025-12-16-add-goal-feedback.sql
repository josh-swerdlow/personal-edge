-- Add goal_feedback table for tracking archived feedback entries
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





