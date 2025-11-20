import { Goal } from '../db/progress-tracker/types';
import { FaEdit, FaTrash } from 'react-icons/fa';

interface GoalCardProps {
  goal: Goal;
  onEdit: (goal: Goal) => void;
  onArchive: (goalId: string) => void;
  variant?: 'primary' | 'working';
}

export default function GoalCard({ goal, onEdit, onArchive, variant = 'primary' }: GoalCardProps) {
  const isPrimary = variant === 'primary';

  return (
    <div
      className={`bg-white rounded-lg shadow-md hover:shadow-lg transition ${
        isPrimary
          ? 'p-6 border-l-4 border-blue-500'
          : 'p-4 border-l-2 border-gray-300'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex-1">
          <p className={`text-gray-800 ${isPrimary ? 'text-base' : 'text-sm'}`}>
            {goal.content}
          </p>
          {!isPrimary && (
            <span className="inline-block mt-2 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
              {goal.discipline}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onEdit(goal)}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition"
            aria-label="Edit goal"
          >
            <FaEdit size={16} />
          </button>
          <button
            onClick={() => onArchive(goal.id)}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition"
            aria-label="Archive goal"
          >
            <FaTrash size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

