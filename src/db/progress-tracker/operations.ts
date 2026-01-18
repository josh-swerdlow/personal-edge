import { progressTrackerDB } from './db';
import { AppData, Goal, GoalContainer, GoalFeedback, GoalSubmission } from './types';
import { DISCIPLINES } from '../../utils/disciplines';
import {
  createGoalInNeon,
  updateGoalInNeon,
  deleteGoalInNeon,
  updateAppDataInNeon,
  createGoalSubmissionInNeon,
  updateGoalSubmissionInNeon,
  getGoalSubmissionByContainerFromNeon,
  getGoalSubmissionFromNeon,
  createGoalFeedbackInNeon,
  updateGoalFeedbackInNeon,
  getGoalFeedbackFromNeon,
  queryGoalFeedbackFromNeon,
} from './neon-operations';
import { syncGoalFromNeon, syncAppDataFromNeon } from '../sync/syncFromNeon';
import { NetworkError, withRetry } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// Simple UUID v4 generator for browser
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Week calculation utilities
export function getCurrentFocus(startDate: string, cycleLength: number): "Spins" | "Jumps" | "Edges" {
  const start = new Date(startDate);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(daysDiff / 7);
  const cyclePosition = weekNumber % cycleLength;

  return DISCIPLINES[cyclePosition] as "Spins" | "Jumps" | "Edges";
}

export function getWeekInCycle(startDate: string, cycleLength: number): number {
  const start = new Date(startDate);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(daysDiff / 7);
  return weekNumber % cycleLength;
}

export function getDaysUntilNextCycle(startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const daysIntoCurrentWeek = daysDiff % 7;
  const daysUntilNextWeek = 7 - daysIntoCurrentWeek;
  return daysUntilNextWeek;
}

export function getWeekStartDate(startDate: string): string {
  const start = new Date(startDate);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const weekNumber = Math.floor(daysDiff / 7);

  // Calculate the start of the current week
  const currentWeekStart = new Date(start);
  currentWeekStart.setDate(currentWeekStart.getDate() + (weekNumber * 7));

  return currentWeekStart.toISOString().split('T')[0];
}

// Helper functions for Neon sync
function normalizeWeekStartDate(value?: string | Date): string | undefined {
  if (!value) return undefined;

  // Handle Date objects (in case value is passed as Date from database)
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }

  // Handle string values
  const trimmed = String(value).trim();
  if (!trimmed) return undefined;

  // Extract date part from ISO string (handles "2025-12-08" and "2025-12-08T00:00:00.000Z")
  const dateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateMatch) {
    return dateMatch[1];
  }

  return undefined;
}

function isNeonAvailable(): boolean {
  return import.meta.env.PROD || !!import.meta.env.VITE_API_URL;
}

function isNetworkError(error: any): boolean {
  return error?.code === 'ECONNREFUSED' ||
         error?.code === 'ETIMEDOUT' ||
         error?.message?.includes('network') ||
         error?.message?.includes('fetch') ||
         error?.message?.includes('connection');
}

// Helper to write goal to Neon and sync back to IndexedDB
async function writeGoalToNeonAndSync(
  writeFn: () => Promise<Goal>,
  goalId: string
): Promise<Goal> {
  if (!isNeonAvailable()) {
    // If Neon is not configured, just use IndexedDB (for local dev)
    return await writeFn();
  }

  try {
    // Write to Neon first (source of truth)
    const goal = await withRetry(writeFn, {
      maxRetries: 3,
      retryDelay: 1000,
    });

    // Sync the goal back from Neon to IndexedDB
    await syncGoalFromNeon(goalId);

    return goal;
  } catch (error: any) {
    // If Neon write fails, throw a NetworkError for user-friendly handling
    if (isNetworkError(error)) {
      throw new NetworkError(
        'Failed to save changes. Please check your internet connection and try again.',
        error
      );
    }
    throw error;
  }
}

async function writeSubmissionToNeonAndSync(
  writeFn: () => Promise<GoalSubmission>,
  submissionId: string
): Promise<GoalSubmission> {
  if (!isNeonAvailable()) {
    return await writeFn();
  }

  try {
    const submission = await withRetry(writeFn, {
      maxRetries: 3,
      retryDelay: 1000,
    });

    await syncGoalSubmissionFromNeon(submissionId);
    return submission;
  } catch (error: any) {
    if (isNetworkError(error)) {
      throw new NetworkError(
        'Failed to save submission. Please check your internet connection and try again.',
        error
      );
    }
    throw error;
  }
}

