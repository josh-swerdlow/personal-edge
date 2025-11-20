import { useState, useEffect } from 'react';
import { AppData, Goal } from '../db/progress-tracker/types';
import {
  getAppData,
  getActiveGoals,
  getCurrentFocus,
  getWeekInCycle,
  getDaysUntilNextCycle,
} from '../db/progress-tracker/operations';

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
        console.error('Failed to load progress tracker data:', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const refreshGoals = async () => {
    const allGoals = await getActiveGoals();
    setGoals(allGoals);
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
    g => g.discipline !== currentFocus && g.type === 'working'
  );

  return {
    appData,
    loading,
    goals,
    currentFocus,
    weekInCycle: weekInCycle !== null ? weekInCycle + 1 : null, // 1-indexed for display
    daysUntilNext,
    primaryGoals,
    workingGoals,
    refreshGoals,
    refreshAppData,
  };
}

