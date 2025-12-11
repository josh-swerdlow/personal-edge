import { progressTrackerDB } from './db';
import { AppData, Goal, GoalContainer } from './types';
import { DISCIPLINES } from '../../utils/disciplines';
import {
  createGoalInNeon,
  updateGoalInNeon,
  deleteGoalInNeon,
  updateAppDataInNeon,
} from './neon-operations';
import { syncGoalFromNeon, syncAppDataFromNeon } from '../sync/syncFromNeon';
import { NetworkError, withRetry } from '../../utils/errorHandler';

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

  const updated: Goal = {
    ...goal,
    ...updates,
  };

  return await writeGoalToNeonAndSync(
    async () => {
      if (isNeonAvailable()) {
        return await updateGoalInNeon(id, updates);
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
    weekStartDate: primaryGoal.weekStartDate,
  };
}

// Get all goal containers for a discipline
export async function getGoalContainersByDiscipline(
  discipline: "Spins" | "Jumps" | "Edges",
  weekStartDate?: string
): Promise<GoalContainer[]> {
  // Get all primary goals for this discipline
  let primaryGoals = await progressTrackerDB.goals
    .where('discipline')
    .equals(discipline)
    .and(g => g.type === 'primary' && !g.archivedAt)
    .toArray();

  // Filter by weekStartDate if provided
  if (weekStartDate) {
    primaryGoals = primaryGoals.filter(g => g.weekStartDate === weekStartDate || !g.weekStartDate);
  }
  // If no weekStartDate provided, return ALL active containers (current + future weeks)

  // Build containers
  const containers: GoalContainer[] = [];
  for (const primaryGoal of primaryGoals) {
    // Get working goals for this container
    const workingGoals = await progressTrackerDB.goals
      .where('containerId')
      .equals(primaryGoal.id)
      .and(g => !g.archivedAt)
      .toArray();

    containers.push(buildGoalContainer(primaryGoal, workingGoals));
  }

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
  weekStartDate?: string
): Promise<GoalContainer> {
  // Validate: Max 3 containers per discipline
  const existingContainers = await getGoalContainersByDiscipline(discipline);
  if (existingContainers.length >= 3) {
    throw new Error(`Maximum 3 goal containers per discipline. ${discipline} already has ${existingContainers.length} containers.`);
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
    .and(g => !g.archivedAt)
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
  };

  await progressTrackerDB.goals.add(workingGoal);
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
export async function canCreateContainer(discipline: "Spins" | "Jumps" | "Edges"): Promise<boolean> {
  const containers = await getGoalContainersByDiscipline(discipline);
  return containers.length < 3;
}

export async function canAddWorkingGoal(containerId: string): Promise<boolean> {
  const workingGoals = await progressTrackerDB.goals
    .where('containerId')
    .equals(containerId)
    .and(g => !g.archivedAt)
    .toArray();

  return workingGoals.length < 2;
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

