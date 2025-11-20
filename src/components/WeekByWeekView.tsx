import { useState, useEffect } from 'react';
import { Goal } from '../db/progress-tracker/types';
import { getAppData, getWeekStartDate } from '../db/progress-tracker/operations';
import { progressTrackerDB } from '../db/progress-tracker/db';
import { DISCIPLINES, getDisciplineBadgeClasses } from '../utils/disciplines';

interface WeekByWeekViewProps {
  currentFocus: "Spins" | "Jumps" | "Edges";
}

interface WeekData {
  weekStartDate: string;
  discipline: "Spins" | "Jumps" | "Edges";
  primaryGoals: Goal[];
  workingGoals: Goal[];
}

export default function WeekByWeekView({ currentFocus }: WeekByWeekViewProps) {
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [pastWeeks, setPastWeeks] = useState<WeekData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [appData, setAppData] = useState<{ startDate: string; cycleLength: number } | null>(null);

  useEffect(() => {
    async function loadWeeks() {
      setLoading(true);
      try {
        const data = await getAppData();
        setAppData(data);

        const currentWeekStart = getWeekStartDate(data.startDate);
        const currentWeekStartDate = new Date(currentWeekStart);

        // Load current and future weeks (3 weeks out)
        const futureWeeks: WeekData[] = [];
        for (let i = 0; i <= 3; i++) {
          const weekStart = new Date(currentWeekStartDate);
          weekStart.setDate(weekStart.getDate() + (i * 7));
          const weekStartStr = weekStart.toISOString().split('T')[0];

          // Calculate which discipline this week is
          const daysFromStart = Math.floor((weekStart.getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24));
          const weekNumber = Math.floor(daysFromStart / 7);
          const cyclePosition = weekNumber % data.cycleLength;
          const discipline = DISCIPLINES[cyclePosition];

          // Load goals for this week
          let allGoals = await progressTrackerDB.goals
            .where('weekStartDate')
            .equals(weekStartStr)
            .toArray();

          // For current week (i === 0), also include goals without weekStartDate
          if (i === 0) {
            const goalsWithoutWeek = await progressTrackerDB.goals
              .filter(g => !g.weekStartDate && !g.archivedAt)
              .toArray();
            allGoals = [...allGoals, ...goalsWithoutWeek];
          }

          const primaryGoals = allGoals.filter(g => g.type === 'primary' && !g.archivedAt);
          const workingGoals = allGoals.filter(g => g.type === 'working' && !g.archivedAt);

          futureWeeks.push({
            weekStartDate: weekStartStr,
            discipline,
            primaryGoals,
            workingGoals,
          });
        }

        setWeeks(futureWeeks);
      } catch (error) {
        console.error('Failed to load weeks:', error);
      } finally {
        setLoading(false);
      }
    }
    loadWeeks();
  }, [currentFocus]);

  async function loadPastWeeks() {
    if (!appData || pastWeeks.length > 0) return;

    setLoading(true);
    try {
      const currentWeekStart = getWeekStartDate(appData.startDate);
      const currentWeekStartDate = new Date(currentWeekStart);

      // Load past weeks (go back 6 weeks)
      const past: WeekData[] = [];
      for (let i = 1; i <= 6; i++) {
        const weekStart = new Date(currentWeekStartDate);
        weekStart.setDate(weekStart.getDate() - (i * 7));
        const weekStartStr = weekStart.toISOString().split('T')[0];

        // Calculate which discipline this week was
        const daysFromStart = Math.floor((weekStart.getTime() - new Date(appData.startDate).getTime()) / (1000 * 60 * 60 * 24));
        const weekNumber = Math.floor(daysFromStart / 7);
        const cyclePosition = weekNumber % appData.cycleLength;
        const discipline = DISCIPLINES[cyclePosition];

        // Load goals for this week (including archived)
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

      setPastWeeks(past.reverse()); // Show oldest first
    } catch (error) {
      console.error('Failed to load past weeks:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatWeekDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  if (loading && weeks.length === 0) {
    return <div className="text-center py-8 text-gray-500">Loading weeks...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Past Weeks Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">📅 Past Weeks</h2>
          <button
            onClick={() => {
              setShowPast(!showPast);
              if (!showPast) {
                loadPastWeeks();
              }
            }}
            className="px-4 py-2 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            {showPast ? 'Hide Past' : 'Load Past Weeks'}
          </button>
        </div>

        {showPast && (
          <div className="space-y-4">
            {pastWeeks.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Loading past weeks...</p>
            ) : (
              pastWeeks.map(week => (
                <WeekCard key={week.weekStartDate} week={week} formatWeekDate={formatWeekDate} />
              ))
            )}
          </div>
        )}
      </div>

      {/* Current and Future Weeks */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">📅 Current & Future Weeks</h2>
        <div className="space-y-4">
          {weeks.map((week, index) => (
            <div key={week.weekStartDate}>
              {index === 0 && (
                <div className="mb-2 text-sm text-gray-600 font-medium">Current Week</div>
              )}
              <WeekCard week={week} formatWeekDate={formatWeekDate} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WeekCard({
  week,
  formatWeekDate
}: {
  week: WeekData;
  formatWeekDate: (d: string) => string;
}) {
  const disciplineBadgeClasses = getDisciplineBadgeClasses(week.discipline);

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-gray-300">
      <div className="flex items-center gap-3 mb-4">
        <span className={`px-3 py-1 rounded-full text-sm font-medium border ${disciplineBadgeClasses}`}>
          {week.discipline} Week
        </span>
        <span className="text-sm text-gray-600">
          {formatWeekDate(week.weekStartDate)}
        </span>
      </div>

      {week.primaryGoals.length > 0 && (
        <div className="mb-4">
          <h4 className="font-medium text-gray-700 mb-2">Primary Goals</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-800">
            {week.primaryGoals.map(goal => (
              <li key={goal.id}>{goal.content}</li>
            ))}
          </ul>
        </div>
      )}

      {week.workingGoals.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-700 mb-2">Working Goals</h4>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
            {week.workingGoals.map(goal => (
              <li key={goal.id}>
                <span className="text-xs text-gray-500">[{goal.discipline}]</span> {goal.content}
              </li>
            ))}
          </ul>
        </div>
      )}

      {week.primaryGoals.length === 0 && week.workingGoals.length === 0 && (
        <p className="text-sm text-gray-400 italic">No goals set for this week</p>
      )}
    </div>
  );
}

