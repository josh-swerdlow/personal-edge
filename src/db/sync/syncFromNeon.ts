// Sync utility: Sync all data from Neon (source of truth) to IndexedDB (local cache)

import { getAllDecksFromNeon } from '../training-coach/neon-operations';
import { trainingCoachDB } from '../training-coach/db';
import { Deck } from '../training-coach/types';
import { getAllDecks } from '../training-coach/operations';
import { logger } from '../../utils/logger';

export interface SyncResult {
  success: boolean;
  decksSynced: number;
  error?: string;
  wasOutOfSync?: boolean;
}

export interface SyncStatus {
  needsSync: boolean;
  reason: string;
  localDeckCount: number;
  remoteDeckCount: number;
  localLastUpdated: number | null;
  remoteLastUpdated: number | null;
}

export async function checkSyncStatus(): Promise<SyncStatus> {
  try {
    // Get local decks from IndexedDB
    const localDecks = await getAllDecks();
    const localDeckCount = localDecks.length;
    const localLastUpdated = localDecks.length > 0
      ? Math.max(...localDecks.map(d => d.updatedAt))
      : null;

    // Get remote decks from Neon
    const remoteDecks = await getAllDecksFromNeon();
    const remoteDeckCount = remoteDecks.length;
    const remoteLastUpdated = remoteDecks.length > 0
      ? Math.max(...remoteDecks.map(d => d.updatedAt))
      : null;

    // Check if sync is needed
    let needsSync = false;
    let reason = '';

    if (localDeckCount === 0 && remoteDeckCount > 0) {
      needsSync = true;
      reason = 'IndexedDB is empty but Neon has data';
    } else if (localDeckCount > 0 && remoteDeckCount === 0) {
      needsSync = false;
      reason = 'IndexedDB has data but Neon is empty (local dev mode)';
    } else if (localLastUpdated === null && remoteLastUpdated !== null) {
      needsSync = true;
      reason = 'IndexedDB has no timestamps, Neon has data';
    } else if (remoteLastUpdated !== null && localLastUpdated !== null && remoteLastUpdated > localLastUpdated) {
      needsSync = true;
      reason = `Neon is newer (${new Date(remoteLastUpdated).toISOString()} vs ${new Date(localLastUpdated).toISOString()})`;
    } else if (localDeckCount !== remoteDeckCount) {
      needsSync = true;
      reason = `Deck count mismatch (local: ${localDeckCount}, remote: ${remoteDeckCount})`;
    } else {
      needsSync = false;
      reason = 'IndexedDB is in sync with Neon';
    }

    return {
      needsSync,
      reason,
      localDeckCount,
      remoteDeckCount,
      localLastUpdated,
      remoteLastUpdated,
    };
  } catch (error: any) {
    logger.error('[Sync] Error checking sync status:', error);
    // If we can't check, assume we need to sync (safer)
    return {
      needsSync: true,
      reason: `Error checking sync status: ${error.message}`,
      localDeckCount: 0,
      remoteDeckCount: 0,
      localLastUpdated: null,
      remoteLastUpdated: null,
    };
  }
}

export async function syncAllDecksFromNeon(): Promise<SyncResult> {
  try {
    logger.verbose('[Sync] Checking if sync is needed...');

    // Check sync status first
    const syncStatus = await checkSyncStatus();
    logger.verbose('[Sync] Sync status:', syncStatus);

    if (!syncStatus.needsSync) {
      logger.verbose(`[Sync] No sync needed: ${syncStatus.reason}`);
      return {
        success: true,
        decksSynced: 0,
        wasOutOfSync: false,
      };
    }

    logger.info(`[Sync] Sync needed: ${syncStatus.reason}`);
    logger.info('[Sync] Starting sync from Neon to IndexedDB...');

    // Fetch all decks from Neon
    const neonDecks = await getAllDecksFromNeon();
    logger.info(`[Sync] Fetched ${neonDecks.length} decks from Neon`);

    // Clear existing decks in IndexedDB
    await trainingCoachDB.decks.clear();
    logger.verbose('[Sync] Cleared IndexedDB decks');

    // Add all decks to IndexedDB
    if (neonDecks.length > 0) {
      await trainingCoachDB.decks.bulkAdd(neonDecks);
      logger.info(`[Sync] Added ${neonDecks.length} decks to IndexedDB`);
    }

    logger.info('[Sync] Sync complete!');
    return {
      success: true,
      decksSynced: neonDecks.length,
      wasOutOfSync: true,
    };
  } catch (error: any) {
    logger.error('[Sync] Sync failed:', error);
    return {
      success: false,
      decksSynced: 0,
      error: error.message || 'Unknown error during sync',
      wasOutOfSync: false,
    };
  }
}

export async function syncDeckFromNeon(deckId: string): Promise<Deck | null> {
  try {
    const { getDeckFromNeon } = await import('../training-coach/neon-operations');
    const deck = await getDeckFromNeon(deckId);

    if (deck) {
      // Upsert the deck in IndexedDB
      await trainingCoachDB.decks.put(deck);
      logger.verbose(`[Sync] Synced deck ${deckId} to IndexedDB`);
    }

    return deck;
  } catch (error: any) {
    logger.error(`[Sync] Failed to sync deck ${deckId}:`, error);
    throw error;
  }
}

