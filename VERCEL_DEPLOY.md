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

**Option A: Add from `.env.local` using Vercel Dashboard (Easiest)**

1. Open your `.env.local` file
2. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
3. For each variable in `.env.local`, click "Add New" and enter:
   - **Name**: The variable name (e.g., `DATABASE_URL` or `VITE_API_URL`)
   - **Value**: The value from your `.env.local` file
   - **Environment**: Select which environments (Production, Preview, Development)

**Option B: Add using Vercel CLI (One at a time)**

For each variable in your `.env.local`, run:

```bash
# Add DATABASE_URL (for backend/serverless functions)
vercel env add DATABASE_URL

# Add VITE_API_URL (for frontend build)
vercel env add VITE_API_URL
```

The CLI will prompt you for the value and which environments to apply it to.

**Option C: Use a script to automate (Advanced)**

A helper script is provided to automate adding variables:

```bash
./scripts/push-env-to-vercel.sh
```

This will read your `.env.local` file and prompt you to add each variable to Vercel.

**Option B: Manual Setup in Vercel Dashboard**

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add each variable manually:

**For Backend (Serverless Functions):**
- `DATABASE_URL` - Your Neon PostgreSQL connection string
  ```
  postgresql://user:password@host/database?sslmode=require
  ```
  - Select: Production, Preview, Development (all environments)

**For Frontend (Build-time):**
- `VITE_API_URL` - Your Vercel deployment URL
  ```
  https://your-project.vercel.app
  ```
  - Select: Production, Preview, Development (all environments)
  - **Note**: Set this after your first deployment with the actual Vercel URL

**Important**:
- `DATABASE_URL` is only available to serverless functions (backend)
- `VITE_API_URL` is baked into the frontend build at build time
- After first deployment, update `VITE_API_URL` to your actual Vercel URL
- Variables starting with `VITE_` are available to the frontend
- Other variables are only available to serverless functions

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
- Automatically use environment variables from Vercel (or `.env.local` if not set in Vercel)

**Note**: `vercel dev` will pull environment variables from your Vercel project. To use local `.env.local` instead, you can:
1. Use `vercel env pull .env.local` to sync Vercel env vars to local
2. Or just run your normal dev server: `npm run dev` and `npm run server`

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

