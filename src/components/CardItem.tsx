import { useState } from 'react';
import { Card } from '../db/training-coach/types';
import { updateCard } from '../db/training-coach/operations';
import { FaArrowUp, FaArrowDown, FaExclamationCircle, FaEdit, FaTrash } from 'react-icons/fa';
import Tooltip from './Tooltip';

interface CardItemProps {
  card: Card;
  deckId: string;
  sectionId: string;
  onUpdate: () => void;
  onDelete: () => void;
}

export default function CardItem({ card, deckId, sectionId, onUpdate, onDelete }: CardItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(card.content);
  const [editTags, setEditTags] = useState(card.tags?.join(', ') || '');
  const [tagError, setTagError] = useState('');

  async function handleSave() {
    const tags = editTags.split(',').map(t => t.trim()).filter(t => t);

    // Validate tags are required
    if (tags.length === 0) {
      setTagError('At least one tag is required');
      return;
    }

    setTagError('');
    await updateCard(deckId, sectionId, card.id, {
      content: editText.trim(),
      tags: tags,
    });
    setIsEditing(false);
    onUpdate();
  }

  async function handleCancel() {
    setEditText(card.content);
    setEditTags(card.tags?.join(', ') || '');
    setIsEditing(false);
  }

  async function handleUpvote() {
    await updateCard(deckId, sectionId, card.id, {
      helpfulnessScore: Math.max(0, card.helpfulnessScore + 1),
      lastUpvotedAt: Date.now(),
    });
    onUpdate();
  }

  async function handleDownvote() {
    await updateCard(deckId, sectionId, card.id, {
      helpfulnessScore: Math.max(0, card.helpfulnessScore - 1),
      lastUpvotedAt: Date.now(),
    });
    onUpdate();
  }

  async function handleTogglePriority() {
    await updateCard(deckId, sectionId, card.id, {
      priority: !card.priority,
    });
    onUpdate();
  }

  async function handleToggleMarkForMerge() {
    await updateCard(deckId, sectionId, card.id, {
      markedForMerge: !card.markedForMerge,
    });
    onUpdate();
  }

  return (
    <div className={`p-3 rounded border transition ${
      card.priority
        ? 'bg-yellow-50 border-yellow-300 hover:border-yellow-400'
        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
    } ${card.markedForMerge ? 'opacity-60' : ''}`}>
      {isEditing ? (
        <div>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 mb-2"
            rows={3}
          />
          <input
            type="text"
            value={editTags}
            onChange={(e) => {
              setEditTags(e.target.value);
              setTagError('');
            }}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 mb-2 ${
              tagError ? 'border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500'
            }`}
            placeholder="Tags (comma-separated) *required"
          />
          {tagError && (
            <p className="text-red-600 text-sm mb-2">{tagError}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!editText.trim() || editTags.trim().length === 0}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1 bg-gray-200 text-gray-700 text-sm rounded hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {/* Priority indicator on left */}
          {card.priority && (
            <div className="flex-shrink-0 pt-1">
              <FaExclamationCircle className="text-red-500 text-lg" title="Priority" />
            </div>
          )}
          <div className="flex-1">
            <div className="flex justify-between items-start mb-2 gap-2">
              <div className="text-gray-800 flex-1 whitespace-pre-wrap">{card.content}</div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(card.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
                {card.markedForMerge && (
                  <span className="px-2 py-1 text-xs bg-orange-200 text-orange-800 rounded">
                    Marked for Merge
                  </span>
                )}
              </div>
            </div>
            {card.tags && card.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {card.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center">
              <div className="flex gap-3 items-center">
                {/* Upvote/Downvote */}
                <div className="flex items-center gap-1">
                  <Tooltip text="Upvote" position="top">
                    <button
                      type="button"
                      onClick={handleUpvote}
                      className="text-gray-600 hover:text-orange-500 transition-colors"
                    >
                      <FaArrowUp />
                    </button>
                  </Tooltip>
                  <span className="text-xs font-medium text-gray-700 min-w-[1.5rem] text-center">
                    {card.helpfulnessScore}
                  </span>
                  <Tooltip text="Downvote" position="top">
                    <button
                      type="button"
                      onClick={handleDownvote}
                      className="text-gray-600 hover:text-blue-500 transition-colors"
                    >
                      <FaArrowDown />
                    </button>
                  </Tooltip>
                </div>
                {/* Priority toggle */}
                <Tooltip text={card.priority ? "Remove priority" : "Mark as priority"} position="top">
                  <button
                    type="button"
                    onClick={handleTogglePriority}
                    className={`text-sm transition-colors ${
                      card.priority
                        ? 'text-yellow-600 hover:text-yellow-700'
                        : 'text-gray-400 hover:text-yellow-600'
                    }`}
                  >
                    <FaExclamationCircle />
                  </button>
                </Tooltip>
                {/* Mark for merge */}
                <Tooltip text={card.markedForMerge ? "Unmark for merge" : "Mark for merge"} position="top">
                  <button
                    type="button"
                    onClick={handleToggleMarkForMerge}
                    className={`text-sm transition-colors ${
                      card.markedForMerge
                        ? 'text-orange-600 hover:text-orange-700'
                        : 'text-gray-400 hover:text-orange-600'
                    }`}
                  >
                    Merge
                  </button>
                </Tooltip>
                {/* Edit */}
                <Tooltip text="Edit card" position="top">
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <FaEdit />
                  </button>
                </Tooltip>
                {/* Delete */}
                <Tooltip text="Delete card" position="top">
                  <button
                    type="button"
                    onClick={onDelete}
                    className="text-red-600 hover:text-red-800 transition-colors"
                  >
                    <FaTrash />
                  </button>
                </Tooltip>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

