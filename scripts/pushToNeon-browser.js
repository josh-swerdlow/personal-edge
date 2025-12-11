// One-line browser console script to push IndexedDB data to production
//
// Usage:
// 1. Open your app in the browser (localhost)
// 2. Open browser console (F12)
// 3. Copy and paste this entire script
// 4. It will push all your localhost data to production
//
// You can also set the API URL by modifying the API_URL variable below

(async function pushToProduction() {
  // Set your production API URL here (or it will try to detect from environment)
  const API_URL = window.location.origin.includes('localhost')
    ? (prompt('Enter your production API URL (e.g., https://your-app.vercel.app):') || '')
    : window.location.origin;

  if (!API_URL) {
    console.error('❌ API URL required. Please run the script again and provide the URL.');
    return;
  }

  console.log('🚀 Starting push to production...');
  console.log(`🌐 API URL: ${API_URL}\n`);

  try {
    // Get all decks from IndexedDB
    const dbName = 'TrainingCoachDB';
    const request = indexedDB.open(dbName, 2);

    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const transaction = db.transaction(['decks'], 'readonly');
    const store = transaction.objectStore('decks');
    const getAllRequest = store.getAll();

    const decks = await new Promise((resolve, reject) => {
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });

    console.log(`📦 Found ${decks.length} deck(s) in IndexedDB\n`);

    if (decks.length === 0) {
      console.log('⚠️  No decks found in IndexedDB. Nothing to push.');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    // Push each deck
    for (const deck of decks) {
      try {
        console.log(`📦 Processing: "${deck.name}"`);
        console.log(`   ID: ${deck.id}`);
        console.log(`   Discipline: ${deck.discipline || 'N/A'}`);
        console.log(`   Sections: ${deck.sections?.length || 0}`);

        // Check if deck exists
        let exists = false;
        try {
          const response = await fetch(`${API_URL}/api/decks/${deck.id}`);
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
          const response = await fetch(`${API_URL}/api/decks/${deck.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deckData),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          console.log(`  ✅ Updated: "${deck.name}"`);
        } else {
          console.log(`  ➕ Creating new deck...`);
          const response = await fetch(`${API_URL}/api/decks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(deckData),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          console.log(`  ✅ Created: "${deck.name}"`);
        }

        // Count cards
        const totalCards = (deck.sections || []).reduce(
          (sum, s) => sum + (s.cards?.length || 0),
          0
        );
        console.log(`   📊 Total cards: ${totalCards}\n`);

        successCount++;
      } catch (error) {
        console.error(`  ❌ Error pushing deck "${deck.name}":`, error.message);
        errorCount++;
      }
    }

    console.log('='.repeat(50));
    console.log('✅ Push complete!');
    console.log(`   Success: ${successCount}`);
    if (errorCount > 0) {
      console.log(`   Errors: ${errorCount}`);
    }
    console.log('='.repeat(50));
  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
})();

