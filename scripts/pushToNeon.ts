// CLI tool to push localhost IndexedDB data to production Neon database
// Usage: pnpm run db
//
// NOTE: For a simpler one-line solution, use the browser console script:
// scripts/pushToNeon-browser.js - just paste it in the browser console!
//
// This CLI version reads from a local export file (legacy method)

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Deck {
  id: string;
  name: string;
  tags?: string[];
  discipline?: "Spins" | "Jumps" | "Edges";
  animal?: "bee" | "duck" | "cow" | "rabbit" | "dolphin" | "squid";
  createdAt: number;
  updatedAt: number;
  sections: any[];
}

// Get API URL from environment
function getApiUrl(): string {
  const apiUrl = process.env.VITE_API_URL || process.env.API_URL;
  if (apiUrl) {
    return apiUrl.replace(/\/+$/, ''); // Remove trailing slashes
  }

  // Prompt user to set API URL
  console.error('❌ Error: API URL not configured');
  console.error('');
  console.error('Please set one of the following environment variables:');
  console.error('  - VITE_API_URL (for production)');
  console.error('  - API_URL (alternative)');
  console.error('');
  console.error('Example:');
  console.error('  API_URL=https://your-app.vercel.app pnpm run db');
  console.error('  or');
  console.error('  VITE_API_URL=https://your-app.vercel.app pnpm run db');
  console.error('');
  process.exit(1);
}

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const apiUrl = getApiUrl();
  const url = `${apiUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

async function checkDeckExists(deckId: string): Promise<boolean> {
  try {
    await apiRequest(`/api/decks/${deckId}`);
    return true;
  } catch (error: any) {
    if (error.message.includes('404') || error.message.includes('not found')) {
      return false;
    }
    throw error;
  }
}

async function pushDeck(deck: Deck): Promise<void> {
  const exists = await checkDeckExists(deck.id);

  if (exists) {
    console.log(`  📝 Updating existing deck: "${deck.name}"`);
    await apiRequest(`/api/decks/${deck.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: deck.name,
        tags: deck.tags || [],
        discipline: deck.discipline,
        animal: deck.animal,
        sections: deck.sections || [],
      }),
    });
    console.log(`  ✅ Updated: "${deck.name}"`);
  } else {
    console.log(`  ➕ Creating new deck: "${deck.name}"`);
    await apiRequest('/api/decks', {
      method: 'POST',
      body: JSON.stringify({
        id: deck.id,
        name: deck.name,
        tags: deck.tags || [],
        discipline: deck.discipline,
        animal: deck.animal,
        sections: deck.sections || [],
      }),
    });
    console.log(`  ✅ Created: "${deck.name}"`);
  }
}

async function pushToNeon() {
  const exportFile = join(__dirname, 'indexeddb-export.json');

  if (!existsSync(exportFile)) {
    console.error('❌ Error: indexeddb-export.json not found');
    console.error('');
    console.error('Please export your IndexedDB data first:');
    console.error('1. Open your app in the browser (localhost)');
    console.error('2. Open browser console (F12)');
    console.error('3. Run the export script (see scripts/export-indexeddb.js)');
    console.error('4. Save the exported JSON to scripts/indexeddb-export.json');
    console.error('');
    process.exit(1);
  }

  console.log('🚀 [Push to Neon] Starting push to production...\n');

  let decks: Deck[];
  try {
    const fileContent = readFileSync(exportFile, 'utf-8');
    decks = JSON.parse(fileContent);

    if (!Array.isArray(decks)) {
      throw new Error('Export file must contain an array of decks');
    }
  } catch (error: any) {
    console.error('❌ Error reading export file:', error.message);
    process.exit(1);
  }

  console.log(`📦 Found ${decks.length} deck(s) to push\n`);

  const apiUrl = getApiUrl();
  console.log(`🌐 API URL: ${apiUrl}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (const deck of decks) {
    try {
      console.log(`\n📦 Processing: "${deck.name}"`);
      console.log(`   ID: ${deck.id}`);
      console.log(`   Discipline: ${deck.discipline || 'N/A'}`);
      console.log(`   Sections: ${deck.sections?.length || 0}`);

      await pushDeck(deck);
      successCount++;

      // Count cards
      const totalCards = (deck.sections || []).reduce(
        (sum, s) => sum + (s.cards?.length || 0),
        0
      );
      console.log(`   📊 Total cards: ${totalCards}`);
    } catch (error: any) {
      console.error(`   ❌ Error pushing deck "${deck.name}":`, error.message);
      errorCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Push complete!');
  console.log(`   Success: ${successCount}`);
  if (errorCount > 0) {
    console.log(`   Errors: ${errorCount}`);
  }
  console.log('='.repeat(50));

  if (errorCount > 0) {
    process.exit(1);
  }
}

// Run the push
pushToNeon().catch((error) => {
  console.error('❌ [Push to Neon] Fatal error:', error);
  process.exit(1);
});

