import { useState } from 'react';
import { FaCog, FaArchive } from 'react-icons/fa';
import { useProgressTracker } from '../hooks/useProgressTracker';
import { createGoal, updateGoal } from '../db/progress-tracker/operations';
import { Goal } from '../db/progress-tracker/types';
import GoalForm from '../components/GoalForm';
import ArchiveWeekModal from '../components/ArchiveWeekModal';
import ProgressTrackerSettings from '../components/ProgressTrackerSettings';
import UnifiedWeekView from '../components/UnifiedWeekView';
import PageLayout from '../components/PageLayout';
import LiquidGlassCard from '../components/LiquidGlassCard';

export default function ProgressTracker() {
  const {
    appData,
    loading,
    currentFocus,
    refreshGoals,
    refreshAppData,
  } = useProgressTracker();

  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [goalFormDefaults, setGoalFormDefaults] = useState<{
    discipline?: "Spins" | "Jumps" | "Edges";
    type?: "primary" | "working";
  }>({});
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  async function handleCreateGoal(goal: Omit<Goal, 'id' | 'createdAt'>) {
    await createGoal(goal);
    await refreshGoals();
    setShowGoalForm(false);
    setGoalFormDefaults({});
  }

  async function handleUpdateGoal(goal: Omit<Goal, 'id' | 'createdAt'>) {
    if (!editingGoal) return;
    await updateGoal(editingGoal.id, goal);
    await refreshGoals();
    setEditingGoal(null);
    setShowGoalForm(false);
  }

  async function handleArchiveWeek() {
    await refreshGoals();
    await refreshAppData();
  }


  if (loading) {
    return (
      <PageLayout>
        <p className="text-white/70">Loading...</p>
      </PageLayout>
    );
  }

  if (!appData || !currentFocus) {
    return (
      <PageLayout>
        <p className="text-white/70">Failed to load progress tracker data.</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {/* Header */}
      <LiquidGlassCard className="mb-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Progress Tracker</h1>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-white hover:text-white/80 hover:bg-white/10 rounded-lg transition"
              aria-label="Settings"
            >
              <FaCog size={20} />
            </button>
            <button
              onClick={() => setShowArchiveModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lgtransition flex items-center gap-2"
            >
              <FaArchive size={16} />
              Complete Week
            </button>
          </div>
        </div>
      </LiquidGlassCard>

      {/* Unified Week View */}
      <UnifiedWeekView onGoalUpdate={refreshGoals} />

      {/* Modals */}
        {(showGoalForm || editingGoal) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4">
                {editingGoal ? 'Edit Goal' : 'Create Goal'}
              </h2>
              <GoalForm
                goal={editingGoal || undefined}
                defaultDiscipline={goalFormDefaults.discipline}
                defaultType={goalFormDefaults.type}
                onSubmit={editingGoal ? handleUpdateGoal : handleCreateGoal}
                onCancel={() => {
                  setShowGoalForm(false);
                  setEditingGoal(null);
                  setGoalFormDefaults({});
                }}
              />
            </div>
          </div>
        )}

        {showArchiveModal && currentFocus && (
          <ArchiveWeekModal
            focusDiscipline={currentFocus}
            onClose={() => setShowArchiveModal(false)}
            onSuccess={handleArchiveWeek}
          />
        )}

        {showSettings && appData && (
          <ProgressTrackerSettings
            appData={appData}
            onClose={() => setShowSettings(false)}
          />
        )}
    </PageLayout>
  );
}

