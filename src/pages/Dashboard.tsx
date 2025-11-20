import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPrioritizedCards, CardWithContext } from '../db/training-coach/search';
import PageLayout from '../components/PageLayout';
import LiquidGlassCard from '../components/LiquidGlassCard';

export default function Dashboard() {
  const [cards, setCards] = useState<CardWithContext[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCards();
  }, []);

  async function loadCards() {
    setLoading(true);
    const prioritized = await getPrioritizedCards({ limit: 20 });
    setCards(prioritized);
    setLoading(false);
  }

  // Aggregate cards by deck
  const priorityByDeck = new Map<string, CardWithContext[]>();
  const helpfulByDeck = new Map<string, CardWithContext[]>();
  const recentByDeck = new Map<string, CardWithContext[]>();

  cards.forEach(item => {
    if (item.priority) {
      const existing = priorityByDeck.get(item.deckId) || [];
      priorityByDeck.set(item.deckId, [...existing, item]);
    } else if (item.helpfulnessScore > 0) {
      const existing = helpfulByDeck.get(item.deckId) || [];
      helpfulByDeck.set(item.deckId, [...existing, item]);
    } else {
      const existing = recentByDeck.get(item.deckId) || [];
      recentByDeck.set(item.deckId, [...existing, item]);
    }
  });

  return (
    <PageLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <Link
          to="/"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          View All Decks
        </Link>
      </div>

      {loading ? (
        <p className="text-white/70">Loading...</p>
      ) : (
        <div className="space-y-8">
          {priorityByDeck.size > 0 && (
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-yellow-400">⭐</span> Priority Content
              </h2>
              <div className="space-y-4">
                {Array.from(priorityByDeck.entries()).map(([deckId, items]) => (
                  <AggregatedDeckCard key={deckId} deckId={deckId} items={items} />
                ))}
              </div>
            </section>
          )}

          {helpfulByDeck.size > 0 && (
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
                <span>⭐</span> Most Helpful
              </h2>
              <div className="space-y-4">
                {Array.from(helpfulByDeck.entries()).map(([deckId, items]) => (
                  <AggregatedDeckCard key={deckId} deckId={deckId} items={items} />
                ))}
              </div>
            </section>
          )}

          {recentByDeck.size > 0 && (
            <section>
              <h2 className="text-2xl font-semibold text-white mb-4">Recent</h2>
              <div className="space-y-4">
                {Array.from(recentByDeck.entries()).map(([deckId, items]) => (
                  <AggregatedDeckCard key={deckId} deckId={deckId} items={items} />
                ))}
              </div>
            </section>
          )}

          {cards.length === 0 && (
            <LiquidGlassCard>
              <div className="text-center py-12">
                <p className="text-lg text-white">No cards yet. Create decks and add cards to see them here!</p>
              </div>
            </LiquidGlassCard>
          )}
        </div>
      )}
    </PageLayout>
  );
}

function AggregatedDeckCard({ deckId, items }: { deckId: string; items: CardWithContext[] }) {
  const deckName = items[0]?.deckName || 'Unknown Deck';
  const sortedItems = [...items].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <LiquidGlassCard>
      <div className="flex justify-between items-start mb-4">
        <Link
          to={`/deck/${deckId}`}
          className="text-lg font-semibold text-white hover:text-white/80"
        >
          {deckName}
        </Link>
        <span className="text-sm text-white/70">{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-3">
        {sortedItems.map((item) => (
          <div key={`${item.sectionId}-${item.id}`} className="border-l-4 border-white/30 pl-3">
            <p className="text-white">{item.content}</p>
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {item.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-xs bg-white/20 text-white rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 mt-1 text-xs text-white/70">
              {item.priority && (
                <span className="px-2 py-0.5 bg-yellow-500/30 text-yellow-200 rounded">Priority</span>
              )}
              {item.helpfulnessScore > 0 && (
                <span>⭐ {item.helpfulnessScore}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </LiquidGlassCard>
  );
}

