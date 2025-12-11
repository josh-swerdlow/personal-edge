// Utility to push IndexedDB data to production via API
// Exposed on window object for console access

import { trainingCoachDB } from '../db/training-coach/db';
import { progressTrackerDB } from '../db/progress-tracker/db';
import { logger } from './logger';

export async function pushToProduction(apiUrl?: string): Promise<void> {
  // Get API URL from parameter, environment, or prompt
  let targetApiUrl = apiUrl;

  if (!targetApiUrl) {
    // Check if we're on localhost
    if (window.location.origin.includes('localhost')) {
      const promptUrl = prompt('Enter your production API URL (e.g., https://your-app.vercel.app):');
      if (!promptUrl) {
        console.error('❌ API URL required. Operation cancelled.');
        return;
      }
      targetApiUrl = promptUrl.trim();
    } else {
      // Use current origin if already on production
      targetApiUrl = window.location.origin;
    }
  }

  // Remove trailing slashes
  targetApiUrl = targetApiUrl.replace(/\/+$/, '');

  console.log('🚀 Starting push to production...');
  console.log(`🌐 API URL: ${targetApiUrl}\n`);

  try {
    // Get all data from IndexedDB
    const decks = await trainingCoachDB.decks.toArray();
    const goals = await progressTrackerDB.goals.toArray();
    const appData = await progressTrackerDB.appData.get('app-data-1');

    console.log(`📦 Found ${decks.length} deck(s), ${goals.length} goal(s), ${appData ? '1' : '0'} app data in IndexedDB\n`);

    if (decks.length === 0 && goals.length === 0 && !appData) {
      console.log('⚠️  No data found in IndexedDB. Nothing to push.');
      return;
    }

    let deckSuccessCount = 0;
    let deckErrorCount = 0;
    let goalSuccessCount = 0;
    let goalErrorCount = 0;
    let appDataSuccess = false;

    // Push decks
    if (decks.length > 0) {
      console.log('📚 Pushing decks...\n');
      for (const deck of decks) {
        try {
          console.log(`📦 Processing deck: "${deck.name}"`);
          console.log(`   ID: ${deck.id}`);
          console.log(`   Discipline: ${deck.discipline || 'N/A'}`);
          console.log(`   Sections: ${deck.sections?.length || 0}`);

          // Check if deck exists
          let exists = false;
          try {
            const response = await fetch(`${targetApiUrl}/api/decks/${deck.id}`);
            exists = response.ok;
          } catch (e) {
            // Deck doesn't exist or error checking
          }

          // Prepare deck data
          const deckData = {
            id: deck.id,
            name: deck.name,
            tags: deck.tags || [],
            discipline: deck.discipline,
            animal: deck.animal,
            sections: deck.sections || [],
          };

          if (exists) {
            console.log(`  📝 Updating existing deck...`);
            const response = await fetch(`${targetApiUrl}/api/decks/${deck.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(deckData),
            });

            if (!response.ok) {
              const error = await response.json().catch(() => ({ error: response.statusText }));
              throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            console.log(`  ✅ Updated: "${deck.name}"`);
          } else {
            console.log(`  ➕ Creating new deck...`);
            const response = await fetch(`${targetApiUrl}/api/decks`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(deckData),
            });

            if (!response.ok) {
              const error = await response.json().catch(() => ({ error: response.statusText }));
              throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            console.log(`  ✅ Created: "${deck.name}"`);
          }

          // Count cards
          const totalCards = (deck.sections || []).reduce(
            (sum, s) => sum + (s.cards?.length || 0),
            0
          );
          console.log(`   📊 Total cards: ${totalCards}\n`);

          deckSuccessCount++;
        } catch (error: any) {
          console.error(`  ❌ Error pushing deck "${deck.name}":`, error.message);
          deckErrorCount++;
          logger.error(`[pushToProduction] Error pushing deck ${deck.id}:`, error);
        }
      }
    }

    // Push goals
    if (goals.length > 0) {
      console.log('🎯 Pushing goals...\n');
      for (const goal of goals) {
        try {
          console.log(`🎯 Processing goal: "${goal.content.substring(0, 50)}${goal.content.length > 50 ? '...' : ''}"`);
          console.log(`   ID: ${goal.id}`);
          console.log(`   Discipline: ${goal.discipline}, Type: ${goal.type}`);

          // Check if goal exists
          let exists = false;
          try {
            const response = await fetch(`${targetApiUrl}/api/goals/${goal.id}`);
            exists = response.ok;
          } catch (e) {
            // Goal doesn't exist or error checking
          }

          // Prepare goal data
          const goalData = {
            id: goal.id,
            discipline: goal.discipline,
            type: goal.type,
            content: goal.content,
            containerId: goal.containerId,
            archivedAt: goal.archivedAt,
            weekStartDate: goal.weekStartDate,
          };

          if (exists) {
            console.log(`  📝 Updating existing goal...`);
            const response = await fetch(`${targetApiUrl}/api/goals/${goal.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(goalData),
            });

            if (!response.ok) {
              const error = await response.json().catch(() => ({ error: response.statusText }));
              throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            console.log(`  ✅ Updated goal\n`);
          } else {
            console.log(`  ➕ Creating new goal...`);
            const response = await fetch(`${targetApiUrl}/api/goals`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(goalData),
            });

            if (!response.ok) {
              const error = await response.json().catch(() => ({ error: response.statusText }));
              throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
            }
            console.log(`  ✅ Created goal\n`);
          }

          goalSuccessCount++;
        } catch (error: any) {
          console.error(`  ❌ Error pushing goal ${goal.id}:`, error.message);
          goalErrorCount++;
          logger.error(`[pushToProduction] Error pushing goal ${goal.id}:`, error);
        }
      }
    }

    // Push app data
    if (appData) {
      console.log('⚙️  Pushing app data...\n');
      try {
        console.log(`⚙️  Processing app data`);
        console.log(`   Start Date: ${appData.startDate}`);
        console.log(`   Cycle Length: ${appData.cycleLength}`);

        const response = await fetch(`${targetApiUrl}/api/app-data`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startDate: appData.startDate,
            cycleLength: appData.cycleLength,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: response.statusText }));
          throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        console.log(`  ✅ Updated app data\n`);
        appDataSuccess = true;
      } catch (error: any) {
        console.error(`  ❌ Error pushing app data:`, error.message);
        logger.error(`[pushToProduction] Error pushing app data:`, error);
      }
    }

    console.log('='.repeat(50));
    console.log('✅ Push complete!');
    console.log(`   Decks: ${deckSuccessCount} success, ${deckErrorCount} errors`);
    console.log(`   Goals: ${goalSuccessCount} success, ${goalErrorCount} errors`);
    console.log(`   App Data: ${appDataSuccess ? 'success' : 'skipped'}`);
    if (deckErrorCount > 0 || goalErrorCount > 0) {
      console.log(`   ⚠️  Some items failed to push`);
    }
    console.log('='.repeat(50));
  } catch (error: any) {
    console.error('❌ Fatal error:', error);
    logger.error('[pushToProduction] Fatal error:', error);
    throw error;
  }
}