function isFutureWeekDate(weekStartDate?: string): boolean {
  if (!weekStartDate) return false;
  const weekDate = new Date(`${weekStartDate}T00:00:00Z`);
  const now = new Date();
  return weekDate.getTime() > now.getTime();
}

function assertWeekIsNotInFuture(weekStartDate?: string): void {
  if (!weekStartDate) return;
  if (isFutureWeekDate(weekStartDate)) {
    throw new Error('Cannot submit feedback for a future week.');
  }
}

async function writeFeedbackToNeonAndSync(
  writeFn: () => Promise<GoalFeedback>,
  feedbackId: string
): Promise<GoalFeedback> {
  if (!isNeonAvailable()) {
    return await writeFn();
  }

  try {
    const entry = await withRetry(writeFn, {
      maxRetries: 3,
      retryDelay: 1000,
    });

    await syncGoalFeedbackFromNeon(feedbackId);
    return entry;
  } catch (error: any) {
    if (isNetworkError(error)) {
      throw new NetworkError(
        'Failed to save feedback. Please check your internet connection and try again.',
        error
      );
    }
    throw error;
  }
}

// Helper to write app data to Neon and sync back to IndexedDB
async function writeAppDataToNeonAndSync(
  writeFn: () => Promise<AppData>
): Promise<AppData> {
  if (!isNeonAvailable()) {
    // If Neon is not configured, just use IndexedDB (for local dev)
    return await writeFn();
  }

  try {
    // Write to Neon first (source of truth)
    const appData = await withRetry(writeFn, {
      maxRetries: 3,
      retryDelay: 1000,
    });

    // Sync the app data back from Neon to IndexedDB
    await syncAppDataFromNeon();

    return appData;
  } catch (error: any) {
    // If Neon write fails, throw a NetworkError for user-friendly handling
    if (isNetworkError(error)) {
      throw new NetworkError(
        'Failed to save changes. Please check your internet connection and try again.',
        error
      );
    }
    throw error;
  }
}

// AppData Operations
export async function getAppData(): Promise<AppData> {
  const appData = await progressTrackerDB.appData.get('app-data-1');
  if (!appData) {
    // Initialize with default values
    const defaultStartDate = new Date().toISOString().split('T')[0];
    return await initializeAppData(defaultStartDate, 3);
  }
  return appData;
}

export async function updateAppData(updates: Partial<Omit<AppData, 'id'>>): Promise<AppData> {
  const existing = await progressTrackerDB.appData.get('app-data-1');
  if (!existing) {
    throw new Error('AppData not found. Please initialize first.');
  }

  const updated: AppData = {
    ...existing,
    ...updates,
  };

  return await writeAppDataToNeonAndSync(
    async () => {
      if (isNeonAvailable()) {
        return await updateAppDataInNeon(updates);
      } else {
        await progressTrackerDB.appData.update('app-data-1', updated);
        return updated;
      }
    }
  );
}

export async function initializeAppData(startDate: string, cycleLength: number = 3): Promise<AppData> {
  const appData: AppData = {
    id: 'app-data-1',
    startDate,
    cycleLength,
  };

  await progressTrackerDB.appData.put(appData);
  return appData;
}

// Goal Operations
export async function createGoal(goal: Omit<Goal, 'id' | 'createdAt'>): Promise<Goal> {
  const newGoal: Goal = {
    id: generateUUID(),
    track: 'on-ice', // Default to on-ice for backward compatibility
    ...goal,
    createdAt: Date.now(),
  };

  return await writeGoalToNeonAndSync(
    async () => {
      if (isNeonAvailable()) {
        return await createGoalInNeon(newGoal);
      } else {
        await progressTrackerDB.goals.add(newGoal);
        return newGoal;
      }
    },
    newGoal.id
  );
}

