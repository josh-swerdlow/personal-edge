import { useEffect, useMemo, useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { Section } from '../db/training-coach/types';
import CardItem from './CardItem';
import { FaPlus } from 'react-icons/fa';
import { getSectionPatternClass } from '../utils/sectionPatterns';
import { getSectionStyle } from '../utils/sections';

interface SectionCarouselProps {
  sections: Section[];
  deckId: string;
  onUpdate: () => void;
  onCreateCard: (sectionId: string) => void;
  onDeleteCard: (sectionId: string, cardId: string) => void;
}

export default function SectionCarousel({
  sections,
  deckId,
  onUpdate,
  onCreateCard,
  onDeleteCard,
}: SectionCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Filter out Core Reminders (but show all other sections, even if empty)
  const visibleSections = useMemo(() => {
    return sections.filter(section => section.title !== 'Core Reminders');
  }, [sections]);

  useEffect(() => {
    if (visibleSections.length === 0) {
      setCurrentIndex(0);
      return;
    }
    setCurrentIndex(prev => {
      if (prev >= visibleSections.length) {
        return visibleSections.length - 1;
      }
      if (prev < 0) {
        return 0;
      }
      return prev;
    });
  }, [visibleSections.length]);

  if (visibleSections.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <p className="text-gray-500 text-center">No sections with content yet.</p>
      </div>
    );
  }

  const currentSection = visibleSections[currentIndex];
  const currentSectionStyle = getSectionStyle(currentSection.title);

  function goToPrevious() {
    setCurrentIndex((prev) => (prev === 0 ? visibleSections.length - 1 : prev - 1));
  }

  function goToNext() {
    setCurrentIndex((prev) => (prev === visibleSections.length - 1 ? 0 : prev + 1));
  }

  function goToSection(index: number) {
    setCurrentIndex(index);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      goToPrevious();
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      goToNext();
    }
  }

  return (
    <div
      className="bg-white rounded-lg shadow-md overflow-hidden"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="region"
      aria-label="Section carousel"
    >
      {/* Tab Navigation Bar - Horizontal scroll on mobile */}
      <div className="flex items-center border-b border-gray-200 bg-gray-50 overflow-x-auto scrollbar-hide">
        {visibleSections.map((section, index) => {
          const isActive = index === currentIndex;
          const sectionStyle = getSectionStyle(section.title);
          return (
            <button
              key={section.id}
              onClick={() => goToSection(index)}
              className={`px-3 sm:px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors relative min-h-[var(--touch-target-min)] ${
                isActive
                  ? `${sectionStyle.tabText} bg-white`
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {section.title}
              {isActive && (
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${sectionStyle.tabBorder}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Carousel Content */}
      <div className="relative">
        {/* Navigation Arrows - Larger on mobile */}
        {visibleSections.length > 1 && (
          <>
            <button
              onClick={goToPrevious}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 sm:p-2.5 shadow-md hover:bg-gray-100 transition-colors min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)] flex items-center justify-center"
              aria-label="Previous section"
            >
              <FaChevronLeft className="text-gray-600 text-lg sm:text-base" />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white rounded-full p-2 sm:p-2.5 shadow-md hover:bg-gray-100 transition-colors min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)] flex items-center justify-center"
              aria-label="Next section"
            >
              <FaChevronRight className="text-gray-600 text-lg sm:text-base" />
            </button>
          </>
        )}

        {/* Section Content */}
        <div className={`p-4 sm:p-6 ${currentSectionStyle.carouselContainer} min-h-[300px] sm:min-h-[400px] relative ${getSectionPatternClass(currentSection.title)}`}>
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex justify-end mb-4">
              <button
                onClick={() => onCreateCard(currentSection.id)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-2 min-h-[var(--touch-target-min)] text-sm sm:text-base"
              >
                <FaPlus />
                <span className="hidden sm:inline">Create Card</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>

            {/* Cards with scrollbar - limit to 5 visible */}
            {(() => {
              const cards = currentSection.cards || [];
              if (cards.length === 0) {
                return (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-gray-500 text-center">No cards in this section yet.</p>
                  </div>
                );
              }
              return (
                <div className="space-y-2 overflow-y-auto max-h-[calc(100dvh-400px)] sm:max-h-[calc(5*120px)] px-8 sm:px-12" style={{ scrollbarWidth: 'thin' }}>
                  {[...cards]
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map(card => (
                      <CardItem
                        key={card.id}
                        card={card}
                        deckId={deckId}
                        sectionId={currentSection.id}
                        onUpdate={onUpdate}
                        onDelete={() => onDeleteCard(currentSection.id, card.id)}
                      />
                    ))}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Carousel Indicators */}
        {visibleSections.length > 1 && (
          <div className="flex justify-center gap-2 p-4 bg-gray-50">
            {visibleSections.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSection(index)}
                className={`h-2 rounded-full transition-all min-w-[var(--touch-target-min)] min-h-[var(--touch-target-min)] ${
                  index === currentIndex
                    ? 'w-8 bg-purple-600'
                    : 'w-2 bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to ${visibleSections[index].title}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

