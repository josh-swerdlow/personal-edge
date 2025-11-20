import { AppData } from '../db/progress-tracker/types';
import { getAppData, getWeekStartDate, createGoal, archiveGoal } from '../db/progress-tracker/operations';
import { progressTrackerDB } from '../db/progress-tracker/db';

export interface GoalRatingInput {
  goalId: string;
  rating: number;
  feedback: string;
}

export interface PlannedGoalsInput {
  primary: string[];
  workingWeek1: string[];
  workingWeek2: string[];
}

export interface UpcomingWeekDates {
  week1: string;
  week2: string;
  week3: string;
}

export function computeUpcomingWeekDates(appData: AppData): UpcomingWeekDates {
  const currentWeekStart = getWeekStartDate(appData.startDate);
  const baseDate = new Date(currentWeekStart);

  const week1Date = new Date(baseDate);
  week1Date.setDate(week1Date.getDate() + 7);

  const week2Date = new Date(week1Date);
  week2Date.setDate(week2Date.getDate() + 7);

  const week3Date = new Date(week2Date);
  week3Date.setDate(week3Date.getDate() + 7);

  return {
    week1: week1Date.toISOString().split('T')[0],
    week2: week2Date.toISOString().split('T')[0],
    week3: week3Date.toISOString().split('T')[0],
  };
}

export interface ArchiveAndPlanPayload {
  focusDiscipline: "Spins" | "Jumps" | "Edges";
  goalRatings: GoalRatingInput[];
  plannedGoals: PlannedGoalsInput;
}

export async function archiveAndPlanWeek({
  focusDiscipline,
  goalRatings,
  plannedGoals,
}: ArchiveAndPlanPayload): Promise<void> {
  const appData = await getAppData();
  const weekDates = computeUpcomingWeekDates(appData);

  const nextWeekStartStr = weekDates.week1;
  const week2StartStr = weekDates.week2;
  const week3StartStr = weekDates.week3;

  const now = Date.now();

  await Promise.all(goalRatings.map(goal => (
    progressTrackerDB.goalRatings.add({
      goalId: goal.goalId,
      rating: goal.rating,
      feedback: goal.feedback,
      archivedAt: now,
    })
  )));

  await Promise.all(goalRatings.map(goal => archiveGoal(goal.goalId)));

  const trimmedPrimaryGoals = plannedGoals.primary.map(content => content.trim()).filter(Boolean);
  const trimmedWorkingWeek1 = plannedGoals.workingWeek1.map(content => content.trim()).filter(Boolean);
  const trimmedWorkingWeek2 = plannedGoals.workingWeek2.map(content => content.trim()).filter(Boolean);

  await Promise.all([
    ...trimmedPrimaryGoals.map(content =>
      createGoal({
        discipline: focusDiscipline,
        type: 'primary',
        content,
        weekStartDate: week3StartStr,
      })
    ),
    ...trimmedWorkingWeek1.map(content =>
      createGoal({
        discipline: focusDiscipline,
        type: 'working',
        content,
        weekStartDate: nextWeekStartStr,
      })
    ),
    ...trimmedWorkingWeek2.map(content =>
      createGoal({
        discipline: focusDiscipline,
        type: 'working',
        content,
        weekStartDate: week2StartStr,
      })
    ),
  ]);
}

