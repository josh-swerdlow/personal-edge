import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { getAllDecks, createDeck, deleteDeck } from '../db/training-coach/operations';
import { Deck } from '../db/training-coach/types';
import PageLayout from '../components/PageLayout';
import LiquidGlassCard from '../components/LiquidGlassCard';
import { getDeckIconPath } from '../utils/deckIcons';
import { FaEdit, FaTrash } from 'react-icons/fa';

const LONG_PRESS_DURATION = 500;

export default function DeckList() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckTags, setNewDeckTags] = useState('');
  const [newDeckDiscipline, setNewDeckDiscipline] = useState<'Spins' | 'Jumps' | 'Edges' | ''>('');
  const [disciplineFilter, setDisciplineFilter] = useState<'all' | 'Spins' | 'Jumps' | 'Edges'>('all');
  const [showDeckMenu, setShowDeckMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [mouseDownTimer, setMouseDownTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [modalPosition, setModalPosition] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    loadDecks();
  }, []);

  async function loadDecks() {
    const allDecks = await getAllDecks();
    setDecks(allDecks);
  }

  async function handleCreateDeck(e: React.FormEvent) {
    e.preventDefault();
    if (!newDeckName.trim()) return;

    const tags = newDeckTags.split(',').map(t => t.trim()).filter(t => t);
    await createDeck({
      name: newDeckName.trim(),
      tags: tags.length > 0 ? tags : undefined,
      discipline: newDeckDiscipline || undefined,
    });

    setNewDeckName('');
    setNewDeckTags('');
    setNewDeckDiscipline('');
    setShowCreateModal(false);
    setModalPosition(null);
    await loadDecks();
  }

  async function handleDeleteDeck(id: string) {
    if (confirm('Are you sure you want to delete this deck? All cards will be deleted.')) {
      await deleteDeck(id);
      await loadDecks();
    }
  }

  const filteredDecks = useMemo(() => {
    if (disciplineFilter === 'all') return decks;
    return decks.filter(deck => deck.discipline === disciplineFilter);
  }, [decks, disciplineFilter]);

  const closeDeckMenu = () => {
    setShowDeckMenu(null);
    setMenuPosition(null);
  };

  const handleDeckContextMenu = (e: React.MouseEvent, deckId: string) => {
    e.preventDefault();
    setShowDeckMenu(deckId);
    setMenuPosition({ x: e.clientX, y: e.clientY });
  };

  const handleDeckMouseDown = (e: React.MouseEvent, deckId: string) => {
    const timer = setTimeout(() => {
      setShowDeckMenu(deckId);
      setMenuPosition({ x: e.clientX, y: e.clientY });
    }, LONG_PRESS_DURATION);
    setMouseDownTimer(timer);
  };

  const handleDeckMouseUp = () => {
    if (mouseDownTimer) {
      clearTimeout(mouseDownTimer);
      setMouseDownTimer(null);
    }
  };

  const handleDeckMouseMove = () => {
    if (mouseDownTimer) {
      clearTimeout(mouseDownTimer);
      setMouseDownTimer(null);
    }
  };

  function handleOpenModal() {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const modalWidth = Math.min(448, viewportWidth - 32); // max-w-md (448px) or viewport - margins
      const estimatedModalHeight = 400; // Approximate modal height

      // Calculate left position: align right edge of modal with right edge of button
      // But ensure it doesn't go off screen
      let left = rect.right - modalWidth;
      if (left < 16) {
        left = 16; // Minimum margin from screen edge
      }
      if (left + modalWidth > viewportWidth - 16) {
        left = viewportWidth - modalWidth - 16; // Ensure it fits on screen
      }

      // Calculate top position: below button, but ensure it doesn't go off screen
      let top = rect.bottom + 8; // 8px gap below button
      if (top + estimatedModalHeight > viewportHeight - 16) {
        // If modal would go off bottom, position it above button instead
        top = rect.top - estimatedModalHeight - 8;
        if (top < 16) {
          // If still doesn't fit, center it vertically
          top = Math.max(16, (viewportHeight - estimatedModalHeight) / 2);
        }
      }

      setModalPosition({
        top: top,
        left: left,
        width: modalWidth,
      });
    }
    setShowCreateModal(true);
  }

  return (
    <PageLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-white">Decks</h1>
        <div className="flex items-center gap-3">
          {/* Discipline Filter */}
          <div className="flex items-center gap-2">
            <label className="text-white text-sm">Filter:</label>
            <select
              value={disciplineFilter}
              onChange={(e) => setDisciplineFilter(e.target.value as 'all' | 'Spins' | 'Jumps' | 'Edges')}
              className="px-3 py-1 bg-black/30 backdrop-blur-sm border border-white/30 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="Spins">Spins</option>
              <option value="Jumps">Jumps</option>
              <option value="Edges">Edges</option>
            </select>
          </div>
          <button
            ref={buttonRef}
            onClick={handleOpenModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + New Deck
          </button>
        </div>
      </div>

      {filteredDecks.length === 0 ? (
        <LiquidGlassCard>
          <div className="text-center py-12">
            <p className="text-lg text-white">No decks yet. Create your first deck to get started!</p>
          </div>
        </LiquidGlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDecks.map(deck => {
            // Filter out Core Reminders section (it contains duplicates)
            const sectionsWithoutCoreReminders = deck.sections?.filter(s => s.title !== 'Core Reminders') || [];
            const totalCards = sectionsWithoutCoreReminders.reduce((sum, section) => sum + (section.cards?.length || 0), 0);
            const cardCountsBySection = sectionsWithoutCoreReminders.map(section => ({
              title: section.title,
              count: section.cards?.length || 0,
            }));

            return (
              <div
                key={deck.id}
                onContextMenu={(e: React.MouseEvent) => handleDeckContextMenu(e, deck.id)}
                onMouseDown={(e: React.MouseEvent) => handleDeckMouseDown(e, deck.id)}
                onMouseUp={handleDeckMouseUp}
                onMouseMove={handleDeckMouseMove}
                onMouseLeave={handleDeckMouseUp}
              >
              <LiquidGlassCard>
                <div className="flex flex-col h-full min-h-[200px]">
                  {/* Top Section: Title and Icon */}
                  <div className="flex justify-between items-start mb-3 relative">
                    <div className="flex-1 min-w-0 pr-3">
                      <Link
                        to={`/deck/${deck.id}`}
                        className="text-2xl font-bold text-white hover:text-white/80 block"
                      >
                        {deck.name}
                      </Link>
                    </div>
                    {/* Animal Icon - Top Right */}
                    {deck.animal && (
                      <div className="absolute top-0 right-0">
                        <img
                          src={getDeckIconPath(deck.animal, deck.discipline, deck.sections?.[0]?.title || 'Reminders')}
                          alt={deck.animal}
                          className="w-12 h-12 flex-shrink-0"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Middle Section: Card Counts and Tags */}
                  {cardCountsBySection.length > 0 && (
                    <div className="mb-2 flex-1">
                      <div className="flex flex-wrap gap-1 mb-2">
                        {cardCountsBySection.map(({ title, count }) => (
                          <span
                            key={title}
                            className="px-2 py-0.5 text-xs bg-white/10 text-white/80 rounded"
                          >
                            {title}: {count}
                          </span>
                        ))}
                      </div>
                      <p className="text-xs text-white/60">Total: {totalCards} cards</p>
                    </div>
                  )}

                  {deck.tags && deck.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {deck.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-1 text-xs bg-white/20 text-white rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Footer Section: Discipline (left) and Updated (right) */}
                  <div className="flex justify-between items-end mt-auto pt-2 border-t border-white/20">
                    {deck.discipline && (
                      <span className="inline-block px-2 py-1 text-xs bg-blue-500/30 text-white rounded">
                        {deck.discipline}
                      </span>
                    )}
                    <p className="text-sm text-white/70">
                      Updated: {deck.updatedAt ? new Date(deck.updatedAt).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Context Menu */}
                {showDeckMenu === deck.id && menuPosition && (
                  <>
                    <div
                      className="fixed inset-0 z-50"
                      onClick={closeDeckMenu}
                      onTouchStart={closeDeckMenu}
                    />
                    <div
                      className="fixed z-50 bg-white rounded-lg shadow-xl border-2 border-gray-300 p-2 min-w-[150px]"
                      style={{
                        left: `${Math.min(menuPosition.x, typeof window !== 'undefined' ? window.innerWidth - 170 : menuPosition.x)}px`,
                        top: `${Math.max(menuPosition.y - 80, 10)}px`,
                      }}
                    >
                      <div className="flex flex-col gap-1">
                        <button
                          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm"
                          onClick={() => {
                            // TODO: Implement edit deck functionality
                            closeDeckMenu();
                          }}
                        >
                          <FaEdit className="text-blue-600" />
                          <span>Edit</span>
                        </button>
                        <button
                          className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm"
                          onClick={() => {
                            handleDeleteDeck(deck.id);
                            closeDeckMenu();
                          }}
                        >
                          <FaTrash className="text-red-600" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </LiquidGlassCard>
              </div>
            );
          })}
        </div>
      )}

        {showCreateModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => {
              setShowCreateModal(false);
              setModalPosition(null);
            }}
          >
            <div
              className="bg-white rounded-lg p-4 sm:p-6 max-w-md absolute"
              style={modalPosition ? {
                top: `${modalPosition.top}px`,
                left: `${modalPosition.left}px`,
                right: 'auto',
                transform: 'none',
                width: `${modalPosition.width}px`,
                maxWidth: 'calc(100vw - 32px)',
              } : {
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'calc(100% - 2rem)',
                maxWidth: '28rem',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl sm:text-2xl font-bold mb-4" style={{ fontSize: 'clamp(1.25rem, 5vw, 1.5rem)' }}>
                Create New Deck
              </h2>
              <form onSubmit={handleCreateDeck}>
                {/* Deck Name */}
                <div className="mb-4">
                  <label className="block font-medium text-gray-700 mb-1" style={{ fontSize: 'clamp(0.875rem, 4vw, 1rem)' }}>
                    Deck Name *
                  </label>
                  <input
                    type="text"
                    value={newDeckName}
                    onChange={(e) => setNewDeckName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ fontSize: 'clamp(1rem, 4vw, 1.125rem)' }}
                    placeholder="e.g., Backspin"
                    autoFocus
                  />
                </div>
                {/* Tags */}
                <div className="mb-4">
                  <label className="block font-medium text-gray-700 mb-1" style={{ fontSize: 'clamp(0.875rem, 4vw, 1rem)' }}>
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newDeckTags}
                    onChange={(e) => setNewDeckTags(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ fontSize: 'clamp(1rem, 4vw, 1.125rem)' }}
                    placeholder="e.g., spin, beginner"
                  />
                </div>
                {/* Discipline */}
                <div className="mb-4">
                  <label className="block font-medium text-gray-700 mb-1" style={{ fontSize: 'clamp(0.875rem, 4vw, 1rem)' }}>
                    Discipline
                  </label>
                  <select
                    value={newDeckDiscipline}
                    onChange={(e) => setNewDeckDiscipline(e.target.value as "Spins" | "Jumps" | "Edges" | "")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ fontSize: 'clamp(1rem, 4vw, 1.125rem)' }}
                  >
                    <option value="">None</option>
                    <option value="Spins">Spins</option>
                    <option value="Jumps">Jumps</option>
                    <option value="Edges">Edges</option>
                  </select>
                </div>
                {/* Buttons */}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setModalPosition(null);
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                    style={{ fontSize: 'clamp(0.875rem, 4vw, 1rem)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    style={{ fontSize: 'clamp(0.875rem, 4vw, 1rem)' }}
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
    </PageLayout>
  );
}

