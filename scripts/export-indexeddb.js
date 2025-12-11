// Browser console script to export IndexedDB data
//
// Usage:
// 1. Open your app in the browser (localhost)
// 2. Open browser console (F12)
// 3. Copy and paste this entire script
// 4. The export will download automatically as a JSON file
//
// Then run: pnpm run db

(async function exportIndexedDB() {
  console.log('📦 Exporting IndexedDB data...');

  try {
    // Import Dexie (should already be available in the app)
    // If not, we'll use the global window object
    const dbName = 'TrainingCoachDB';

    // Open the database
    const request = indexedDB.open(dbName, 2);

    const db = await new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    // Get all decks from the decks store
    const transaction = db.transaction(['decks'], 'readonly');
    const store = transaction.objectStore('decks');
    const getAllRequest = store.getAll();

    const decks = await new Promise((resolve, reject) => {
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });

    console.log(`✅ Found ${decks.length} deck(s)`);

    // Create download
    const dataStr = JSON.stringify(decks, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'indexeddb-export.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('✅ Export complete! File downloaded as indexeddb-export.json');
    console.log('📝 Next step: Move the file to scripts/indexeddb-export.json');
    console.log('   Then run: pnpm run db');

    return decks;
  } catch (error) {
    console.error('❌ Export failed:', error);
    throw error;
  }
})();

