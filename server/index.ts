// Backend API server for secure database operations
// Keeps database credentials server-side

// Only load dotenv in local development (not in Vercel)
// Vercel provides environment variables automatically
async function loadEnv() {
  if (process.env.VERCEL !== '1') {
    try {
      const dotenv = await import('dotenv');
      const { fileURLToPath } = await import('url');
      const { dirname, join } = await import('path');

      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const rootDir = join(__dirname, '..');

      dotenv.default.config({ path: join(rootDir, '.env.local') });
      dotenv.default.config({ path: join(rootDir, '.env') });
    } catch (e) {
      // dotenv not available, continue without it
    }
  }
}

await loadEnv();

import express, { Request, Response } from 'express';
import cors from 'cors';
import { neon } from '@neondatabase/serverless';
import { Deck } from '../src/db/training-coach/types';

const app = express();
app.use(cors());
app.use(express.json());

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sql = neon(databaseUrl);

// Get all decks
app.get('/api/decks', async (_req: Request, res: Response) => {
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
  try {
    await sql`DELETE FROM decks WHERE id = ${req.params.id}`;
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting deck:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export for Vercel serverless functions
export default app;

// Only start server if not in Vercel environment
if (process.env.VERCEL !== '1') {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Backend API server running on http://localhost:${PORT}`);
    console.log(`📊 Database: ${databaseUrl.replace(/:[^:@]+@/, ':****@')}`);
  });
}

