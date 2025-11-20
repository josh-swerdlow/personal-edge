// Script to import waltz_update_11192025_v2.json to Neon PostgreSQL
// Usage: DATABASE_URL=your_neon_url npm run import:neon

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const waltzUpdateData = JSON.parse(
  readFileSync(join(__dirname, 'db-updates', 'waltz_update_11192025_v2.json'), 'utf-8')
);

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Transform structured Theory content to readable text
function transformTheoryContent(content: { bodyParts: Array<{ bodyPart: string; portion: string; description: string }> }): string {
  const lines = content.bodyParts.map((bp) => {
    return `${bp.bodyPart} (${bp.portion}): ${bp.description}`;
  });
  return lines.join('\n');
}

// Transform structured Troubleshooting content to readable text
function transformTroubleshootingContent(content: {
  feeling?: string;
  issue?: string;
  solution?: string;
  regressions?: string;
}): string {
  const parts: string[] = [];

  if (content.feeling) {
    parts.push(`Feeling: ${content.feeling}`);
  }
  if (content.issue) {
    parts.push(`Issue: ${content.issue}`);
  }
  if (content.solution) {
    parts.push(`Solution: ${content.solution}`);
  }
  if (content.regressions) {
    parts.push(`Watch for: ${content.regressions}`);
  }

  return parts.join('\n\n');
}

// Transform structured content to readable text based on section type
function transformContent(content: any, sectionTitle: string): string {
  if (sectionTitle === 'Theory' && content.bodyParts) {
    return transformTheoryContent(content);
  }

  if (sectionTitle === 'Troubleshooting') {
    return transformTroubleshootingContent(content);
  }

  if (sectionTitle === 'Reminders') {
    if (typeof content === 'string') {
      return content;
    }
    if (content.content) {
      return content.content;
    }
    if (content.text) {
      return content.text;
    }
  }

  if (typeof content === 'string') {
    return content;
  }

  return JSON.stringify(content);
}

// Transform structured tags to flat string array
function transformTags(tags: any): string[] {
  const tagArray: string[] = [];

  if (tags.onOffIce) {
    tagArray.push(tags.onOffIce);
  }

  if (tags.partOfElement) {
    tagArray.push(tags.partOfElement);
  }

  if (tags.bodyPosition) {
    const bp = tags.bodyPosition;
    tagArray.push(bp.horizontalPlane);
    tagArray.push(bp.mediaPlane);
    tagArray.push(bp.frontalPlane);
  }

  if (tags.wildcard && Array.isArray(tags.wildcard)) {
    tagArray.push(...tags.wildcard);
  }

  return tagArray;
}

interface Card {
  id: string;
  sectionId: string;
  content: string;
  tags: string[];
  helpfulnessScore: number;
  priority: boolean;
  markedForMerge: boolean;
  createdAt: number;
}

interface Section {
  id: string;
  title: string;
  cards: Card[];
}

interface Deck {
  id: string;
  name: string;
  tags: string[];
  discipline?: string;
  sections: Section[];
  createdAt: number;
  updatedAt: number;
}

