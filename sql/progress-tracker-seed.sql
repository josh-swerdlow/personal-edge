-- Progress Tracker Seed Data
-- Initial data for development and testing

-- Insert default app data
INSERT INTO app_data (id, start_date, cycle_length)
VALUES (
    'app-data-1',
    CURRENT_DATE - INTERVAL '7 days',  -- Start date 7 days ago
    3
)
ON CONFLICT (id) DO NOTHING;

-- Insert sample goals for Spins (primary)
INSERT INTO goals (id, discipline, type, content, created_at)
VALUES
    ('goal-spin-1', 'Spins', 'primary', 'Front Spin → Find true rocker', EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000),
    ('goal-spin-2', 'Spins', 'primary', 'Back Spin → Stay over backside', EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)
ON CONFLICT (id) DO NOTHING;

-- Insert sample goals for Jumps (working)
INSERT INTO goals (id, discipline, type, content, created_at)
VALUES
    ('goal-jump-1', 'Jumps', 'working', 'Waltz Jump → Keep shoulder back', EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000),
    ('goal-jump-2', 'Jumps', 'working', 'Salchow → Check entry edge', EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)
ON CONFLICT (id) DO NOTHING;

-- Insert sample goals for Edges (working)
INSERT INTO goals (id, discipline, type, content, created_at)
VALUES
    ('goal-edge-1', 'Edges', 'working', 'Crossovers → Engage lower back', EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000),
    ('goal-edge-2', 'Edges', 'working', 'Forward Outside 3-Turn → Maintain edge quality', EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000)
ON CONFLICT (id) DO NOTHING;