export async function updateGoal(id: string, updates: Partial<Omit<Goal, 'id' | 'createdAt'>>): Promise<Goal> {
  const goal = await progressTrackerDB.goals.get(id);
  if (!goal) {
    throw new Error(`Goal ${id} not found`);
  }

  const updatedAt = Date.now();
  const updated: Goal = {
    ...goal,
    ...updates,
    updatedAt,
  };

  return await writeGoalToNeonAndSync(
    async () => {
      if (isNeonAvailable()) {
        try {
          return await updateGoalInNeon(id, { ...updates, updatedAt });
        } catch (error: any) {
          const message = error?.message?.toLowerCase?.() || '';
          const is404 = message.includes('404') || message.includes('not found');
          if (is404) {
            const goalPayload = {
              id: updated.id,
              discipline: updated.discipline,
              type: updated.type,
              content: updated.content,
              containerId: updated.containerId,
              archivedAt: updated.archivedAt,
              weekStartDate: updated.weekStartDate,
            };
            return await createGoalInNeon(goalPayload);
          }
          throw error;
        }
      } else {
        await progressTrackerDB.goals.update(id, updated);
        return updated;
      }
    },
    id
  );
}

export async function archiveGoal(id: string): Promise<void> {
  await updateGoal(id, { archivedAt: Date.now() });
}

export async function deleteGoal(id: string): Promise<void> {
  if (isNeonAvailable()) {
    try {
      await withRetry(
        async () => {
          await deleteGoalInNeon(id);
        },
        { maxRetries: 3, retryDelay: 1000 }
      );
      // Sync: remove from IndexedDB after successful Neon delete
      await progressTrackerDB.goals.delete(id);
    } catch (error: any) {
      if (isNetworkError(error)) {
        throw new NetworkError(
          'Failed to delete goal. Please check your internet connection and try again.',
          error
        );
      }
      throw error;
    }
  } else {
    await progressTrackerDB.goals.delete(id);
  }
}

export async function getActiveGoals(
  discipline?: "Spins" | "Jumps" | "Edges",
  type?: "primary" | "working"
): Promise<Goal[]> {
  let goals = await progressTrackerDB.goals.toArray();

  // Filter out archived goals
  goals = goals.filter(g => !g.archivedAt);

  // Filter by discipline if provided
  if (discipline) {
    goals = goals.filter(g => g.discipline === discipline);
  }

  // Filter by type if provided
  if (type) {
    goals = goals.filter(g => g.type === type);
  }

  return goals.sort((a, b) => b.createdAt - a.createdAt); // Newest first
}

export async function getAllGoals(): Promise<Goal[]> {
  return await progressTrackerDB.goals.orderBy('createdAt').reverse().toArray();
}

// Archive Workflow
export async function archiveWeek(
  focusDiscipline: "Spins" | "Jumps" | "Edges",
  feedback: string[],
  newPrimaryGoals?: string[]
): Promise<void> {
  const disciplines = DISCIPLINES;
  const currentIdx = disciplines.indexOf(focusDiscipline);
  const otherDisciplines = [
    disciplines[(currentIdx + 1) % 3],
    disciplines[(currentIdx + 2) % 3],
  ];

  // Archive all active primary goals for the focus discipline
  const allGoals = await progressTrackerDB.goals
    .where('discipline')
    .equals(focusDiscipline)
    .toArray();
  const activePrimaryGoals = allGoals.filter(
    g => g.type === 'primary' && !g.archivedAt
  );

  for (const goal of activePrimaryGoals) {
    await archiveGoal(goal.id);
  }

  // Create working goals in other disciplines from feedback
  for (const discipline of otherDisciplines) {
    for (const content of feedback) {
      if (content.trim()) {
        await createGoal({
          discipline,
          type: 'working',
          content: content.trim(),
        });
      }
    }
  }

  // Optionally create new primary goals for next cycle
  if (newPrimaryGoals && newPrimaryGoals.length > 0) {
    for (const content of newPrimaryGoals) {
      if (content.trim()) {
        await createGoal({
          discipline: focusDiscipline,
          type: 'primary',
          content: content.trim(),
        });
      }
    }
  }
}

// Goal Container Operations
// Helper: Build a GoalContainer from goals
function buildGoalContainer(primaryGoal: Goal, workingGoals: Goal[]): GoalContainer {
  return {
    id: primaryGoal.id,
    discipline: primaryGoal.discipline,
    primaryGoalId: primaryGoal.id,
    workingGoalIds: workingGoals.map(g => g.id),
    createdAt: primaryGoal.createdAt,
    archivedAt: primaryGoal.archivedAt,
    weekStartDate: primaryGoal.weekStartDate,
    track: primaryGoal.track || 'on-ice', // Default to on-ice for backward compatibility
  };
}

