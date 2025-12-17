import { useState, useEffect } from 'react';
import { getAllDecks, getAllCards } from '../db/training-coach/operations';
import { Deck, Card } from '../db/training-coach/types';
import { getAllGoals, getAppData } from '../db/progress-tracker/operations';
import { Goal, AppData, GoalFeedback } from '../db/progress-tracker/types';
import { progressTrackerDB } from '../db/progress-tracker/db';
import PageLayout from '../components/PageLayout';
import LiquidGlassCard from '../components/LiquidGlassCard';

interface Stats {
  totalDecks: number;
  totalSections: number;
  totalCards: number;
  cardsByDiscipline: Record<string, number>;
  cardsByPriority: { priority: number; nonPriority: number };
  cardsByHelpfulness: { withScore: number; withoutScore: number };
  markedForMerge: number;
}

export default function DbInspector() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [allCards, setAllCards] = useState<Array<Card & { deckId: string; sectionTitle?: string }>>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [goalFeedback, setGoalFeedback] = useState<GoalFeedback[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDecks, setExpandedDecks] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedProgressTracker, setExpandedProgressTracker] = useState(true);
  const [expandedDecksSection, setExpandedDecksSection] = useState(true);
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const allDecks = await getAllDecks();
      setDecks(allDecks);

      // Load all cards
      const cards = await getAllCards();
      setAllCards(cards);

      // Load progress tracker data
      const progressGoals = await getAllGoals();
      setGoals(progressGoals);

      const progressAppData = await getAppData();
      setAppData(progressAppData);

      const feedbackEntries = await progressTrackerDB.goalFeedback.toArray();
      setGoalFeedback(feedbackEntries);

      // Calculate stats
      const totalSections = allDecks.reduce((sum, deck) => sum + (deck.sections?.length || 0), 0);
      const cardStats: Stats = {
        totalDecks: allDecks.length,
        totalSections,
        totalCards: cards.length,
        cardsByDiscipline: {},
        cardsByPriority: { priority: 0, nonPriority: 0 },
        cardsByHelpfulness: { withScore: 0, withoutScore: 0 },
        markedForMerge: 0,
      };

      // Get deck names for discipline mapping
      const deckMap = new Map(allDecks.map(d => [d.id, d]));

      for (const card of cards) {
        const deck = deckMap.get(card.deckId);
        if (deck?.discipline) {
          cardStats.cardsByDiscipline[deck.discipline] =
            (cardStats.cardsByDiscipline[deck.discipline] || 0) + 1;
        }

        if (card.priority) {
          cardStats.cardsByPriority.priority++;
        } else {
          cardStats.cardsByPriority.nonPriority++;
        }

        if (card.helpfulnessScore > 0) {
          cardStats.cardsByHelpfulness.withScore++;
        } else {
          cardStats.cardsByHelpfulness.withoutScore++;
        }

        if (card.markedForMerge) {
          cardStats.markedForMerge++;
        }
      }

      setStats(cardStats);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  function toggleDeck(deckId: string) {
    const newExpanded = new Set(expandedDecks);
    if (newExpanded.has(deckId)) {
      newExpanded.delete(deckId);
    } else {
      newExpanded.add(deckId);
    }
    setExpandedDecks(newExpanded);
  }

  function toggleSection(sectionId: string) {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  }

  function getCardsForSection(deckId: string, sectionId: string): Array<Card & { deckId: string; sectionTitle?: string }> {
    return allCards.filter(c => c.deckId === deckId && c.sectionId === sectionId);
  }

  if (loading) {
    return (
      <PageLayout maxWidth="7xl">
        <p className="text-white/70">Loading database contents...</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout maxWidth="7xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Database Inspector</h1>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('tree')}
              className={`px-3 py-2 md:px-4 md:py-2 rounded-lg transition text-sm md:text-base ${
                viewMode === 'tree'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              Tree View
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-3 py-2 md:px-4 md:py-2 rounded-lg transition text-sm md:text-base ${
                viewMode === 'raw'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              Raw JSON
            </button>
            <button
              onClick={loadData}
              className="px-3 py-2 md:px-4 md:py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 text-sm md:text-base"
            >
              Refresh
            </button>
          </div>
        </div>

      {stats && (
        <LiquidGlassCard className="mb-6">
          <h2 className="text-xl font-semibold mb-4 text-white">Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-white/70">Total Decks</p>
              <p className="text-2xl font-bold text-white">{stats.totalDecks}</p>
            </div>
            <div>
              <p className="text-sm text-white/70">Total Sections</p>
              <p className="text-2xl font-bold text-white">{stats.totalSections}</p>
            </div>
            <div>
              <p className="text-sm text-white/70">Total Cards</p>
              <p className="text-2xl font-bold text-white">{stats.totalCards}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/30">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-white/70">Priority Cards</p>
                <p className="text-lg font-semibold text-white">{stats.cardsByPriority.priority}</p>
              </div>
              <div>
                <p className="text-sm text-white/70">With Helpfulness Score</p>
                <p className="text-lg font-semibold text-white">{stats.cardsByHelpfulness.withScore}</p>
              </div>
              <div>
                <p className="text-sm text-white/70">Marked for Merge</p>
                <p className="text-lg font-semibold text-white">{stats.markedForMerge}</p>
              </div>
            </div>
            {Object.keys(stats.cardsByDiscipline).length > 0 && (
              <div className="mt-4">
                <p className="text-sm text-white/70 mb-2">Cards by Discipline</p>
                <div className="flex gap-4">
                  {Object.entries(stats.cardsByDiscipline).map(([discipline, count]) => (
                    <div key={discipline} className="text-white">
                      <span className="font-semibold">{discipline}:</span> {count}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </LiquidGlassCard>
      )}

      {viewMode === 'raw' ? (
        <LiquidGlassCard>
          <h2 className="text-xl font-semibold mb-4 text-white">Raw Database JSON</h2>
          <pre className="bg-black/20 p-4 rounded overflow-auto text-xs text-white">
            {JSON.stringify({ decks, progressTracker: { appData, goals, goalFeedback } }, null, 2)}
          </pre>
        </LiquidGlassCard>
      ) : (
        <div className="space-y-4">
          {/* Decks Section */}
          <LiquidGlassCard>
              <div
                className="p-4 cursor-pointer hover:bg-white/10 transition flex justify-between items-center"
                onClick={() => setExpandedDecksSection(!expandedDecksSection)}
              >
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">Decks</h3>
                  <p className="text-xs text-white/70 mt-1">
                    {decks.length} deck{decks.length !== 1 ? 's' : ''} | {stats?.totalCards || 0} card{stats?.totalCards !== 1 ? 's' : ''}
                  </p>
                </div>
                <button className="text-white/70 hover:text-white">
                  {expandedDecksSection ? '▼' : '▶'}
                </button>
              </div>

              {expandedDecksSection && (
                <div className="border-t border-white/30 p-4">
                  {decks.length === 0 ? (
                    <LiquidGlassCard>
                      <div className="text-center py-6">
                        <p className="text-white">No decks found in database.</p>
                      </div>
                    </LiquidGlassCard>
                  ) : (
                    <div className="space-y-4">
                      {decks.map(deck => {
                const isExpanded = expandedDecks.has(deck.id);
                const sections = deck.sections || [];

                return (
                  <LiquidGlassCard key={deck.id}>
                    <div
                      className="p-4 cursor-pointer hover:bg-white/10 transition flex justify-between items-center"
                      onClick={() => toggleDeck(deck.id)}
                    >
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white">{deck.name}</h3>
                        <div className="flex gap-2 mt-1">
                          {deck.discipline && (
                            <span className="text-xs px-2 py-1 bg-blue-500/30 text-white rounded">
                              {deck.discipline}
                            </span>
                          )}
                          {deck.tags && deck.tags.map(tag => (
                            <span key={tag} className="text-xs px-2 py-1 bg-white/20 text-white rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-white/70 mt-1">
                          ID: {deck.id} | Created: {new Date(deck.createdAt).toLocaleString()} |
                          Updated: {new Date(deck.updatedAt).toLocaleString()}
                        </p>
                        <p className="text-sm text-white/70 mt-1">
                          {sections.length} section{sections.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <button className="text-white/70 hover:text-white">
                        {isExpanded ? '▼' : '▶'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-white/30 p-4">
                        {sections.length === 0 ? (
                          <p className="text-sm text-white/70">No sections in this deck.</p>
                        ) : (
                          <div className="space-y-3">
                            {sections.map(section => {
                              const isSectionExpanded = expandedSections.has(section.id);
                              const sectionCards = getCardsForSection(deck.id, section.id);

                              return (
                                <LiquidGlassCard key={section.id}>
                                  <div
                                    className="p-3 cursor-pointer hover:bg-white/10 transition flex justify-between items-center"
                                    onClick={() => toggleSection(section.id)}
                                  >
                                    <div className="flex-1">
                                      <p className="font-medium text-sm text-white">
                                        {section.title}
                                      </p>
                                      <p className="text-xs text-white/70">
                                        ID: {section.id} | {sectionCards.length} card{sectionCards.length !== 1 ? 's' : ''}
                                      </p>
                                    </div>
                                    <button className="text-white/70 hover:text-white text-xs">
                                      {isSectionExpanded ? '▼' : '▶'}
                                    </button>
                                  </div>

                                  {isSectionExpanded && (
                                    <div className="border-t border-white/30 p-3">
                                      {sectionCards.length === 0 ? (
                                        <p className="text-xs text-white/50 italic">No cards</p>
                                      ) : (
                                        <div className="space-y-2 ml-4">
                                          {sectionCards.map(card => (
                                            <LiquidGlassCard key={card.id}>
                                              <p className="text-white mb-1 text-xs">{card.content}</p>
                                              <div className="flex gap-2 flex-wrap">
                                                {card.priority && (
                                                  <span className="px-1 py-0.5 bg-yellow-500/30 text-yellow-200 rounded text-xs">
                                                    Priority
                                                  </span>
                                                )}
                                                {card.helpfulnessScore > 0 && (
                                                  <span className="px-1 py-0.5 bg-blue-500/30 text-blue-200 rounded text-xs">
                                                    Score: {card.helpfulnessScore}
                                                  </span>
                                                )}
                                                {card.markedForMerge && (
                                                  <span className="px-1 py-0.5 bg-orange-500/30 text-orange-200 rounded text-xs">
                                                    Marked for Merge
                                                  </span>
                                                )}
                                                {card.tags && card.tags.map(tag => (
                                                  <span
                                                    key={tag}
                                                    className="px-1 py-0.5 bg-white/20 text-white rounded text-xs"
                                                  >
                                                    {tag}
                                                  </span>
                                                ))}
                                              </div>
                                              <p className="text-xs text-white/70 mt-1">
                                                ID: {card.id} | Created: {new Date(card.createdAt).toLocaleString()}
                                              </p>
                                            </LiquidGlassCard>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </LiquidGlassCard>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </LiquidGlassCard>
                );
              })}
                    </div>
                  )}
                </div>
              )}
          </LiquidGlassCard>

          {/* Progress Tracker Section */}
          <LiquidGlassCard>
            <div
              className="p-4 cursor-pointer hover:bg-white/10 transition flex justify-between items-center"
              onClick={() => setExpandedProgressTracker(!expandedProgressTracker)}
            >
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">Progress Tracker</h3>
                <p className="text-xs text-white/70 mt-1">
                  {goals.length} goal{goals.length !== 1 ? 's' : ''} | {goalFeedback.length} feedback entr{goalFeedback.length === 1 ? 'y' : 'ies'}
                </p>
              </div>
              <button className="text-white/70 hover:text-white">
                {expandedProgressTracker ? '▼' : '▶'}
              </button>
            </div>

              {expandedProgressTracker && (
                <div className="border-t border-white/30 p-4">
                  {appData && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2 text-white">App Data</h4>
                      <LiquidGlassCard>
                        <p className="text-white text-sm"><strong>Start Date:</strong> {appData.startDate}</p>
                        <p className="text-white text-sm"><strong>Cycle Length:</strong> {appData.cycleLength} weeks</p>
                        <p className="text-xs text-white/70 mt-2">
                          The start date determines which week of the cycle is active. The cycle rotates through Spins, Jumps, and Edges disciplines.
                        </p>
                      </LiquidGlassCard>
                    </div>
                  )}

                  <div className="mb-4">
                    <h4 className="font-medium mb-2 text-white">Goals ({goals.length})</h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {goals.length === 0 ? (
                        <p className="text-sm text-white/50 italic">No goals</p>
                      ) : (
                        goals.map(goal => (
                          <LiquidGlassCard key={goal.id}>
                            <p className="font-medium text-white text-sm">{goal.content}</p>
                            <div className="flex gap-2 mt-1 flex-wrap">
                              <span className="px-2 py-0.5 bg-blue-500/30 text-white rounded text-xs">
                                {goal.discipline}
                              </span>
                              <span className="px-2 py-0.5 bg-white/20 text-white rounded text-xs">
                                {goal.type}
                              </span>
                              {goal.weekStartDate && (
                                <span className="px-2 py-0.5 bg-purple-500/30 text-purple-200 rounded text-xs">
                                  Week: {goal.weekStartDate}
                                </span>
                              )}
                              {goal.archivedAt && (
                                <span className="px-2 py-0.5 bg-white/20 text-white/70 rounded text-xs">
                                  Archived
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-white/70 mt-1">
                              ID: {goal.id} | Created: {new Date(goal.createdAt).toLocaleString()}
                            </p>
                          </LiquidGlassCard>
                        ))
                      )}
                    </div>
                  </div>

                  {goalFeedback.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 text-white">Goal Feedback ({goalFeedback.length})</h4>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {goalFeedback.map((entry) => (
                          <LiquidGlassCard key={entry.id}>
                            <p className="text-white text-sm"><strong>Goal ID:</strong> {entry.goalId}</p>
                            <p className="text-white text-sm"><strong>Container:</strong> {entry.containerId}</p>
                            <p className="text-white text-sm">
                              <strong>Rating:</strong> {entry.rating ? `${entry.rating}/5` : 'Not provided'}
                            </p>
                            {entry.feedback && <p className="text-white text-sm"><strong>Feedback:</strong> {entry.feedback}</p>}
                            <p className="text-white text-sm"><strong>Discipline:</strong> {entry.discipline}</p>
                            {entry.weekStartDate && (
                              <p className="text-white text-sm"><strong>Week:</strong> {entry.weekStartDate}</p>
                            )}
                            <p className="text-xs text-white/70 mt-1">
                              Updated: {new Date(entry.updatedAt).toLocaleString()}
                            </p>
                          </LiquidGlassCard>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
          </LiquidGlassCard>
        </div>
      )}
    </PageLayout>
  );
}
