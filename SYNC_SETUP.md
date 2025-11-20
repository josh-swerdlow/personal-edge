# Neon Sync Setup

This app uses Neon PostgreSQL as the source of truth, with IndexedDB as a local cache for offline use.

**⚠️ IMPORTANT: For security, database credentials are kept on the backend API server, not in the frontend.**

## Architecture

- **Backend API**: Secure server that handles all database operations
- **Neon PostgreSQL**: Source of truth (cloud database)
- **IndexedDB**: Local cache (offline-first, fast reads)
- **Sync Strategy**:
  - **On App Load**: Sync all data from API → IndexedDB
  - **On Write**: Write to API (which writes to Neon) first, then sync back to IndexedDB
  - **On Read**: Read from IndexedDB only (fast, works offline)

## Setup

1. **Start the Backend API Server**

   ```bash
   npm run server
   # or for development with auto-reload:
   npm run dev:server
   ```

   The server runs on `http://localhost:3001` by default.

2. **Set Environment Variables**

   **Backend (`.env.local` or server environment):**
   ```
   DATABASE_URL=postgresql://user:password@host/database?sslmode=require
   PORT=3001  # Optional, defaults to 3001
   ```

   **Frontend (`.env.local`):**
   ```
   VITE_API_URL=http://localhost:3001
   ```

   For production, set `VITE_API_URL` to your deployed API URL.

2. **Database Schema**

   The schema is automatically created when you run the import script or when the app first syncs. The schema includes:
   - `id` (TEXT PRIMARY KEY)
   - `name` (TEXT)
   - `tags` (JSONB)
   - `discipline` (TEXT)
   - `animal` (TEXT)
   - `sections` (JSONB) - Contains all sections and cards
   - `created_at` (BIGINT)
   - `updated_at` (BIGINT)

3. **Testing**

   - **With Neon**: App will sync on load and all writes go to Neon
   - **Without Neon**: App works offline with IndexedDB only (for local dev)

## Error Handling

The app includes user-friendly error handling:

- **Network Errors**: Shows modal with retry option
- **Sync Failures**: Shows modal with retry option
- **Automatic Retries**: Operations retry up to 3 times with exponential backoff

## Manual Sync

You can manually trigger a sync by calling:
```javascript
import { syncAllDecksFromNeon } from './db/sync/syncFromNeon';
await syncAllDecksFromNeon();
```

## Import Data to Neon

To import data from JSON files to Neon:
```bash
DATABASE_URL=your_neon_url npm run import:neon
```

