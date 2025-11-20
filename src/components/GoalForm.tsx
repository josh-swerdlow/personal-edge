import { useState, useEffect } from 'react';
import { Goal } from '../db/progress-tracker/types';

interface GoalFormProps {
  goal?: Goal | null;
  defaultDiscipline?: "Spins" | "Jumps" | "Edges";
  defaultType?: "primary" | "working";
  onSubmit: (goal: Omit<Goal, 'id' | 'createdAt'>) => Promise<void>;
  onCancel: () => void;
}

export default function GoalForm({
  goal,
  defaultDiscipline,
  defaultType,
  onSubmit,
  onCancel,
}: GoalFormProps) {
  const [discipline, setDiscipline] = useState<"Spins" | "Jumps" | "Edges">(
    goal?.discipline || defaultDiscipline || "Spins"
  );
  const [type, setType] = useState<"primary" | "working">(
    goal?.type || defaultType || "primary"
  );
  const [content, setContent] = useState(goal?.content || '');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (goal) {
      setDiscipline(goal.discipline);
      setType(goal.type);
      setContent(goal.content);
    }
  }, [goal]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        discipline,
        type,
        content: content.trim(),
      });
      setContent('');
    } catch (error) {
      console.error('Failed to save goal:', error);
      alert('Failed to save goal. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Discipline *
        </label>
        <select
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value as "Spins" | "Jumps" | "Edges")}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="Spins">Spins</option>
          <option value="Jumps">Jumps</option>
          <option value="Edges">Edges</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Type *
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "primary" | "working")}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="primary">Primary</option>
          <option value="working">Working</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Content *
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          placeholder="e.g., Front Spin → Find true rocker"
          required
          autoFocus
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          disabled={submitting || !content.trim()}
        >
          {submitting ? 'Saving...' : goal ? 'Update' : 'Create'}
        </button>
      </div>
    </form>
  );
}

