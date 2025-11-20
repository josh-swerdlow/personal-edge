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

interface StackedCardsStyleProps {
  deck: Deck;
}

const CARDS_PER_VIEW = 4;
const SWIPE_THRESHOLD = 50;
const LONG_PRESS_DURATION = 500;
const SCROLL_THRESHOLD = 10;

export default function StackedCardsStyle({ deck }: StackedCardsStyleProps) {
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
  const [hoverZone, setHoverZone] = useState<'left' | 'right' | 'top' | 'bottom' | null>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  const currentCard = unifiedCards[currentGlobalIndex];
  const currentSection = deck.sections.find(s => s.id === currentCard?.sectionId);

  // Prevent body scroll when interacting with card
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
      navigator.vibrate(50);
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
        : 0;
    } else {
      targetSectionIndex = currentSectionIndex > 0
        ? currentSectionIndex - 1
        : deck.sections.length - 1;
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
      return;
    }

    // If movement is significant (horizontal or large vertical), it's a swipe - prevent scroll
    if (deltaX > SCROLL_THRESHOLD || isLargeVerticalMovement) {
      setIsScrolling(false);
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }

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

    if (timeDelta > 300) {
      setSwipeStart(null);
      setIsScrolling(false);
      return;
    }

    if (absDeltaX > SWIPE_THRESHOLD || absDeltaY > SWIPE_THRESHOLD) {
      if (absDeltaX > absDeltaY) {
        e.preventDefault();
        e.stopPropagation();
        if (deltaX < 0) {
          navigateCard('next');
        } else {
          navigateCard('prev');
        }
      } else {
        e.preventDefault();
        e.stopPropagation();
        if (deltaY < 0) {
          navigateSection('next');
        } else {
          navigateSection('prev');
        }
      }
    } else {
      // Invalid swipe (too small) - provide feedback
      triggerFeedback();
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

    // Divide card into zones: left, right, top, bottom, center
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

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentCard) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const cardWidth = rect.width;
    const cardHeight = rect.height;

    const leftZone = mouseX < cardWidth * 0.33;
    const rightZone = mouseX > cardWidth * 0.67;
    const topZone = mouseY < cardHeight * 0.33;
    const bottomZone = mouseY > cardHeight * 0.67;

    if (leftZone) {
      setHoverZone('left');
    } else if (rightZone) {
      setHoverZone('right');
    } else if (topZone) {
      setHoverZone('top');
    } else if (bottomZone) {
      setHoverZone('bottom');
    } else {
      setHoverZone(null);
    }
  };

  const handleCardMouseLeave = () => {
    setHoverZone(null);
    if (mouseDownTimer) {
      clearTimeout(mouseDownTimer);
      setMouseDownTimer(null);
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
            <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
              {currentCard.sectionTitle}
            </h4>
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
            {currentSection.cards.map((card) => (
              <div
                key={card.id}
                className="flex-shrink-0 bg-white border-2 border-gray-300 rounded-lg p-4 shadow-lg transition-all duration-300"
                style={{
                  width: 'clamp(180px, 50vw, 200px)',
                  minHeight: 'clamp(120px, 35vw, 150px)',
                  minWidth: '180px',
                }}
              >
                <div className="flex flex-col h-full">
                  <p className="text-sm text-gray-700 mb-2 line-clamp-4 flex-1">
                    {card.content}
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-200">
                    <div className="flex gap-1">
                      {card.tags?.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {card.priority && (
                      <span className="text-xs text-yellow-600">★</span>
                    )}
                  </div>
                </div>
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
        /* Stacked Cards View */
        <div className="space-y-4">
          {/* Section Indicator and Card Counter */}
          <div className="flex items-center justify-between text-sm text-gray-600">
            <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">
              {currentCard.sectionTitle}
            </h4>
            <span>
              Card {currentCardInSection + 1} of {sectionCards.length}
            </span>
          </div>

          {/* Stacked Cards Container */}
          <div
            ref={cardContainerRef}
            className={`relative mx-auto flex items-center justify-center ${isShaking ? 'shake' : ''}`}
            style={{
              width: 'clamp(180px, 50vw, 200px)',
              minHeight: 'clamp(180px, 50vw, 200px)',
              touchAction: 'pan-y',
              minWidth: '180px',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={handleDoubleClick}
          >
            {/* Only show top 3 cards in stack for cleaner look */}
            {sectionCards
              .slice(Math.max(0, currentCardInSection - 1), currentCardInSection + 2)
              .map((card, stackIndex) => {
                const actualIndex = Math.max(0, currentCardInSection - 1) + stackIndex;
                const isTopCard = actualIndex === currentCardInSection;
                const distanceFromTop = Math.abs(actualIndex - currentCardInSection);

                // Only show up to 3 cards: one behind, current, one ahead
                if (distanceFromTop > 1) return null;

                const stackOffset = distanceFromTop * 6;
                const zIndex = 100 - distanceFromTop;
                const rotation = distanceFromTop === 0 ? 0 : (distanceFromTop === 1 && actualIndex < currentCardInSection ? -2 : 2);
                const scale = 1 - (distanceFromTop * 0.05);
                const opacity = 1 - (distanceFromTop * 0.3);

                return (
                  <div
                    key={card.id}
                    className="absolute bg-white border-2 border-gray-300 rounded-lg p-4 shadow-lg cursor-pointer transition-all duration-300"
                    style={{
                      left: `${stackOffset}px`,
                      top: `${stackOffset}px`,
                      transform: `rotate(${rotation}deg) scale(${scale})`,
                      zIndex,
                      width: 'clamp(180px, 50vw, 200px)',
                      minWidth: '180px',
                      minHeight: 'clamp(96px, 30vw, 120px)',
                      opacity,
                    }}
                    onClick={isTopCard ? handleCardClick : undefined}
                    onMouseDown={isTopCard ? handleMouseDown : undefined}
                    onMouseUp={isTopCard ? handleMouseUp : undefined}
                    onMouseMove={isTopCard ? handleCardMouseMove : undefined}
                    onMouseLeave={isTopCard ? handleCardMouseLeave : undefined}
                  >
                    {/* Hover Overlays */}
                    {isTopCard && (
                      <>
                        {/* Left Zone */}
                        <div
                          className={`absolute inset-y-0 left-0 w-1/3 bg-blue-500/20 border-r-2 border-blue-500/50 transition-opacity duration-200 ${
                            hoverZone === 'left' ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-semibold text-blue-700 bg-white/90 px-2 py-1 rounded shadow">
                              ← Prev Card
                            </span>
                          </div>
                        </div>
                        {/* Right Zone */}
                        <div
                          className={`absolute inset-y-0 right-0 w-1/3 bg-blue-500/20 border-l-2 border-blue-500/50 transition-opacity duration-200 ${
                            hoverZone === 'right' ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-semibold text-blue-700 bg-white/90 px-2 py-1 rounded shadow">
                              Next Card →
                            </span>
                          </div>
                        </div>
                        {/* Top Zone */}
                        <div
                          className={`absolute inset-x-0 top-0 h-1/3 bg-green-500/20 border-b-2 border-green-500/50 transition-opacity duration-200 ${
                            hoverZone === 'top' ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-semibold text-green-700 bg-white/90 px-2 py-1 rounded shadow">
                              ↑ Next Section
                            </span>
                          </div>
                        </div>
                        {/* Bottom Zone */}
                        <div
                          className={`absolute inset-x-0 bottom-0 h-1/3 bg-green-500/20 border-t-2 border-green-500/50 transition-opacity duration-200 ${
                            hoverZone === 'bottom' ? 'opacity-100' : 'opacity-0'
                          }`}
                        >
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs font-semibold text-green-700 bg-white/90 px-2 py-1 rounded shadow">
                              ↓ Prev Section
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                    <div className="flex flex-col h-full relative z-10">
                      <p className="text-sm text-gray-700 mb-2 line-clamp-3 flex-1">
                        {card.content}
                      </p>
                      <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-200">
                        <div className="flex gap-1">
                          {card.tags?.slice(0, 2).map((tag) => (
                            <span
                              key={tag}
                              className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        {card.priority && (
                          <span className="text-xs text-yellow-600">★</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

            {/* Navigation Hints */}
            <div className="absolute -bottom-8 left-0 right-0 text-center text-xs text-gray-400 space-y-1">
              <div>Swipe ← → for cards</div>
              <div>Swipe ↑ ↓ for sections</div>
              <div>Double-click to expand</div>
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

