import { useState, useRef, useMemo, useEffect } from 'react';
import { Deck, Card } from '../../db/training-coach/types';
import { FaChevronLeft, FaChevronRight, FaEdit, FaTrash, FaExclamationCircle } from 'react-icons/fa';

interface UnifiedCard {
  card: Card;
  sectionId: string;
  sectionTitle: string;
  globalIndex: number;
  sectionIndex: number;
}

interface IndexCardStyleProps {
  deck: Deck;
}

const CARDS_PER_VIEW = 4;
const SWIPE_THRESHOLD = 50;
const LONG_PRESS_DURATION = 500;
const SCROLL_THRESHOLD = 10; // Pixels moved before we consider it a scroll vs swipe

// Suit symbols mapping
const suitSymbols: Record<string, string> = {
  'Reminders': '♠',
  'Troubleshooting': '♥',
  'Theory': '♦',
  'Core Reminders': '♣',
};

const suitColors: Record<string, string> = {
  'Reminders': 'text-black',
  'Troubleshooting': 'text-red-600',
  'Theory': 'text-red-600',
  'Core Reminders': 'text-black',
};

export default function IndexCardStyle({ deck }: IndexCardStyleProps) {
  // Flatten all cards with section context
  const unifiedCards = useMemo<UnifiedCard[]>(() => {
    let globalIndex = 0;
    return deck.sections.flatMap(section =>
      section.cards.map((card, sectionIndex) => ({
        card,
        sectionId: section.id,
        sectionTitle: section.title,
        globalIndex: globalIndex++,
        sectionIndex,
      }))
    );
  }, [deck]);

  const [currentGlobalIndex, setCurrentGlobalIndex] = useState(0);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [carouselIndex, setCarouselIndex] = useState<Record<string, number>>({});
  const [swipeStart, setSwipeStart] = useState<{ x: number; y: number; time: number } | null>(null);
  const [isScrolling, setIsScrolling] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [showEditMenu, setShowEditMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [mouseDownTimer, setMouseDownTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  const currentCard = unifiedCards[currentGlobalIndex];
  const currentSection = deck.sections.find(s => s.id === currentCard?.sectionId);

  // Prevent body scroll when interacting with card
  useEffect(() => {
    if (cardContainerRef.current) {
      const container = cardContainerRef.current;
      const preventScroll = (e: TouchEvent) => {
        // Only prevent if we're in the card area and not scrolling the page
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

  // Trigger tactile feedback
  const triggerFeedback = () => {
    // Vibration API (mobile)
    if ('vibrate' in navigator) {
      navigator.vibrate(50); // 50ms vibration
    }
    // Shake animation
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
    if (!currentCard) {
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

  // Handle double-click to expand section
  const handleDoubleClick = () => {
    if (!currentCard) return;

    if (expandedSection === currentCard.sectionId) {
      setExpandedSection(null);
    } else {
      setExpandedSection(currentCard.sectionId);
      setCarouselIndex((prev) => ({ ...prev, [currentCard.sectionId]: 0 }));
    }
  };

  // Touch handlers for swipe detection
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setSwipeStart({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    });
    setIsScrolling(false);

    // Start long press timer
    const timer = setTimeout(() => {
      if (currentCard) {
        setShowEditMenu(currentCard.card.id);
        setMenuPosition({ x: touch.clientX, y: touch.clientY });
      }
    }, LONG_PRESS_DURATION);
    setLongPressTimer(timer);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeStart) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - swipeStart.x);
    const deltaY = Math.abs(touch.clientY - swipeStart.y);
    const timeDelta = Date.now() - swipeStart.time;

    // Cancel long press if user moves finger
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    // Determine if this is a scroll or swipe
    // Only treat as scroll if movement is small AND slow (page scrolling)
    // Large or fast vertical movements are intentional swipes
    const isLargeVerticalMovement = deltaY > SWIPE_THRESHOLD;
    const isSmallSlowVertical = deltaY > SCROLL_THRESHOLD && deltaY > deltaX && deltaY < SWIPE_THRESHOLD && timeDelta > 200;

    if (isSmallSlowVertical) {
      setIsScrolling(true);
      return; // Allow natural scrolling for small, slow movements
    }

    // If movement is significant (horizontal or large vertical), it's a swipe - prevent scroll
    if (deltaX > SCROLL_THRESHOLD || isLargeVerticalMovement) {
      setIsScrolling(false);
      e.preventDefault(); // Prevent page scroll
      e.stopPropagation();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Clear long press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

    // If we were scrolling, don't process swipe
    if (isScrolling || !swipeStart) {
      setSwipeStart(null);
      setIsScrolling(false);
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
      return;
    }

    // Determine swipe direction
    if (absDeltaX > SWIPE_THRESHOLD || absDeltaY > SWIPE_THRESHOLD) {
      if (absDeltaX > absDeltaY) {
        // Horizontal swipe - navigate cards
        e.preventDefault();
        e.stopPropagation();
        if (deltaX < 0) {
          navigateCard('next'); // Swipe left = next
        } else {
          navigateCard('prev'); // Swipe right = previous
        }
      } else {
        // Vertical swipe - navigate sections
        e.preventDefault();
        e.stopPropagation();
        if (deltaY < 0) {
          navigateSection('next'); // Swipe up = next section
        } else {
          navigateSection('prev'); // Swipe down = previous section
        }
      }
    }

    setSwipeStart(null);
    setIsScrolling(false);
  };

  // Carousel navigation
  const goToPrevious = (sectionId: string) => {
    setCarouselIndex((prev) => ({
      ...prev,
      [sectionId]: Math.max(0, (prev[sectionId] || 0) - 1),
    }));
  };

  const goToNext = (sectionId: string) => {
    const section = deck.sections.find(s => s.id === sectionId);
    const cardCount = section?.cards.length || 0;
    const maxIndex = Math.max(0, cardCount - CARDS_PER_VIEW);
    setCarouselIndex((prev) => ({
      ...prev,
      [sectionId]: Math.min(maxIndex, (prev[sectionId] || 0) + 1),
    }));
  };

  // Close edit menu
  const closeEditMenu = () => {
    setShowEditMenu(null);
    setMenuPosition(null);
  };

  // Desktop click handlers
  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentCard) return;

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

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentCard) return;

    const timer = setTimeout(() => {
      if (currentCard) {
        setShowEditMenu(currentCard.card.id);
        setMenuPosition({ x: e.clientX, y: e.clientY });
      }
    }, LONG_PRESS_DURATION);
    setMouseDownTimer(timer);
  };

  const handleMouseUp = () => {
    if (mouseDownTimer) {
      clearTimeout(mouseDownTimer);
      setMouseDownTimer(null);
    }
  };

  const handleMouseLeave = () => {
    if (mouseDownTimer) {
      clearTimeout(mouseDownTimer);
      setMouseDownTimer(null);
    }
  };

  if (!currentCard || !currentSection) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No cards available
      </div>
    );
  }

  const isExpanded = expandedSection === currentCard.sectionId;
  const needsCarousel = currentSection.cards.length > CARDS_PER_VIEW;
  const currentCarouselIndex = carouselIndex[currentCard.sectionId] || 0;
  const maxCarouselIndex = Math.max(0, currentSection.cards.length - CARDS_PER_VIEW);

  // Show stacked cards from current section
  const sectionCards = currentSection.cards;
  const currentCardInSection = sectionCards.findIndex(c => c.id === currentCard.card.id);

  return (
    <div className="space-y-4">
      {/* Deck Header */}
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">{deck.name}</h3>
        {deck.discipline && (
          <span className="text-xs text-gray-500">{deck.discipline}</span>
        )}
      </div>

      {isExpanded ? (
        /* Expanded Carousel View */
        <div
          className="relative"
          onDoubleClick={handleDoubleClick}
        >
          {/* Section Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className={`text-2xl ${suitColors[currentCard.sectionTitle] || 'text-gray-600'}`}>
                {suitSymbols[currentCard.sectionTitle] || '●'}
              </span>
              <h4 className="font-semibold text-gray-700">{currentCard.sectionTitle}</h4>
            </div>
            <span className="text-xs text-gray-500">Double-click to collapse</span>
          </div>

          {/* Carousel Navigation - Previous (Desktop only) */}
          {needsCarousel && currentCarouselIndex > 0 && (
            <button
              onClick={() => goToPrevious(currentCard.sectionId)}
              className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
              aria-label="Previous cards"
            >
              <FaChevronLeft className="text-gray-600" />
            </button>
          )}

          {/* Expanded Cards Row - Scrollable on mobile */}
          <div className="flex gap-3 overflow-x-auto md:overflow-hidden scrollbar-hide">
            {currentSection.cards.map((card, idx) => (
              <div
                key={card.id}
                className="flex-shrink-0 bg-white border-2 border-gray-800 rounded-lg p-3 shadow-lg"
                style={{
                  width: 'clamp(120px, 35vw, 140px)',
                  minHeight: 'clamp(160px, 45vw, 200px)',
                  minWidth: '120px',
                }}
              >
                {/* Card Corner - Top Left */}
                <div className="absolute top-1 left-1">
                  <div className={`text-xs font-bold ${suitColors[currentCard.sectionTitle] || 'text-gray-600'}`}>
                    {idx + 1}
                  </div>
                  <div className={`text-sm ${suitColors[currentCard.sectionTitle] || 'text-gray-600'}`}>
                    {suitSymbols[currentCard.sectionTitle] || '●'}
                  </div>
                </div>

                {/* Card Corner - Bottom Right */}
                <div className="absolute bottom-1 right-1 rotate-180">
                  <div className={`text-xs font-bold ${suitColors[currentCard.sectionTitle] || 'text-gray-600'}`}>
                    {idx + 1}
                  </div>
                  <div className={`text-sm ${suitColors[currentCard.sectionTitle] || 'text-gray-600'}`}>
                    {suitSymbols[currentCard.sectionTitle] || '●'}
                  </div>
                </div>

                {/* Card Content */}
                <div className="pt-6 pb-4 h-full flex items-center justify-center">
                  <p className="text-xs text-gray-700 text-center line-clamp-6">
                    {card.content}
                  </p>
                </div>

                {/* Priority Badge */}
                {card.priority && (
                  <div className="absolute top-1 right-1 bg-yellow-400 rounded-full w-3 h-3 border border-gray-800" />
                )}
              </div>
            ))}
          </div>

          {/* Carousel Navigation - Next (Desktop only) */}
          {needsCarousel && currentCarouselIndex < maxCarouselIndex && (
            <button
              onClick={() => goToNext(currentCard.sectionId)}
              className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
              aria-label="Next cards"
            >
              <FaChevronRight className="text-gray-600" />
            </button>
          )}

          {/* Carousel Indicators (Desktop only) */}
          {needsCarousel && (
            <div className="hidden md:flex justify-center gap-2 mt-3">
              {Array.from({
                length: Math.ceil(currentSection.cards.length / CARDS_PER_VIEW),
              }).map((_, idx) => (
                <button
                  key={idx}
                  onClick={() =>
                    setCarouselIndex((prev) => ({
                      ...prev,
                      [currentCard.sectionId]: idx * CARDS_PER_VIEW,
                    }))
                  }
                  className={`h-2 rounded-full transition-all ${
                    Math.floor(currentCarouselIndex / CARDS_PER_VIEW) === idx
                      ? 'w-8 bg-blue-600'
                      : 'w-2 bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`Go to page ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Unified Card Stack View */
        <div className="space-y-4">
          {/* Section Indicator and Card Counter */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className={`text-xl ${suitColors[currentCard.sectionTitle] || 'text-gray-600'}`}>
                {suitSymbols[currentCard.sectionTitle] || '●'}
              </span>
              <span>{currentCard.sectionTitle}</span>
            </div>
            <span>
              Card {currentCardInSection + 1} of {sectionCards.length}
            </span>
          </div>

          {/* Main Card Display */}
          <div
            ref={cardContainerRef}
            className="relative mx-auto flex items-center justify-center"
            style={{
              width: 'clamp(180px, 50vw, 200px)',
              minHeight: 'clamp(240px, 70vw, 300px)',
              touchAction: 'pan-y',
              minWidth: '180px',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={handleDoubleClick}
          >
            {/* Single Card - Centered */}
            <div
              className={`relative bg-white border-2 border-gray-800 rounded-lg p-4 shadow-xl cursor-pointer transition-transform duration-300 ${isShaking ? 'shake' : ''}`}
              style={{
                width: 'clamp(180px, 50vw, 200px)',
                minWidth: '180px',
                minHeight: '300px',
              }}
              onClick={handleCardClick}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
            >
              {/* Card Corner - Top Left */}
              <div className="absolute top-2 left-2">
                <div className={`text-sm font-bold ${suitColors[currentCard.sectionTitle] || 'text-gray-600'}`}>
                  {currentCard.sectionIndex + 1}
                </div>
                <div className={`text-lg ${suitColors[currentCard.sectionTitle] || 'text-gray-600'}`}>
                  {suitSymbols[currentCard.sectionTitle] || '●'}
                </div>
              </div>

              {/* Card Corner - Bottom Right */}
              <div className="absolute bottom-2 right-2 rotate-180">
                <div className={`text-sm font-bold ${suitColors[currentCard.sectionTitle] || 'text-gray-600'}`}>
                  {currentCard.sectionIndex + 1}
                </div>
                <div className={`text-lg ${suitColors[currentCard.sectionTitle] || 'text-gray-600'}`}>
                  {suitSymbols[currentCard.sectionTitle] || '●'}
                </div>
              </div>

              {/* Card Content */}
              <div className="pt-8 pb-6 h-full flex flex-col">
                <p className="text-sm text-gray-700 text-center flex-1 flex items-center justify-center">
                  {currentCard.card.content}
                </p>

                {/* Tags */}
                {currentCard.card.tags && currentCard.card.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-4 justify-center">
                    {currentCard.card.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Priority Badge */}
                {currentCard.card.priority && (
                  <div className="absolute top-2 right-2 bg-yellow-400 rounded-full w-4 h-4 border-2 border-gray-800" />
                )}
              </div>
            </div>

            {/* Navigation Hints */}
            <div className="absolute -bottom-8 left-0 right-0 text-center text-xs text-gray-400 space-y-1">
              <div>Swipe ← → for cards</div>
              <div>Swipe ↑ ↓ for sections</div>
              <div>Double-click to expand section</div>
              <div>Hold for actions</div>
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
                  <button
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm"
                    onClick={() => {
                      console.log('Edit card:', currentCard.card.id);
                      closeEditMenu();
                    }}
                  >
                    <FaEdit className="text-blue-600" />
                    <span>Edit</span>
                  </button>
                  <button
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm"
                    onClick={() => {
                      console.log('Toggle priority:', currentCard.card.id);
                      closeEditMenu();
                    }}
                  >
                    <FaExclamationCircle className="text-yellow-600" />
                    <span>{currentCard.card.priority ? 'Remove Priority' : 'Set Priority'}</span>
                  </button>
                  <button
                    className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm"
                    onClick={() => {
                      console.log('Delete card:', currentCard.card.id);
                      closeEditMenu();
                    }}
                  >
                    <FaTrash className="text-red-600" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

