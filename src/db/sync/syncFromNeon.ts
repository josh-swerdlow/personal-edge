// Sync utility: Sync all data from Neon (source of truth) to IndexedDB (local cache)

import { getAllDecksFromNeon } from '../training-coach/neon-operations';
import { trainingCoachDB } from '../training-coach/db';
import { Deck } from '../training-coach/types';
import { getAllDecks } from '../training-coach/operations';
import { getAllGoalsFromNeon, getAppDataFromNeon } from '../progress-tracker/neon-operations';
import { progressTrackerDB } from '../progress-tracker/db';
import { Goal, AppData } from '../progress-tracker/types';
import { getAllGoals } from '../progress-tracker/operations';
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

// ========== Progress Tracker Sync Functions ==========

export interface GoalsSyncResult {
  success: boolean;
  goalsSynced: number;
  error?: string;
  wasOutOfSync?: boolean;
}

export interface GoalsSyncStatus {
  needsSync: boolean;
  reason: string;
  localGoalCount: number;
  remoteGoalCount: number;
  localLastUpdated: number | null;
  remoteLastUpdated: number | null;
}

export async function checkGoalsSyncStatus(): Promise<GoalsSyncStatus> {
  try {
    // Get local goals from IndexedDB
    const localGoals = await getAllGoals();
    const localGoalCount = localGoals.length;
    const localLastUpdated = localGoals.length > 0
      ? Math.max(...localGoals.map(g => g.createdAt))
      : null;

    // Get remote goals from Neon
    const remoteGoals = await getAllGoalsFromNeon();
    const remoteGoalCount = remoteGoals.length;
    const remoteLastUpdated = remoteGoals.length > 0
      ? Math.max(...remoteGoals.map(g => g.createdAt))
      : null;

    // Check if sync is needed
    let needsSync = false;
    let reason = '';

    if (localGoalCount === 0 && remoteGoalCount > 0) {
      needsSync = true;
      reason = 'IndexedDB is empty but Neon has goals';
    } else if (localGoalCount > 0 && remoteGoalCount === 0) {
      needsSync = false;
      reason = 'IndexedDB has goals but Neon is empty (local dev mode)';
    } else if (localLastUpdated === null && remoteLastUpdated !== null) {
      needsSync = true;
      reason = 'IndexedDB has no timestamps, Neon has goals';
    } else if (remoteLastUpdated !== null && localLastUpdated !== null && remoteLastUpdated > localLastUpdated) {
      needsSync = true;
      reason = `Neon is newer (${new Date(remoteLastUpdated).toISOString()} vs ${new Date(localLastUpdated).toISOString()})`;
    } else if (localGoalCount !== remoteGoalCount) {
      needsSync = true;
      reason = `Goal count mismatch (local: ${localGoalCount}, remote: ${remoteGoalCount})`;
    } else {
      needsSync = false;
      reason = 'IndexedDB is in sync with Neon';
    }

    return {
      needsSync,
      reason,
      localGoalCount,
      remoteGoalCount,
      localLastUpdated,
      remoteLastUpdated,
    };
  } catch (error: any) {
    logger.error('[Sync] Error checking goals sync status:', error);
    // If we can't check, assume we need to sync (safer)
    return {
      needsSync: true,
      reason: `Error checking goals sync status: ${error.message}`,
      localGoalCount: 0,
      remoteGoalCount: 0,
      localLastUpdated: null,
      remoteLastUpdated: null,
    };
  }
}

export async function syncAllGoalsFromNeon(): Promise<GoalsSyncResult> {
  try {
    logger.verbose('[Sync] Checking if goals sync is needed...');

    // Check sync status first
    const syncStatus = await checkGoalsSyncStatus();
    logger.verbose('[Sync] Goals sync status:', syncStatus);

    if (!syncStatus.needsSync) {
      logger.verbose(`[Sync] No goals sync needed: ${syncStatus.reason}`);
      return {
        success: true,
        goalsSynced: 0,
        wasOutOfSync: false,
      };
    }

    logger.info(`[Sync] Goals sync needed: ${syncStatus.reason}`);
    logger.info('[Sync] Starting goals sync from Neon to IndexedDB...');

    // Fetch all goals from Neon
    const neonGoals = await getAllGoalsFromNeon();
    logger.info(`[Sync] Fetched ${neonGoals.length} goals from Neon`);

    // Clear existing goals in IndexedDB
    await progressTrackerDB.goals.clear();
    logger.verbose('[Sync] Cleared IndexedDB goals');

    // Add all goals to IndexedDB
    if (neonGoals.length > 0) {
      await progressTrackerDB.goals.bulkAdd(neonGoals);
      logger.info(`[Sync] Added ${neonGoals.length} goals to IndexedDB`);
    }

    // Also sync app data
    const neonAppData = await getAppDataFromNeon();
    if (neonAppData) {
      await progressTrackerDB.appData.put(neonAppData);
      logger.verbose('[Sync] Synced app data from Neon');
    }

    logger.info('[Sync] Goals sync complete!');
    return {
      success: true,
      goalsSynced: neonGoals.length,
      wasOutOfSync: true,
    };
  } catch (error: any) {
    logger.error('[Sync] Goals sync failed:', error);
    return {
      success: false,
      goalsSynced: 0,
      error: error.message || 'Unknown error during goals sync',
      wasOutOfSync: false,
    };
  }
}

export async function syncGoalFromNeon(goalId: string): Promise<Goal | null> {
  try {
    const { getGoalFromNeon } = await import('../progress-tracker/neon-operations');
    const goal = await getGoalFromNeon(goalId);

    if (goal) {
      // Upsert the goal in IndexedDB
      await progressTrackerDB.goals.put(goal);
      logger.verbose(`[Sync] Synced goal ${goalId} to IndexedDB`);
    }

    return goal;
  } catch (error: any) {
    logger.error(`[Sync] Failed to sync goal ${goalId}:`, error);
    throw error;
  }
}

export async function syncAppDataFromNeon(): Promise<AppData | null> {
  try {
    const appData = await getAppDataFromNeon();

    if (appData) {
      // Upsert the app data in IndexedDB
      await progressTrackerDB.appData.put(appData);
      logger.verbose('[Sync] Synced app data to IndexedDB');
    }

    return appData;
  } catch (error: any) {
    logger.error('[Sync] Failed to sync app data:', error);
    throw error;
  }
}

