// Vercel serverless function - Express app for API routes
import express, { Request, Response } from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
// Import Deck type - using relative path that Vercel can resolve
import type { Deck } from '../src/db/training-coach/types';

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

export default app;
