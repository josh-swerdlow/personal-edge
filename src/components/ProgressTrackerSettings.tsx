import { AppData } from '../db/progress-tracker/types';

interface ProgressTrackerSettingsProps {
  appData: AppData;
  onClose: () => void;
}

export default function ProgressTrackerSettings({
  appData,
  onClose,
}: ProgressTrackerSettingsProps) {
  // Both fields are now read-only, no state or submission needed

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">⚙️ Progress Tracker Settings</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600">
              {(() => {
                const date = new Date(appData.startDate);
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const year = date.getFullYear();
                return `${month}/${day}/${year}`;
              })()}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              The date when your cycle started. This cannot be changed as it would affect all historical week calculations.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cycle Length (weeks)
            </label>
            <input
              type="number"
              value={appData.cycleLength}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 cursor-not-allowed"
              readOnly
            />
            <p className="text-xs text-gray-500 mt-1">
              Number of weeks in a cycle (fixed at 3 for Spins → Jumps → Edges).
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