// Get all goal containers for a discipline
export async function getGoalContainersByDiscipline(
  discipline: "Spins" | "Jumps" | "Edges",
  weekStartDate?: string,
  track?: "on-ice" | "off-ice",
  includeArchived?: boolean
): Promise<GoalContainer[]> {
  logger.info(`[getGoalContainersByDiscipline] Loading containers for ${discipline}${weekStartDate ? ` (week: ${weekStartDate})` : ' (all weeks)'}${includeArchived ? ' (including archived)' : ''}`);

  // Get all goals for this discipline, then filter in memory
  // This is more reliable than complex Dexie queries
  let allGoals = await progressTrackerDB.goals
    .where('discipline')
    .equals(discipline)
    .toArray();

  logger.info(`[getGoalContainersByDiscipline] Found ${allGoals.length} total goals for ${discipline}`);

  // Filter to primary goals (optionally include archived)
  let primaryGoals = allGoals.filter(g =>
    g.type === 'primary' && (includeArchived || !g.archivedAt)
  );

  // Filter by track if provided (treat undefined track as "on-ice" for backward compatibility)
  if (track !== undefined) {
    const beforeTrackFilter = primaryGoals.length;
    primaryGoals = primaryGoals.filter(g => (g.track || 'on-ice') === track);
    logger.info(`[getGoalContainersByDiscipline] Filtered to ${primaryGoals.length} primary goals for track ${track} (from ${beforeTrackFilter})`);
  }

  logger.info(`[getGoalContainersByDiscipline] Found ${primaryGoals.length} active primary goals for ${discipline}`);

  // Filter by weekStartDate if provided
  const normalizedTarget = normalizeWeekStartDate(weekStartDate);
  if (normalizedTarget) {
    const beforeFilter = primaryGoals.length;
    const targetDate = new Date(`${normalizedTarget}T00:00:00Z`);

    logger.info(`[getGoalContainersByDiscipline] Filtering ${beforeFilter} primary goals for week ${normalizedTarget}`);

    const isWithinTargetWeek = (goal: Goal) => {
      const normalizedGoalWeek = normalizeWeekStartDate(goal.weekStartDate);
      // Treat missing weekStartDate as matching for legacy data
      if (!normalizedGoalWeek) {
        logger.info(`[getGoalContainersByDiscipline] Goal "${goal.content}" has no weekStartDate; keeping (legacy)`);
        return true;
      }

      const goalDate = new Date(`${normalizedGoalWeek}T00:00:00Z`);
      const diffDays = Math.floor((goalDate.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));
      const matches = diffDays >= 0 && diffDays < 7; // same 7-day window as target week

      logger.info(
        `[getGoalContainersByDiscipline] Goal "${goal.content}" has weekStartDate: ${goal.weekStartDate} (normalized: ${normalizedGoalWeek}), diffDays=${diffDays}, matchesTargetWeek=${matches}`
      );

      return matches;
    };

    primaryGoals = primaryGoals.filter(isWithinTargetWeek);
    logger.info(`[getGoalContainersByDiscipline] Filtered to ${primaryGoals.length} primary goals for week ${normalizedTarget} (from ${beforeFilter})`);
  }
  // If no weekStartDate provided, return ALL active containers (current + future weeks)

  // Build containers
  const containers: GoalContainer[] = [];
  for (const primaryGoal of primaryGoals) {
    // Get working goals for this container
    // Query by containerId, then filter in memory for reliability
    const containerGoals = await progressTrackerDB.goals
      .where('containerId')
      .equals(primaryGoal.id)
      .toArray();

    // Filter to working goals (optionally include archived)
    const workingGoals = containerGoals.filter(g =>
      g.type === 'working' && (includeArchived || !g.archivedAt) && g.containerId === primaryGoal.id
    );

    logger.info(`[getGoalContainersByDiscipline] Built container for "${primaryGoal.content}" with ${workingGoals.length} working goals`);
    containers.push(buildGoalContainer(primaryGoal, workingGoals));
  }

  logger.info(`[getGoalContainersByDiscipline] Returning ${containers.length} containers for ${discipline}`);
  // Sort by creation date (newest first)
  return containers.sort((a, b) => b.createdAt - a.createdAt);
}

