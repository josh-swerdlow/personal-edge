import Dexie, { Table } from 'dexie';
import { AppData, Goal, GoalRating } from './types';

export class ProgressTrackerDB extends Dexie {
  goals!: Table<Goal, string>;
  appData!: Table<AppData, string>;
  goalRatings!: Table<GoalRating, string>;

  constructor() {
    super("ProgressTrackerDB");
    this.version(2).stores({
      goals: "id, discipline, type, createdAt, archivedAt, weekStartDate",
      appData: "id, startDate",
      goalRatings: "goalId, archivedAt"
    });
    // Version 3: Add containerId to goals
    this.version(3).stores({
      goals: "id, discipline, type, createdAt, archivedAt, weekStartDate, containerId",
      appData: "id, startDate",
      goalRatings: "goalId, archivedAt"
    });
  }
}

export const progressTrackerDB = new ProgressTrackerDB();
