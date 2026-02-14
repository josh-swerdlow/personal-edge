import { AppData } from '../db/progress-tracker/types';
import {
  getAppData,
  getWeekStartDate,
  createGoal,
  archiveGoal,
  updateGoal,
  createGoalFeedbackEntry,
} from '../db/progress-tracker/operations';
import { progressTrackerDB } from '../db/progress-tracker/db';

export interface GoalRatingInput {
  goalId: string;
  rating: number;
  feedback: string;
  skipped?: boolean;
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
  track?: "on-ice" | "off-ice";
}

export async function archiveAndPlanWeek({
  focusDiscipline,
  goalRatings,
  plannedGoals,
  track = "on-ice",
}: ArchiveAndPlanPayload): Promise<void> {
  const appData = await getAppData();
  const weekDates = computeUpcomingWeekDates(appData);

  const nextWeekStartStr = weekDates.week1;
  const week2StartStr = weekDates.week2;
  const week3StartStr = weekDates.week3;
  const archivedWeekStart = getWeekStartDate(appData.startDate);

  await Promise.all(goalRatings.map(async goal => {
    const sourceGoal = await progressTrackerDB.goals.get(goal.goalId);
    if (!sourceGoal) {
      throw new Error(`Goal ${goal.goalId} not found while recording feedback.`);
    }

    await createGoalFeedbackEntry({
      goalId: goal.goalId,
      containerId: sourceGoal.containerId ?? sourceGoal.id,
      discipline: sourceGoal.discipline,
      weekStartDate: archivedWeekStart,
      rating: goal.skipped ? undefined : goal.rating,
      feedback: goal.skipped ? undefined : goal.feedback,
      completed: !goal.skipped,
    });
  }));

  await Promise.all(goalRatings.map(goal => archiveGoal(goal.goalId)));

  const trimmedPrimaryGoals = plannedGoals.primary.map(content => content.trim()).filter(Boolean);
  const trimmedWorkingWeek1 = plannedGoals.workingWeek1.map(content => content.trim());
  const trimmedWorkingWeek2 = plannedGoals.workingWeek2.map(content => content.trim());

  if (
    trimmedPrimaryGoals.length !== trimmedWorkingWeek1.length ||
    trimmedPrimaryGoals.length !== trimmedWorkingWeek2.length
  ) {
    throw new Error('Goal card data is misaligned. Please try again.');
  }

  for (let i = 0; i < trimmedPrimaryGoals.length; i++) {
    const primaryContent = trimmedPrimaryGoals[i];
    const step1Content = trimmedWorkingWeek1[i];
    const step2Content = trimmedWorkingWeek2[i];

    // Create primary goal first
    const primaryGoal = await createGoal({
      discipline: focusDiscipline,
      type: 'primary',
      content: primaryContent,
      weekStartDate: week3StartStr,
      track,
    });

    // Ensure primary goal references its own container
    await updateGoal(primaryGoal.id, { containerId: primaryGoal.id });

    // Create working goals linked to the container
    await createGoal({
      discipline: focusDiscipline,
      type: 'working',
      content: step1Content,
      weekStartDate: nextWeekStartStr,
      containerId: primaryGoal.id,
      track,
    });

    await createGoal({
      discipline: focusDiscipline,
      type: 'working',
      content: step2Content,
      weekStartDate: week2StartStr,
      containerId: primaryGoal.id,
      track,
    });
  }
}

