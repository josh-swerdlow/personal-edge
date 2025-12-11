import { useState, useEffect, useCallback } from 'react';
import { Goal, GoalContainer } from '../db/progress-tracker/types';
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
  deleteGoal
} from '../db/progress-tracker/operations';
import { progressTrackerDB } from '../db/progress-tracker/db';
import { FaEdit, FaTrash, FaPlus } from 'react-icons/fa';
import { DISCIPLINES, getDisciplineBadgeClasses, getDisciplineDisplay } from '../utils/disciplines';
import LiquidGlassCard from './LiquidGlassCard';
import { logger } from '../utils/logger';

interface UnifiedWeekViewProps {
  onGoalUpdate: () => void;
}

interface WeekData {
  weekStartDate: string;
  discipline: "Spins" | "Jumps" | "Edges";
  containers: GoalContainer[];
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

  const disciplines = DISCIPLINES;

  const loadCurrentWeek = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAppData();
      setAppData(data);

      const currentWeekStart = getWeekStartDate(data.startDate);
      const currentWeekStartDate = new Date(currentWeekStart);

      // Calculate which discipline this week is
      const daysFromStart = Math.floor((currentWeekStartDate.getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24));
      const weekNumber = Math.floor(daysFromStart / 7);
      const cyclePosition = weekNumber % data.cycleLength;
      const discipline = disciplines[cyclePosition];

      // Load goal containers for current week
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
      const currentWeekStart = getWeekStartDate(appData.startDate);
      const currentWeekStartDate = new Date(currentWeekStart);

