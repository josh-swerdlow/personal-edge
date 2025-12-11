import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { logger } from './utils/logger'

// Conditionally load seed database function if feature flag is enabled
if (import.meta.env.VITE_ENABLE_SEED === 'true') {
  import('./utils/seedDatabase').then(({ seedDatabase }) => {
    // Expose to window for console access
    (window as Window & { seedDatabase?: typeof seedDatabase }).seedDatabase = seedDatabase;
  }).catch(err => {
    logger.error('Failed to load seed database:', err);
  });
}

// Always expose importUpdate function for database updates
import('./utils/importUpdate').then(({ importUpdate }) => {
  // Expose to window for console access
  (window as Window & { importUpdate?: typeof importUpdate }).importUpdate = importUpdate;
}).catch(err => {
  logger.error('Failed to load import update:', err);
});


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