async function ensureSchema(sql: any) {
  console.log('🔧 [Neon Import] Ensuring database schema exists...\n');

  // Check if table exists
  const tableExists = await sql`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'decks'
    )
  `;

  if (!tableExists[0].exists) {
    console.log('  [Neon Import] Creating decks table...');
    // Create decks table
    await sql`
      CREATE TABLE decks (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        tags JSONB,
        discipline TEXT CHECK (discipline IN ('Spins', 'Jumps', 'Edges')),
        animal TEXT CHECK (animal IN ('bee', 'duck', 'cow', 'rabbit', 'dolphin', 'squid')),
        sections JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        created_at_db TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at_db TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `;
  } else {
    console.log('  [Neon Import] Decks table exists, checking columns...');
    // Check if sections column exists
    const columns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'decks'
      AND column_name = 'sections'
    `;

    if (columns.length === 0) {
      console.log('  [Neon Import] Adding sections column...');
      await sql`ALTER TABLE decks ADD COLUMN sections JSONB NOT NULL DEFAULT '[]'::jsonb`;
    }

    // Check and add other columns if needed
    const allColumns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'decks'
    `;
    const columnNames = allColumns.map((c: any) => c.column_name);

    if (!columnNames.includes('tags')) {
      await sql`ALTER TABLE decks ADD COLUMN tags JSONB`;
    }
    if (!columnNames.includes('discipline')) {
      await sql`ALTER TABLE decks ADD COLUMN discipline TEXT CHECK (discipline IN ('Spins', 'Jumps', 'Edges'))`;
    }
    if (!columnNames.includes('animal')) {
      await sql`ALTER TABLE decks ADD COLUMN animal TEXT CHECK (animal IN ('bee', 'duck', 'cow', 'rabbit', 'dolphin', 'squid'))`;
    }
    if (!columnNames.includes('created_at')) {
      await sql`ALTER TABLE decks ADD COLUMN created_at BIGINT NOT NULL DEFAULT 0`;
    }
    if (!columnNames.includes('updated_at')) {
      await sql`ALTER TABLE decks ADD COLUMN updated_at BIGINT NOT NULL DEFAULT 0`;
    }
    if (!columnNames.includes('created_at_db')) {
      await sql`ALTER TABLE decks ADD COLUMN created_at_db TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
    }
    if (!columnNames.includes('updated_at_db')) {
      await sql`ALTER TABLE decks ADD COLUMN updated_at_db TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`;
    }
  }

  // Create indexes (drop first if they exist to avoid conflicts)
  console.log('  [Neon Import] Creating indexes...');
  await sql`DROP INDEX IF EXISTS idx_decks_name`;
  await sql`CREATE INDEX idx_decks_name ON decks(name)`;

  await sql`DROP INDEX IF EXISTS idx_decks_discipline`;
  await sql`CREATE INDEX idx_decks_discipline ON decks(discipline)`;

  await sql`DROP INDEX IF EXISTS idx_decks_updated_at`;
  await sql`CREATE INDEX idx_decks_updated_at ON decks(updated_at)`;

  await sql`DROP INDEX IF EXISTS idx_decks_tags`;
  await sql`CREATE INDEX idx_decks_tags ON decks USING GIN(tags)`;

  await sql`DROP INDEX IF EXISTS idx_decks_sections`;
  await sql`CREATE INDEX idx_decks_sections ON decks USING GIN(sections)`;

  // Create trigger function
  console.log('  [Neon Import] Creating trigger function...');
  await sql`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at_db = CURRENT_TIMESTAMP;
      RETURN NEW;
    END;
    $$ language 'plpgsql'
  `;

  // Create trigger
  await sql`DROP TRIGGER IF EXISTS update_decks_updated_at ON decks`;
  await sql`
    CREATE TRIGGER update_decks_updated_at BEFORE UPDATE ON decks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
  `;

  console.log('✅ [Neon Import] Schema ensured\n');
}

async function importToNeon() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL environment variable is required');
    console.error('Usage: DATABASE_URL=your_neon_url tsx scripts/importToNeon.ts');
    process.exit(1);
  }

  console.log('🚀 [Neon Import] Starting import to Neon PostgreSQL...\n');

  const sql = neon(databaseUrl);

  // Ensure schema exists
  await ensureSchema(sql);

  const now = Date.now();

  const waltzUpdate = waltzUpdateData as { decks: any[] };
  console.log(`[Neon Import] Processing ${waltzUpdate.decks.length} deck(s) from update file\n`);

  for (const deckData of waltzUpdate.decks) {
    console.log(`\n📦 [Neon Import] Processing deck: "${deckData.name}"`);
    console.log(`  Discipline: ${deckData.discipline || 'N/A'}`);
    console.log(`  Sections: ${deckData.sections.length}`);

    // Check if deck exists
    const existingDeck = await sql`
      SELECT id, sections FROM decks WHERE name = ${deckData.name}
    `;

    let deckId: string;
    let existingSections: Section[] = [];

    if (existingDeck.length > 0) {
      console.log(`  [Neon Import] Updating existing deck: ${existingDeck[0].id}`);
      deckId = existingDeck[0].id;
      existingSections = existingDeck[0].sections || [];
    } else {
      console.log(`  [Neon Import] Creating new deck`);
      deckId = generateUUID();
    }

    // Transform sections
    const sectionMap = new Map<string, Section>();
    existingSections.forEach((s: Section) => {
      sectionMap.set(s.title, s);
    });

    const transformedSections: Section[] = deckData.sections.map((sectionData: any) => {
      const existingSection = sectionMap.get(sectionData.title);
      const sectionId = existingSection?.id || generateUUID();

      // Transform cards
      const newCards: Card[] = sectionData.cards.map((cardData: any) => {
        const transformedContent = transformContent(cardData.content, sectionData.title);
        const transformedTags = transformTags(cardData.tags);

        return {
          id: generateUUID(),
          sectionId,
          content: transformedContent,
          tags: transformedTags,
          helpfulnessScore: cardData.helpfulnessScore || 0,
          priority: cardData.priority || false,
          markedForMerge: cardData.markedForMerge || false,
          createdAt: now,
        };
      });

      // Merge with existing cards if section exists
      const cards = existingSection
        ? [...(existingSection.cards || []), ...newCards]
        : newCards;

      return {
        id: sectionId,
        title: sectionData.title,
        cards,
      };
    });

    // Upsert deck
    if (existingDeck.length > 0) {
      await sql`
        UPDATE decks
        SET
          sections = ${JSON.stringify(transformedSections)}::jsonb,
          updated_at = ${now}
        WHERE id = ${deckId}
      `;
      console.log(`  ✅ [Neon Import] Deck updated successfully: "${deckData.name}"`);
    } else {
      await sql`
        INSERT INTO decks (id, name, tags, discipline, sections, created_at, updated_at)
        VALUES (
          ${deckId},
          ${deckData.name},
          ${JSON.stringify([])}::jsonb,
          ${deckData.discipline || null},
          ${JSON.stringify(transformedSections)}::jsonb,
          ${now},
          ${now}
        )
      `;
      console.log(`  ✅ [Neon Import] Deck created successfully: "${deckData.name}"`);
    }

    // Count cards
    const totalCards = transformedSections.reduce((sum, s) => sum + s.cards.length, 0);
    console.log(`  📊 [Neon Import] Total cards: ${totalCards}`);
  }

  console.log('\n✅ [Neon Import] Import complete!');
}

// Run the import
importToNeon().catch((error) => {
  console.error('❌ [Neon Import] Error:', error);
  process.exit(1);
});

