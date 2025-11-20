# Security Setup

## Important: Database Credentials

**Never expose database credentials to client-side code!**

This app uses a backend API server to keep database credentials secure.

## Setup

### 1. Backend API Server

The backend API server (`server/index.ts`) handles all database operations securely.

**Start the server:**
```bash
npm run server
# or for development with auto-reload:
npm run dev:server
```

The server runs on `http://localhost:3001` by default.

### 2. Environment Variables

**Backend (`.env.local` or server environment):**
```bash
DATABASE_URL=postgresql://user:password@host/database?sslmode=require
PORT=3001  # Optional, defaults to 3001
```

**Frontend (`.env.local`):**
```bash
VITE_API_URL=http://localhost:3001
```

For production, set:
```bash
VITE_API_URL=https://your-api-domain.com
```

### 3. How It Works

1. **Frontend** → Calls API endpoints (no database credentials)
2. **Backend API** → Connects to Neon PostgreSQL (credentials stay on server)
3. **Database** → Only accessible via the backend

### 4. Security Benefits

✅ Database credentials never exposed to client
✅ Can add authentication/authorization to API
✅ Can rate limit API requests
✅ Can add request validation
✅ Credentials stay on server only

### 5. Production Deployment

- Deploy backend API to a server (Railway, Render, Fly.io, etc.)
- Set `DATABASE_URL` in your hosting platform's environment variables
- Set `VITE_API_URL` to your deployed API URL
- Build and deploy frontend

