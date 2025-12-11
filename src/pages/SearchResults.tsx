import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { searchByMode, searchByText, SearchFilters, CardWithContext } from '../db/training-coach/search';
import { getAllDecks } from '../db/training-coach/operations';
import { Deck } from '../db/training-coach/types';
import PageLayout from '../components/PageLayout';
import LiquidGlassCard from '../components/LiquidGlassCard';
import { logger } from '../utils/logger';

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const [results, setResults] = useState<CardWithContext[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [decks, setDecks] = useState<Deck[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const query = searchParams.get('q') || '';
  const mode = (searchParams.get('mode') || 'text') as 'recent' | 'helpful' | 'priority' | 'text';

  useEffect(() => {
    loadDecks();
  }, []);

  async function loadDecks() {
    const allDecks = await getAllDecks();
    setDecks(allDecks);
  }

  // Filter decks based on selected discipline
  const filteredDecks = filters.discipline
    ? decks.filter(deck => deck.discipline === filters.discipline)
    : decks;

  // Clear deck selection if it doesn't match the discipline
  function handleDisciplineChange(discipline: string) {
    const newDiscipline = (discipline || undefined) as "Spins" | "Jumps" | "Edges" | undefined;
    const selectedDeck = decks.find(d => d.id === filters.deckId);

    // If a deck is selected and it doesn't match the new discipline, clear it
    if (selectedDeck && newDiscipline && selectedDeck.discipline !== newDiscipline) {
      setFilters({
        ...filters,
        discipline: newDiscipline,
        deckId: undefined,
      });
    } else {
      setFilters({
        ...filters,
        discipline: newDiscipline,
      });
    }
  }

  const performSearch = useCallback(async () => {
    setLoading(true);
    try {
      let searchResults: CardWithContext[];

      if (mode === 'text' && query) {
        searchResults = await searchByText(query, filters);
      } else if (mode === 'text' && !query) {
        searchResults = await searchByMode('recent', filters);
      } else if (mode !== 'text') {
        searchResults = await searchByMode(mode, filters);
      } else {
        searchResults = [];
      }

      setResults(searchResults);
    } catch (error) {
      logger.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, [mode, query, filters]);

  useEffect(() => {
    performSearch();
  }, [searchParams, filters, performSearch]);

  return (
    <PageLayout>
      <Link to="/" className="text-white hover:text-white/80 mb-4 inline-block">
        ← Back to Decks
      </Link>

      <h1 className="text-3xl font-bold text-white mb-6">
        {mode === 'text' ? 'Search Results' :
         mode === 'recent' ? 'Most Recent' :
         mode === 'helpful' ? 'Most Helpful' :
         'Priority Content'}
      </h1>

      <div className="mb-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 backdrop-blur-sm"
        >
          {showFilters ? 'Hide' : 'Show'} Filters
        </button>
      </div>

      {showFilters && (
        <LiquidGlassCard className="mb-6">
          <h3 className="font-semibold mb-3 text-white">Filters</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Discipline
                </label>
                <select
                  value={filters.discipline || ''}
                  onChange={(e) => handleDisciplineChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">All</option>
                  <option value="Spins">Spins</option>
                  <option value="Jumps">Jumps</option>
                  <option value="Edges">Edges</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-white mb-1">
                  Deck
                </label>
                <select
                  value={filters.deckId || ''}
                  onChange={(e) => setFilters({
                    ...filters,
                    deckId: e.target.value || undefined,
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  disabled={filters.discipline ? filteredDecks.length === 0 : false}
                >
                  <option value="">All Decks</option>
                  {filteredDecks.map(deck => (
                    <option key={deck.id} value={deck.id}>{deck.name}</option>
                  ))}
                </select>
                {filters.discipline && filteredDecks.length === 0 && (
                  <p className="text-xs text-white/70 mt-1">No decks match this discipline</p>
                )}
              </div>
            </div>
        </LiquidGlassCard>
      )}

      {loading ? (
        <p className="text-white">Loading...</p>
      ) : results.length === 0 ? (
        <LiquidGlassCard>
          <div className="text-center py-12">
            <p className="text-lg text-white">No results found.</p>
          </div>
        </LiquidGlassCard>
      ) : (
        <div className="space-y-4">
          {(() => {
            // First, deduplicate results by card ID to avoid counting the same card multiple times
            const seenCardIds = new Set<string>();
            const uniqueResults = results.filter((item) => {
              const cardKey = `${item.deckId}-${item.sectionId}-${item.id}`;
              if (seenCardIds.has(cardKey)) {
                return false;
              }
              seenCardIds.add(cardKey);
              return true;
            });

            // Aggregate results by deck and section
            const sectionMap = new Map<string, { deckId: string; deckName: string; sectionId: string; sectionTitle: string; count: number }>();

            uniqueResults.forEach((item) => {
              const key = `${item.deckId}-${item.sectionId}`;
              const existing = sectionMap.get(key);
              if (existing) {
                existing.count += 1;
              } else {
                sectionMap.set(key, {
                  deckId: item.deckId,
                  deckName: item.deckName || 'Unknown Deck',
                  sectionId: item.sectionId,
                  sectionTitle: item.sectionTitle || 'Unknown Section',
                  count: 1,
                });
              }
            });

            return Array.from(sectionMap.values()).map((section) => {
              const deckUrl = `/deck/${section.deckId}${query ? `?q=${encodeURIComponent(query)}&section=${encodeURIComponent(section.sectionId)}` : `?section=${encodeURIComponent(section.sectionId)}`}`;

              return (
                <LiquidGlassCard key={`${section.deckId}-${section.sectionId}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-lg font-semibold text-white mb-1">
                        {section.deckName}
                      </p>
                      <p className="text-white">
                        {section.sectionTitle}: {section.count} hit{section.count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Link
                      to={deckUrl}
                      className="text-white hover:text-white/80 underline"
                    >
                      View →
                    </Link>
                  </div>
                </LiquidGlassCard>
              );
            });
          })()}
        </div>
      )}
    </PageLayout>
  );
}

