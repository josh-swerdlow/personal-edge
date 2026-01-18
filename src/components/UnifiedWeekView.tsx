import { useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { Goal, GoalContainer, GoalFeedback, GoalTrack } from '../db/progress-tracker/types';
import { TrackTabs } from './TrackTabs';
import {
  getAppData,
  getWeekStartDate,
  updateGoal,
  createGoalContainer,
  getGoalContainersByDiscipline,
  addWorkingGoalToContainer,
  deleteGoalContainer,
  canCreateContainer,
  canAddWorkingGoal,
  deleteGoal,
  getGoalFeedbackForContainer,
  upsertGoalFeedbackEntry
} from '../db/progress-tracker/operations';
import { progressTrackerDB } from '../db/progress-tracker/db';
import { FaEdit, FaTrash, FaPlus } from 'react-icons/fa';
import { DISCIPLINES, getDisciplineBadgeClasses, getDisciplineDisplay } from '../utils/disciplines';
import LiquidGlassCard from './LiquidGlassCard';
import { logger } from '../utils/logger';
import ArchiveWeekModal from './ArchiveWeekModal';

interface UnifiedWeekViewProps {
  onGoalUpdate: () => void;
}

interface WeekData {
  weekStartDate: string;
  discipline: "Spins" | "Jumps" | "Edges";
  containers: GoalContainer[];
  isFuture?: boolean;
}

function formatWeekDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function UnifiedWeekView({ onGoalUpdate }: UnifiedWeekViewProps) {
  const [currentWeek, setCurrentWeek] = useState<WeekData | null>(null);
  const [futureWeeks, setFutureWeeks] = useState<WeekData[]>([]);
  const [pastWeeks, setPastWeeks] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFuture, setShowFuture] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editText, setEditText] = useState('');
  const [appData, setAppData] = useState<{ startDate: string; cycleLength: number } | null>(null);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [archiveDiscipline, setArchiveDiscipline] = useState<"Spins" | "Jumps" | "Edges" | null>(null);
  const [archiveTrack, setArchiveTrack] = useState<"on-ice" | "off-ice">("on-ice");

  const disciplines = DISCIPLINES;

  const loadCurrentWeek = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAppData();
      setAppData(data);

      const currentWeekStart = getWeekStartDate(data.startDate);
      // Calculate which discipline this week is using current date (not week start date)
      const now = new Date();
      const daysFromStart = Math.floor((now.getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24));
      const weekNumber = Math.floor(daysFromStart / 7);
      const cyclePosition = weekNumber % data.cycleLength;
      const discipline = disciplines[cyclePosition];

      // Load goal containers for current week (will be filtered by track in WeekCard)
      const containers = await getGoalContainersByDiscipline(discipline, currentWeekStart);

      setCurrentWeek({
        weekStartDate: currentWeekStart,
        discipline,
        containers,
      });
    } catch (error) {
      logger.error('Failed to load current week:', error);
    } finally {
      setLoading(false);
    }
  }, [disciplines]);

  useEffect(() => {
    loadCurrentWeek();
  }, [loadCurrentWeek]);

  async function loadFutureWeeks(forceReload = false) {
    if (!appData || (!forceReload && futureWeeks.length > 0)) return;

    setLoading(true);
    try {
      // Calculate current week number first
      const now = new Date();
      const daysFromStart = Math.floor((now.getTime() - new Date(appData.startDate).getTime()) / (1000 * 60 * 60 * 24));
      const currentWeekNumber = Math.floor(daysFromStart / 7);

      const future: WeekData[] = [];
      for (let i = 1; i <= 3; i++) {
        // Calculate the week number for this future week
        const futureWeekNumber = currentWeekNumber + i;

        // Calculate the week start date directly from start date and week number
        const weekStart = new Date(appData.startDate);
        weekStart.setDate(weekStart.getDate() + (futureWeekNumber * 7));
        const weekStartStr = weekStart.toISOString().split('T')[0];

        // Calculate discipline using the week number
        const cyclePosition = futureWeekNumber % appData.cycleLength;
        const discipline = disciplines[cyclePosition];

        // Load goal containers for this week (will be filtered by track in WeekCard)
        const containers = await getGoalContainersByDiscipline(discipline, weekStartStr);

        future.push({
          weekStartDate: weekStartStr,
          discipline,
          containers,
          isFuture: true,
        });
      }

      setFutureWeeks(future);
    } catch (error) {
      logger.error('Failed to load future weeks:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPastWeeks(forceReload = false) {
    if (!appData || (!forceReload && pastWeeks.length > 0)) return;

    setLoading(true);
    try {
      // Calculate current week number first
      const now = new Date();
      const daysFromStart = Math.floor((now.getTime() - new Date(appData.startDate).getTime()) / (1000 * 60 * 60 * 24));
      const currentWeekNumber = Math.floor(daysFromStart / 7);

      const past: WeekData[] = [];
      for (let i = 1; i <= 6; i++) {
        // Calculate the week number for this past week
        const pastWeekNumber = currentWeekNumber - i;

        // Calculate the week start date directly from start date and week number
        const weekStart = new Date(appData.startDate);
        weekStart.setDate(weekStart.getDate() + (pastWeekNumber * 7));
        const weekStartStr = weekStart.toISOString().split('T')[0];

        // Calculate discipline using the week number
        const cyclePosition = pastWeekNumber % appData.cycleLength;
        const discipline = disciplines[cyclePosition];

        // Load goal containers for this week (will be filtered by track in WeekCard)
        const containers = await getGoalContainersByDiscipline(discipline, weekStartStr);

        past.push({
          weekStartDate: weekStartStr,
          discipline,
          containers,
        });
      }

      setPastWeeks(past.reverse());
    } catch (error) {
      logger.error('Failed to load past weeks:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoalEdit(goal: Goal) {
    // Verify the goal exists and get fresh data
    const freshGoal = await progressTrackerDB.goals.get(goal.id);
    if (!freshGoal || freshGoal.archivedAt) {
      logger.error('Cannot edit archived or non-existent goal:', goal.id);
      return;
    }
    setEditingGoal(freshGoal);
    setEditText(freshGoal.content);
  }

  async function handleGoalSave() {
    if (!editingGoal || !editText.trim()) return;

    // Verify we're editing the correct goal type
    const goalToUpdate = await progressTrackerDB.goals.get(editingGoal.id);
    if (!goalToUpdate) {
      logger.error('Goal not found for update:', editingGoal.id);
      setEditingGoal(null);
      setEditText('');
      return;
    }

    // Update the goal
    await updateGoal(editingGoal.id, { content: editText.trim() });

    // Clear editing state
    setEditingGoal(null);
    setEditText('');

    // Reload data
    await loadCurrentWeek();
    if (showFuture) {
      await loadFutureWeeks(true);
    }
    if (showPast) {
      await loadPastWeeks(true);
    }
    onGoalUpdate();
  }

  async function handleGoalDelete(goalId: string, isPrimary: boolean = false) {
    if (confirm(isPrimary ? 'Are you sure you want to delete this goal container? This will delete the primary goal and all working goals.' : 'Are you sure you want to delete this goal?')) {
      if (isPrimary) {
        // Delete entire container
        await deleteGoalContainer(goalId);
      } else {
        // Delete just the working goal
      await deleteGoal(goalId);
      }
      await loadCurrentWeek();
      if (showFuture) {
        await loadFutureWeeks(true);
      }
      if (showPast) {
        await loadPastWeeks(true);
      }
      onGoalUpdate();
    }
  }

  function handleSubmitRequest(discipline: "Spins" | "Jumps" | "Edges", track: "on-ice" | "off-ice" = "on-ice") {
    setArchiveDiscipline(discipline);
    setArchiveTrack(track);
    setShowArchiveModal(true);
  }

  async function handleCreateContainer(discipline: "Spins" | "Jumps" | "Edges", primaryContent: string, weekStartDate?: string, track: "on-ice" | "off-ice" = "on-ice") {
    if (!primaryContent || !primaryContent.trim()) return;

    try {
      // Explicitly pass empty array to ensure no working goals are created
      await createGoalContainer(discipline, primaryContent.trim(), [], weekStartDate, track);
      // Clear any editing state before reloading
      setEditingGoal(null);
      setEditText('');
      await loadCurrentWeek();
      if (showFuture) {
        await loadFutureWeeks(true);
      }
      if (showPast) {
        await loadPastWeeks(true);
      }
      onGoalUpdate();
    } catch (error: any) {
      alert(error.message || 'Failed to create goal container');
    }
  }

  async function handleAddWorkingGoal(containerId: string, content: string) {
    if (!content || !content.trim()) return;

    try {
      await addWorkingGoalToContainer(containerId, content.trim());
      // Clear any editing state before reloading
      setEditingGoal(null);
      setEditText('');
    await loadCurrentWeek();
    if (showFuture) {
      await loadFutureWeeks(true);
    }
    if (showPast) {
      await loadPastWeeks(true);
    }
    onGoalUpdate();
    } catch (error: any) {
      alert(error.message || 'Failed to add working goal');
    }
  }

  if (loading && !currentWeek) {
    return <div className="text-center py-8 text-white/70">Loading...</div>;
  }

  if (!currentWeek) {
    return <div className="text-center py-8 text-white/70">No current week data</div>;
  }

  return (
    <div className="space-y-6">
      {showArchiveModal && archiveDiscipline && (
        <ArchiveWeekModal
          focusDiscipline={archiveDiscipline}
          track={archiveTrack}
          onClose={() => setShowArchiveModal(false)}
          onSuccess={async () => {
            await loadCurrentWeek();
            if (showFuture) {
              await loadFutureWeeks(true);
            }
            if (showPast) {
              await loadPastWeeks(true);
            }
            onGoalUpdate();
            setShowArchiveModal(false);
          }}
        />
      )}

      {/* Current Week */}
      <WeekCard
        week={currentWeek}
        isCurrent={true}
        isFuture={false}
        formatWeekDate={formatWeekDate}
        getDisciplineDisplay={getDisciplineDisplay}
        onGoalEdit={handleGoalEdit}
        onGoalDelete={handleGoalDelete}
        editingGoal={editingGoal}
        editText={editText}
        setEditText={setEditText}
        onSave={handleGoalSave}
        onCancel={() => {
          setEditingGoal(null);
          setEditText('');
        }}
        onCreateContainer={handleCreateContainer}
        onAddWorkingGoal={handleAddWorkingGoal}
        onSubmitRequest={handleSubmitRequest}
      />

      {/* Future Weeks */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Future Weeks</h2>
          <button
            onClick={() => {
              setShowFuture(!showFuture);
              if (!showFuture) {
                loadFutureWeeks();
              }
            }}
            className="px-4 py-2 text-sm bg-white/20 text-white rounded-lg hover:bg-white/30 transition"
          >
            {showFuture ? 'Hide Future' : 'Load Future Weeks'}
          </button>
        </div>

        {showFuture && (
          <div className="space-y-4">
            {futureWeeks.length === 0 ? (
              <p className="text-white/70 text-center py-4">Loading future weeks...</p>
            ) : (
              futureWeeks.map(week => (
                <WeekCard
                  key={week.weekStartDate}
                  week={week}
                  isCurrent={false}
                  isPast={false}
                  isFuture={true}
                  formatWeekDate={formatWeekDate}
                  getDisciplineDisplay={getDisciplineDisplay}
                  onGoalEdit={handleGoalEdit}
                  onGoalDelete={handleGoalDelete}
                  editingGoal={editingGoal}
                  editText={editText}
                  setEditText={setEditText}
                  onSave={handleGoalSave}
                  onCancel={() => {
                    setEditingGoal(null);
                    setEditText('');
                  }}
                  onCreateContainer={handleCreateContainer}
                  onAddWorkingGoal={handleAddWorkingGoal}
                  onSubmitRequest={handleSubmitRequest}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Past Weeks */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Past Weeks</h2>
          <button
            onClick={() => {
              setShowPast(!showPast);
              if (!showPast) {
                loadPastWeeks();
              }
            }}
            className="px-4 py-2 text-sm bg-white/20 text-white rounded-lg hover:bg-white/30 transition"
          >
            {showPast ? 'Hide Past' : 'Load Past Weeks'}
          </button>
        </div>

        {showPast && (
          <div className="space-y-4">
            {pastWeeks.length === 0 ? (
              <p className="text-white/70 text-center py-4">Loading past weeks...</p>
            ) : (
              pastWeeks.map(week => (
                <WeekCard
                  key={week.weekStartDate}
                  week={week}
                  isCurrent={false}
                  isPast={true}
                  isFuture={false}
                  formatWeekDate={formatWeekDate}
                  getDisciplineDisplay={getDisciplineDisplay}
                  onGoalEdit={handleGoalEdit}
                  onGoalDelete={handleGoalDelete}
                  editingGoal={editingGoal}
                  editText={editText}
                  setEditText={setEditText}
                  onSave={handleGoalSave}
                  onCancel={() => {
                    setEditingGoal(null);
                    setEditText('');
                  }}
                  onCreateContainer={handleCreateContainer}
                  onAddWorkingGoal={handleAddWorkingGoal}
                  onSubmitRequest={handleSubmitRequest}
                />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface WeekCardProps {
  week: WeekData;
  isCurrent: boolean;
  isPast?: boolean;
  isFuture?: boolean;
  formatWeekDate: (d: string) => string;
  getDisciplineDisplay: (d: "Spins" | "Jumps" | "Edges") => string;
  onGoalEdit: (goal: Goal) => void;
  onGoalDelete: (goalId: string, isPrimary?: boolean) => void;
  editingGoal: Goal | null;
  editText: string;
  setEditText: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onCreateContainer: (discipline: "Spins" | "Jumps" | "Edges", primaryContent: string, weekStartDate?: string, track?: "on-ice" | "off-ice") => void;
  onAddWorkingGoal: (containerId: string, content: string) => void;
  onSubmitRequest: (discipline: "Spins" | "Jumps" | "Edges", track?: "on-ice" | "off-ice") => void;
}

function WeekCard({
  week,
  isCurrent,
  isPast = false,
  isFuture = false,
  formatWeekDate,
  getDisciplineDisplay,
  onGoalEdit,
  onGoalDelete,
  editingGoal,
  editText,
  setEditText,
  onSave,
  onCancel,
  onCreateContainer,
  onAddWorkingGoal,
  onSubmitRequest,
}: WeekCardProps) {
  const [addingContainer, setAddingContainer] = useState(false);
  const [newPrimaryText, setNewPrimaryText] = useState('');
  const [addingWorkingToContainer, setAddingWorkingToContainer] = useState<string | null>(null);
  const [newWorkingText, setNewWorkingText] = useState('');
  const [canCreate, setCanCreate] = useState(true);
  const [activeTrack, setActiveTrack] = useState<GoalTrack>('on-ice');
  const readOnly = isPast;

  // Filter containers by active track
  const filteredContainers = useMemo(() => {
    return week.containers.filter(
      container => (container.track || 'on-ice') === activeTrack
    );
  }, [week.containers, activeTrack]);

  // Check if we can create a new container
  useEffect(() => {
    canCreateContainer(week.discipline, activeTrack).then(setCanCreate);
  }, [week.discipline, filteredContainers.length, activeTrack]);

  async function handleCreateContainer() {
    if (!newPrimaryText.trim()) {
      setAddingContainer(false);
      setNewPrimaryText('');
      return;
    }
    await onCreateContainer(week.discipline, newPrimaryText, week.weekStartDate, activeTrack);
    setAddingContainer(false);
    setNewPrimaryText('');
  }


  return (
    <LiquidGlassCard>
      {/* Navbar with week info and tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getDisciplineBadgeClasses(week.discipline)}`}>
            {getDisciplineDisplay(week.discipline)} Week
          </span>
          <span className="text-sm text-white/70">
            {formatWeekDate(week.weekStartDate)}
          </span>
          {isCurrent && (
            <span className="text-xs px-2 py-1 bg-blue-500/30 text-blue-200 rounded">Current</span>
          )}
          {isPast && (
            <span className="text-xs px-2 py-1 bg-gray-500/30 text-gray-200 rounded">Past (view only)</span>
          )}
          {isFuture && !isCurrent && (
            <span className="text-xs px-2 py-1 bg-white/20 text-white rounded">Future</span>
          )}
        </div>
        <TrackTabs activeTrack={activeTrack} onTrackChange={setActiveTrack} />
      </div>

      {/* Goal Containers */}
      <div className="space-y-4">
        {filteredContainers.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-white/70">No {activeTrack === 'on-ice' ? 'on ice' : 'off ice'} goals set for this week yet.</p>
          </div>
        ) : (
          filteredContainers.map(container => (
          <GoalContainerCard
            key={container.id}
            container={container}
            weekStartDate={week.weekStartDate}
            isFutureWeek={isFuture}
              editingGoal={editingGoal}
              editText={editText}
              setEditText={setEditText}
            onGoalEdit={onGoalEdit}
            onGoalDelete={onGoalDelete}
              onSave={onSave}
              onCancel={onCancel}
            onAddWorkingGoal={onAddWorkingGoal}
            addingWorkingToContainer={addingWorkingToContainer}
            setAddingWorkingToContainer={setAddingWorkingToContainer}
            newWorkingText={newWorkingText}
            setNewWorkingText={setNewWorkingText}
            readOnly={readOnly}
            />
          ))
        )}

        {/* Add Container Button */}
        {!readOnly && (addingContainer ? (
          <div className="border border-white/20 rounded-lg p-3 bg-white/5">
            <h5 className="text-sm font-semibold text-white/90 mb-2">Goal</h5>
              <input
                type="text"
                value={newPrimaryText}
                onChange={(e) => setNewPrimaryText(e.target.value)}
              className="w-full px-2 py-1 border border-white/30 rounded text-sm bg-white/10 text-white placeholder-white/50"
                autoFocus
              placeholder="Enter goal"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                  handleCreateContainer();
                  } else if (e.key === 'Escape') {
                  setAddingContainer(false);
                    setNewPrimaryText('');
                  }
                }}
              onBlur={handleCreateContainer}
            />
          </div>
        ) : canCreate && filteredContainers.length < 3 ? (
          <button
            onClick={() => setAddingContainer(true)}
            className="w-full py-2 px-4 border border-dashed border-white/30 rounded-lg text-white/70 hover:text-white hover:border-white/50 hover:bg-white/10 transition flex items-center justify-center gap-2"
          >
            <FaPlus size={14} />
            <span>Add Goal Container</span>
          </button>
        ) : filteredContainers.length >= 3 ? (
          <p className="text-sm text-white/50 text-center italic">Maximum 3 goal containers per discipline per track</p>
        ) : null)}

      </div>

      {/* Single Submit Button for the entire week */}
      {!readOnly && !isFuture && isCurrent && week.containers.length > 0 && (
        <div className="mt-6 border-t border-white/10 pt-4 flex items-center justify-end">
          <button
            onClick={() => onSubmitRequest(week.discipline, activeTrack)}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition"
          >
            Submit
          </button>
        </div>
      )}
    </LiquidGlassCard>
  );
}

interface GoalContainerCardProps {
  container: GoalContainer;
  weekStartDate: string;
  isFutureWeek: boolean;
  editingGoal: Goal | null;
  editText: string;
  setEditText: (text: string) => void;
  onGoalEdit: (goal: Goal) => void;
  onGoalDelete: (goalId: string, isPrimary?: boolean) => void;
  onSave: () => void;
  onCancel: () => void;
  onAddWorkingGoal: (containerId: string, content: string) => void;
  addingWorkingToContainer: string | null;
  setAddingWorkingToContainer: (id: string | null) => void;
  newWorkingText: string;
  setNewWorkingText: (text: string) => void;
  readOnly?: boolean;
}

function GoalContainerCard({
  container,
  weekStartDate,
  isFutureWeek,
  editingGoal,
  editText,
  setEditText,
  onGoalEdit,
  onGoalDelete,
  onSave,
  onCancel,
  onAddWorkingGoal,
  addingWorkingToContainer,
  setAddingWorkingToContainer,
  newWorkingText,
  setNewWorkingText,
  readOnly = false,
}: GoalContainerCardProps) {
  const [primaryGoal, setPrimaryGoal] = useState<Goal | null>(null);
  const [workingGoals, setWorkingGoals] = useState<Goal[]>([]);
  const [canAddWorking, setCanAddWorking] = useState(true);
  const [feedbackEntries, setFeedbackEntries] = useState<GoalFeedback[]>([]);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  useEffect(() => {
    async function loadGoals() {
      // Load primary goal
      const primary = await progressTrackerDB.goals.get(container.primaryGoalId);
      if (primary && !primary.archivedAt) {
        setPrimaryGoal(primary);
      }
      // Load working goals - only get goals that are actually working goals (containerId !== id)
      const allWorking = await Promise.all(
        container.workingGoalIds.map(id => progressTrackerDB.goals.get(id).then(g => g!))
      );
      const validWorking = allWorking.filter(g =>
        g &&
        !g.archivedAt &&
        g.containerId &&
        g.containerId !== g.id && // Working goal: containerId !== id
        g.type === 'working' // Double check it's a working goal
      );
      setWorkingGoals(validWorking);
      // Check if we can add working goal
      canAddWorkingGoal(container.id).then(setCanAddWorking);
    }
    loadGoals();
  }, [container]);

  const fetchFeedbackEntries = useCallback(async () => {
    if (isFutureWeek || !readOnly) {
      return [] as GoalFeedback[];
    }
    return await getGoalFeedbackForContainer(container.id, weekStartDate);
  }, [container.id, weekStartDate, isFutureWeek, readOnly]);

  useEffect(() => {
    let isMounted = true;
    async function loadFeedback() {
      try {
        const entries = await fetchFeedbackEntries();
        if (isMounted) {
          setFeedbackEntries(entries);
        }
      } catch (error) {
        logger.error('[GoalContainerCard] Failed to load goal feedback:', error);
        if (isMounted) {
          setFeedbackEntries([]);
        }
      }
    }

    loadFeedback();
    return () => {
      isMounted = false;
    };
  }, [fetchFeedbackEntries]);

  const feedbackByGoalId = useMemo(() => {
    const map: Record<string, GoalFeedback> = {};
    feedbackEntries.forEach(entry => {
      map[entry.goalId] = entry;
    });
    return map;
  }, [feedbackEntries]);

  async function handleAddWorkingGoal() {
    if (!newWorkingText.trim()) {
      setAddingWorkingToContainer(null);
      setNewWorkingText('');
      return;
    }
    await onAddWorkingGoal(container.id, newWorkingText);
    setAddingWorkingToContainer(null);
    setNewWorkingText('');
  }

  const showFeedbackInline = readOnly && !isFutureWeek;
  const canShowAddWorkingControl = !readOnly && canAddWorking && workingGoals.length < 2;
  const renderFeedbackSummary = useCallback((entry?: GoalFeedback) => (
    <p className="mt-2 text-sm text-white/70 italic pl-4 border-l border-white/10">
      {entry?.feedback ?? 'No feedback recorded.'}
    </p>
  ), []);

  const containerGoals = useMemo(() => {
    if (!primaryGoal) return [];
    return [primaryGoal, ...workingGoals];
  }, [primaryGoal, workingGoals]);

  const handleFeedbackModalSaved = useCallback(async () => {
    const refreshed = await fetchFeedbackEntries();
    setFeedbackEntries(refreshed);
    setShowFeedbackModal(false);
  }, [fetchFeedbackEntries]);

  const workingIndentClass = 'pl-6';
  const addWorkingControl = canShowAddWorkingControl ? (
    addingWorkingToContainer === container.id ? (
      <div className={`${workingIndentClass} mt-1.5`}>
        <input
          type="text"
          value={newWorkingText}
          onChange={(e) => setNewWorkingText(e.target.value)}
          className="w-full px-2 py-1 border border-white/30 rounded text-sm bg-white/10 text-white placeholder-white/50"
          autoFocus
          placeholder="Enter working goal"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleAddWorkingGoal();
            } else if (e.key === 'Escape') {
              setAddingWorkingToContainer(null);
              setNewWorkingText('');
            }
          }}
          onBlur={handleAddWorkingGoal}
        />
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setAddingWorkingToContainer(container.id)}
        className={`${workingIndentClass} mt-1.5 w-full text-sm text-white/50 italic text-left hover:text-white/80 hover:bg-white/10 px-2 py-2 rounded transition`}
      >
        + Add working goal
      </button>
    )
  ) : null;

  if (!primaryGoal) return null;

  const primaryFeedback = feedbackByGoalId[primaryGoal.id];

  return (
    <div className="border-2 border-white/40 rounded-lg p-3 bg-white/5 group">
      {/* Goal (as header) */}
      <div className="mb-2">
        {!readOnly && editingGoal?.id === primaryGoal.id && editingGoal?.type === 'primary' ? (
          <>
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full px-2 py-1 border border-white/30 rounded text-sm bg-white/10 text-white mb-2"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onSave();
                } else if (e.key === 'Escape') {
                  onCancel();
                }
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={onSave}
                className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={onCancel}
                className="px-2 py-1 text-sm bg-white/20 text-white rounded hover:bg-white/30"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1">
              <h5
                className="text-base font-semibold text-white cursor-pointer hover:text-white/80"
                onClick={() => {
                  if (!readOnly) onGoalEdit(primaryGoal);
                }}
              >
                {primaryGoal.content}
              </h5>
              {showFeedbackInline && renderFeedbackSummary(primaryFeedback)}
            </div>
            <div className="flex items-center gap-2">
              {showFeedbackInline && primaryFeedback?.rating && (
                <span className="text-sm text-yellow-300 font-semibold whitespace-nowrap">
                  ★ {primaryFeedback.rating}/5
                </span>
              )}
              {!readOnly && (
                <div className="flex gap-1">
                  <button
                    onClick={() => onGoalEdit(primaryGoal)}
                    className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-blue-200 hover:bg-blue-600/30 rounded transition"
                    aria-label="Edit goal"
                  >
                    <FaEdit size={14} />
                  </button>
                  <button
                    onClick={() => onGoalDelete(primaryGoal.id, true)}
                    className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-red-300 hover:bg-red-500/30 rounded transition"
                    aria-label="Delete goal"
                  >
                    <FaTrash size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="w-full">
        {workingGoals.length > 0 && (
          <ol className="mt-1 space-y-1.5 pl-6 list-decimal marker:text-white/60 text-sm text-white/90">
            {workingGoals.map(goal => {
              const feedbackEntry = feedbackByGoalId[goal.id];
              return (
                <li key={goal.id} className="space-y-1">
                  <GoalItem
                    goal={goal}
                    editingGoal={editingGoal}
                    editText={editText}
                    setEditText={setEditText}
                    onEdit={() => {
                      if (!readOnly) onGoalEdit(goal);
                    }}
                    onDelete={() => {
                      if (!readOnly) {
                        if (goal.containerId && goal.containerId !== goal.id) {
                          onGoalDelete(goal.id, false);
                        } else {
                          logger.error('Attempted to delete primary goal as working goal', goal);
                          alert('Error: Cannot delete primary goal from this action. Use the delete button on the goal header.');
                        }
                      }
                    }}
                    onSave={onSave}
                    onCancel={onCancel}
                    readOnly={readOnly}
                    rightContent={
                      showFeedbackInline && feedbackEntry?.rating ? (
                        <span className="text-xs text-yellow-300 font-semibold whitespace-nowrap">
                          ★ {feedbackEntry.rating}/5
                        </span>
                      ) : undefined
                    }
                  />
                  {showFeedbackInline && renderFeedbackSummary(feedbackEntry)}
                </li>
              );
            })}
          </ol>
        )}
        {addWorkingControl}
      </div>

      {showFeedbackInline && (
        <div className="mt-4 border-t border-white/10 pt-3 flex items-center justify-end">
          <button
            type="button"
            onClick={() => setShowFeedbackModal(true)}
            className="px-3 py-1 text-sm rounded bg-white/20 text-white hover:bg-white/30"
          >
            Edit Feedback
          </button>
        </div>
      )}

      {showFeedbackInline && showFeedbackModal && primaryGoal && (
        <GoalFeedbackModal
          containerId={container.id}
          weekStartDate={weekStartDate}
          goals={containerGoals}
          feedbackMap={feedbackByGoalId}
          onClose={() => setShowFeedbackModal(false)}
          onSaved={handleFeedbackModalSaved}
        />
      )}
    </div>
  );
}

interface GoalItemProps {
  goal: Goal;
  editingGoal: Goal | null;
  editText: string;
  setEditText: (text: string) => void;
  onEdit: () => void;
  onDelete: () => void;
  onSave: () => void;
  onCancel: () => void;
  showDiscipline?: boolean;
  readOnly?: boolean;
  rightContent?: ReactNode;
}

function GoalItem({
  goal,
  editingGoal,
  editText,
  setEditText,
  onEdit,
  onDelete,
  onSave,
  onCancel,
  showDiscipline = false,
  readOnly = false,
  rightContent,
}: GoalItemProps) {
  const isEditing = editingGoal?.id === goal.id;

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 bg-white/10 p-2 rounded">
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="flex-1 h-10 px-3 border border-white/30 rounded text-sm bg-white/10 text-white"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSave();
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
        />
        <button
          onClick={onSave}
          className="h-10 px-4 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="h-10 px-4 text-sm bg-white/20 text-white rounded hover:bg-white/30"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <span
        className={`text-sm text-white flex-1 ${readOnly ? '' : 'cursor-pointer'}`}
        onClick={() => {
          if (!readOnly) onEdit();
        }}
      >
        {showDiscipline && (
          <span className="text-xs text-white/60 mr-2">[{goal.discipline}]</span>
        )}
        {goal.content}
      </span>
      {rightContent}
      {!readOnly && (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button
            onClick={onEdit}
            className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-blue-200 hover:bg-blue-600/30 rounded transition"
            aria-label="Edit goal"
          >
            <FaEdit size={14} />
          </button>
          <button
            onClick={onDelete}
            className="w-7 h-7 flex items-center justify-center text-white/70 hover:text-red-300 hover:bg-red-500/30 rounded transition"
            aria-label="Delete goal"
          >
            <FaTrash size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

interface GoalFeedbackModalProps {
  containerId: string;
  weekStartDate?: string;
  goals: Goal[];
  feedbackMap: Record<string, GoalFeedback | undefined>;
  onClose: () => void;
  onSaved: () => void;
}

function GoalFeedbackModal({
  containerId,
  weekStartDate,
  goals,
  feedbackMap,
  onClose,
  onSaved,
}: GoalFeedbackModalProps) {
  const [entries, setEntries] = useState<Record<string, { rating?: number; feedback: string }>>(() => {
    const initial: Record<string, { rating?: number; feedback: string }> = {};
    goals.forEach(goal => {
      const existing = feedbackMap[goal.id];
      initial[goal.id] = {
        rating: existing?.rating,
        feedback: existing?.feedback ?? '',
      };
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const updated: Record<string, { rating?: number; feedback: string }> = {};
    goals.forEach(goal => {
      const existing = feedbackMap[goal.id];
      updated[goal.id] = {
        rating: existing?.rating,
        feedback: existing?.feedback ?? '',
      };
    });
    setEntries(updated);
  }, [goals, feedbackMap]);

  function updateEntry(goalId: string, updates: Partial<{ rating?: number; feedback: string }>) {
    setEntries(prev => ({
      ...prev,
      [goalId]: {
        rating: updates.rating !== undefined ? updates.rating : prev[goalId]?.rating,
        feedback: updates.feedback !== undefined ? updates.feedback : prev[goalId]?.feedback ?? '',
      },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await Promise.all(
        goals.map(async goal => {
          const state = entries[goal.id] ?? {};
          const effectiveWeek = weekStartDate || goal.weekStartDate;
          await upsertGoalFeedbackEntry({
            goalId: goal.id,
            containerId,
            discipline: goal.discipline,
            weekStartDate: effectiveWeek,
            rating: state.rating,
            feedback: state.feedback?.trim() || undefined,
            completed: true,
          });
        })
      );
      await onSaved();
    } catch (error: any) {
      logger.error('[GoalFeedbackModal] Failed to save feedback:', error);
      alert(error?.message || 'Failed to save feedback. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Edit Feedback</h2>
            <p className="text-sm text-gray-500">
              Update the star rating and notes for each goal in this container.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {goals.map(goal => {
            const entry = entries[goal.id] ?? { rating: undefined, feedback: '' };
            return (
              <div key={goal.id} className="border border-gray-200 rounded-md p-4 space-y-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {goal.type === 'primary' ? 'Primary Goal' : 'Working Goal'}
                  </p>
                  <p className="text-sm text-gray-600">{goal.content}</p>
                </div>
                <StarRatingInput
                  value={entry.rating}
                  onChange={value => updateEntry(goal.id, { rating: value })}
                />
                <textarea
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900"
                  rows={3}
                  placeholder="Add feedback..."
                  value={entry.feedback}
                  onChange={(e) => updateEntry(goal.id, { feedback: e.target.value })}
                />
              </div>
            );
          })}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface StarRatingInputProps {
  value?: number;
  onChange: (value?: number) => void;
}

function StarRatingInput({ value, onChange }: StarRatingInputProps) {
  const stars = [1, 2, 3, 4, 5];
  const [hovered, setHovered] = useState<number | undefined>(undefined);
  const displayed = hovered ?? value;

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1">
        {stars.map(star => (
          <button
            key={star}
            type="button"
            className={`text-xl ${displayed && star <= displayed ? 'text-yellow-400' : 'text-gray-300'} hover:text-yellow-300`}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(undefined)}
            onFocus={() => setHovered(star)}
            onBlur={() => setHovered(undefined)}
            onClick={() => onChange(star)}
          >
            ★
          </button>
        ))}
      </div>
      <button
        type="button"
        className="text-xs text-gray-500 underline hover:text-gray-700"
        onClick={() => onChange(undefined)}
      >
        Clear
      </button>
    </div>
  );
}

