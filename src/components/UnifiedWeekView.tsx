import { useState, useEffect, useCallback } from 'react';
import { Goal } from '../db/progress-tracker/types';
import { getAppData, getWeekStartDate, updateGoal, createGoal } from '../db/progress-tracker/operations';
import { progressTrackerDB } from '../db/progress-tracker/db';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { DISCIPLINES, getDisciplineBadgeClasses, getDisciplineDisplay } from '../utils/disciplines';
import LiquidGlassCard from './LiquidGlassCard';

interface UnifiedWeekViewProps {
  onGoalUpdate: () => void;
}

interface WeekData {
  weekStartDate: string;
  discipline: "Spins" | "Jumps" | "Edges";
  primaryGoals: Goal[];
  workingGoals: Goal[];
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

      // Load goals for current week (with and without weekStartDate)
      const goalsWithWeek = await progressTrackerDB.goals
        .where('weekStartDate')
        .equals(currentWeekStart)
        .toArray();

      const goalsWithoutWeek = await progressTrackerDB.goals
        .filter(g => !g.weekStartDate && !g.archivedAt)
        .toArray();

      const allGoals = [...goalsWithWeek, ...goalsWithoutWeek];
      const primaryGoals = allGoals.filter(g => g.type === 'primary' && !g.archivedAt);
      const workingGoals = allGoals.filter(g => g.type === 'working' && !g.archivedAt);

