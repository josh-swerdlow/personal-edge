# Deploying to Vercel

This guide explains how to deploy both the frontend and backend API to Vercel.

## Architecture

- **Frontend**: React app built with Vite (served as static files)
- **Backend API**: Express server running as Vercel serverless functions
- **Routes**:
  - `/api/*` → Backend API serverless function
  - `/*` → Frontend React app

## Setup Steps

### 1. Install Vercel CLI (optional, for local testing)

```bash
npm i -g vercel
```

### 2. Deploy to Vercel

**Option A: Using Vercel Dashboard**
1. Go to [vercel.com](https://vercel.com)
2. Import your Git repository
3. Vercel will auto-detect the Vite framework
4. Add environment variables (see below)
5. Deploy

**Option B: Using Vercel CLI**
```bash
vercel
```

### 3. Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables, add:

**For Backend (Serverless Functions):**
- `DATABASE_URL` - Your Neon PostgreSQL connection string
  ```
  postgresql://user:password@host/database?sslmode=require
  ```

**For Frontend (Build-time):**
- `VITE_API_URL` - Your Vercel deployment URL (will be set automatically)
  ```
  https://your-project.vercel.app
  ```

**Important**:
- `DATABASE_URL` is only available to serverless functions (backend)
- `VITE_API_URL` is baked into the frontend build
- After first deployment, update `VITE_API_URL` to your actual Vercel URL

### 4. Update Frontend API URL

After your first deployment:

1. Get your Vercel deployment URL (e.g., `https://your-project.vercel.app`)
2. Update the `VITE_API_URL` environment variable in Vercel
3. Redeploy (or it will auto-redeploy on next push)

### 5. How It Works

- **API Routes** (`/api/*`): Handled by `api/index.ts` → Express server as serverless function
- **Frontend Routes** (`/*`): Served from `dist/` directory (Vite build output)
- **Build Process**:
  1. Vercel runs `npm run build` (builds frontend)
  2. Vercel compiles `api/index.ts` as serverless function
  3. Both are deployed together

## Local Testing

Test the Vercel setup locally:

```bash
vercel dev
```

This will:
- Start the frontend dev server
- Run API routes as serverless functions
- Simulate the Vercel environment

## Troubleshooting

### API Routes Not Working

- Check that `api/index.ts` exists and exports the Express app
- Verify `vercel.json` has correct rewrites
- Check serverless function logs in Vercel dashboard

### Environment Variables Not Available

- `DATABASE_URL` is only available in serverless functions (backend)
- `VITE_API_URL` must be set at build time
- Redeploy after changing environment variables

### CORS Issues

- The Express app already has CORS enabled
- If issues persist, check the `cors()` configuration in `server/index.ts`

## Production Checklist

- [ ] `DATABASE_URL` set in Vercel environment variables
- [ ] `VITE_API_URL` set to your Vercel deployment URL
- [ ] Database schema created in Neon
- [ ] Test API endpoints work (`/api/decks`)
- [ ] Test frontend can connect to API
- [ ] Verify sync works on first load

