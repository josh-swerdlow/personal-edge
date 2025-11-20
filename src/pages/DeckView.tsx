import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getDeckWithSections, addCardToSection, updateCard, deleteCard, getAllCards } from '../db/training-coach/operations';
import { Deck, Card } from '../db/training-coach/types';
import CreateCardModal from '../components/CreateCardModal';
import EditCardModal from '../components/EditCardModal';
import DeckCardView from '../components/DeckCardView';
import PageLayout from '../components/PageLayout';
import DeckViewSettingsBar from '../components/DeckViewSettingsBar';
import { similarity } from '../utils/fuzzyMatch';

export default function DeckView() {
  const { deckId } = useParams<{ deckId: string }>();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const sectionFilter = searchParams.get('section') || '';
  const cardIdParam = searchParams.get('cardId') || '';
  const filterModeParam = searchParams.get('filterMode') as 'all' | 'recent' | 'helpful' | 'priority' | null;
  const [deck, setDeck] = useState<Deck | null>(null);
  const [createCardModalOpen, setCreateCardModalOpen] = useState(false);
  const [createCardSectionId, setCreateCardSectionId] = useState<string | null>(null);
  const [editCardModalOpen, setEditCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<{ card: Card; sectionId: string; sectionTitle: string } | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'recent' | 'helpful' | 'priority'>(filterModeParam || 'all');
  const [initialCardIndex, setInitialCardIndex] = useState<number>(0);
  const [allCards, setAllCards] = useState<Array<{
    content: string;
    deckId: string;
    sectionId: string;
    id: string;
    helpfulnessScore: number;
    deckName?: string;
    createdAt?: number;
    sectionTitle?: string;
    tags?: string[];
  }>>([]);

  const loadDeck = useCallback(async () => {
    if (!deckId) return;
    console.log('[DeckView] Loading deck:', deckId);
    try {
      const deckData = await getDeckWithSections(deckId);
      if (deckData) {
        console.log('[DeckView] Deck loaded:', {
          id: deckData.id,
          name: deckData.name,
          sectionsCount: deckData.sections?.length || 0
        });
        setDeck(deckData);
      } else {
        console.error('[DeckView] Deck not found:', deckId);
      }
    } catch (error) {
      console.error('[DeckView] Error loading deck:', error);
    }
  }, [deckId]);

  useEffect(() => {
    loadDeck();
  }, [loadDeck]);

  // Set filter mode from URL parameter
  useEffect(() => {
    if (filterModeParam) {
      setFilterMode(filterModeParam);
    }
  }, [filterModeParam]);

  useEffect(() => {
    if (deck) {
      loadAllCards();
    }
  }, [deck]);

  async function loadAllCards() {
    const cards = await getAllCards();
    const decks = await (await import('../db/training-coach/operations')).getAllDecks();
    const deckMap = new Map(decks.map(d => [d.id, d.name]));

    const cardsWithLocation = cards.map(c => ({
      content: c.content,
      deckId: c.deckId,
      sectionId: c.sectionId,
      id: c.id,
      helpfulnessScore: c.helpfulnessScore,
      deckName: deckMap.get(c.deckId),
      createdAt: c.createdAt,
      sectionTitle: c.sectionTitle,
      tags: c.tags,
    }));

    setAllCards(cardsWithLocation);
  }

  async function handleCreateCard(content: string, tags: string[], sectionId: string, onIce: boolean | null, createdAt?: number) {
    if (!deck || !deckId) return;

    // Add on-ice/off-ice tag if specified
    const allTags = [...tags];
    if (onIce !== null) {
      allTags.push(onIce ? 'on-ice' : 'off-ice');
    }

    await addCardToSection(deckId, sectionId, {
      content: content.trim(),
      tags: allTags.length > 0 ? allTags : undefined,
      helpfulnessScore: 0,
      priority: false,
      markedForMerge: false,
      createdAt: createdAt, // Use provided date or let addCardToSection use default
    });

    await loadAllCards();
    await loadDeck();
    setCreateCardModalOpen(false);
    setCreateCardSectionId(null);
  }

  async function handleEditCard(card: Card, sectionId: string, sectionTitle: string) {
    setEditingCard({ card, sectionId, sectionTitle });
    setEditCardModalOpen(true);
  }

  async function handleSaveEditCard(
    content: string,
    tags: string[],
    newSectionId: string,
    priority: boolean,
    helpfulnessScore: number
  ) {
    if (!deckId || !editingCard) return;

    // If section changed, we need to move the card
    if (newSectionId !== editingCard.sectionId) {
      // For now, just update in place - moving cards between sections would require moveCard operation
      // This is a simplified version - you might want to implement moveCard later
      await updateCard(deckId, editingCard.sectionId, editingCard.card.id, {
        content,
        tags,
        priority,
        helpfulnessScore,
      });
    } else {
      await updateCard(deckId, editingCard.sectionId, editingCard.card.id, {
        content,
        tags,
        priority,
        helpfulnessScore,
      });
    }

    await loadDeck();
    await loadAllCards();
    setEditCardModalOpen(false);
    setEditingCard(null);
  }

  async function handleDeleteEditCard() {
    if (!deckId || !editingCard) return;
    await deleteCard(deckId, editingCard.sectionId, editingCard.card.id);
    await loadDeck();
    await loadAllCards();
    setEditCardModalOpen(false);
    setEditingCard(null);
  }

  async function handleTogglePriority(card: Card, sectionId: string) {
    if (!deckId) return;
    await updateCard(deckId, sectionId, card.id, {
      priority: !card.priority,
    });
    await loadDeck();
    await loadAllCards();
  }

  async function handleDeleteCard(card: Card, sectionId: string) {
    if (!deckId) return;
    await deleteCard(deckId, sectionId, card.id);
    await loadDeck();
    await loadAllCards();
  }

  async function handleIncreaseHelpfulness(card: Card, sectionId: string) {
    if (!deckId) return;
    await updateCard(deckId, sectionId, card.id, {
      helpfulnessScore: Math.max(0, card.helpfulnessScore + 1),
      lastUpvotedAt: Date.now(),
    });
    await loadDeck();
    await loadAllCards();
  }

  async function handleDecreaseHelpfulness(card: Card, sectionId: string) {
    if (!deckId) return;
    await updateCard(deckId, sectionId, card.id, {
      helpfulnessScore: Math.max(0, card.helpfulnessScore - 1),
      lastUpvotedAt: Date.now(),
    });
    await loadDeck();
    await loadAllCards();
  }

  // Filter out Core Reminders section (we use priority filter instead)
  // This is done in filteredDeck useMemo below

  // Filter cards based on filterMode, search query, and section filter before passing to DeckCardView (must be before early return)
  const filteredDeck = useMemo(() => {
    if (!deck || !deck.sections) return deck || null;

    // Filter out Core Reminders section (we use priority filter instead)
    let sectionsToProcess = deck.sections.filter(s => s.title !== 'Core Reminders');

    // Filter to specific section if section parameter is provided
    if (sectionFilter) {
      sectionsToProcess = sectionsToProcess.filter(s => s.id === sectionFilter);
    }

    const filteredSections = sectionsToProcess.map(section => {
      const cards = section.cards || [];
      let filteredCards = cards;

      // Apply search query filter if present
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase();
        filteredCards = filteredCards.filter(c => {
          const contentMatch = c.content.toLowerCase().includes(queryLower);
          const tagMatch = c.tags?.some(tag => tag.toLowerCase().includes(queryLower));
          const fuzzyMatch = similarity(searchQuery, c.content) >= 60;
          return contentMatch || tagMatch || fuzzyMatch;
        });
      }

      // Apply filter mode
      if (filterMode === 'recent') {
        filteredCards = [...filteredCards].sort((a, b) => b.createdAt - a.createdAt);
      } else if (filterMode === 'helpful') {
        filteredCards = [...filteredCards].sort((a, b) => {
          if (b.helpfulnessScore !== a.helpfulnessScore) {
            return b.helpfulnessScore - a.helpfulnessScore;
          }
          return (b.lastUpvotedAt || b.createdAt) - (a.lastUpvotedAt || a.createdAt);
        });
      } else if (filterMode === 'priority') {
        // Filter to priority cards, but exclude Troubleshooting and Theory sections
        filteredCards = filteredCards.filter(c => {
          const isRestricted = section.title === 'Troubleshooting' || section.title === 'Theory';
          return c.priority && !isRestricted;
        }).sort((a, b) => {
          if (b.helpfulnessScore !== a.helpfulnessScore) {
            return b.helpfulnessScore - a.helpfulnessScore;
          }
          return (b.lastUpvotedAt || b.createdAt) - (a.lastUpvotedAt || a.createdAt);
        });
      }

      return {
        ...section,
        cards: filteredCards,
      };
    });

    return {
      ...deck,
      sections: filteredSections,
    };
  }, [deck, filterMode, searchQuery, sectionFilter]);

  // Check if deck has any cards (must be before early return)
  const hasCards = filteredDeck?.sections?.some(s => (s.cards || []).length > 0) || false;

  // Find card index when cardId is provided
  useEffect(() => {
    if (cardIdParam && filteredDeck) {
      let globalIndex = 0;
      for (const section of filteredDeck.sections || []) {
        for (const card of section.cards || []) {
          if (card.id === cardIdParam) {
            setInitialCardIndex(globalIndex);
            return;
          }
          globalIndex++;
        }
      }
    }
  }, [cardIdParam, filteredDeck]);

  const handleCreateCardClick = () => {
    // Open modal to select section
    if (!deck) return;
    const firstSection = deck.sections.find(s => s.title !== 'Core Reminders');
    if (firstSection) {
      setCreateCardSectionId(firstSection.id);
      setCreateCardModalOpen(true);
    }
  };

  if (!deck) {
    return (
      <PageLayout>
        <p className="text-white/70">Loading...</p>
      </PageLayout>
    );
  }

  return (
    <>
      {/* Deck View Settings Bar */}
      <DeckViewSettingsBar
        filterMode={filterMode}
        onFilterChange={setFilterMode}
        onCreateCard={handleCreateCardClick}
        deckName={deck.name}
      />

      <PageLayout hasSettingsBar={true}>

        {/* Section: Card View Container */}
        <div
          className="w-full relative"
          style={{
            height: 'calc(100svh - var(--deck-navbar-height) - var(--deck-settings-bar-height) - var(--deck-bottom-margin))',
            marginBottom: '32px', // Bottom margin so cards don't touch bottom
          }}
        >
        {hasCards && filteredDeck ? (
          <DeckCardView
            deck={filteredDeck}
            searchQuery={searchQuery}
            initialCardIndex={initialCardIndex}
            onEditCard={handleEditCard}
            onTogglePriority={handleTogglePriority}
            onDeleteCard={handleDeleteCard}
            onIncreaseHelpfulness={handleIncreaseHelpfulness}
            onDecreaseHelpfulness={handleDecreaseHelpfulness}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-white/70 text-lg mb-4">
                {searchQuery ? `No cards match "${searchQuery}" in this deck.` : 'No cards in this deck yet.'}
              </p>
              <button
                onClick={() => {
                  const firstSection = deck.sections[0];
                  if (firstSection) {
                    setCreateCardSectionId(firstSection.id);
                    setCreateCardModalOpen(true);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors"
              >
                Create First Card
              </button>
            </div>
          </div>
        )}
        </div>

        {/* Create Card Modal */}
      {createCardSectionId && deck && (
        <CreateCardModal
          isOpen={createCardModalOpen}
          onClose={() => {
            setCreateCardModalOpen(false);
            setCreateCardSectionId(null);
          }}
          sectionTitle={deck.sections.find(s => s.id === createCardSectionId)?.title || ''}
          sectionId={createCardSectionId}
          sections={deck.sections.map(s => ({ id: s.id, title: s.title }))}
          deckDiscipline={deck.discipline}
          onSave={handleCreateCard}
          allCards={allCards}
        />
      )}

      {/* Edit Card Modal */}
      {editingCard && deck && (
        <EditCardModal
          isOpen={editCardModalOpen}
          onClose={() => {
            setEditCardModalOpen(false);
            setEditingCard(null);
          }}
          card={editingCard.card}
          sectionTitle={editingCard.sectionTitle}
          sectionId={editingCard.sectionId}
          sections={deck.sections.map(s => ({ id: s.id, title: s.title }))}
          deckDiscipline={deck.discipline}
          onSave={handleSaveEditCard}
          onDelete={handleDeleteEditCard}
          allCards={allCards}
        />
      )}
      </PageLayout>
    </>
  );
}
