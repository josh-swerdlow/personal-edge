# Figure Skating Trainer

A Progressive Web App for tracking figure skating training progress and managing element-specific notes.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Database**: Dexie.js (IndexedDB) for offline storage
- **Styling**: Tailwind CSS
- **PWA**: vite-plugin-pwa
- **Cloud Sync**: Neon (PostgreSQL)

## Project Structure

```
src/
├── db/
│   ├── progress-tracker/    # 3-week cycle goals tracking
│   │   ├── types.ts
│   │   └── db.ts
│   ├── training-coach/      # Deck/Card/Section/Content system
│   │   ├── types.ts
│   │   └── db.ts
│   └── sync/
│       └── neon.ts          # Neon PostgreSQL sync
├── components/              # React components
├── hooks/                   # Custom React hooks
├── pages/                   # Page components
├── utils/                   # Utility functions
└── App.tsx
```

## Setup

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Build for production:
```bash
npm run build
```

## Database Setup

### Local (Dexie/IndexedDB)
The Dexie databases are automatically created when the app runs.

### Neon PostgreSQL (Cloud Sync)

1. Create a Neon database
2. Run the schema and seed scripts:

```bash
# Progress Tracker
psql $DATABASE_URL -f sql/progress-tracker-schema.sql
psql $DATABASE_URL -f sql/progress-tracker-seed.sql

# Training Coach
psql $DATABASE_URL -f sql/training-coach-schema.sql
psql $DATABASE_URL -f sql/training-coach-seed.sql
```

## Development

- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
