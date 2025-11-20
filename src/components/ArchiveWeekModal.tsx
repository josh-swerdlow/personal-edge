import { useState, useEffect, useReducer, Dispatch, SetStateAction } from 'react';
import { Goal } from '../db/progress-tracker/types';
import { getActiveGoals, getAppData } from '../db/progress-tracker/operations';
import { getDisciplineDisplay } from '../utils/disciplines';
import { archiveAndPlanWeek, computeUpcomingWeekDates, GoalRatingInput, UpcomingWeekDates } from '../services/archiveWeek';

function StarRating({ rating, onRatingChange }: { rating: number | undefined; onRatingChange: (rating: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onRatingChange(star)}
          className={`text-2xl ${star <= (rating || 0) ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

interface ArchiveWeekModalProps {
  focusDiscipline: "Spins" | "Jumps" | "Edges";
  onClose: () => void;
  onSuccess: () => void;
}

interface GoalFeedbackState {
  rating?: number;
  feedback: string;
}

type GoalRatingsState = Record<string, GoalFeedbackState>;

type GoalRatingsAction =
  | { type: 'reset'; payload: GoalRatingsState }
  | { type: 'update'; goalId: string; rating?: number; feedback?: string };

function goalRatingsReducer(state: GoalRatingsState, action: GoalRatingsAction): GoalRatingsState {
  switch (action.type) {
    case 'reset':
      return action.payload;
    case 'update': {
      const existing = state[action.goalId] ?? { feedback: '' };
      return {
        ...state,
        [action.goalId]: {
          rating: action.rating ?? existing.rating,
          feedback: action.feedback ?? existing.feedback,
        },
      };
    }
    default:
      return state;
  }
}

function createLineHandlers(setter: Dispatch<SetStateAction<string[]>>) {
  return {
    add: () => setter(prev => [...prev, '']),
    update: (index: number, value: string) => setter(prev => prev.map((line, idx) => (idx === index ? value : line))),
    remove: (index: number) => setter(prev => prev.filter((_, idx) => idx !== index)),
  };
}

export default function ArchiveWeekModal({
  focusDiscipline,
  onClose,
  onSuccess,
}: ArchiveWeekModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [primaryGoals, setPrimaryGoals] = useState<Goal[]>([]);
  const [workingGoals, setWorkingGoals] = useState<Goal[]>([]);
  const [goalRatings, dispatchGoalRatings] = useReducer(goalRatingsReducer, {});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Step 2 data
  const [newPrimaryGoals, setNewPrimaryGoals] = useState<string[]>(['']);
  const [newWorkingGoalsWeek1, setNewWorkingGoalsWeek1] = useState<string[]>(['']);
  const [newWorkingGoalsWeek2, setNewWorkingGoalsWeek2] = useState<string[]>(['']);
  const [weekDates, setWeekDates] = useState<UpcomingWeekDates | null>(null);

  const primaryLineHandlers = createLineHandlers(setNewPrimaryGoals);
  const workingWeek1LineHandlers = createLineHandlers(setNewWorkingGoalsWeek1);
  const workingWeek2LineHandlers = createLineHandlers(setNewWorkingGoalsWeek2);


  useEffect(() => {
    async function loadGoals() {
      setLoading(true);
      try {
        const allGoals = await getActiveGoals();
        const primary = allGoals.filter(
          g => g.discipline === focusDiscipline && g.type === 'primary'
        );
        const working = allGoals.filter(
          g => g.discipline === focusDiscipline && g.type === 'working'
        );
        setPrimaryGoals(primary);
        setWorkingGoals(working);

        const initialRatings: GoalRatingsState = {};
        [...primary, ...working].forEach(goal => {
          initialRatings[goal.id] = { rating: undefined, feedback: '' };
        });
        dispatchGoalRatings({ type: 'reset', payload: initialRatings });

        setNewPrimaryGoals(['']);
        setNewWorkingGoalsWeek1(['']);
        setNewWorkingGoalsWeek2(['']);

        // Calculate week dates for step 2
        const appData = await getAppData();
        setWeekDates(computeUpcomingWeekDates(appData));
      } catch (error) {
        console.error('Failed to load goals:', error);
      } finally {
        setLoading(false);
      }
    }
    loadGoals();
  }, [focusDiscipline]);

  function updateGoalRating(goalId: string, rating: number | undefined, feedback: string) {
    dispatchGoalRatings({ type: 'update', goalId, rating, feedback });
  }

  async function handleStep1Next() {
    // Validate that all goals have ratings (1-5)
    const allGoalIds = [...primaryGoals, ...workingGoals].map(goal => goal.id);
    const missingRatings = allGoalIds.filter(goalId => {
      const rating = goalRatings[goalId]?.rating;
      return rating === undefined || rating < 1 || rating > 5;
    });

    if (missingRatings.length > 0) {
      alert(`Please provide ratings (1-5 stars) for all goals. ${missingRatings.length} goal(s) missing ratings.`);
      return;
    }

    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const plannedPrimaryGoals = newPrimaryGoals.map(goal => goal.trim()).filter(Boolean);
    if (plannedPrimaryGoals.length === 0) {
      alert('Please enter at least one primary goal for the next week.');
      return;
    }

    const plannedGoals = {
      primary: plannedPrimaryGoals,
      workingWeek1: newWorkingGoalsWeek1.map(goal => goal.trim()).filter(Boolean),
      workingWeek2: newWorkingGoalsWeek2.map(goal => goal.trim()).filter(Boolean),
    };

    const goalsToArchive = [...primaryGoals, ...workingGoals];
    const goalRatingInputs: GoalRatingInput[] = [];

    for (const goal of goalsToArchive) {
      const entry = goalRatings[goal.id];
      if (!entry || entry.rating === undefined) {
        alert('Please provide ratings (1-5 stars) for all goals before archiving.');
        return;
      }
      goalRatingInputs.push({
        goalId: goal.id,
        rating: entry.rating,
        feedback: entry.feedback || '',
      });
    }

    setSubmitting(true);
    try {
      await archiveAndPlanWeek({
        focusDiscipline,
        goalRatings: goalRatingInputs,
        plannedGoals,
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to archive week:', error);
      alert('Failed to archive week. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }


  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6">
          <p>Loading goals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          ✅ Archive {getDisciplineDisplay(focusDiscipline)} Week - Step {step} of 2
        </h2>

        {step === 1 ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">📝 Feedback</h3>
              <p className="text-sm text-gray-600 mb-4">
                Rate how well you did on each goal and provide feedback.
              </p>

              {primaryGoals.length > 0 && (
                <div className="mb-6">
                  <h4 className="font-medium mb-2">Primary Goals</h4>
                  <div className="space-y-3">
                    {primaryGoals.map(goal => {
                      const goalState = goalRatings[goal.id] ?? { rating: undefined, feedback: '' };
                      return (
                        <div key={goal.id} className="border border-gray-200 rounded-lg p-4">
                          <p className="mb-2 font-medium">{goal.content}</p>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-700 mb-1">
                                Rating (1-5 stars)
                              </label>
                              <StarRating
                                rating={goalState.rating}
                                onRatingChange={(rating) => updateGoalRating(goal.id, rating, goalState.feedback)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-700 mb-1">
                                Feedback
                              </label>
                              <textarea
                                value={goalState.feedback}
                                onChange={(e) => updateGoalRating(goal.id, goalState.rating, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                rows={2}
                                placeholder="How did it go?"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {workingGoals.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Working Goals</h4>
                  <div className="space-y-3">
                    {workingGoals.map(goal => {
                      const goalState = goalRatings[goal.id] ?? { rating: undefined, feedback: '' };
                      return (
                        <div key={goal.id} className="border border-gray-200 rounded-lg p-4">
                          <p className="mb-2 font-medium">{goal.content}</p>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-700 mb-1">
                                Rating (1-5 stars)
                              </label>
                              <StarRating
                                rating={goalState.rating}
                                onRatingChange={(rating) => updateGoalRating(goal.id, rating, goalState.feedback)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-700 mb-1">
                                Feedback
                              </label>
                              <textarea
                                value={goalState.feedback}
                                onChange={(e) => updateGoalRating(goal.id, goalState.rating, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                rows={2}
                                placeholder="How did it go?"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {primaryGoals.length === 0 && workingGoals.length === 0 && (
                <p className="text-gray-500">No goals to rate for this week.</p>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStep1Next}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                disabled={primaryGoals.length === 0 && workingGoals.length === 0}
              >
                Next: Set Next Goals
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Next Goals</h3>
              <p className="text-sm text-gray-600 mb-4">
                Set goals for {getDisciplineDisplay(focusDiscipline)} over the next 3 weeks
              </p>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Goals for Next {getDisciplineDisplay(focusDiscipline)} Week [{weekDates ? new Date(weekDates.week3).toLocaleDateString() : ''}] *
                </label>
                <div className="space-y-2">
                  {newPrimaryGoals.map((line, index) => (
                    <div key={index} className="flex gap-2">
                      <textarea
                        value={line}
                        onChange={(e) => primaryLineHandlers.update(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder={`Primary goal ${index + 1}`}
                        required
                      />
                      {newPrimaryGoals.length > 1 && (
                        <button
                          type="button"
                          onClick={() => primaryLineHandlers.remove(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={primaryLineHandlers.add}
                  className="mt-2 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition"
                >
                  + Add Primary Goal
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Working Goals for {getDisciplineDisplay(focusDiscipline)} [{weekDates ? new Date(weekDates.week1).toLocaleDateString() : ''}]
                </label>
                <div className="space-y-2">
                  {newWorkingGoalsWeek1.map((line, index) => (
                    <div key={index} className="flex gap-2">
                      <textarea
                        value={line}
                        onChange={(e) => workingWeek1LineHandlers.update(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder={`Working goal ${index + 1}`}
                      />
                      {newWorkingGoalsWeek1.length > 1 && (
                        <button
                          type="button"
                          onClick={() => workingWeek1LineHandlers.remove(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={workingWeek1LineHandlers.add}
                  className="mt-2 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition"
                >
                  + Add Working Goal
                </button>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Working Goals for {getDisciplineDisplay(focusDiscipline)} [{weekDates ? new Date(weekDates.week2).toLocaleDateString() : ''}]
                </label>
                <div className="space-y-2">
                  {newWorkingGoalsWeek2.map((line, index) => (
                    <div key={index} className="flex gap-2">
                      <textarea
                        value={line}
                        onChange={(e) => workingWeek2LineHandlers.update(index, e.target.value)}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder={`Working goal ${index + 1}`}
                      />
                      {newWorkingGoalsWeek2.length > 1 && (
                        <button
                          type="button"
                          onClick={() => workingWeek2LineHandlers.remove(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded transition"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={workingWeek2LineHandlers.add}
                  className="mt-2 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition"
                >
                  + Add Working Goal
                </button>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                disabled={submitting}
              >
                Back
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                disabled={submitting}
              >
                {submitting ? 'Archiving...' : 'Archive & Save'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
