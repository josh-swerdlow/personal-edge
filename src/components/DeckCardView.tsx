import { useState, useRef, useMemo, useEffect, ReactNode } from 'react';
import { Deck, Card } from '../db/training-coach/types';
import { getDeckIconPath } from '../utils/deckIcons';
import { FaEdit, FaTrash, FaExclamationCircle } from 'react-icons/fa';

interface UnifiedCard {
  card: Card;
  sectionId: string;
  sectionTitle: string;
  globalIndex: number;
  sectionIndex: number;
}

const SWIPE_THRESHOLD = 50;
const SCROLL_THRESHOLD = 10;
const LONG_PRESS_DURATION = 500;

// Section colors for styling
const sectionColors: Record<string, string> = {
  'Reminders': 'text-black',
  'Troubleshooting': 'text-black',
  'Theory': 'text-black',
  'Core Reminders': 'text-black',
};

interface DeckCardViewProps {
  deck: Deck;
  searchQuery?: string;
  onCardChange?: (cardIndex: number) => void;
  initialCardIndex?: number;
  onEditCard?: (card: Card, sectionId: string, sectionTitle: string) => void;
  onTogglePriority?: (card: Card, sectionId: string) => Promise<void>;
  onDeleteCard?: (card: Card, sectionId: string) => Promise<void>;
  onIncreaseHelpfulness?: (card: Card, sectionId: string) => Promise<void>;
  onDecreaseHelpfulness?: (card: Card, sectionId: string) => Promise<void>;
}