      const future: WeekData[] = [];
      for (let i = 1; i <= 3; i++) {
        const weekStart = new Date(currentWeekStartDate);
        weekStart.setDate(weekStart.getDate() + (i * 7));
        const weekStartStr = weekStart.toISOString().split('T')[0];

        const daysFromStart = Math.floor((weekStart.getTime() - new Date(appData.startDate).getTime()) / (1000 * 60 * 60 * 24));
        const weekNumber = Math.floor(daysFromStart / 7);
        const cyclePosition = weekNumber % appData.cycleLength;
        const discipline = disciplines[cyclePosition];

        // Load goal containers for this week
        const containers = await getGoalContainersByDiscipline(discipline, weekStartStr);

        future.push({
          weekStartDate: weekStartStr,
          discipline,
          containers,
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
      const currentWeekStart = getWeekStartDate(appData.startDate);
      const currentWeekStartDate = new Date(currentWeekStart);

      const past: WeekData[] = [];
      for (let i = 1; i <= 6; i++) {
        const weekStart = new Date(currentWeekStartDate);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        const weekStartStr = weekStart.toISOString().split('T')[0];

        const daysFromStart = Math.floor((weekStart.getTime() - new Date(appData.startDate).getTime()) / (1000 * 60 * 60 * 24));
        const weekNumber = Math.floor(daysFromStart / 7);
        const cyclePosition = weekNumber % appData.cycleLength;
        const discipline = disciplines[cyclePosition];

        // Load goal containers for this week
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

  async function handleCreateContainer(discipline: "Spins" | "Jumps" | "Edges", primaryContent: string, weekStartDate?: string) {
    if (!primaryContent || !primaryContent.trim()) return;

    try {
      // Explicitly pass empty array to ensure no working goals are created
      await createGoalContainer(discipline, primaryContent.trim(), [], weekStartDate);
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
      {/* Current Week */}
      <WeekCard
        week={currentWeek}
        isCurrent={true}
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
  formatWeekDate: (d: string) => string;
  getDisciplineDisplay: (d: "Spins" | "Jumps" | "Edges") => string;
  onGoalEdit: (goal: Goal) => void;
  onGoalDelete: (goalId: string, isPrimary?: boolean) => void;
  editingGoal: Goal | null;
  editText: string;
  setEditText: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onCreateContainer: (discipline: "Spins" | "Jumps" | "Edges", primaryContent: string, weekStartDate?: string) => void;
  onAddWorkingGoal: (containerId: string, content: string) => void;
}

function WeekCard({
  week,
  isCurrent,
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
}: WeekCardProps) {
  const [addingContainer, setAddingContainer] = useState(false);
  const [newPrimaryText, setNewPrimaryText] = useState('');
  const [addingWorkingToContainer, setAddingWorkingToContainer] = useState<string | null>(null);
  const [newWorkingText, setNewWorkingText] = useState('');
  const [canCreate, setCanCreate] = useState(true);

  // Check if we can create a new container
  useEffect(() => {
    canCreateContainer(week.discipline).then(setCanCreate);
  }, [week.discipline, week.containers.length]);

  async function handleCreateContainer() {
    if (!newPrimaryText.trim()) {
      setAddingContainer(false);
      setNewPrimaryText('');
      return;
    }
    await onCreateContainer(week.discipline, newPrimaryText, week.weekStartDate);
    setAddingContainer(false);
    setNewPrimaryText('');
  }


  return (
    <LiquidGlassCard>
      <div className="flex items-center gap-3 mb-4">
        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getDisciplineBadgeClasses(week.discipline)}`}>
          {getDisciplineDisplay(week.discipline)} Week
        </span>
        <span className="text-sm text-white/70">
          {formatWeekDate(week.weekStartDate)}
        </span>
        {isCurrent && (
          <span className="text-xs px-2 py-1 bg-blue-500/30 text-blue-200 rounded">Current</span>
        )}
      </div>

      {/* Goal Containers */}
      <div className="space-y-4">
        {week.containers.map(container => (
          <GoalContainerCard
            key={container.id}
            container={container}
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
            />
          ))}

        {/* Add Container Button */}
        {addingContainer ? (
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
        ) : canCreate && week.containers.length < 3 ? (
          <button
            onClick={() => setAddingContainer(true)}
            className="w-full py-2 px-4 border border-dashed border-white/30 rounded-lg text-white/70 hover:text-white hover:border-white/50 hover:bg-white/10 transition flex items-center justify-center gap-2"
          >
            <FaPlus size={14} />
            <span>Add Goal Container</span>
          </button>
        ) : week.containers.length >= 3 ? (
          <p className="text-sm text-white/50 text-center italic">Maximum 3 goal containers per discipline</p>
        ) : null}
      </div>
    </LiquidGlassCard>
  );
}

interface GoalContainerCardProps {
  container: GoalContainer;
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
}

function GoalContainerCard({
  container,
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
}: GoalContainerCardProps) {
  const [primaryGoal, setPrimaryGoal] = useState<Goal | null>(null);
  const [workingGoals, setWorkingGoals] = useState<Goal[]>([]);
  const [canAddWorking, setCanAddWorking] = useState(true);

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

  if (!primaryGoal) return null;

  return (
    <div className="border-2 border-white/40 rounded-lg p-3 bg-white/5 group">
      {/* Goal (as header) */}
      <div className="mb-3">
        {editingGoal?.id === primaryGoal.id && editingGoal?.type === 'primary' ? (
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
          <div className="flex items-start justify-between gap-2">
            <h5
              className="text-base font-semibold text-white flex-1 cursor-pointer hover:text-white/80"
              onClick={() => onGoalEdit(primaryGoal)}
            >
              {primaryGoal.content}
            </h5>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
              <button
                onClick={() => onGoalEdit(primaryGoal)}
                className="p-1 text-white/70 hover:text-white hover:bg-white/20 rounded"
                aria-label="Edit goal"
              >
                <FaEdit size={14} />
              </button>
              <button
                onClick={() => onGoalDelete(primaryGoal.id, true)}
                className="p-1 text-white/70 hover:text-red-300 hover:bg-red-500/20 rounded"
                aria-label="Delete goal"
              >
                <FaTrash size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Working Goals (bullet points, no label) - Reserve space for up to 2 working goals */}
      <div className="min-h-[4rem]">
        {workingGoals.length > 0 && (
          <ul className="space-y-1">
            {workingGoals.map(goal => (
            <GoalItem
              key={goal.id}
              goal={goal}
              editingGoal={editingGoal}
              editText={editText}
              setEditText={setEditText}
              onEdit={() => onGoalEdit(goal)}
                onDelete={() => {
                  // Verify this is actually a working goal: working goals have containerId !== id
                  // Primary goals have containerId === id (their own id)
                  if (goal.containerId && goal.containerId !== goal.id) {
                    onGoalDelete(goal.id, false);
                  } else {
                    logger.error('Attempted to delete primary goal as working goal', goal);
                    alert('Error: Cannot delete primary goal from this action. Use the delete button on the goal header.');
                  }
                }}
              onSave={onSave}
              onCancel={onCancel}
            />
          ))}
          </ul>
        )}
      </div>

      {/* Add working goal option */}
      {addingWorkingToContainer === container.id ? (
        <div className="mt-2">
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
      ) : canAddWorking && workingGoals.length < 2 ? (
        <div
          onClick={() => setAddingWorkingToContainer(container.id)}
          className="text-sm text-white/50 italic cursor-pointer hover:text-white/80 hover:bg-white/10 p-2 rounded transition mt-2"
        >
          + Add working goal
        </div>
      ) : null}
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
}: GoalItemProps) {
  const isEditing = editingGoal?.id === goal.id;

  if (isEditing) {
    return (
      <li className="flex items-start gap-2 bg-white/10 p-2 rounded">
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          className="flex-1 px-2 py-1 border border-white/30 rounded text-sm bg-white/10 text-white"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave();
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
        />
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
      </li>
    );
  }

  return (
    <li className="flex items-start gap-2 group">
      <span className="text-sm text-white flex-1 cursor-pointer" onClick={onEdit}>
        {showDiscipline && (
          <span className="text-xs text-white/60 mr-2">[{goal.discipline}]</span>
        )}
        {goal.content}
      </span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={onEdit}
          className="p-1 text-white/70 hover:text-white hover:bg-white/20 rounded"
          aria-label="Edit goal"
        >
          <FaEdit size={14} />
        </button>
        <button
          onClick={onDelete}
          className="p-1 text-white/70 hover:text-red-300 hover:bg-red-500/20 rounded"
          aria-label="Delete goal"
        >
          <FaTrash size={14} />
        </button>
      </div>
    </li>
  );
}

