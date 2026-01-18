import { useState, useEffect, useReducer, useRef } from 'react';
import { Goal } from '../db/progress-tracker/types';
import { getActiveGoals, getAppData } from '../db/progress-tracker/operations';
import { getDisciplineDisplay } from '../utils/disciplines';
import { archiveAndPlanWeek, computeUpcomingWeekDates, GoalRatingInput, UpcomingWeekDates } from '../services/archiveWeek';

function StarRating({ rating, onRatingChange }: { rating: number | undefined; onRatingChange: (rating: number) => void }) {
  const [hovered, setHovered] = useState<number | undefined>(undefined);
  const displayed = hovered ?? rating ?? 0;

  return (
    <div className="flex gap-1" onMouseLeave={() => setHovered(undefined)}>
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onFocus={() => setHovered(star)}
          onBlur={() => setHovered(undefined)}
          onClick={() => onRatingChange(star)}
          className={`text-2xl ${star <= displayed ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-400 transition`}
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
  track?: "on-ice" | "off-ice";
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

export default function ArchiveWeekModal({
  focusDiscipline,
  onClose,
  onSuccess,
  track = "on-ice",
}: ArchiveWeekModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [primaryGoals, setPrimaryGoals] = useState<Goal[]>([]);
  const [workingGoals, setWorkingGoals] = useState<Goal[]>([]);
  const [goalRatings, dispatchGoalRatings] = useReducer(goalRatingsReducer, {});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Step 2 data - goal cards
  type GoalCard = { goal: string; step1: string; step2: string };
  const [goalCards, setGoalCards] = useState<GoalCard[]>([{ goal: '', step1: '', step2: '' }]);
  const [weekDates, setWeekDates] = useState<UpcomingWeekDates | null>(null);

  function updateGoalCard(index: number, field: keyof GoalCard, value: string) {
    setGoalCards(prev => prev.map((card, idx) => (idx === index ? { ...card, [field]: value } : card)));
  }

  function addGoalCard() {
    setGoalCards(prev => (prev.length >= 3 ? prev : [...prev, { goal: '', step1: '', step2: '' }]));
  }

  function removeGoalCard(index: number) {
    setGoalCards(prev => prev.filter((_, idx) => idx !== index));
  }


  useEffect(() => {
    async function loadGoals() {
      setLoading(true);
      try {
        const allGoals = await getActiveGoals();
        const primary = allGoals.filter(
          g => g.discipline === focusDiscipline && g.type === 'primary' && (g.track || 'on-ice') === track
        );
        const working = allGoals.filter(
          g => g.discipline === focusDiscipline && g.type === 'working' && (g.track || 'on-ice') === track
        );
        setPrimaryGoals(primary);
        setWorkingGoals(working);

        const initialRatings: GoalRatingsState = {};
        [...primary, ...working].forEach(goal => {
          initialRatings[goal.id] = { rating: undefined, feedback: '' };
        });
        dispatchGoalRatings({ type: 'reset', payload: initialRatings });

        setGoalCards([{ goal: '', step1: '', step2: '' }]);

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


  // Keep modal scrolled to top on step change.
  useEffect(() => {
    if (modalRef.current) {
      modalRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [step]);

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
    const missingFeedback = allGoalIds.filter(goalId => {
      const feedback = goalRatings[goalId]?.feedback?.trim();
      return !feedback;
    });

    if (missingRatings.length > 0 || missingFeedback.length > 0) {
      const parts: string[] = [];
      if (missingRatings.length > 0) {
        parts.push(`${missingRatings.length} goal(s) missing ratings`);
      }
      if (missingFeedback.length > 0) {
        parts.push(`${missingFeedback.length} goal(s) missing feedback`);
      }
      alert(`Please complete all required fields: ${parts.join(', ')}.`);
      return;
    }

    setStep(2);
  }

  function handleBackToStep1() {
    setStep(1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const cleanedCards = goalCards.map(card => ({
      goal: card.goal.trim(),
      step1: card.step1.trim(),
      step2: card.step2.trim(),
    }));

    // Validation: all fields required on every card, at least one card
    if (
      cleanedCards.length === 0 ||
      cleanedCards.some(card => !card.goal || !card.step1 || !card.step2)
    ) {
      alert('Each goal card requires Goal, Step 1, and Step 2. Add at least one card.');
      return;
    }

    const plannedGoals = {
      primary: cleanedCards.map(c => c.goal),
      workingWeek1: cleanedCards.map(c => c.step1),
      workingWeek2: cleanedCards.map(c => c.step2),
    };

    const goalsToArchive = [...primaryGoals, ...workingGoals];
    const goalRatingInputs: GoalRatingInput[] = [];

    for (const goal of goalsToArchive) {
      const entry = goalRatings[goal.id];
      if (!entry || entry.rating === undefined) {
        alert('Please provide ratings (1-5 stars) for all goals before archiving.');
        return;
      }
      if (!entry.feedback || entry.feedback.trim() === '') {
        alert('Please provide feedback for all goals before archiving.');
        return;
      }
      goalRatingInputs.push({
        goalId: goal.id,
        rating: entry.rating,
        feedback: entry.feedback.trim(),
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
        <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-lg">
          <p>Loading goals...</p>
        </div>
      </div>
    );
  }

  // Build goal containers for feedback step (primary with its working steps)
  const goalContainers = primaryGoals.map(primary => ({
    primary,
    working: workingGoals.filter(w => w.containerId === primary.id),
  }));

  const unlinkedWorkingGoals = workingGoals.filter(
    w => !primaryGoals.some(p => p.id === w.containerId)
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div
        ref={modalRef}
        className="bg-white rounded-lg p-6 max-w-3xl w-full overflow-y-auto shadow-xl my-auto"
        style={{
          maxHeight: 'calc(100vh - 2rem)',
        }}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold">
            ✅ Archive {getDisciplineDisplay(focusDiscipline)} Week
          </h2>
          <span className="text-sm text-gray-500 mt-1">Step {step} of 2</span>
        </div>

        {step === 1 ? (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">📝 Feedback</h3>
              <p className="text-sm text-gray-600 mb-4">
                Rate how well you did on each goal and provide feedback.
              </p>

              {goalContainers.length > 0 && (
                <div className="space-y-4">
                  {goalContainers.map(container => {
                    const primaryState = goalRatings[container.primary.id] ?? { rating: undefined, feedback: '' };
                    return (
                      <div key={container.primary.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                        <div>
                          <p className="mb-1 text-xs uppercase text-gray-500">Primary Goal</p>
                          <p className="mb-2 font-medium">{container.primary.content}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-700 mb-1">
                                Rating (1-5 stars) <span className="text-red-500">*</span>
                              </label>
                              <StarRating
                                rating={primaryState.rating}
                                onRatingChange={(rating) => updateGoalRating(container.primary.id, rating, primaryState.feedback)}
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-700 mb-1">
                                Feedback <span className="text-red-500">*</span>
                              </label>
                              <textarea
                                value={primaryState.feedback}
                                onChange={(e) => updateGoalRating(container.primary.id, primaryState.rating, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                                rows={2}
                                placeholder="How did it go?"
                              />
                            </div>
                          </div>
                        </div>

                        {container.working.length > 0 && (
                          <div className="space-y-3">
                            <p className="text-xs uppercase text-gray-500">Working Steps</p>
                            {container.working.map((goal, idx) => {
                              const goalState = goalRatings[goal.id] ?? { rating: undefined, feedback: '' };
                              return (
                                <div key={goal.id} className="border border-gray-100 rounded-md p-3">
                                  <p className="mb-2 font-medium">Step {idx + 1}: {goal.content}</p>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="block text-sm text-gray-700 mb-1">
                                        Rating (1-5 stars) <span className="text-red-500">*</span>
                                      </label>
                                      <StarRating
                                        rating={goalState.rating}
                                        onRatingChange={(rating) => updateGoalRating(goal.id, rating, goalState.feedback)}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm text-gray-700 mb-1">
                                        Feedback <span className="text-red-500">*</span>
                                      </label>
                                      <textarea
                                        value={goalState.feedback}
                                        onChange={(e) => updateGoalRating(goal.id, goalState.rating, e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                                        rows={2}
                                        placeholder="How did it go?"
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {unlinkedWorkingGoals.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Additional Working Goals</h4>
                  {unlinkedWorkingGoals.map(goal => {
                    const goalState = goalRatings[goal.id] ?? { rating: undefined, feedback: '' };
                    return (
                      <div key={goal.id} className="border border-gray-200 rounded-lg p-4">
                        <p className="mb-2 font-medium">{goal.content}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-gray-700 mb-1">
                              Rating (1-5 stars) <span className="text-red-500">*</span>
                            </label>
                            <StarRating
                              rating={goalState.rating}
                              onRatingChange={(rating) => updateGoalRating(goal.id, rating, goalState.feedback)}
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-gray-700 mb-1">
                              Feedback <span className="text-red-500">*</span>
                            </label>
                            <textarea
                              value={goalState.feedback}
                              onChange={(e) => updateGoalRating(goal.id, goalState.rating, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900"
                              rows={2}
                              placeholder="How did it go?"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {goalContainers.length === 0 && unlinkedWorkingGoals.length === 0 && (
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
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Next Goals</h3>
                <p className="text-sm text-gray-600">
                  Each goal has two required steps leading up to the next {getDisciplineDisplay(focusDiscipline)} week.
                </p>
              </div>

              <div className="space-y-4">
                {goalCards.map((card, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="font-medium">Goal {index + 1}</div>
                      <button
                        type="button"
                        onClick={() => removeGoalCard(index)}
                        className="text-sm text-red-600 hover:text-red-700 disabled:text-gray-300"
                        disabled={goalCards.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Goal (primary) — target week {weekDates ? new Date(weekDates.week3).toLocaleDateString() : ''} <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={card.goal}
                        onChange={(e) => updateGoalCard(index, 'goal', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="What you want to achieve by the next discipline week"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Step 1 — week of {weekDates ? new Date(weekDates.week1).toLocaleDateString() : ''} <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={card.step1}
                        onChange={(e) => updateGoalCard(index, 'step1', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="First working step for the upcoming week"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">
                        Step 2 — week of {weekDates ? new Date(weekDates.week2).toLocaleDateString() : ''} <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        value={card.step2}
                        onChange={(e) => updateGoalCard(index, 'step2', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={2}
                        placeholder="Second working step for the following week"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>

              {goalCards.length < 3 && (
                <button
                  type="button"
                  onClick={addGoalCard}
                  className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition"
                >
                  + Add another goal
                </button>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={handleBackToStep1}
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