// Get goal containers for a specific week
export async function getGoalContainersForWeek(weekStartDate: string): Promise<GoalContainer[]> {
  const allContainers: GoalContainer[] = [];

  for (const discipline of DISCIPLINES) {
    const containers = await getGoalContainersByDiscipline(discipline, weekStartDate);
    allContainers.push(...containers);
  }

  return allContainers;
}

// Create a new goal container
export async function createGoalContainer(
  discipline: "Spins" | "Jumps" | "Edges",
  primaryGoalContent: string,
  workingGoalContents: string[] = [],
  weekStartDate?: string,
  track: "on-ice" | "off-ice" = "on-ice"
): Promise<GoalContainer> {
  // Validate: Max 3 containers per discipline per track
  const existingContainers = await getGoalContainersByDiscipline(discipline, undefined, track);
  if (existingContainers.length >= 3) {
    throw new Error(`Maximum 3 goal containers per discipline per track. ${discipline} (${track}) already has ${existingContainers.length} containers.`);
  }

  // Validate: Max 2 working goals
  if (workingGoalContents.length > 2) {
    throw new Error('Maximum 2 working goals per container.');
  }

  // Create primary goal (containerId === id)
  const primaryGoalId = generateUUID();
  const primaryGoal: Goal = {
    id: primaryGoalId,
    discipline,
    type: 'primary',
    content: primaryGoalContent.trim(),
    containerId: primaryGoalId, // Primary goal's containerId is its own id
    createdAt: Date.now(),
    weekStartDate,
    track,
  };

  await progressTrackerDB.goals.add(primaryGoal);

  // Create working goals
  const workingGoals: Goal[] = [];
  for (const content of workingGoalContents) {
    if (content.trim()) {
      const workingGoal: Goal = {
        id: generateUUID(),
        discipline,
        type: 'working',
        content: content.trim(),
        containerId: primaryGoalId, // Working goals reference the primary goal's id
        createdAt: Date.now(),
        weekStartDate,
        track,
      };
      await progressTrackerDB.goals.add(workingGoal);
      workingGoals.push(workingGoal);
    }
  }

  return buildGoalContainer(primaryGoal, workingGoals);
}

// Add a working goal to an existing container
export async function addWorkingGoalToContainer(
  containerId: string,
  workingGoalContent: string
): Promise<Goal> {
  // Get the primary goal to validate container exists
  const primaryGoal = await progressTrackerDB.goals.get(containerId);
  if (!primaryGoal || primaryGoal.type !== 'primary' || primaryGoal.archivedAt) {
    throw new Error(`Container ${containerId} not found or archived.`);
  }

  // Validate: Max 2 working goals
  const existingWorkingGoals = await progressTrackerDB.goals
    .where('containerId')
    .equals(containerId)
    .and(g => !g.archivedAt && g.type === 'working')
    .toArray();

  if (existingWorkingGoals.length >= 2) {
    throw new Error('Maximum 2 working goals per container.');
  }

  // Create working goal
  const workingGoal: Goal = {
    id: generateUUID(),
    discipline: primaryGoal.discipline,
    type: 'working',
    content: workingGoalContent.trim(),
    containerId: containerId,
    createdAt: Date.now(),
    weekStartDate: primaryGoal.weekStartDate,
    track: primaryGoal.track || 'on-ice', // Inherit track from primary goal
  };

  await progressTrackerDB.transaction('rw', progressTrackerDB.goals, async () => {
    await progressTrackerDB.goals.add(workingGoal);
    const primaryGoal = await progressTrackerDB.goals.get(containerId);
    if (primaryGoal) {
      const existingIds = Array.isArray(primaryGoal.workingGoalIds) ? primaryGoal.workingGoalIds : [];
      const updatedIds = [
        ...existingIds.filter((goalId: string) => goalId !== workingGoal.id),
        workingGoal.id,
      ];
      await progressTrackerDB.goals.update(containerId, { workingGoalIds: updatedIds, updatedAt: Date.now() });
    }
  });
  return workingGoal;
}

// Remove a working goal from a container
export async function removeWorkingGoalFromContainer(workingGoalId: string): Promise<void> {
  await deleteGoal(workingGoalId);
}

// Delete an entire goal container (primary + all working goals)
export async function deleteGoalContainer(containerId: string): Promise<void> {
  // Delete primary goal
  await deleteGoal(containerId);

  // Delete all working goals in this container
  const workingGoals = await progressTrackerDB.goals
    .where('containerId')
    .equals(containerId)
    .toArray();

  for (const goal of workingGoals) {
    await deleteGoal(goal.id);
  }
}

