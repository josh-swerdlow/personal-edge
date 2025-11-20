import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getDeckWithSections } from '../db/training-coach/operations';
import { Deck } from '../db/training-coach/types';
import DeckCardView from '../components/DeckCardView';

export default function TestDecksPage() {
  const { deckId } = useParams<{ deckId?: string }>();
  const [deck, setDeck] = useState<Deck | null>(null);

  // Load deck if deckId is provided
  useEffect(() => {
    if (deckId) {
      getDeckWithSections(deckId).then((deck) => {
        setDeck(deck || null);
      });
    } else {
      // Use mock data if no deckId
      setDeck({
        id: 'test-deck-1',
        name: 'Backspin',
        tags: ['spin', 'beginner'],
        discipline: 'Spins',
        animal: 'bee', // Mock animal for testing
        createdAt: Date.now() - 86400000 * 30,
        updatedAt: Date.now(),
        sections: [
          {
            id: 'section-1',
            title: 'Reminders',
            cards: [
              {
                id: 'card-1',
                sectionId: 'section-1',
                content: 'Keep your head up and look forward',
                tags: ['posture', 'head'],
                helpfulnessScore: 5,
                priority: true,
                markedForMerge: false,
                createdAt: Date.now() - 86400000 * 5,
              },
              {
                id: 'card-2',
                sectionId: 'section-1',
                content: 'Bend your knees slightly',
                tags: ['posture', 'knees'],
                helpfulnessScore: 3,
                priority: false,
                markedForMerge: false,
                createdAt: Date.now() - 86400000 * 3,
              },
              {
                id: 'card-3',
                sectionId: 'section-1',
                content: 'Pull arms in tight to center',
                tags: ['arms', 'position'],
                helpfulnessScore: 7,
                priority: true,
                markedForMerge: false,
                createdAt: Date.now() - 86400000 * 2,
              },
            ],
          },
          {
            id: 'section-2',
            title: 'Troubleshooting',
            cards: [
              {
                id: 'card-4',
                sectionId: 'section-2',
                content: 'If spinning too fast, check entry speed',
                tags: ['speed', 'entry'],
                helpfulnessScore: 4,
                priority: false,
                markedForMerge: false,
                createdAt: Date.now() - 86400000 * 7,
              },
              {
                id: 'card-5',
                sectionId: 'section-2',
                content: 'Wobbling usually means off-center',
                tags: ['balance', 'center'],
                helpfulnessScore: 6,
                priority: false,
                markedForMerge: false,
                createdAt: Date.now() - 86400000 * 4,
              },
            ],
          },
          {
            id: 'section-3',
            title: 'Theory',
            cards: [
              {
                id: 'card-6',
                sectionId: 'section-3',
                content: 'Conservation of angular momentum',
                tags: ['physics', 'theory'],
                helpfulnessScore: 2,
                priority: false,
                markedForMerge: false,
                createdAt: Date.now() - 86400000 * 10,
              },
            ],
          },
        ],
      });
    }
  }, [deckId]);

  if (!deck) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <p className="text-white/70">Loading...</p>
      </div>
    );
  }

  // Check if deck has any cards
  const hasCards = deck.sections.some(s => s.cards.length > 0);

  return (
    <div className="fixed inset-0 overflow-hidden">
      {/* Background Image - same as other pages */}
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

      {/* Card View Container - Account for nav bar */}
      <div
        className="w-full relative"
        style={{
          height: 'calc(100svh - 80px)',
          marginTop: '80px',
          zIndex: 1,
        }}
      >
        {hasCards ? (
          <DeckCardView deck={deck} />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-white/70 text-lg">No cards available</p>
          </div>
        )}
      </div>
    </div>
  );
}

