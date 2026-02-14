import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { useProgressTracker } from '../hooks/useProgressTracker';
import { getPrioritizedCards, CardWithContext } from '../db/training-coach/search';
import { DISCIPLINES, getDisciplineDisplay } from '../utils/disciplines';
import { updateCard } from '../db/training-coach/operations';
import { progressTrackerDB } from '../db/progress-tracker/db';
import { Goal, GoalTrack, GoalContainer } from '../db/progress-tracker/types';
import { logger } from '../utils/logger';
import { TrackTabs } from '../components/TrackTabs';
import ArchiveWeekModal from '../components/ArchiveWeekModal';
import ArchiveButton from '../components/ArchiveButton';

export default function Home() {

  const {
    loading: progressLoading,
    currentFocus,
    containersByDiscipline,
    refreshGoals,
  } = useProgressTracker();

  const [priorityCards, setPriorityCards] = useState<CardWithContext[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [activeTrack, setActiveTrack] = useState<GoalTrack>('on-ice');
  const [archiveModalDiscipline, setArchiveModalDiscipline] = useState<"Spins" | "Jumps" | "Edges" | null>(null);

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
      logger.error('Failed to load priority cards:', error);
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
      logger.error('Failed to load other discipline cards:', error);
    }
  };

  useEffect(() => {
    loadOtherDisciplineCards();
  }, [currentFocus]);

  // Reset carousel to first discipline (current focus) when it changes
  useEffect(() => {
    setCarouselIndex(0);
  }, [currentFocus]);

  // Order disciplines: current discipline first, then others
  const orderedDisciplines = useMemo(() => {
    if (!currentFocus) return [...DISCIPLINES];
    const others = DISCIPLINES.filter(d => d !== currentFocus);
    return [currentFocus, ...others] as Array<typeof DISCIPLINES[number]>;
  }, [currentFocus]);

  // Filter containers by active track
  const filteredContainersByDiscipline = useMemo(() => {
    const filtered: typeof containersByDiscipline = {
      Spins: [],
      Jumps: [],
      Edges: [],
    };
    for (const discipline of DISCIPLINES) {
      filtered[discipline] = containersByDiscipline[discipline].filter(
        container => (container.track || 'on-ice') === activeTrack
      );
    }
    return filtered;
  }, [containersByDiscipline, activeTrack]);

  // Check if there are any containers for the active track
  const hasAnyGoals = useMemo(() => {
    const counts = orderedDisciplines.map(d => ({
      discipline: d,
      count: filteredContainersByDiscipline[d].length
    }));
    logger.info(`[Home] Container counts for ${activeTrack}:`, counts);
    return orderedDisciplines.some(discipline =>
      filteredContainersByDiscipline[discipline].length > 0
    );
  }, [orderedDisciplines, filteredContainersByDiscipline, activeTrack]);

  const handleUnmarkPriority = async (card: CardWithContext) => {
    try {
      if (!card.deckId || !card.sectionId || !card.id) {
        return;
      }

      await updateCard(card.deckId, card.sectionId, card.id, {
        priority: false,
      });

      // Clear pending removal state
      setPendingRemoval(null);

      // Small delay to ensure database update is complete
      await new Promise(resolve => setTimeout(resolve, 100));

      // Reload both card lists after unmarking
      await Promise.all([loadPriorityCards(), loadOtherDisciplineCards()]);
    } catch (error) {
      logger.error('[Home] Failed to unmark priority:', error);
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
        {/* Unified Goals Card */}
        <section className="mb-8">
          {!hasAnyGoals ? (
            <div className="liquid-glass liquid-glass--card">
              <div className="liquid-glass__content">
                {/* Navbar with title and tabs */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-white">Goals</h2>
                  <TrackTabs activeTrack={activeTrack} onTrackChange={setActiveTrack} />
                </div>
                <div className="p-8 text-center">
                  <p className="text-white">No goals set for this week yet.</p>
                  <Link to="/progress" className="text-white hover:text-white/80 mt-2 inline-block underline">
                    Go to Progress Tracker →
                  </Link>
                </div>
              </div>
            </div>
          ) : (
              <div className="liquid-glass liquid-glass--card">
                <div className="liquid-glass__content transition-all duration-200 ease-in-out">
                  {/* Navbar with title and tabs */}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-white">Goals</h2>
                    <TrackTabs activeTrack={activeTrack} onTrackChange={setActiveTrack} />
                  </div>

                  {/* Desktop: Three Column Layout */}
                  <div className="hidden md:grid md:grid-cols-3 md:gap-4 min-h-[200px]">
                    {orderedDisciplines.map((discipline, index) => {
                      const containers = filteredContainersByDiscipline[discipline];

                      return (
                        <div
                          key={discipline}
                          className={`flex flex-col ${index < orderedDisciplines.length - 1 ? 'border-r border-white/20 pr-4' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-medium text-white">
                              {getDisciplineDisplay(discipline)}
                            </h3>
                            {containers.length > 0 && (
                              <ArchiveButton
                                onClick={() => setArchiveModalDiscipline(discipline)}
                                showText={true}
                              />
                            )}
                          </div>

                          {/* Goal Containers (max 3) */}
                          {containers.length > 0 ? (
                            <div className="space-y-3">
                              {containers.map(container => {
                                logger.info(`[Home] Rendering container ${container.id} for ${discipline}, container data:`, container);
                                return <GoalContainerDisplay key={container.id} container={container} />;
                              })}
                            </div>
                          ) : (
                            <div className="min-h-[60px] flex items-center">
                              <p className="text-white/50 text-sm">No goals set</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Mobile: Carousel Layout */}
                  <div className="md:hidden relative">
                    <div
                      className="overflow-hidden"
                      onTouchStart={(e) => setTouchStart(e.targetTouches[0].clientX)}
                      onTouchMove={(e) => setTouchEnd(e.targetTouches[0].clientX)}
                      onTouchEnd={() => {
                        if (touchStart === null || touchEnd === null) return;
                        const distance = touchStart - touchEnd;
                        const isLeftSwipe = distance > 50;
                        const isRightSwipe = distance < -50;

                        if (isLeftSwipe && carouselIndex < orderedDisciplines.length - 1) {
                          setCarouselIndex(prev => prev + 1);
                        }
                        if (isRightSwipe && carouselIndex > 0) {
                          setCarouselIndex(prev => prev - 1);
                        }

                        setTouchStart(null);
                        setTouchEnd(null);
                      }}
                    >
                      <div
                        className="flex transition-transform duration-300 ease-in-out"
                        style={{ transform: `translateX(-${carouselIndex * 100}%)` }}
                      >
                        {orderedDisciplines.map(discipline => {
                          const containers = filteredContainersByDiscipline[discipline];

                          return (
                            <div
                              key={discipline}
                              className="w-full flex-shrink-0 px-2"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-medium text-white">
                                  {getDisciplineDisplay(discipline)}
                                </h3>
                                {containers.length > 0 && (
                                  <ArchiveButton
                                    onClick={() => setArchiveModalDiscipline(discipline)}
                                    showText={false}
                                  />
                                )}
                              </div>

                              {/* Goal Containers (max 3) */}
                              {containers.length > 0 ? (
                                <div className="space-y-3">
                                  {containers.map(container => {
                                    logger.info(`[Home] Rendering container ${container.id} for ${discipline}`);
                                    return <GoalContainerDisplay key={container.id} container={container} />;
                                  })}
                                </div>
                              ) : (
                                <div className="min-h-[60px] flex items-center">
                                  <p className="text-white/50 text-sm">No goals set</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Carousel Navigation */}
                    {orderedDisciplines.length > 1 && (
                      <div className="flex items-center justify-between mt-4">
                        <button
                          onClick={() => setCarouselIndex(prev => (prev - 1 + orderedDisciplines.length) % orderedDisciplines.length)}
                          className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                          aria-label="Previous discipline"
                        >
                          <FaChevronLeft />
                        </button>
                        <div className="flex gap-2">
                          {orderedDisciplines.map((_, index) => (
                            <button
                              key={index}
                              onClick={() => setCarouselIndex(index)}
                              className={`h-2 rounded transition-all ${
                                index === carouselIndex
                                  ? 'w-8 bg-white'
                                  : 'w-2 bg-white/30'
                              }`}
                              aria-label={`Go to ${getDisciplineDisplay(orderedDisciplines[index])}`}
                            />
                          ))}
                        </div>
                        <button
                          onClick={() => setCarouselIndex(prev => (prev + 1) % orderedDisciplines.length)}
                          className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
                          aria-label="Next discipline"
                        >
                          <FaChevronRight />
                        </button>
                      </div>
                    )}
                  </div>
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

        {/* Archive Modal - Full Page Overlay */}
        {archiveModalDiscipline && (
          <ArchiveWeekModal
            focusDiscipline={archiveModalDiscipline}
            onClose={() => setArchiveModalDiscipline(null)}
            onSuccess={async () => {
              setArchiveModalDiscipline(null);
              await refreshGoals();
            }}
            track={activeTrack}
          />
        )}
      </div>
    </div>
  );
}

// Component to display a single goal container
function GoalContainerDisplay({ container }: { container: GoalContainer }) {
  console.log(`[GoalContainerDisplay] FUNCTION CALLED for container ${container.id}`, container);
  logger.info(`[GoalContainerDisplay] Component mounted for container ${container.id}`, container);
  const [primaryGoal, setPrimaryGoal] = useState<Goal | null>(null);
  const [workingGoals, setWorkingGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log(`[GoalContainerDisplay] useEffect REGISTERED for container ${container.id}`, container);
    logger.info(`[GoalContainerDisplay] useEffect triggered for container ${container.id}`);
    async function loadGoals() {
      console.log(`[GoalContainerDisplay] loadGoals() CALLED for container ${container.id}`);
      setLoading(true);
      try {
        logger.info(`[GoalContainerDisplay] Loading container ${container.id}, primaryGoalId: ${container.primaryGoalId}, workingGoalIds: [${container.workingGoalIds.join(', ')}]`);

        // Check if goals exist in IndexedDB
        const allGoals = await progressTrackerDB.goals.toArray();
        logger.info(`[GoalContainerDisplay] Total goals in IndexedDB: ${allGoals.length}`);
        logger.info(`[GoalContainerDisplay] Goal IDs in IndexedDB: [${allGoals.map(g => g.id).join(', ')}]`);

        // Load primary goal
        const primary = await progressTrackerDB.goals.get(container.primaryGoalId);
        logger.info(`[GoalContainerDisplay] Primary goal loaded:`, primary ? `"${primary.content}" (id: ${primary.id})` : `NOT FOUND (looking for: ${container.primaryGoalId})`);
        setPrimaryGoal(primary || null);

        // Load working goals
        const working = await Promise.all(
          container.workingGoalIds.map(async (id) => {
            const goal = await progressTrackerDB.goals.get(id);
            logger.info(`[GoalContainerDisplay] Working goal ${id}:`, goal ? `"${goal.content}"` : 'NOT FOUND');
            return goal;
          })
        );
        const validWorking = working.filter((g): g is Goal => g !== undefined && !g.archivedAt);
        logger.info(`[GoalContainerDisplay] Working goals loaded: ${validWorking.length}/${container.workingGoalIds.length}`);
        setWorkingGoals(validWorking);
      } catch (error) {
        logger.error('[GoalContainerDisplay] Failed to load goals:', error);
      } finally {
        setLoading(false);
      }
    }
    console.log(`[GoalContainerDisplay] About to call loadGoals() for container ${container.id}`);
    loadGoals();
    console.log(`[GoalContainerDisplay] loadGoals() called (async, so it's running in background)`);
  }, [container]);

  if (loading) {
    return <div className="border-2 border-white/40 rounded p-2 bg-white/5 text-white/50 text-sm">Loading...</div>;
  }

  if (!primaryGoal) {
    logger.warn(`[GoalContainerDisplay] Container ${container.id} has no primary goal`);
    return null;
  }

  return (
    <div className="border-2 border-white/40 rounded p-2 bg-white/5">
      {/* Goal as header */}
      <h4 className="text-sm font-semibold text-white mb-2">{primaryGoal.content}</h4>
      {/* Working goals as bullet points - ensure space for up to 2 */}
      {workingGoals.length > 0 ? (
        <ul className="space-y-1">
          {workingGoals.map(goal => (
            <li key={goal.id} className="text-white text-sm">• {goal.content}</li>
          ))}
        </ul>
      ) : (
        <div className="h-8" /> // Reserve space for working goals even when empty
      )}
    </div>
  );
}

