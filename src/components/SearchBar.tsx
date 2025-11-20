import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SearchBarProps {
  onSearch?: () => void;
}

export default function SearchBar({ onSearch }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

  // Close modal when navigating to search results
  useEffect(() => {
    if (location.pathname === '/search' && onSearch) {
      onSearch();
    }
  }, [location.pathname, onSearch]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    navigate(`/search?q=${encodeURIComponent(query)}&mode=text`);
    if (onSearch) {
      onSearch();
    }
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes, tags..."
          className="flex-1 px-4 py-2 border border-black/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white/90 text-black placeholder-black/50"
          style={{ fontSize: 'clamp(1rem, 4vw, 1rem)' }}
        />
        <button
          type="submit"
          className="px-4 md:px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm md:text-base"
          style={{ fontSize: 'clamp(0.875rem, 3.5vw, 1rem)' }}
        >
          Search
        </button>
      </form>
    </div>
  );
}

