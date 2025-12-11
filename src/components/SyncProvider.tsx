// Sync Provider: Handles initial sync from Neon and error handling

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { syncAllDecksFromNeon, syncAllGoalsFromNeon, SyncResult } from '../db/sync/syncFromNeon';
import { getErrorMessage, isNetworkError } from '../utils/errorHandler';
import SyncErrorModal from './SyncErrorModal';
import { logger } from '../utils/logger';

interface SyncContextType {
  isSyncing: boolean;
  syncError: string | null;
  retrySync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextType>({
  isSyncing: false,
  syncError: null,
  retrySync: async () => {},
});

export const useSync = () => useContext(SyncContext);

interface SyncProviderProps {
  children: ReactNode;
}

export default function SyncProvider({ children }: SyncProviderProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const performSync = async (): Promise<SyncResult> => {
    setIsSyncing(true);
    setSyncError(null);

    try {
      // Sync both decks and goals
      const decksResult = await syncAllDecksFromNeon();
      const goalsResult = await syncAllGoalsFromNeon();

      if (!decksResult.success) {
        throw new Error(decksResult.error || 'Decks sync failed');
      }

      if (!goalsResult.success) {
        throw new Error(goalsResult.error || 'Goals sync failed');
      }

      const wasOutOfSync = decksResult.wasOutOfSync || goalsResult.wasOutOfSync;
      logger.info(`[SyncProvider] Sync result: ${decksResult.decksSynced} decks, ${goalsResult.goalsSynced} goals synced, wasOutOfSync: ${wasOutOfSync}`);

      // Only reload if we actually synced data (wasOutOfSync = true) and got data
      if (wasOutOfSync && (decksResult.decksSynced > 0 || goalsResult.goalsSynced > 0)) {
        logger.info('[SyncProvider] Data was out of sync and has been updated, reloading page to refresh all components...');
        // Small delay to ensure state is saved before reload
        setTimeout(() => {
          window.location.reload();
        }, 100);
      }

      return decksResult;
      } catch (error: any) {
        const errorMessage = getErrorMessage(error);
        logger.error('[SyncProvider] Sync error:', errorMessage);
        setSyncError(errorMessage);
        throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const retrySync = async () => {
    try {
      await performSync();
      setShowErrorModal(false);
    } catch (error: any) {
      // Error is already set in state, modal will show it
    }
  };

  // Initial sync on app load
  useEffect(() => {
    async function initialSync() {
      if (hasInitialized) return;

      try {
        // In production/preview builds (Vercel), API is on same domain (relative URLs), so always try to sync
        // In local development, check if VITE_API_URL is configured
        const apiUrl = import.meta.env.VITE_API_URL;
        if (!import.meta.env.PROD && !apiUrl) {
          logger.debug('[SyncProvider] API not configured, skipping sync');
          setHasInitialized(true);
          return;
        }

        // Check sync status first - only sync if IndexedDB is out of sync
        logger.verbose('[SyncProvider] Checking if sync is needed...');
        const { checkSyncStatus, checkGoalsSyncStatus } = await import('../db/sync/syncFromNeon');
        const syncStatus = await checkSyncStatus();
        const goalsSyncStatus = await checkGoalsSyncStatus();

        const needsSync = syncStatus.needsSync || goalsSyncStatus.needsSync;
        if (!needsSync) {
          logger.verbose(`[SyncProvider] No sync needed: ${syncStatus.reason}, ${goalsSyncStatus.reason}`);
          setHasInitialized(true);
          return;
        }

        // Sync is needed - perform the sync
        logger.info(`[SyncProvider] Sync needed: ${syncStatus.reason || goalsSyncStatus.reason}`);
        logger.info('[SyncProvider] Starting sync from Neon...');
        await performSync();

        setHasInitialized(true);
      } catch (error: any) {
        logger.error('[SyncProvider] Initial sync failed:', error);
        setHasInitialized(true);

        // Only show error modal if it's a network error
        if (isNetworkError(error)) {
          setShowErrorModal(true);
        }
      }
    }

    initialSync();
  }, [hasInitialized]);

  return (
    <SyncContext.Provider value={{ isSyncing, syncError, retrySync }}>
      {children}
      {isSyncing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="liquid-glass liquid-glass--card p-6">
            <div className="liquid-glass__content">
              <div className="flex items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <p className="text-white text-lg">Syncing from cloud...</p>
              </div>
            </div>
          </div>
        </div>
      )}
      <SyncErrorModal
        isOpen={showErrorModal}
        title="Sync Failed"
        message={syncError || 'Failed to sync data from cloud. Please check your internet connection.'}
        onRetry={retrySync}
        onClose={() => setShowErrorModal(false)}
        isRetrying={isSyncing}
      />
    </SyncContext.Provider>
  );
}

