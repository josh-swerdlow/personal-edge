import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaTimes } from 'react-icons/fa';
import { useProgressTracker } from '../hooks/useProgressTracker';
import { getPrioritizedCards, CardWithContext } from '../db/training-coach/search';
import { DISCIPLINES, getDisciplineDisplay } from '../utils/disciplines';
import { updateCard } from '../db/training-coach/operations';

export default function Home() {

  const {
    loading: progressLoading,
    currentFocus,
    primaryGoals,
    workingGoals,
  } = useProgressTracker();

  const [priorityCards, setPriorityCards] = useState<CardWithContext[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  const loadPriorityCards = async () => {
    setLoadingCards(true);
    try {
      if (currentFocus) {
        // Get priority cards for current discipline
        const cards = await getPrioritizedCards({
          discipline: currentFocus,
          limit: 10
        });
        setPriorityCards(cards.filter(c => c.priority));
      }
    } catch (error) {
      console.error('Failed to load priority cards:', error);
    } finally {
      setLoadingCards(false);
    }
  };

  useEffect(() => {
    loadPriorityCards();
  }, [currentFocus]);

  // Get cards from other disciplines (priority reminders)
  const [otherDisciplineCards, setOtherDisciplineCards] = useState<CardWithContext[]>([]);

  const loadOtherDisciplineCards = async () => {
    if (!currentFocus) return;

    try {
      const otherDisciplines = DISCIPLINES.filter(d => d !== currentFocus);

      // Get priority cards from each other discipline
      const allOtherCards: CardWithContext[] = [];
      for (const discipline of otherDisciplines) {
        const cards = await getPrioritizedCards({
          discipline: discipline as "Spins" | "Jumps" | "Edges",
          limit: 5
        });
        allOtherCards.push(...cards.filter(c => c.priority));
      }

      // Sort by helpfulness and take top 5
      const sorted = allOtherCards.sort((a, b) => {
        if (a.helpfulnessScore !== b.helpfulnessScore) {
          return b.helpfulnessScore - a.helpfulnessScore;
        }
        return (b.lastUpvotedAt || b.createdAt) - (a.lastUpvotedAt || a.createdAt);
      });

      setOtherDisciplineCards(sorted.slice(0, 5));
    } catch (error) {
      console.error('Failed to load other discipline cards:', error);
    }
  };

  useEffect(() => {
    loadOtherDisciplineCards();
  }, [currentFocus]);

  const handleUnmarkPriority = async (card: CardWithContext) => {
    try {
      console.log('[Home] Unmarking priority for card:', {
        deckId: card.deckId,
        sectionId: card.sectionId,
        cardId: card.id,
      });

      if (!card.deckId || !card.sectionId || !card.id) {
        console.error('[Home] Missing required card data:', card);
        return;
      }

      await updateCard(card.deckId, card.sectionId, card.id, {
        priority: false,
      });

      console.log('[Home] Priority unmarked successfully, waiting before reload...');

      // Clear pending removal state
      setPendingRemoval(null);

      // Small delay to ensure database update is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reload both card lists after unmarking
      await Promise.all([loadPriorityCards(), loadOtherDisciplineCards()]);

      console.log('[Home] Cards reloaded');
    } catch (error) {
      console.error('[Home] Failed to unmark priority:', error);
      alert('Failed to remove priority. Please try again.');
      setPendingRemoval(null);
    }
  };

  if (progressLoading) {
    return (
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-y-auto h-full"
      style={{
        minHeight: '100%',
        position: 'relative',
        paddingTop: 'var(--deck-navbar-height)',
        paddingLeft: 'clamp(0.5rem, 2vw, 1rem)',
        paddingRight: 'clamp(0.5rem, 2vw, 1rem)',
        paddingBottom: 'clamp(0.5rem, env(safe-area-inset-bottom) + 0.5rem, 1rem)',
      }}
    >
      {/* Crisp Background Image */}
      <div
        className="fixed inset-0"
        style={{
          backgroundImage: 'url(/background.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Main Content */}
      <div
        className="max-w-4xl mx-auto relative"
        style={{
          zIndex: 1,
        }}
      >
        {/* Current Week Goals */}
        <section className="mb-8">
          {primaryGoals.length > 0 && (
            <div className="mb-4">
              <div className="liquid-glass liquid-glass--card">
                <div className="liquid-glass__content">
                  <h3 className="font-medium text-white mb-3">Primary Goals</h3>
                <ul className="space-y-2">
                  {primaryGoals.map(goal => (
                    <li key={goal.id} className="text-white text-sm">
                      • {goal.content}
                    </li>
                  ))}
                </ul>
                </div>
              </div>
            </div>
          )}

          {workingGoals.length > 0 && (
            <div>
              <div className="liquid-glass liquid-glass--card">
                <div className="liquid-glass__content">
                  <h3 className="font-medium text-white mb-3">Working Goals</h3>
                <ul className="space-y-2">
                  {workingGoals.map(goal => (
                    <li key={goal.id} className="text-white text-sm">
                      • <span className="text-xs text-white/70">[{goal.discipline}]</span> {goal.content}
                    </li>
                  ))}
                </ul>
                </div>
              </div>
            </div>
          )}

          {primaryGoals.length === 0 && workingGoals.length === 0 && (
            <div className="liquid-glass liquid-glass--card">
              <div className="liquid-glass__content p-8 text-center">
                <p className="text-white">No goals set for this week yet.</p>
              <Link to="/progress" className="text-white hover:text-white/80 mt-2 inline-block underline">
                Go to Progress Tracker →
              </Link>
              </div>
            </div>
          )}
        </section>

        {/* Priority Reminders */}
        {currentFocus && (
          <>
            <section className="mb-8">
              <div className="liquid-glass liquid-glass--card">
                <div className="liquid-glass__content">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Priority Reminders - {getDisciplineDisplay(currentFocus)}
                  </h2>
                {loadingCards ? (
                  <p className="text-white/70">Loading reminders...</p>
                ) : priorityCards.length > 0 ? (
                  (() => {
                    // Group cards by deck
                    const cardsByDeck = new Map<string, CardWithContext[]>();
                    priorityCards.forEach(card => {
                      const deckKey = card.deckId;
                      const existing = cardsByDeck.get(deckKey) || [];
                      cardsByDeck.set(deckKey, [...existing, card]);
                    });

                    return Array.from(cardsByDeck.entries()).map(([deckId, cards]) => {
                      const deckName = cards[0]?.deckName || 'Unknown Deck';
                      const deckUrl = `/deck/${deckId}?filterMode=priority`;

                      return (
                        <div key={deckId} className="mb-4 last:mb-0">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-semibold text-white">{deckName}</h3>
                            <Link
                              to={deckUrl}
                              className="text-sm text-white/70 hover:text-white underline"
                            >
                              View all priority →
                            </Link>
                          </div>
                          <ul className="space-y-2">
                            {cards.map((card, index) => {
                              const cardUrl = `/deck/${card.deckId}?filterMode=priority&cardId=${card.id}`;
                              const isPendingRemoval = pendingRemoval === card.id;
                              return (
                                <li key={`priority-${card.deckId}-${card.sectionId}-${card.id}-${index}`} className="border-l-4 border-yellow-400 pl-3 flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <Link
                                      to={cardUrl}
                                      className="text-white hover:text-white/80 hover:underline"
                                      onClick={(e) => {
                                        if (isPendingRemoval) {
                                          e.preventDefault();
                                        }
                                      }}
                                    >
                                      <p className="text-white">{card.content}</p>
                                    </Link>
                                  </div>
                                  {isPendingRemoval ? (
                                    <div className="flex-shrink-0 flex items-center gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleUnmarkPriority(card);
                                        }}
                                        className="px-2 py-1 text-xs bg-red-600 text-white hover:bg-red-700 rounded transition-colors"
                                        title="Confirm removal"
                                        aria-label="Confirm removal"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setPendingRemoval(null);
                                        }}
                                        className="px-2 py-1 text-xs bg-white/20 text-white hover:bg-white/30 rounded transition-colors"
                                        title="Cancel"
                                        aria-label="Cancel"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setPendingRemoval(card.id);
                                      }}
                                      className="flex-shrink-0 p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                                      title="Remove priority"
                                      aria-label="Remove priority"
                                    >
                                      <FaTimes size={14} />
                                    </button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    });
                  })()
                ) : (
                  <p className="text-white/70">No priority reminders for {getDisciplineDisplay(currentFocus)}.</p>
                )}
                </div>
              </div>
            </section>

            {/* Other Discipline Reminders */}
            <section className="mb-8">
              <div className="liquid-glass liquid-glass--card">
                <div className="liquid-glass__content">
                  <h2 className="text-xl font-semibold text-white mb-4">
                    Reminders - Other Disciplines
                  </h2>
                {otherDisciplineCards.length > 0 ? (
                  (() => {
                    // Group cards by deck
                    const cardsByDeck = new Map<string, CardWithContext[]>();
                    otherDisciplineCards.forEach(card => {
                      const deckKey = card.deckId;
                      const existing = cardsByDeck.get(deckKey) || [];
                      cardsByDeck.set(deckKey, [...existing, card]);
                    });

                    return Array.from(cardsByDeck.entries()).map(([deckId, cards]) => {
                      const deckName = cards[0]?.deckName || 'Unknown Deck';
                      const deckUrl = `/deck/${deckId}?filterMode=priority`;

                      return (
                        <div key={deckId} className="mb-4 last:mb-0">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-base font-semibold text-white">{deckName}</h3>
                            <Link
                              to={deckUrl}
                              className="text-sm text-white/70 hover:text-white underline"
                            >
                              View all priority →
                            </Link>
                          </div>
                          <ul className="space-y-2">
                            {cards.map((card, index) => {
                              const cardUrl = `/deck/${card.deckId}?filterMode=priority&cardId=${card.id}`;
                              const isPendingRemoval = pendingRemoval === card.id;
                              return (
                                <li key={`other-${card.deckId}-${card.sectionId}-${card.id}-${index}`} className="border-l-4 border-white/30 pl-3 flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <Link
                                      to={cardUrl}
                                      className="text-white text-sm hover:text-white/80 hover:underline"
                                      onClick={(e) => {
                                        if (isPendingRemoval) {
                                          e.preventDefault();
                                        }
                                      }}
                                    >
                                      <p className="text-white text-sm">{card.content}</p>
                                    </Link>
                                  </div>
                                  {isPendingRemoval ? (
                                    <div className="flex-shrink-0 flex items-center gap-1">
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleUnmarkPriority(card);
                                        }}
                                        className="px-2 py-1 text-xs bg-red-600 text-white hover:bg-red-700 rounded transition-colors"
                                        title="Confirm removal"
                                        aria-label="Confirm removal"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setPendingRemoval(null);
                                        }}
                                        className="px-2 py-1 text-xs bg-white/20 text-white hover:bg-white/30 rounded transition-colors"
                                        title="Cancel"
                                        aria-label="Cancel"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setPendingRemoval(card.id);
                                      }}
                                      className="flex-shrink-0 p-1 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                                      title="Remove priority"
                                      aria-label="Remove priority"
                                    >
                                      <FaTimes size={14} />
                                    </button>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    });
                  })()
                ) : (
                  <p className="text-white/70">No priority reminders from other disciplines.</p>
                )}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

