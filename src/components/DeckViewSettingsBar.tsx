import { useRef, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

interface DeckViewSettingsBarProps {
  filterMode: 'all' | 'recent' | 'helpful' | 'priority';
  onFilterChange: (mode: 'all' | 'recent' | 'helpful' | 'priority') => void;
  onCreateCard: () => void;
  deckName?: string;
}

const filterOptions = [
  { value: 'all' as const, label: 'All' },
  { value: 'recent' as const, label: 'Recent' },
  { value: 'helpful' as const, label: 'Helpful' },
  { value: 'priority' as const, label: 'Priority' },
];

export default function DeckViewSettingsBar({
  filterMode,
  onFilterChange,
  onCreateCard,
  deckName,
}: DeckViewSettingsBarProps) {
  const [searchParams] = useSearchParams();
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Determine back link based on URL parameters
  const getBackLink = () => {
    const query = searchParams.get('q');
    const filterModeParam = searchParams.get('filterMode');

    // If coming from search results (has query parameter)
    if (query) {
      return `/search?q=${encodeURIComponent(query)}&mode=text`;
    }

    // If coming from priority filter (likely from home page)
    if (filterModeParam === 'priority') {
      return '/';
    }

    // Default: go back to decks list
    return '/decks';
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setFilterDropdownOpen(false);
      }
    };

    if (filterDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filterDropdownOpen]);

  return (
    <div className="liquid-glass liquid-glass--nav flex-shrink-0 relative z-[var(--z-sticky)]" style={{ position: 'sticky', top: 0 }}>
      <div className="liquid-glass__content flex items-center justify-between py-3 px-4">
        {/* Left Side: Back Button and Deck Name */}
        <div className="flex items-center gap-4">
          <Link
            to={getBackLink()}
            className="text-white hover:text-white/80 text-2xl font-bold transition-colors"
          >
            ←
          </Link>
          {deckName && (
            <div className="text-white text-lg font-medium">
              {deckName}
            </div>
          )}
        </div>

        {/* Right Side: Filter and Create Card Buttons */}
        <div className="flex items-center gap-3">
          {/* Filter Dropdown */}
          <div className="relative" ref={filterDropdownRef}>
            <button
              onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
              className="text-white hover:text-white/80 bg-black/50 backdrop-blur-sm px-3 py-2 rounded-lg transition-colors flex items-center gap-2"
              title="Filter cards"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              <span className="text-sm">{filterOptions.find(o => o.value === filterMode)?.label}</span>
            </button>

            {/* Dropdown Menu */}
            {filterDropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-black/90 backdrop-blur-sm rounded-lg shadow-lg z-[var(--z-modal)] border border-white/20">
                <div className="py-1">
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        onFilterChange(option.value);
                        setFilterDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        filterMode === option.value
                          ? 'bg-blue-600/80 text-white'
                          : 'text-white/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Create Card Button */}
          <button
            onClick={onCreateCard}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors shadow-lg"
            title="Create Card"
          >
            <span className="text-2xl leading-none">+</span>
          </button>
        </div>
      </div>
    </div>
  );
}

