// Vercel serverless function - Express app for API routes
import express, { Request, Response } from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
// Import Deck type - using relative path that Vercel can resolve
import type { Deck } from '../src/db/training-coach/types';
import type { Goal, AppData } from '../src/db/progress-tracker/types';

const app = express();
app.use(cors());
app.use(express.json());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  // Don't exit in serverless - just log the error
}

const sql = databaseUrl ? neon(databaseUrl) : null;

// Get all decks
app.get('/api/decks', async (_req: Request, res: Response) => {
  if (!sql) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  try {
    const result = await sql`
      SELECT * FROM decks
      ORDER BY updated_at DESC
    `;

    const decks = result.map((row: any) => ({
      id: row.id,
      name: row.name,
      tags: row.tags || [],
      discipline: row.discipline || undefined,
      animal: row.animal || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sections: row.sections || [],
    }));

    res.json(decks);
  } catch (error: any) {
    console.error('Error fetching decks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single deck
app.get('/api/decks/:id', async (req: Request, res: Response) => {
  if (!sql) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  try {
    const result = await sql`
      SELECT * FROM decks WHERE id = ${req.params.id}
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    const row = result[0];
    const deck = {
      id: row.id,
      name: row.name,
      tags: row.tags || [],
      discipline: row.discipline || undefined,
      animal: row.animal || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sections: row.sections || [],
    };

    res.json(deck);
  } catch (error: any) {
    console.error('Error fetching deck:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create deck
app.post('/api/decks', async (req: Request, res: Response) => {
  if (!sql) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  try {
    const deck: Omit<Deck, 'createdAt' | 'updatedAt'> = req.body;
    const now = Date.now();

    const newDeck: Deck = {
      ...deck,
      createdAt: now,
      updatedAt: now,
    };

    await sql`
      INSERT INTO decks (id, name, tags, discipline, animal, sections, created_at, updated_at)
      VALUES (
        ${newDeck.id},
        ${newDeck.name},
        ${JSON.stringify(newDeck.tags || [])}::jsonb,
        ${newDeck.discipline || null},
        ${newDeck.animal || null},
        ${JSON.stringify(newDeck.sections || [])}::jsonb,
        ${newDeck.createdAt},
        ${newDeck.updatedAt}
      )
    `;

    res.json(newDeck);
  } catch (error: any) {
    console.error('Error creating deck:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update deck
app.put('/api/decks/:id', async (req: Request, res: Response) => {
  if (!sql) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  try {
    const updates = req.body;
    const now = Date.now();

    // Get current deck
    const current = await sql`
      SELECT * FROM decks WHERE id = ${req.params.id}
    `;

    if (current.length === 0) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    const row = current[0];
    const updated: Deck = {
      id: row.id,
      name: updates.name ?? row.name,
      tags: updates.tags ?? row.tags ?? [],
      discipline: updates.discipline ?? row.discipline ?? undefined,
      animal: updates.animal ?? row.animal ?? undefined,
      sections: updates.sections ?? row.sections ?? [],
      createdAt: row.created_at,
      updatedAt: now,
    };

    await sql`
      UPDATE decks
      SET
        name = ${updated.name},
        tags = ${JSON.stringify(updated.tags || [])}::jsonb,
        discipline = ${updated.discipline || null},
        animal = ${updated.animal || null},
        sections = ${JSON.stringify(updated.sections || [])}::jsonb,
        updated_at = ${updated.updatedAt}
      WHERE id = ${req.params.id}
    `;

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating deck:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete deck
app.delete('/api/decks/:id', async (req: Request, res: Response) => {
  if (!sql) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  try {
    await sql`DELETE FROM decks WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting deck:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== Progress Tracker API Routes ==========

// Get all goals
app.get('/api/goals', async (_req: Request, res: Response) => {
  if (!sql) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  try {
    const result = await sql`
      SELECT * FROM goals
      ORDER BY created_at DESC
    `;

    const goals = result.map((row: any) => ({
      id: row.id,
      discipline: row.discipline,
      type: row.type,
      content: row.content,
      containerId: row.container_id || undefined,
      createdAt: row.created_at,
      archivedAt: row.archived_at || undefined,
      weekStartDate: row.week_start_date || undefined,
    }));

    res.json(goals);
  } catch (error: any) {
    console.error('Error fetching goals:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single goal
app.get('/api/goals/:id', async (req: Request, res: Response) => {
  if (!sql) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  try {
    const result = await sql`
      SELECT * FROM goals WHERE id = ${req.params.id}
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const row = result[0];
    const goal: Goal = {
      id: row.id,
      discipline: row.discipline,
      type: row.type,
      content: row.content,
      containerId: row.container_id || undefined,
      createdAt: row.created_at,
      archivedAt: row.archived_at || undefined,
      weekStartDate: row.week_start_date || undefined,
    };

    res.json(goal);
  } catch (error: any) {
    console.error('Error fetching goal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create goal
app.post('/api/goals', async (req: Request, res: Response) => {
  if (!sql) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  try {
    const goalData: Omit<Goal, 'createdAt'> = req.body;
    const createdAt = Date.now();

    await sql`
      INSERT INTO goals (id, discipline, type, content, container_id, created_at, archived_at, week_start_date)
      VALUES (
        ${goalData.id},
        ${goalData.discipline},
        ${goalData.type},
        ${goalData.content},
        ${goalData.containerId || null},
        ${createdAt},
        ${goalData.archivedAt || null},
        ${goalData.weekStartDate || null}
      )
    `;

    const newGoal: Goal = {
      ...goalData,
      createdAt,
    };

    res.json(newGoal);
  } catch (error: any) {
    console.error('Error creating goal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update goal
app.put('/api/goals/:id', async (req: Request, res: Response) => {
  if (!sql) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  try {
    const updates = req.body;

    // Get current goal
    const current = await sql`
      SELECT * FROM goals WHERE id = ${req.params.id}
    `;

    if (current.length === 0) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    const row = current[0];
    const updated: Goal = {
      id: row.id,
      discipline: updates.discipline ?? row.discipline,
      type: updates.type ?? row.type,
      content: updates.content ?? row.content,
      containerId: updates.containerId !== undefined ? updates.containerId : (row.container_id || undefined),
      createdAt: row.created_at,
      archivedAt: updates.archivedAt !== undefined ? updates.archivedAt : (row.archived_at || undefined),
      weekStartDate: updates.weekStartDate !== undefined ? updates.weekStartDate : (row.week_start_date || undefined),
    };

    await sql`
      UPDATE goals
      SET
        discipline = ${updated.discipline},
        type = ${updated.type},
        content = ${updated.content},
        container_id = ${updated.containerId || null},
        archived_at = ${updated.archivedAt || null},
        week_start_date = ${updated.weekStartDate || null}
      WHERE id = ${req.params.id}
    `;

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating goal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete goal
app.delete('/api/goals/:id', async (req: Request, res: Response) => {
  if (!sql) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  try {
    await sql`DELETE FROM goals WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting goal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get app data
app.get('/api/app-data', async (_req: Request, res: Response) => {
  if (!sql) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  try {
    const result = await sql`
      SELECT * FROM app_data WHERE id = 'app-data-1'
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'App data not found' });
    }

    const row = result[0];
    const appData: AppData = {
      id: row.id,
      startDate: row.start_date,
      cycleLength: row.cycle_length,
    };

    res.json(appData);
  } catch (error: any) {
    console.error('Error fetching app data:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update app data
app.put('/api/app-data', async (req: Request, res: Response) => {
  if (!sql) {
    return res.status(500).json({ error: 'Database not configured' });
  }
  try {
    const updates = req.body;

    // Check if app data exists
    const current = await sql`
      SELECT * FROM app_data WHERE id = 'app-data-1'
    `;

    if (current.length === 0) {
      // Create new app data
      const newAppData: AppData = {
        id: 'app-data-1',
        startDate: updates.startDate || new Date().toISOString().split('T')[0],
        cycleLength: updates.cycleLength || 3,
      };

      await sql`
        INSERT INTO app_data (id, start_date, cycle_length)
        VALUES (
          ${newAppData.id},
          ${newAppData.startDate},
          ${newAppData.cycleLength}
        )
      `;

      res.json(newAppData);
    } else {
      // Update existing app data
      const row = current[0];
      const updated: AppData = {
        id: row.id,
        startDate: updates.startDate ?? row.start_date,
        cycleLength: updates.cycleLength ?? row.cycle_length,
      };

      await sql`
        UPDATE app_data
        SET
          start_date = ${updated.startDate},
          cycle_length = ${updated.cycleLength}
        WHERE id = 'app-data-1'
      `;

      res.json(updated);
    }
  } catch (error: any) {
    console.error('Error updating app data:', error);
    res.status(500).json({ error: error.message });
  }
});

export default app;
