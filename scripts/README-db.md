# Push Localhost Data to Production

This tool allows you to push your localhost IndexedDB data to production Neon database.

## Quick Start (Recommended - One Line!)

1. **Open your app in the browser** (localhost)
2. **Open browser console** (F12)
3. **Copy and paste** the entire script from `scripts/pushToNeon-browser.js`
4. **Enter your production API URL** when prompted (e.g., `https://your-app.vercel.app`)
5. **Done!** All your data is pushed to production

That's it! No file exports, no moving files around.

## Alternative: CLI Method (Legacy)

If you prefer the CLI approach:

## Detailed Steps

### Step 1: Export from Browser

1. Open your app in the browser (localhost)
2. Open browser console (F12)
3. Copy and paste the entire script from `scripts/export-indexeddb.js`
4. The script will automatically download `indexeddb-export.json`

### Step 2: Prepare Export File

Move the downloaded file to the scripts directory:
```bash
mv ~/Downloads/indexeddb-export.json scripts/indexeddb-export.json
```

### Step 3: Push to Production

Set your production API URL and run:
```bash
API_URL=https://your-app.vercel.app pnpm run db
```

Or add to your `.env.local`:
```
API_URL=https://your-app.vercel.app
```

Then run:
```bash
pnpm run db
```

## What It Does

- Reads all decks from `scripts/indexeddb-export.json`
- For each deck:
  - Checks if it exists in production (by ID)
  - Updates existing deck or creates new one
  - Preserves all sections, cards, and metadata

## Notes

- The script uses the API endpoints (`/api/decks`), so it works with your deployed serverless functions
- Existing decks are updated (not duplicated)
- New decks are created
- All data (sections, cards, tags, etc.) is preserved

## Troubleshooting

**"API URL not configured"**
- Set `API_URL` or `VITE_API_URL` environment variable
- Use your production Vercel URL (e.g., `https://your-app.vercel.app`)

**"indexeddb-export.json not found"**
- Make sure you exported the data from the browser
- Move the file to `scripts/indexeddb-export.json`

**"HTTP 401/403"**
- Check that your production API is accessible
- Verify the API URL is correct

**"Network error"**
- Check your internet connection
- Verify the API URL is reachable