      setCurrentWeek({
        weekStartDate: currentWeekStart,
        discipline,
        primaryGoals,
        workingGoals,
      });
    } catch (error) {
      console.error('Failed to load current week:', error);
    } finally {
      setLoading(false);
    }
  }, [disciplines]);

  useEffect(() => {
    loadCurrentWeek();
  }, [loadCurrentWeek]);

  async function loadFutureWeeks() {
    if (!appData || futureWeeks.length > 0) return;

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

        const allGoals = await progressTrackerDB.goals
          .where('weekStartDate')
          .equals(weekStartStr)
          .toArray();

        const primaryGoals = allGoals.filter(g => g.type === 'primary' && !g.archivedAt);
        const workingGoals = allGoals.filter(g => g.type === 'working' && !g.archivedAt);

        future.push({
          weekStartDate: weekStartStr,
          discipline,
          primaryGoals,
          workingGoals,
        });
      }

      setFutureWeeks(future);
    } catch (error) {
      console.error('Failed to load future weeks:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadPastWeeks() {
    if (!appData || pastWeeks.length > 0) return;

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

        const allGoals = await progressTrackerDB.goals
          .where('weekStartDate')
          .equals(weekStartStr)
          .toArray();

        const primaryGoals = allGoals.filter(g => g.type === 'primary');
        const workingGoals = allGoals.filter(g => g.type === 'working');

        past.push({
          weekStartDate: weekStartStr,
          discipline,
          primaryGoals,
          workingGoals,
        });
      }

      setPastWeeks(past.reverse());
    } catch (error) {
      console.error('Failed to load past weeks:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoalEdit(goal: Goal) {
    setEditingGoal(goal);
    setEditText(goal.content);
  }

  async function handleGoalSave() {
    if (!editingGoal || !editText.trim()) return;

    await updateGoal(editingGoal.id, { content: editText.trim() });
    setEditingGoal(null);
    setEditText('');
    await loadCurrentWeek();
    onGoalUpdate();
  }

  async function handleGoalArchive(goalId: string) {
    if (confirm('Are you sure you want to archive this goal?')) {
      await progressTrackerDB.goals.update(goalId, { archivedAt: Date.now() });
      await loadCurrentWeek();
      onGoalUpdate();
    }
  }

  async function handleAddGoal(type: 'primary' | 'working', weekStartDate?: string, content?: string) {
    if (!content || !content.trim()) return;

    // Use the week's discipline if weekStartDate is provided, otherwise use currentWeek
    let discipline: "Spins" | "Jumps" | "Edges" = currentWeek?.discipline || "Spins";

    if (weekStartDate && appData) {
      // Calculate discipline for the specified week
      const daysFromStart = Math.floor((new Date(weekStartDate).getTime() - new Date(appData.startDate).getTime()) / (1000 * 60 * 60 * 24));
      const weekNumber = Math.floor(daysFromStart / 7);
      const cyclePosition = weekNumber % appData.cycleLength;
      discipline = disciplines[cyclePosition];
    }

    await createGoal({
      discipline,
      type,
      content: content.trim(),
      weekStartDate,
    });

    await loadCurrentWeek();
    if (showFuture) {
      await loadFutureWeeks();
    }
    if (showPast) {
      await loadPastWeeks();
    }
    onGoalUpdate();
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
        onGoalArchive={handleGoalArchive}
        editingGoal={editingGoal}
        editText={editText}
        setEditText={setEditText}
        onSave={handleGoalSave}
        onCancel={() => {
          setEditingGoal(null);
          setEditText('');
        }}
        onAddGoal={handleAddGoal}
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
                  onGoalArchive={handleGoalArchive}
                  editingGoal={editingGoal}
                  editText={editText}
                  setEditText={setEditText}
                  onSave={handleGoalSave}
                  onCancel={() => {
                    setEditingGoal(null);
                    setEditText('');
                  }}
                  onAddGoal={handleAddGoal}
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
                  onGoalArchive={handleGoalArchive}
                  editingGoal={editingGoal}
                  editText={editText}
                  setEditText={setEditText}
                  onSave={handleGoalSave}
                  onCancel={() => {
                    setEditingGoal(null);
                    setEditText('');
                  }}
                  onAddGoal={handleAddGoal}
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
  onGoalArchive: (goalId: string) => void;
  editingGoal: Goal | null;
  editText: string;
  setEditText: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onAddGoal: (type: 'primary' | 'working', weekStartDate?: string, content?: string) => void;
}

function WeekCard({
  week,
  isCurrent,
  formatWeekDate,
  getDisciplineDisplay,
  onGoalEdit,
  onGoalArchive,
  editingGoal,
  editText,
  setEditText,
  onSave,
  onCancel,
  onAddGoal,
}: WeekCardProps) {
  const [addingPrimary, setAddingPrimary] = useState(false);
  const [addingWorking, setAddingWorking] = useState(false);
  const [newPrimaryText, setNewPrimaryText] = useState('');
  const [newWorkingText, setNewWorkingText] = useState('');

  async function handleCreatePrimary() {
    if (!newPrimaryText.trim()) {
      setAddingPrimary(false);
      setNewPrimaryText('');
      return;
    }
    await onAddGoal('primary', week.weekStartDate, newPrimaryText);
    setAddingPrimary(false);
    setNewPrimaryText('');
  }

  async function handleCreateWorking() {
    if (!newWorkingText.trim()) {
      setAddingWorking(false);
      setNewWorkingText('');
      return;
    }
    await onAddGoal('working', week.weekStartDate, newWorkingText);
    setAddingWorking(false);
    setNewWorkingText('');
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

      {/* Primary Goals Section - Always shown */}
      <div className="mb-4">
        <h4 className="font-medium text-white mb-2">Primary Goals</h4>
        <ul className="space-y-2">
          {week.primaryGoals.map(goal => (
            <GoalItem
              key={goal.id}
              goal={goal}
              editingGoal={editingGoal}
              editText={editText}
              setEditText={setEditText}
              onEdit={() => onGoalEdit(goal)}
              onArchive={() => onGoalArchive(goal.id)}
              onSave={onSave}
              onCancel={onCancel}
            />
          ))}
          {addingPrimary ? (
            <li className="flex items-start gap-2 bg-white/10 p-2 rounded">
              <input
                type="text"
                value={newPrimaryText}
                onChange={(e) => setNewPrimaryText(e.target.value)}
                className="flex-1 px-2 py-1 border border-white/30 rounded text-sm bg-white/10 text-white placeholder-white/50"
                autoFocus
                placeholder="Enter primary goal"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreatePrimary();
                  } else if (e.key === 'Escape') {
                    setAddingPrimary(false);
                    setNewPrimaryText('');
                  }
                }}
                onBlur={handleCreatePrimary}
              />
            </li>
          ) : (
            <EmptyGoalItem
              text="No goals set"
              onClick={() => setAddingPrimary(true)}
            />
          )}
        </ul>
      </div>

      {/* Working Goals Section - Always shown */}
      <div>
        <h4 className="font-medium text-white mb-2">Working Goals</h4>
        <ul className="space-y-2">
          {week.workingGoals.map(goal => (
            <GoalItem
              key={goal.id}
              goal={goal}
              editingGoal={editingGoal}
              editText={editText}
              setEditText={setEditText}
              onEdit={() => onGoalEdit(goal)}
              onArchive={() => onGoalArchive(goal.id)}
              onSave={onSave}
              onCancel={onCancel}
              showDiscipline={true}
            />
          ))}
          {addingWorking ? (
            <li className="flex items-start gap-2 bg-white/10 p-2 rounded">
              <input
                type="text"
                value={newWorkingText}
                onChange={(e) => setNewWorkingText(e.target.value)}
                className="flex-1 px-2 py-1 border border-white/30 rounded text-sm bg-white/10 text-white placeholder-white/50"
                autoFocus
                placeholder="Enter working goal"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateWorking();
                  } else if (e.key === 'Escape') {
                    setAddingWorking(false);
                    setNewWorkingText('');
                  }
                }}
                onBlur={handleCreateWorking}
              />
            </li>
          ) : (
            <EmptyGoalItem
              text="No goals set"
              onClick={() => setAddingWorking(true)}
            />
          )}
        </ul>
      </div>
    </LiquidGlassCard>
  );
}

interface EmptyGoalItemProps {
  text: string;
  onClick: () => void;
}

function EmptyGoalItem({ text, onClick }: EmptyGoalItemProps) {
  return (
    <li
      onClick={onClick}
      className="text-sm text-white/50 italic cursor-pointer hover:text-white/80 hover:bg-white/10 p-2 rounded transition group"
    >
      <span>{text}</span>
    </li>
  );
}

interface GoalItemProps {
  goal: Goal;
  editingGoal: Goal | null;
  editText: string;
  setEditText: (text: string) => void;
  onEdit: () => void;
  onArchive: () => void;
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
  onArchive,
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
          onClick={onArchive}
          className="p-1 text-white/70 hover:text-red-300 hover:bg-red-500/20 rounded"
          aria-label="Archive goal"
        >
          <FaTrash size={14} />
        </button>
      </div>
    </li>
  );
}

