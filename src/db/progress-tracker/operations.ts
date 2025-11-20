import { progressTrackerDB } from './db';
import { AppData, Goal } from './types';
import { DISCIPLINES } from '../../utils/disciplines';

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

  await progressTrackerDB.appData.update('app-data-1', updated);
  return updated;
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

  await progressTrackerDB.goals.add(newGoal);
  return newGoal;
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

  await progressTrackerDB.goals.update(id, updated);
  return updated;
}

export async function archiveGoal(id: string): Promise<void> {
  await progressTrackerDB.goals.update(id, { archivedAt: Date.now() });
}

export async function deleteGoal(id: string): Promise<void> {
  await progressTrackerDB.goals.delete(id);
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