export default function DeckCardView({
  deck,
  searchQuery = '',
  onCardChange,
  initialCardIndex = 0,
  onEditCard,
  onTogglePriority,
  onDeleteCard,
  onIncreaseHelpfulness,
  onDecreaseHelpfulness,
}: DeckCardViewProps) {
  const [currentGlobalIndex, setCurrentGlobalIndex] = useState(initialCardIndex);
  const [swipeStart, setSwipeStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [cardOffset, setCardOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [mouseDownTimer, setMouseDownTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [showEditMenu, setShowEditMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  const unifiedCards = useMemo<UnifiedCard[]>(() => {
    if (!deck || !deck.sections) return [];
    let globalIndex = 0;
    return deck.sections.flatMap(section =>
      (section.cards || []).map((card, sectionIndex) => ({
        card,
        sectionId: section.id,
        sectionTitle: section.title,
        globalIndex: globalIndex++,
        sectionIndex,
      }))
    );
  }, [deck]);

  const currentCard = unifiedCards[currentGlobalIndex] || unifiedCards[0];

  // Reset index if it's out of bounds
  useEffect(() => {
    if (unifiedCards.length > 0 && currentGlobalIndex >= unifiedCards.length) {
      setCurrentGlobalIndex(0);
    }
  }, [unifiedCards.length, currentGlobalIndex]);

  // Notify parent of card change
  useEffect(() => {
    if (onCardChange) {
      onCardChange(currentGlobalIndex);
    }
  }, [currentGlobalIndex, onCardChange]);

  // Get section boundaries for navigation
  const getSectionBoundaries = (sectionId: string) => {
    const startIndex = unifiedCards.findIndex(uc => uc.sectionId === sectionId);
    let endIndex = startIndex;
    for (let i = unifiedCards.length - 1; i >= 0; i--) {
      if (unifiedCards[i].sectionId === sectionId) {
        endIndex = i;
        break;
      }
    }
    return { startIndex, endIndex };
  };

  // Prevent body scroll
  useEffect(() => {
    if (cardContainerRef.current) {
      const container = cardContainerRef.current;
      const preventScroll = (e: TouchEvent) => {
        if (!isScrolling) {
          e.preventDefault();
        }
      };
      container.addEventListener('touchmove', preventScroll, { passive: false });
      return () => {
        container.removeEventListener('touchmove', preventScroll);
      };
    }
  }, [isScrolling]);

  const triggerFeedback = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);
  };

  // Navigate to next/previous card (only within current section)
  const navigateCard = (direction: 'next' | 'prev'): boolean => {
    if (!currentCard) {
      triggerFeedback();
      return false;
    }

    const { startIndex, endIndex } = getSectionBoundaries(currentCard.sectionId);

    if (direction === 'next') {
      if (currentGlobalIndex < endIndex) {
        setCurrentGlobalIndex(currentGlobalIndex + 1);
        return true;
      }
    } else {
      if (currentGlobalIndex > startIndex) {
        setCurrentGlobalIndex(currentGlobalIndex - 1);
        return true;
      }
    }
    triggerFeedback();
    return false;
  };

  // Navigate to next/previous section
  const navigateSection = (direction: 'next' | 'prev'): boolean => {
    if (!currentCard || !deck) {
      triggerFeedback();
      return false;
    }

    const currentSectionIndex = deck.sections.findIndex(s => s.id === currentCard.sectionId);
    let targetSectionIndex: number;

    if (direction === 'next') {
      targetSectionIndex = currentSectionIndex < deck.sections.length - 1
        ? currentSectionIndex + 1
        : 0; // Wrap to first
    } else {
      targetSectionIndex = currentSectionIndex > 0
        ? currentSectionIndex - 1
        : deck.sections.length - 1; // Wrap to last
    }

    const targetSection = deck.sections[targetSectionIndex];
    const { startIndex } = getSectionBoundaries(targetSection.id);
    setCurrentGlobalIndex(startIndex);
    return true;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setSwipeStart({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    });
    setIsScrolling(false);
    setIsDragging(true);
    setCardOffset({ x: 0, y: 0 });

    // Start long press timer
    if (currentCard) {
      const timer = setTimeout(() => {
        if (currentCard) {
          setShowEditMenu(currentCard.card.id);
          setMenuPosition({ x: touch.clientX, y: touch.clientY });
        }
      }, LONG_PRESS_DURATION);
      setLongPressTimer(timer);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeStart || !isDragging) return;

    // Cancel long press if user moves finger
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    const touch = e.touches[0];
    const deltaX = touch.clientX - swipeStart.x;
    const deltaY = touch.clientY - swipeStart.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const timeDelta = Date.now() - swipeStart.time;

    // Update card position for visual feedback
    setCardOffset({ x: deltaX, y: deltaY });

    // Determine if this is a scroll or swipe
    const isLargeVerticalMovement = absDeltaY > SWIPE_THRESHOLD;
    const isSmallSlowVertical = absDeltaY > SCROLL_THRESHOLD && absDeltaY > absDeltaX && absDeltaY < SWIPE_THRESHOLD && timeDelta > 200;

    if (isSmallSlowVertical) {
      setIsScrolling(true);
      return;
    }

    // If movement is significant, it's a swipe - prevent scroll
    if (absDeltaX > SCROLL_THRESHOLD || isLargeVerticalMovement) {
      setIsScrolling(false);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Clear long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    setIsDragging(false);

    // If we were scrolling, don't process swipe
    if (isScrolling || !swipeStart) {
      setSwipeStart(null);
      setIsScrolling(false);
      setCardOffset({ x: 0, y: 0 });
      return;
    }

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - swipeStart.x;
    const deltaY = touch.clientY - swipeStart.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const timeDelta = Date.now() - swipeStart.time;

    // Only process fast swipes (not slow drags)
    if (timeDelta > 300) {
      setSwipeStart(null);
      setIsScrolling(false);
      setCardOffset({ x: 0, y: 0 });
      return;
    }

    // Determine swipe direction
    if (absDeltaX > SWIPE_THRESHOLD || absDeltaY > SWIPE_THRESHOLD) {
      e.preventDefault();
      e.stopPropagation();
      if (absDeltaX > absDeltaY) {
        // Horizontal swipe - navigate cards
        if (deltaX < 0) {
          navigateCard('next'); // Swipe left = next
        } else {
          navigateCard('prev'); // Swipe right = previous
        }
      } else {
        // Vertical swipe - navigate sections
        if (deltaY < 0) {
          navigateSection('next'); // Swipe up = next section
        } else {
          navigateSection('prev'); // Swipe down = previous section
        }
      }
    }

    setSwipeStart(null);
    setIsScrolling(false);
    setCardOffset({ x: 0, y: 0 });
  };

  // Mouse handlers for desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    setSwipeStart({
      x: e.clientX,
      y: e.clientY,
      time: Date.now()
    });
    setIsDragging(true);
    setCardOffset({ x: 0, y: 0 });

    // Start long press timer for mouse
    if (currentCard) {
      const timer = setTimeout(() => {
        if (currentCard) {
          setShowEditMenu(currentCard.card.id);
          setMenuPosition({ x: e.clientX, y: e.clientY });
        }
      }, LONG_PRESS_DURATION);
      setMouseDownTimer(timer);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!swipeStart || !isDragging) return;

    // Cancel long press if mouse moves
    if (mouseDownTimer) {
      clearTimeout(mouseDownTimer);
      setMouseDownTimer(null);
    }

    const deltaX = e.clientX - swipeStart.x;
    const deltaY = e.clientY - swipeStart.y;
    setCardOffset({ x: deltaX, y: deltaY });
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    // Clear long press timer
    if (mouseDownTimer) {
      clearTimeout(mouseDownTimer);
      setMouseDownTimer(null);
    }

    if (!swipeStart) return;
    setIsDragging(false);

    const deltaX = e.clientX - swipeStart.x;
    const deltaY = e.clientY - swipeStart.y;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const timeDelta = Date.now() - swipeStart.time;

    if (timeDelta < 300) {
      if (absDeltaX > SWIPE_THRESHOLD || absDeltaY > SWIPE_THRESHOLD) {
        if (absDeltaX > absDeltaY) {
          // Horizontal movement - navigate cards
          if (deltaX < 0) {
            navigateCard('next');
          } else {
            navigateCard('prev');
          }
        } else {
          // Vertical movement - navigate sections
          if (deltaY < 0) {
            navigateSection('next');
          } else {
            navigateSection('prev');
          }
        }
      }
    }

    setSwipeStart(null);
    setCardOffset({ x: 0, y: 0 });
  };

  // Parse troubleshooting content into structured parts
  const parseTroubleshootingContent = (content: string) => {
    const parts: { [key: string]: string } = {};
    const lines = content.split('\n\n');

    for (const line of lines) {
      if (line.startsWith('Feeling:')) {
        parts.feeling = line.replace(/^Feeling:\s*/, '');
      } else if (line.startsWith('Issue:')) {
        parts.issue = line.replace(/^Issue:\s*/, '');
      } else if (line.startsWith('Solution:')) {
        parts.solution = line.replace(/^Solution:\s*/, '');
      } else if (line.startsWith('Condition:')) {
        parts.condition = line.replace(/^Condition:\s*/, '');
      } else if (line.startsWith('Watch for:')) {
        parts.regressions = line.replace(/^Watch for:\s*/, '');
      }
    }

    return parts;
  };

  // Highlight search query in text
  const highlightText = (text: string, query: string): ReactNode => {
    if (!query.trim()) {
      return text;
    }

    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, index) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={index} className="bg-yellow-300 text-black">{part}</mark>
      ) : (
        part
      )
    );
  };

  const closeEditMenu = () => {
    setShowEditMenu(null);
    setMenuPosition(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (currentCard) {
      setShowEditMenu(currentCard.card.id);
      setMenuPosition({ x: e.clientX, y: e.clientY });
    }
  };

  // Click handlers for desktop (zone-based navigation)
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentCard || isDragging || showEditMenu) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const cardWidth = rect.width;
    const cardHeight = rect.height;

    const leftZone = clickX < cardWidth * 0.33;
    const rightZone = clickX > cardWidth * 0.67;
    const topZone = clickY < cardHeight * 0.33;
    const bottomZone = clickY > cardHeight * 0.67;

    if (leftZone) {
      navigateCard('prev');
    } else if (rightZone) {
      navigateCard('next');
    } else if (topZone) {
      navigateSection('next');
    } else if (bottomZone) {
      navigateSection('prev');
    }
  };

  if (!deck) {
    return (
      <div className="deck-card-view-empty">
        <p className="text-black/70">Loading deck...</p>
      </div>
    );
  }

  if (!deck.sections || deck.sections.length === 0) {
    return (
      <div className="deck-card-view-empty">
        <p className="text-black/70">No sections in deck</p>
      </div>
    );
  }

  if (unifiedCards.length === 0 || !currentCard) {
    return (
      <div className="deck-card-view-empty">
        <p className="text-black/70">No cards available</p>
      </div>
    );
  }

  // Calculate rotation based on horizontal offset
  const rotation = cardOffset.x * 0.1;
  const opacity = Math.max(0.3, 1 - Math.abs(cardOffset.x) / 300);

  // Get current section info
  const currentSection = deck.sections.find(s => s.id === currentCard.sectionId);
  const sectionCards = currentSection?.cards || [];
  const currentCardInSection = sectionCards.findIndex(c => c.id === currentCard.card.id);

  return (
    <div
      ref={cardContainerRef}
      className="deck-card-view-container"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setIsDragging(false);
        setCardOffset({ x: 0, y: 0 });
        setSwipeStart(null);
      }}
    >
      {/* Main Card - Vertical Index Card Style with Liquid Glass */}
      <div
        className={`liquid-glass liquid-glass--card deck-card transition-transform duration-200 ${isShaking ? 'shake' : ''}`}
        style={{
          transform: `translate(${cardOffset.x}px, ${cardOffset.y}px) rotate(${rotation}deg)`,
          opacity: isDragging ? opacity : 1,
        }}
        onClick={handleCardClick}
        onContextMenu={handleContextMenu}
      >
        {/* Card Content */}
        <div className="liquid-glass__content deck-card__content">
          {/* Header - Top Left */}
          <div className="text-left mb-4">
            {/* Section Title - Responsive sizing to fit card */}
            <h2 className={`text-lg md:text-xl lg:text-2xl font-bold break-words ${sectionColors[currentCard.sectionTitle] || 'text-black'}`}>
              {currentCard.sectionTitle}
            </h2>
          </div>

          {/* Animal Icon - Top Right */}
          <div className="absolute top-4 right-4 z-10">
            <img
              src={getDeckIconPath(deck.animal, deck.discipline, currentCard.sectionTitle)}
              alt={`${deck.animal || 'bee'} ${currentCard.sectionTitle}`}
              className="w-16 h-16"
              onError={(e) => {
                // Fallback if icon doesn't exist - hide the image
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          {/* Content Area - Left justified, scrollable */}
          <div className="flex-1 overflow-y-auto pr-2 mt-2">
            {currentCard.sectionTitle === 'Troubleshooting' ? (
              // Troubleshooting content with sub-sections
              (() => {
                const troubleshootingParts = parseTroubleshootingContent(currentCard.card.content);
                return (
                  <div className="space-y-4 text-left">
                    {troubleshootingParts.feeling && (
                      <div>
                        <h3 className="text-sm md:text-base font-semibold text-black mb-1">Feeling</h3>
                        <p className="text-sm md:text-base text-black leading-relaxed whitespace-pre-line">
                          {highlightText(troubleshootingParts.feeling, searchQuery)}
                        </p>
                      </div>
                    )}
                    {troubleshootingParts.issue && (
                      <div>
                        <h3 className="text-sm md:text-base font-semibold text-black mb-1">Reason</h3>
                        <p className="text-sm md:text-base text-black leading-relaxed whitespace-pre-line">
                          {highlightText(troubleshootingParts.issue, searchQuery)}
                        </p>
                      </div>
                    )}
                    {troubleshootingParts.solution && (
                      <div>
                        <h3 className="text-sm md:text-base font-semibold text-black mb-1">Solution</h3>
                        <p className="text-sm md:text-base text-black leading-relaxed whitespace-pre-line">
                          {highlightText(troubleshootingParts.solution, searchQuery)}
                        </p>
                      </div>
                    )}
                    {/* Show any remaining content that wasn't parsed */}
                    {!troubleshootingParts.feeling && !troubleshootingParts.issue && !troubleshootingParts.solution && (
                      <p className="text-sm md:text-base text-black leading-relaxed whitespace-pre-line">
                        {highlightText(currentCard.card.content, searchQuery)}
                      </p>
                    )}
                  </div>
                );
              })()
            ) : (
              // Regular content (non-troubleshooting)
              <p className="text-sm md:text-base text-black text-left leading-relaxed whitespace-pre-line">
                {highlightText(currentCard.card.content, searchQuery)}
              </p>
            )}
          </div>

          {/* Bottom Bar - Priority Badges, Tags (centered), and X/Y Counter */}
          <div className="absolute bottom-0 left-0 right-0 border-t border-gray-300/30 z-10 pt-3 pb-4 px-4">
            <div className="flex flex-row items-center">
            {/* Left Side: Priority Badges */}
            <div className="flex flex-row gap-2 items-center">
              {/* Priority Badge */}
              {currentCard.card.priority && (
                <div className="bg-yellow-400 rounded-full w-6 h-6 flex items-center justify-center shadow-lg border-2 border-yellow-600">
                  <span className="text-yellow-900 text-xs font-bold">!</span>
                </div>
              )}
              {/* Helpfulness Score (+1, +2, etc.) */}
              {currentCard.card.helpfulnessScore > 0 && (
                <div className="bg-green-400 rounded-full min-w-[24px] h-6 flex items-center justify-center shadow-lg border-2 border-green-600 px-1.5">
                  <span className="text-green-900 text-xs font-bold">+{currentCard.card.helpfulnessScore}</span>
                </div>
              )}
            </div>

            {/* Center: Tags */}
            <div className="flex-1 flex flex-row gap-2 items-center justify-center flex-wrap">
              {currentCard.card.tags && currentCard.card.tags.length > 0 && (
                <>
                  {currentCard.card.tags.slice(0, 5).map((tag) => (
                    <span
                      key={tag}
                      className="text-sm px-3 py-1 bg-blue-100 text-blue-700 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </>
              )}
            </div>

            {/* Right Side: X/Y Counter */}
            <div className="text-base font-bold text-black flex-shrink-0">
              {currentCardInSection + 1}/{sectionCards.length}
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Menu Overlay */}
      {showEditMenu === currentCard.card.id && menuPosition && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={closeEditMenu}
            onTouchStart={closeEditMenu}
          />
          <div
            className="fixed z-50 bg-white rounded-lg shadow-xl border-2 border-gray-300 p-2 min-w-[150px]"
            style={{
              left: `${Math.min(menuPosition.x, typeof window !== 'undefined' ? window.innerWidth - 170 : menuPosition.x)}px`,
              top: `${Math.max(menuPosition.y - 120, 10)}px`,
            }}
          >
            <div className="flex flex-col gap-1">
              {onEditCard && (
                <button
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm"
                  onClick={() => {
                    if (currentCard && onEditCard) {
                      onEditCard(currentCard.card, currentCard.sectionId, currentCard.sectionTitle);
                    }
                    closeEditMenu();
                  }}
                >
                  <FaEdit className="text-blue-600" />
                  <span>Edit</span>
                </button>
              )}
              {onTogglePriority && currentCard.sectionTitle !== 'Troubleshooting' && currentCard.sectionTitle !== 'Theory' && (
                <button
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm"
                  onClick={async () => {
                    if (currentCard && onTogglePriority) {
                      await onTogglePriority(currentCard.card, currentCard.sectionId);
                    }
                    closeEditMenu();
                  }}
                >
                  <FaExclamationCircle className="text-yellow-600" />
                  <span>{currentCard.card.priority ? 'Remove Priority' : 'Set Priority'}</span>
                </button>
              )}
              {onIncreaseHelpfulness && (
                <button
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm"
                  onClick={async () => {
                    if (currentCard && onIncreaseHelpfulness) {
                      await onIncreaseHelpfulness(currentCard.card, currentCard.sectionId);
                    }
                    closeEditMenu();
                  }}
                >
                  <span className="text-green-600 font-bold">+</span>
                  <span>Increase Helpfulness</span>
                </button>
              )}
              {onDecreaseHelpfulness && (
                <button
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm"
                  onClick={async () => {
                    if (currentCard && onDecreaseHelpfulness) {
                      await onDecreaseHelpfulness(currentCard.card, currentCard.sectionId);
                    }
                    closeEditMenu();
                  }}
                >
                  <span className="text-red-600 font-bold">−</span>
                  <span>Decrease Helpfulness</span>
                </button>
              )}
              {onDeleteCard && (
                <button
                  className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm"
                  onClick={async () => {
                    if (currentCard && onDeleteCard && confirm('Are you sure you want to delete this card?')) {
                      await onDeleteCard(currentCard.card, currentCard.sectionId);
                    }
                    closeEditMenu();
                  }}
                >
                  <FaTrash className="text-red-600" />
                  <span>Delete</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

