-- Training Coach Seed Data
-- Initial data for development and testing

-- Insert sample decks
INSERT INTO decks (id, name, tags, discipline, created_at, updated_at)
VALUES
    (
        'deck-backspin',
        'Backspin',
        '["spin", "beginner"]'::jsonb,
        'Spins',
        EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000,
        EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000
    ),
    (
        'deck-waltz-jump',
        'Waltz Jump',
        '["jump", "entry", "beginner"]'::jsonb,
        'Jumps',
        EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000,
        EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000
    ),
    (
        'deck-forward-outside-3-turn',
        'Forward Outside 3-Turn',
        '["turns", "edge"]'::jsonb,
        'Edges',
        EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000,
        EXTRACT(EPOCH FROM CURRENT_TIMESTAMP) * 1000
    )
ON CONFLICT (id) DO NOTHING;

-- Insert sample card for Backspin
-- Using jsonb_build functions to properly construct nested JSON
DO $$
DECLARE
    now_ts BIGINT;
BEGIN
    now_ts := EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::BIGINT * 1000;

    INSERT INTO cards (id, deck_id, created_at, sections)
    VALUES (
        'card-backspin-1',
        'deck-backspin',
        now_ts,
        jsonb_build_array(
            jsonb_build_object(
                'id', 'section-reminders-1',
                'title', 'Reminders',
                'contentList', jsonb_build_array(
                    jsonb_build_object(
                        'id', 'content-1',
                        'content', 'Lead with right hip',
                        'tags', jsonb_build_array('hip', 'free'),
                        'helpfulnessScore', 3,
                        'priority', false,
                        'markedForMerge', false,
                        'createdAt', now_ts,
                        'lastUpvotedAt', now_ts
                    ),
                    jsonb_build_object(
                        'id', 'content-2',
                        'content', 'Keep left shoulder down',
                        'tags', jsonb_build_array('shoulder', 'front'),
                        'helpfulnessScore', 5,
                        'priority', true,
                        'markedForMerge', false,
                        'createdAt', now_ts,
                        'lastUpvotedAt', now_ts
                    )
                )
            ),
            jsonb_build_object(
                'id', 'section-troubleshooting-1',
                'title', 'Troubleshooting',
                'contentList', jsonb_build_array(
                    jsonb_build_object(
                        'id', 'content-3',
                        'content', 'Losing center — overrotating. Remedy: tighten arm path.',
                        'tags', jsonb_build_array('core', 'balance', 'arms', 'upper'),
                        'helpfulnessScore', 2,
                        'priority', false,
                        'markedForMerge', false,
                        'createdAt', now_ts
                    )
                )
            ),
            jsonb_build_object(
                'id', 'section-theory-1',
                'title', 'Theory',
                'contentList', jsonb_build_array(
                    jsonb_build_object(
                        'id', 'content-4',
                        'content', 'Maintain axis through shoulders & hips',
                        'tags', jsonb_build_array(),
                        'helpfulnessScore', 1,
                        'priority', false,
                        'markedForMerge', false,
                        'createdAt', now_ts
                    )
                )
            )
        )
    )
    ON CONFLICT (id) DO NOTHING;
END $$;

-- Insert sample card for Waltz Jump
DO $$
DECLARE
    past_ts BIGINT;
BEGIN
    past_ts := EXTRACT(EPOCH FROM CURRENT_TIMESTAMP - INTERVAL '7 days')::BIGINT * 1000;

    INSERT INTO cards (id, deck_id, created_at, sections)
    VALUES (
        'card-waltz-1',
        'deck-waltz-jump',
        past_ts,
        jsonb_build_array(
            jsonb_build_object(
                'id', 'section-reminders-2',
                'title', 'Reminders',
                'contentList', jsonb_build_array(
                    jsonb_build_object(
                        'id', 'content-5',
                        'content', 'Hips ahead of entry',
                        'tags', jsonb_build_array('hip', 'entry'),
                        'helpfulnessScore', 4,
                        'priority', false,
                        'markedForMerge', false,
                        'createdAt', past_ts
                    )
                )
            )
        )
    )
    ON CONFLICT (id) DO NOTHING;
END $$;
