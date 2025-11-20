import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllCards } from '../db/training-coach/operations';
import { Card } from '../db/training-coach/types';
import { updateCard, deleteCard } from '../db/training-coach/operations';
import { getAllDecks } from '../db/training-coach/operations';
import PageLayout from '../components/PageLayout';
import LiquidGlassCard from '../components/LiquidGlassCard';

interface CardWithContext extends Card {
  deckId: string;
  sectionId: string;
  deckName?: string;
}

export default function MergeWorkflow() {
  const [mergeCandidates, setMergeCandidates] = useState<CardWithContext[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMergeCandidates();
  }, []);

  async function loadMergeCandidates() {
    setLoading(true);
    const allCards = await getAllCards();
    const marked = allCards.filter(c => c.markedForMerge);

    const decks = await getAllDecks();
    const deckMap = new Map(decks.map(d => [d.id, d.name]));

    const withContext: CardWithContext[] = marked.map(c => ({
      ...c,
      deckName: deckMap.get(c.deckId),
    }));

    setMergeCandidates(withContext);
    setLoading(false);
  }

  function toggleSelection(id: string) {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  }

  async function handleMerge() {
    if (selectedItems.size < 2) {
      alert('Please select at least 2 items to merge');
      return;
    }

    const selected = mergeCandidates.filter(c => selectedItems.has(c.id));

    // Find the item with highest helpfulness score (or first if tied)
    const master = selected.reduce((prev, current) =>
      current.helpfulnessScore > prev.helpfulnessScore ? current : prev
    );

    // Collect all unique tags
    const allTags = new Set<string>();
    selected.forEach(item => {
      item.tags?.forEach(tag => allTags.add(tag));
    });

    // Check if any item is priority
    const hasPriority = selected.some(item => item.priority);

    // Get highest helpfulness score
    const maxHelpfulness = Math.max(...selected.map(item => item.helpfulnessScore));

    // Combine content texts
    const combinedContent = selected
      .map(item => item.content)
      .filter((text, index, self) => self.indexOf(text) === index) // Remove duplicates
      .join(' | ');

    // Update master card
    await updateCard(master.deckId, master.sectionId, master.id, {
      content: combinedContent,
      tags: Array.from(allTags),
      helpfulnessScore: maxHelpfulness,
      priority: hasPriority,
      markedForMerge: false,
    });

    // Delete other selected items
    for (const item of selected) {
      if (item.id !== master.id) {
        await deleteCard(item.deckId, item.sectionId, item.id);
      }
    }

    // Reload
    await loadMergeCandidates();
    setSelectedItems(new Set());
  }

  async function handleUnmark(id: string) {
    const item = mergeCandidates.find(c => c.id === id);
    if (!item) return;

    await updateCard(item.deckId, item.sectionId, item.id, {
      markedForMerge: false,
    });

    await loadMergeCandidates();
  }

  if (loading) {
    return (
      <PageLayout>
        <p className="text-white/70">Loading...</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <h1 className="text-2xl font-bold text-white mb-6">Merge Workflow</h1>

      {mergeCandidates.length === 0 ? (
        <LiquidGlassCard>
          <div className="text-center py-12">
            <p className="text-lg text-white">No items marked for merge.</p>
          </div>
        </LiquidGlassCard>
      ) : (
        <>
          <div className="mb-4 flex justify-between items-center">
            <p className="text-white/70">
              {selectedItems.size} of {mergeCandidates.length} selected
            </p>
            {selectedItems.size >= 2 && (
              <button
                onClick={handleMerge}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Merge Selected ({selectedItems.size} items)
              </button>
            )}
          </div>

          <div className="space-y-4">
            {mergeCandidates.map((item) => (
              <LiquidGlassCard
                key={item.id}
                className={selectedItems.has(item.id) ? 'ring-2 ring-blue-400' : ''}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleSelection(item.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <Link
                          to={`/deck/${item.deckId}`}
                          className="text-sm font-medium text-white hover:text-white/80"
                        >
                          {item.deckName || 'Unknown Deck'}
                        </Link>
                        {item.priority && (
                          <span className="ml-2 px-2 py-1 text-xs bg-yellow-500/30 text-yellow-200 rounded">
                            Priority
                          </span>
                        )}
                      </div>
                      {item.helpfulnessScore > 0 && (
                        <span className="text-sm text-white/70">
                          Score: {item.helpfulnessScore}
                        </span>
                      )}
                    </div>
                    <p className="text-white mb-2">{item.content}</p>
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        {item.tags.map(tag => (
                          <span
                            key={tag}
                            className="px-2 py-1 text-xs bg-white/20 text-white rounded"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-white/70">
                        {new Date(item.createdAt).toLocaleDateString('en-US', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                      <button
                        onClick={() => handleUnmark(item.id)}
                        className="text-xs text-white/70 hover:text-white"
                      >
                        Unmark
                      </button>
                    </div>
                  </div>
                </div>
              </LiquidGlassCard>
            ))}
          </div>
        </>
      )}
    </PageLayout>
  );
}

