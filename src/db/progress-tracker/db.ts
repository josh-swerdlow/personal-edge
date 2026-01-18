import Dexie, { Table } from 'dexie';
import { AppData, Goal, GoalFeedback, GoalSubmission } from './types';

export class ProgressTrackerDB extends Dexie {
  goals!: Table<Goal, string>;
  appData!: Table<AppData, string>;
  goalFeedback!: Table<GoalFeedback, string>;
  goalSubmissions!: Table<GoalSubmission, string>;

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
    // Version 4: Goal submissions (one per container per week)
    this.version(4).stores({
      goals: "id, discipline, type, createdAt, archivedAt, weekStartDate, containerId",
      appData: "id, startDate",
      goalRatings: "goalId, archivedAt",
      goalSubmissions: "id, containerId, primaryGoalId, weekStartDate"
    });
    // Version 5: Goal feedback replaces legacy goalRatings table
    this.version(5).stores({
      goals: "id, discipline, type, createdAt, archivedAt, weekStartDate, containerId",
      appData: "id, startDate",
      goalSubmissions: "id, containerId, primaryGoalId, weekStartDate",
      goalFeedback: "id, goalId, containerId, weekStartDate, discipline, createdAt",
      goalRatings: null,
    }).upgrade(async (tx) => {
      try {
        const legacyRatings = await tx.table('goalRatings').toArray();
        if (!legacyRatings || legacyRatings.length === 0) {
          return;
        }

        const goalsTable = tx.table('goals');
        const now = Date.now();
        const feedbackEntries: GoalFeedback[] = [];

        for (const rating of legacyRatings) {
          const goal = await goalsTable.get(rating.goalId);
          if (!goal) continue;

          const archivedAt = rating.archivedAt ?? now;
          feedbackEntries.push({
            id: generateLocalId(),
            goalId: rating.goalId,
            containerId: goal.containerId ?? goal.id,
            discipline: goal.discipline,
            weekStartDate: goal.weekStartDate,
            rating: rating.rating,
            feedback: rating.feedback,
            completed: true,
            createdAt: archivedAt,
            updatedAt: archivedAt,
          });
        }

        if (feedbackEntries.length > 0) {
          await tx.table('goalFeedback').bulkAdd(feedbackEntries);
        }
      } catch (error) {
        console.warn('[ProgressTrackerDB] Goal feedback migration skipped:', error);
      }
    });

    // Version 6: Add track field index for on-ice/off-ice filtering
    this.version(6).stores({
      goals: "id, discipline, type, createdAt, archivedAt, weekStartDate, containerId, track",
      appData: "id, startDate",
      goalSubmissions: "id, containerId, primaryGoalId, weekStartDate",
      goalFeedback: "id, goalId, containerId, weekStartDate, discipline, createdAt",
    }).upgrade(async (tx) => {
      // Set track to 'on-ice' for any existing goals without a track field
      console.log('[ProgressTrackerDB] Migrating goals to include track field...');
      const goalsTable = tx.table('goals');
      const allGoals = await goalsTable.toArray();
      let migrated = 0;
      for (const goal of allGoals) {
        if (!goal.track) {
          await goalsTable.update(goal.id, { track: 'on-ice' });
          migrated++;
        }
      }
      console.log(`[ProgressTrackerDB] Migrated ${migrated} goals to have track='on-ice'`);
    });
  }
}

export const progressTrackerDB = new ProgressTrackerDB();

function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