// Validation functions
export async function canCreateContainer(discipline: "Spins" | "Jumps" | "Edges", track: "on-ice" | "off-ice" = "on-ice"): Promise<boolean> {
  const containers = await getGoalContainersByDiscipline(discipline, undefined, track);
  return containers.length < 3;
}

export async function canAddWorkingGoal(containerId: string): Promise<boolean> {
  const workingGoals = await progressTrackerDB.goals
    .where('containerId')
    .equals(containerId)
    .and(g => !g.archivedAt && g.type === 'working')
    .toArray();

  return workingGoals.length < 2;
}

// Goal submissions
async function syncGoalSubmissionFromNeon(submissionId: string): Promise<GoalSubmission | null> {
  const submission = await getGoalSubmissionFromNeon(submissionId);
  if (submission) {
    await progressTrackerDB.goalSubmissions.put(submission);
  }
  return submission;
}

async function syncGoalFeedbackFromNeon(feedbackId: string): Promise<GoalFeedback | null> {
  const entry = await getGoalFeedbackFromNeon(feedbackId);
  if (entry) {
    await progressTrackerDB.goalFeedback.put(entry);
  }
  return entry;
}

export async function getGoalSubmissionForContainer(
  containerId: string,
  weekStartDate?: string
): Promise<GoalSubmission | null> {
  const targetWeek = normalizeWeekStartDate(weekStartDate);

  const local = await progressTrackerDB.goalSubmissions
    .where('containerId')
    .equals(containerId)
    .and(sub => normalizeWeekStartDate(sub.weekStartDate) === targetWeek)
    .first();

  if (local) {
    return local;
  }

  if (!isNeonAvailable()) return null;

  const remote = await getGoalSubmissionByContainerFromNeon(containerId, targetWeek);
  if (remote) {
    await progressTrackerDB.goalSubmissions.put(remote);
  }

  return remote;
}

export interface GoalSubmissionInput {
  containerId: string;
  primaryGoalId: string;
  discipline: "Spins" | "Jumps" | "Edges";
  weekStartDate?: string;
  notes: string;
}

export async function upsertGoalSubmission(input: GoalSubmissionInput): Promise<GoalSubmission> {
  const targetWeek = normalizeWeekStartDate(input.weekStartDate);
  const existing = await getGoalSubmissionForContainer(input.containerId, targetWeek);
  const now = Date.now();

  if (existing) {
    const updated: GoalSubmission = {
      ...existing,
      weekStartDate: targetWeek ?? existing.weekStartDate,
      notes: input.notes.trim(),
      updatedAt: now,
    };

    return await writeSubmissionToNeonAndSync(
      async () => {
        if (isNeonAvailable()) {
          return await updateGoalSubmissionInNeon(updated.id, {
            containerId: updated.containerId,
            primaryGoalId: updated.primaryGoalId,
            discipline: updated.discipline,
            weekStartDate: updated.weekStartDate,
            notes: updated.notes,
            submittedAt: updated.submittedAt,
            updatedAt: updated.updatedAt,
          });
        }

        await progressTrackerDB.goalSubmissions.put(updated);
        return updated;
      },
      updated.id
    );
  }

  const submission: GoalSubmission = {
    id: generateUUID(),
    containerId: input.containerId,
    primaryGoalId: input.primaryGoalId,
    discipline: input.discipline,
    weekStartDate: targetWeek,
    notes: input.notes.trim(),
    submittedAt: now,
    updatedAt: now,
  };

  return await writeSubmissionToNeonAndSync(
    async () => {
      if (isNeonAvailable()) {
        return await createGoalSubmissionInNeon(submission);
      }

      await progressTrackerDB.goalSubmissions.add(submission);
      return submission;
    },
    submission.id
  );
}

export interface GoalFeedbackInput {
  goalId: string;
  containerId: string;
  discipline: "Spins" | "Jumps" | "Edges";
  weekStartDate?: string;
  rating?: number;
  feedback?: string;
  completed?: boolean;
}

