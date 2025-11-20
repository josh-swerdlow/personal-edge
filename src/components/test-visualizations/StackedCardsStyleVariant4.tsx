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

// Variant 4: Soft - Pastel colors, rounded
export default function StackedCardsStyleVariant4({ deck }: StackedCardsStyleProps) {
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

  const triggerFeedback = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);
  };

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

  const navigateSection = (direction: 'next' | 'prev'): boolean => {
    if (!currentCard) {
      triggerFeedback();
      return false;
    }
    const currentSectionIndex = deck.sections.findIndex(s => s.id === currentCard.sectionId);
    let targetSectionIndex: number;
    if (direction === 'next') {
      targetSectionIndex = currentSectionIndex < deck.sections.length - 1 ? currentSectionIndex + 1 : 0;
    } else {
      targetSectionIndex = currentSectionIndex > 0 ? currentSectionIndex - 1 : deck.sections.length - 1;
    }
    const targetSection = deck.sections[targetSectionIndex];
    const { startIndex } = getSectionBoundaries(targetSection.id);
    setCurrentGlobalIndex(startIndex);
    return true;
  };

  const handleDoubleClick = () => {
    if (!currentCard) return;
    if (expandedSection === currentCard.sectionId) {
      setExpandedSection(null);
    } else {
      setExpandedSection(currentCard.sectionId);
      setCarouselIndex((prev) => ({ ...prev, [currentCard.sectionId]: 0 }));
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setSwipeStart({ x: touch.clientX, y: touch.clientY, time: Date.now() });
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
    const isLargeVerticalMovement = deltaY > SWIPE_THRESHOLD;
    const isSmallSlowVertical = deltaY > SCROLL_THRESHOLD && deltaY > deltaX && deltaY < SWIPE_THRESHOLD && timeDelta > 200;
    if (isSmallSlowVertical) {
      setIsScrolling(true);
      return;
    }
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
      triggerFeedback();
    }
    setSwipeStart(null);
    setIsScrolling(false);
  };

  const goToPrevious = (sectionId: string) => {
    setCarouselIndex((prev) => ({ ...prev, [sectionId]: Math.max(0, (prev[sectionId] || 0) - 1) }));
  };

  const goToNext = (sectionId: string) => {
    const section = deck.sections.find(s => s.id === sectionId);
    const cardCount = section?.cards.length || 0;
    const maxIndex = Math.max(0, cardCount - CARDS_PER_VIEW);
    setCarouselIndex((prev) => ({ ...prev, [sectionId]: Math.min(maxIndex, (prev[sectionId] || 0) + 1) }));
  };

  const closeEditMenu = () => {
    setShowEditMenu(null);
    setMenuPosition(null);
  };

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentCard) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const cardWidth = rect.width;
    const cardHeight = rect.height;
    const leftZone = clickX < cardWidth * 0.17; // Half size: 1/6 instead of 1/3
    const rightZone = clickX > cardWidth * 0.83; // Half size: 5/6 instead of 2/3
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

  const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentCard) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const cardWidth = rect.width;
    const cardHeight = rect.height;
    const leftZone = mouseX < cardWidth * 0.17; // Half size: 1/6 instead of 1/3
    const rightZone = mouseX > cardWidth * 0.83; // Half size: 5/6 instead of 2/3
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

  if (!currentCard || !currentSection) {
    return <div className="flex items-center justify-center h-64 text-gray-500">No cards available</div>;
  }

  const isExpanded = expandedSection === currentCard.sectionId;
  const needsCarousel = currentSection.cards.length > CARDS_PER_VIEW;
  const currentCarouselIndex = carouselIndex[currentCard.sectionId] || 0;
  const maxCarouselIndex = Math.max(0, currentSection.cards.length - CARDS_PER_VIEW);
  const sectionCards = currentSection.cards;
  const currentCardInSection = sectionCards.findIndex(c => c.id === currentCard.card.id);

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <h3 className="text-lg font-bold text-gray-800">Variant 4: Pink/Peach</h3>
        <span className="text-xs text-gray-500">Soft edges, gradient</span>
      </div>

      {isExpanded ? (
        <div className="relative" onDoubleClick={handleDoubleClick}>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{currentCard.sectionTitle}</h4>
            <span className="text-xs text-gray-500">Double-click to collapse</span>
          </div>
          {needsCarousel && currentCarouselIndex > 0 && (
            <button
              onClick={() => goToPrevious(currentCard.sectionId)}
              className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
            >
              <FaChevronLeft className="text-gray-600" />
            </button>
          )}
          <div className="flex gap-3 overflow-x-auto md:overflow-hidden scrollbar-hide">
            {currentSection.cards.map((card) => (
              <div
                key={card.id}
                className="flex-shrink-0 bg-gradient-to-br from-pink-50 to-orange-50 border-2 border-pink-200 rounded-2xl p-4 shadow-lg transition-all duration-300"
                style={{
                  width: 'clamp(280px, 80vw, 400px)',
                  minHeight: 'clamp(200px, 60vw, 300px)',
                  minWidth: '280px',
                }}
              >
                <div className="flex flex-col h-full">
                  <h5 className="text-sm font-semibold text-gray-800 mb-2">{currentCard.sectionTitle}</h5>
                  <p className="text-base text-gray-700 mb-2 line-clamp-4 flex-1">{card.content}</p>
                  <div className="mt-auto pt-3 border-t-2 border-gray-300">
                    <div className="flex items-center justify-between pt-2">
                      <div className="flex gap-1">
                        {card.tags?.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                      {card.priority && <span className="text-xs text-yellow-600">★</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {needsCarousel && currentCarouselIndex < maxCarouselIndex && (
            <button
              onClick={() => goToNext(currentCard.sectionId)}
              className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
            >
              <FaChevronRight className="text-gray-600" />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <h4 className="font-semibold text-gray-700 text-sm uppercase tracking-wide">{currentCard.sectionTitle}</h4>
            <span>Card {currentCardInSection + 1} of {sectionCards.length}</span>
          </div>
          <div
            ref={cardContainerRef}
            className={`relative mx-auto flex items-center justify-center ${isShaking ? 'shake' : ''}`}
            style={{
              width: 'clamp(280px, 80vw, 400px)',
              minHeight: 'clamp(280px, 80vw, 400px)',
              touchAction: 'pan-y',
              minWidth: '280px',
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={handleDoubleClick}
          >
            {sectionCards
              .slice(Math.max(0, currentCardInSection - 1), currentCardInSection + 2)
              .map((card, stackIndex) => {
                const actualIndex = Math.max(0, currentCardInSection - 1) + stackIndex;
                const isTopCard = actualIndex === currentCardInSection;
                const distanceFromTop = Math.abs(actualIndex - currentCardInSection);
                if (distanceFromTop > 1) return null;
                const stackOffset = distanceFromTop * 12;
                const zIndex = 100 - distanceFromTop;
                const rotation = distanceFromTop === 0 ? 0 : (distanceFromTop === 1 && actualIndex < currentCardInSection ? -2 : 2);
                const scale = 1 - (distanceFromTop * 0.05);
                const opacity = 1 - (distanceFromTop * 0.3);

                return (
                  <div
                    key={card.id}
                    className="absolute bg-gradient-to-br from-pink-50 to-orange-50 border-2 border-pink-200 rounded-2xl p-4 shadow-lg cursor-pointer transition-all duration-300"
                    style={{
                      left: `${stackOffset}px`,
                      top: `${stackOffset}px`,
                      transform: `rotate(${rotation}deg) scale(${scale})`,
                      zIndex,
                      width: 'clamp(280px, 80vw, 400px)',
                      minWidth: '280px',
                      minHeight: '240px',
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
                        {/* Left Zone - half size */}
                        <div
                          className={`absolute inset-y-0 left-0 w-1/6 bg-gray-400/10 transition-opacity duration-200 ${
                            hoverZone === 'left' ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                        {/* Right Zone - half size */}
                        <div
                          className={`absolute inset-y-0 right-0 w-1/6 bg-gray-400/10 transition-opacity duration-200 ${
                            hoverZone === 'right' ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                        {/* Top Zone */}
                        <div
                          className={`absolute inset-x-0 top-0 h-1/3 bg-gray-400/10 transition-opacity duration-200 ${
                            hoverZone === 'top' ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                        {/* Bottom Zone */}
                        <div
                          className={`absolute inset-x-0 bottom-0 h-1/3 bg-gray-400/10 transition-opacity duration-200 ${
                            hoverZone === 'bottom' ? 'opacity-100' : 'opacity-0'
                          }`}
                        />
                      </>
                    )}
                    <div className="flex flex-col h-full relative z-10">
                      <h5 className="text-sm font-semibold text-gray-800 mb-2">{currentCard.sectionTitle}</h5>
                      <p className="text-base text-gray-700 mb-2 line-clamp-3 flex-1">{card.content}</p>
                      <div className="mt-auto pt-3 border-t-2 border-gray-300">
                        <div className="flex items-center justify-between pt-2">
                          <div className="flex gap-1">
                            {card.tags?.slice(0, 2).map((tag) => (
                              <span key={tag} className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                          {card.priority && <span className="text-xs text-yellow-600">★</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            <div className="absolute -bottom-8 left-0 right-0 text-center text-xs text-gray-400 space-y-1">
              <div>Swipe ← → for cards</div>
              <div>Swipe ↑ ↓ for sections</div>
              <div>Double-click to expand</div>
              <div>Hold for actions</div>
            </div>
          </div>
          {showEditMenu === currentCard.card.id && menuPosition && (
            <>
              <div className="fixed inset-0 z-50" onClick={closeEditMenu} onTouchStart={closeEditMenu} />
              <div
                className="fixed z-50 bg-white rounded-lg shadow-xl border-2 border-gray-300 p-2 min-w-[150px]"
                style={{
                  left: `${Math.min(menuPosition.x, typeof window !== 'undefined' ? window.innerWidth - 170 : menuPosition.x)}px`,
                  top: `${Math.max(menuPosition.y - 120, 10)}px`,
                }}
              >
                <div className="flex flex-col gap-1">
                  <button className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm" onClick={() => { console.log('Edit'); closeEditMenu(); }}>
                    <FaEdit className="text-blue-600" /> <span>Edit</span>
                  </button>
                  <button className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm" onClick={() => { console.log('Priority'); closeEditMenu(); }}>
                    <FaExclamationCircle className="text-yellow-600" /> <span>{currentCard.card.priority ? 'Remove Priority' : 'Set Priority'}</span>
                  </button>
                  <button className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100 rounded text-sm" onClick={() => { console.log('Delete'); closeEditMenu(); }}>
                    <FaTrash className="text-red-600" /> <span>Delete</span>
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
