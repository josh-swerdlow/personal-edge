import { useState, useEffect } from 'react';
import { AppData } from '../db/progress-tracker/types';
import { updateAppData } from '../db/progress-tracker/operations';

interface ProgressTrackerSettingsProps {
  appData: AppData;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ProgressTrackerSettings({
  appData,
  onClose,
  onSuccess,
}: ProgressTrackerSettingsProps) {
  const [startDate, setStartDate] = useState(appData.startDate);
  const [cycleLength, setCycleLength] = useState(appData.cycleLength.toString());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setStartDate(appData.startDate);
    setCycleLength(appData.cycleLength.toString());
  }, [appData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const cycleLengthNum = parseInt(cycleLength, 10);
    if (isNaN(cycleLengthNum) || cycleLengthNum < 1) {
      alert('Cycle length must be a positive number.');
      return;
    }

    setSubmitting(true);
    try {
      await updateAppData({
        startDate,
        cycleLength: cycleLengthNum,
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to update settings:', error);
      alert('Failed to update settings. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">⚙️ Progress Tracker Settings</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date *
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              The date when your 3-week cycle started. Changing this will affect the current week calculation.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cycle Length (weeks) *
            </label>
            <input
              type="number"
              value={cycleLength}
              onChange={(e) => setCycleLength(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Number of weeks in a cycle (default: 3 for Spins → Jumps → Edges).
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              disabled={submitting}
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