export async function createGoalFeedbackEntry(input: GoalFeedbackInput): Promise<GoalFeedback> {
  const now = Date.now();
  const normalizedWeek = normalizeWeekStartDate(input.weekStartDate);
  assertWeekIsNotInFuture(normalizedWeek);

  const entry: GoalFeedback = {
    id: generateUUID(),
    goalId: input.goalId,
    containerId: input.containerId,
    discipline: input.discipline,
    weekStartDate: normalizedWeek,
    rating: input.rating,
    feedback: input.feedback?.trim() || undefined,
    completed: input.completed ?? false,
    createdAt: now,
    updatedAt: now,
  };

  return await writeFeedbackToNeonAndSync(
    async () => {
      if (isNeonAvailable()) {
        return await createGoalFeedbackInNeon(entry);
      }
      await progressTrackerDB.goalFeedback.add(entry);
      return entry;
    },
    entry.id
  );
}

export async function updateGoalFeedbackEntry(
  id: string,
  updates: Partial<Omit<GoalFeedbackInput, 'goalId'>> & { rating?: number; feedback?: string; completed?: boolean }
): Promise<GoalFeedback> {
  const existing = await progressTrackerDB.goalFeedback.get(id);
  if (!existing) {
    throw new Error(`Goal feedback ${id} not found.`);
  }

  const updated: GoalFeedback = {
    ...existing,
    ...updates,
    weekStartDate: updates.weekStartDate
      ? normalizeWeekStartDate(updates.weekStartDate)
      : existing.weekStartDate,
    rating: updates.rating ?? existing.rating,
    feedback: updates.feedback?.trim() ?? existing.feedback,
    completed: updates.completed ?? existing.completed,
    updatedAt: Date.now(),
  };
  assertWeekIsNotInFuture(updated.weekStartDate);

  return await writeFeedbackToNeonAndSync(
    async () => {
      if (isNeonAvailable()) {
        return await updateGoalFeedbackInNeon(id, {
          goalId: updated.goalId,
          containerId: updated.containerId,
          discipline: updated.discipline,
          weekStartDate: updated.weekStartDate,
          rating: updated.rating,
          feedback: updated.feedback,
          completed: updated.completed,
          updatedAt: updated.updatedAt,
        });
      }

      await progressTrackerDB.goalFeedback.put(updated);
      return updated;
    },
    id
  );
}

export async function getGoalFeedbackForContainer(
  containerId: string,
  weekStartDate?: string
): Promise<GoalFeedback[]> {
  const targetWeek = normalizeWeekStartDate(weekStartDate);
  const local = await progressTrackerDB.goalFeedback
    .where('containerId')
    .equals(containerId)
    .filter(entry => {
      if (!targetWeek) return true;
      return normalizeWeekStartDate(entry.weekStartDate) === targetWeek;
    })
    .toArray();

  if (local.length > 0 || !isNeonAvailable()) {
    return local.sort((a, b) => b.createdAt - a.createdAt);
  }

  const remote = await queryGoalFeedbackFromNeon({
    containerId,
    weekStartDate: targetWeek,
  });

  if (remote.length > 0) {
    await progressTrackerDB.goalFeedback.bulkPut(remote);
  }

  return remote;
}

export async function listGoalFeedbackForWeek(weekStartDate: string): Promise<GoalFeedback[]> {
  const targetWeek = normalizeWeekStartDate(weekStartDate);
  if (!targetWeek) return [];

  const local = await progressTrackerDB.goalFeedback
    .where('weekStartDate')
    .equals(targetWeek)
    .toArray();

  if (local.length > 0 || !isNeonAvailable()) {
    return local.sort((a, b) => b.createdAt - a.createdAt);
  }

  const remote = await queryGoalFeedbackFromNeon({ weekStartDate: targetWeek });
  if (remote.length > 0) {
    await progressTrackerDB.goalFeedback.bulkPut(remote);
  }

  return remote;
}

export async function getAllGoalFeedback(): Promise<GoalFeedback[]> {
  return await progressTrackerDB.goalFeedback.orderBy('createdAt').reverse().toArray();
}

export async function upsertGoalFeedbackEntry(input: GoalFeedbackInput): Promise<GoalFeedback> {
  const normalizedWeek = normalizeWeekStartDate(input.weekStartDate);
  const existing = await progressTrackerDB.goalFeedback
    .where('goalId')
    .equals(input.goalId)
    .filter(entry => normalizeWeekStartDate(entry.weekStartDate) === normalizedWeek)
    .first();

  if (existing) {
    return await updateGoalFeedbackEntry(existing.id, {
      containerId: input.containerId,
      discipline: input.discipline,
      weekStartDate: normalizedWeek,
      rating: input.rating,
      feedback: input.feedback,
      completed: input.completed,
    });
  }

  return await createGoalFeedbackEntry({ ...input, weekStartDate: normalizedWeek });
}

