import { useState, useEffect } from 'react';
import { AppData, Goal, GoalContainer } from '../db/progress-tracker/types';
import {
  getAppData,
  getActiveGoals,
  getCurrentFocus,
  getWeekInCycle,
  getDaysUntilNextCycle,
  getGoalContainersByDiscipline,
  getWeekStartDate,
} from '../db/progress-tracker/operations';
import { logger } from '../utils/logger';

export function useProgressTracker() {
  const [appData, setAppData] = useState<AppData | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  // Load data on mount and when appData changes
  useEffect(() => {
    async function load() {
      try {
        const data = await getAppData();
        setAppData(data);
        const allGoals = await getActiveGoals();
        setGoals(allGoals);
      } catch (error) {
        logger.error('Failed to load progress tracker data:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const refreshGoals = async () => {
    const allGoals = await getActiveGoals();
    setGoals(allGoals);
    // Also refresh containers
    if (appData) {
      const currentWeekStart = getWeekStartDate(appData.startDate);
      const containers = {
        Spins: await getGoalContainersByDiscipline('Spins', currentWeekStart),
        Jumps: await getGoalContainersByDiscipline('Jumps', currentWeekStart),
        Edges: await getGoalContainersByDiscipline('Edges', currentWeekStart),
      };
      setContainersByDiscipline(containers);
    }
  };

  const refreshAppData = async () => {
    const data = await getAppData();
    setAppData(data);
  };

  const currentFocus = appData ? getCurrentFocus(appData.startDate, appData.cycleLength) : null;
  const weekInCycle = appData ? getWeekInCycle(appData.startDate, appData.cycleLength) : null;
  const daysUntilNext = appData ? getDaysUntilNextCycle(appData.startDate) : null;

  const primaryGoals = goals.filter(
    g => g.discipline === currentFocus && g.type === 'primary'
  );

  const workingGoals = goals.filter(
    g => g.type === 'working'
  );

  // Load goal containers by discipline
  const [containersByDiscipline, setContainersByDiscipline] = useState<{
    Spins: GoalContainer[];
    Jumps: GoalContainer[];
    Edges: GoalContainer[];
  }>({
    Spins: [],
    Jumps: [],
    Edges: [],
  });

  useEffect(() => {
    async function loadContainers() {
      if (!appData) return;

      // Load containers for current week AND future weeks (no weekStartDate filter for future)
      // Get all active containers regardless of week
      const containers = {
        Spins: await getGoalContainersByDiscipline('Spins'), // No weekStartDate = all active containers
        Jumps: await getGoalContainersByDiscipline('Jumps'),
        Edges: await getGoalContainersByDiscipline('Edges'),
      };
      setContainersByDiscipline(containers);
    }
    loadContainers();
  }, [appData]);

  // Also refresh containers when goals change
  useEffect(() => {
    async function refreshContainers() {
      if (!appData) return;

      // Load all active containers (current + future weeks)
      const containers = {
        Spins: await getGoalContainersByDiscipline('Spins'),
        Jumps: await getGoalContainersByDiscipline('Jumps'),
        Edges: await getGoalContainersByDiscipline('Edges'),
      };
      setContainersByDiscipline(containers);
    }
    refreshContainers();
  }, [appData, goals]);

  return {
    appData,
    loading,
    goals,
    currentFocus,
    weekInCycle: weekInCycle !== null ? weekInCycle + 1 : null, // 1-indexed for display
    daysUntilNext,
    primaryGoals,
    workingGoals,
    containersByDiscipline,
    refreshGoals,
    refreshAppData,
  };
}