// Migration: Convert existing goals to goal containers
// This creates containers from existing primary goals and assigns working goals to the nearest primary goal
export async function migrateGoalsToContainers(): Promise<void> {

  // Get all active primary goals grouped by discipline
  const allPrimaryGoals = await getActiveGoals(undefined, 'primary');
  const allWorkingGoals = await getActiveGoals(undefined, 'working');

  // Group by discipline
  const primaryByDiscipline: Record<string, Goal[]> = {
    Spins: [],
    Jumps: [],
    Edges: [],
  };
  const workingByDiscipline: Record<string, Goal[]> = {
    Spins: [],
    Jumps: [],
    Edges: [],
  };

  allPrimaryGoals.forEach(goal => {
    primaryByDiscipline[goal.discipline].push(goal);
  });

  allWorkingGoals.forEach(goal => {
    workingByDiscipline[goal.discipline].push(goal);
  });

  let containersCreated = 0;
  let goalsUpdated = 0;

  // Process each discipline
  for (const discipline of DISCIPLINES) {
    const primaryGoals = primaryByDiscipline[discipline].sort((a, b) => a.createdAt - b.createdAt); // Oldest first
    const workingGoals = workingByDiscipline[discipline].sort((a, b) => a.createdAt - b.createdAt);

    // Limit to 3 primary goals (max containers per discipline)
    const primaryGoalsToProcess = primaryGoals.slice(0, 3);
    const remainingPrimaryGoals = primaryGoals.slice(3);

    // Update primary goals: set containerId === id
    for (const primaryGoal of primaryGoalsToProcess) {
      if (!primaryGoal.containerId || primaryGoal.containerId !== primaryGoal.id) {
        await updateGoal(primaryGoal.id, { containerId: primaryGoal.id });
        goalsUpdated++;
        containersCreated++;
      }
    }

    // Archive remaining primary goals if there are more than 3
    for (const primaryGoal of remainingPrimaryGoals) {
      await archiveGoal(primaryGoal.id);
    }

    // Assign working goals to primary goals
    // Distribute working goals evenly across primary goals (max 2 per container)
    let workingGoalIndex = 0;
    for (const primaryGoal of primaryGoalsToProcess) {
      // Get existing working goals for this container
      const existingWorking = await progressTrackerDB.goals
        .where('containerId')
        .equals(primaryGoal.id)
        .and(g => !g.archivedAt)
        .toArray();

      const slotsAvailable = 2 - existingWorking.length;

      // Assign up to 2 working goals to this primary goal
      for (let i = 0; i < slotsAvailable && workingGoalIndex < workingGoals.length; i++) {
        const workingGoal = workingGoals[workingGoalIndex];
        if (!workingGoal.containerId) {
          await updateGoal(workingGoal.id, { containerId: primaryGoal.id });
          goalsUpdated++;
        }
        workingGoalIndex++;
      }
    }

    // Archive any remaining unassigned working goals
    for (let i = workingGoalIndex; i < workingGoals.length; i++) {
      const workingGoal = workingGoals[i];
      if (!workingGoal.containerId) {
        await archiveGoal(workingGoal.id);
      }
    }
  }
}

// Helper function to delete goals by content pattern (for cleanup)
export async function deleteGoalsByContentPattern(
  pattern: string,
  discipline?: "Spins" | "Jumps" | "Edges"
): Promise<number> {
  let goals = await progressTrackerDB.goals.toArray();

  // Filter by discipline if provided
  if (discipline) {
    goals = goals.filter(g => g.discipline === discipline);
  }

  // Filter by content pattern (case-insensitive partial match)
  const matchingGoals = goals.filter(g =>
    g.content.toLowerCase().includes(pattern.toLowerCase())
  );

  // Delete matching goals
  for (const goal of matchingGoals) {
    await deleteGoal(goal.id);
  }

  return matchingGoals.length;
}

// Quick cleanup function for specific test goals
export async function cleanupMooGoals(): Promise<void> {
  const patterns = ['moo', 'more some less'];

  for (const pattern of patterns) {
    await deleteGoalsByContentPattern(pattern, 'Spins');
  }
}
