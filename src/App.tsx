import { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { FaBars, FaTimes, FaSearch } from 'react-icons/fa';
import DeckList from './pages/DeckList';
import DeckView from './pages/DeckView';
import SearchResults from './pages/SearchResults';
import MergeWorkflow from './pages/MergeWorkflow';
import DbInspector from './pages/DbInspector';
import ProgressTracker from './pages/ProgressTracker';
import Home from './pages/Home';
import Landing from './pages/Landing';
import SearchBar from './components/SearchBar';
import SyncProvider from './components/SyncProvider';
import { getAppData, getCurrentFocus, getDaysUntilNextCycle } from './db/progress-tracker/operations';
import { cn } from './utils/cn';

// Context to track intro state
const IntroContext = createContext<{ isIntroActive: boolean; setIntroActive: (active: boolean) => void }>({
  isIntroActive: false,
  setIntroActive: () => {},
});

export const useIntro = () => useContext(IntroContext);

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [currentWeekInfo, setCurrentWeekInfo] = useState<{ focus: string; daysRemaining: number | null } | null>(null);
  const [isIntroActive, setIsIntroActive] = useState(true);

  // Check if user has seen landing page on first load
  useEffect(() => {
    const hasSeenLanding = localStorage.getItem('hasSeenLanding');
    if (!hasSeenLanding && location.pathname === '/') {
      navigate('/landing', { replace: true });
    }
  }, [navigate, location.pathname]);

  // Hide nav on landing page
  useEffect(() => {
    if (location.pathname === '/landing') {
      setIsIntroActive(true);
    } else {
      setIsIntroActive(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    async function loadWeekInfo() {
      try {
        const appData = await getAppData();
        const focus = getCurrentFocus(appData.startDate, appData.cycleLength);
        const daysRemaining = getDaysUntilNextCycle(appData.startDate);
        setCurrentWeekInfo({ focus, daysRemaining });
      } catch (error) {
        console.error('Failed to load week info:', error);
      }
    }
    loadWeekInfo();
    // Refresh every minute to update days remaining
    const interval = setInterval(loadWeekInfo, 60000);
    return () => clearInterval(interval);
  }, []);

  function toggleMobileMenu() {
    setMobileMenuOpen(prev => !prev);
  }

  function closeMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <SyncProvider>
      <IntroContext.Provider value={{ isIntroActive, setIntroActive: setIsIntroActive }}>
        <div
        className="flex flex-col overflow-hidden"
        style={{
          height: '100dvh',
          backgroundColor: 'transparent',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
        }}
      >
        <nav
          className={cn(
            "liquid-glass liquid-glass--nav flex-shrink-0 relative z-[var(--z-sticky)] transition-transform duration-300 ease-in-out",
            isIntroActive ? "-translate-y-full invisible" : "translate-y-0 visible"
          )}
          style={{
            position: 'sticky',
            top: 0,
          }}
        >
          <div className="liquid-glass__content max-w-7xl mx-auto px-4 py-3">
            <div className="flex justify-between items-center">
              <div>
                <Link
                  to="/"
                  className="text-xl font-bold text-white"
                  onClick={closeMobileMenu}
                >
                  Training Coach
                </Link>
                {currentWeekInfo && (
                  <div className="text-xs text-white mt-0.5">
                    {currentWeekInfo.focus === 'Spins' ? 'Spin' : currentWeekInfo.focus === 'Jumps' ? 'Jump' : 'Edge'} Week ({currentWeekInfo.daysRemaining} day{currentWeekInfo.daysRemaining !== 1 ? 's' : ''} remaining)
                  </div>
                )}
              </div>

              {/* Desktop Navigation */}
              <div className="hidden md:flex gap-4 items-center">
                <Link
                  to="/progress"
                  className="text-white hover:text-white/80 transition-colors px-3 py-2 rounded-md hover:bg-white/10"
                >
                  Progress Tracker
                </Link>
                <Link
                  to="/decks"
                  className="text-white hover:text-white/80 transition-colors px-3 py-2 rounded-md hover:bg-white/10"
                >
                  Decks
                </Link>
                <Link
                  to="/db-inspector"
                  className="text-white hover:text-white/80 transition-colors px-3 py-2 rounded-md hover:bg-white/10"
                >
                  DB Inspector
                </Link>
                <button
                  onClick={() => {
                    setShowSearchModal(true);
                    closeMobileMenu();
                  }}
                  className="p-2 text-white hover:text-white/80 hover:bg-white/10 rounded-md transition-colors"
                  aria-label="Search"
                >
                  <FaSearch size={18} />
                </button>
              </div>

              {/* Mobile Navigation */}
              <div className="md:hidden flex gap-2 items-center">
                <button
                  type="button"
                  onClick={toggleMobileMenu}
                  className="p-2 text-white hover:text-white/80 hover:bg-white/10 rounded-md transition-colors"
                  aria-label="Toggle menu"
                  aria-expanded={mobileMenuOpen}
                >
                  <FaBars size={20} />
                </button>
                <button
                  onClick={() => {
                    setShowSearchModal(true);
                    closeMobileMenu();
                  }}
                  className="p-2 text-white hover:text-white/80 hover:bg-white/10 rounded-md transition-colors"
                  aria-label="Search"
                >
                  <FaSearch size={18} />
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Mobile Menu Backdrop - rendered first so menu can be on top */}
        {mobileMenuOpen && (
          <div
            className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-[var(--z-modal-backdrop)]"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
        )}

        {/* Mobile Navigation Menu - rendered after backdrop to ensure it's on top */}
        {mobileMenuOpen && (
          <div
            className="md:hidden fixed top-16 left-0 right-0 liquid-glass liquid-glass--card z-[var(--z-modal)]"
          >
            <div className="liquid-glass__content">
              <div className="flex justify-between items-center px-4 py-3 border-b border-white/30">
                <h2 className="text-lg font-semibold text-white">Menu</h2>
                <button
                  onClick={closeMobileMenu}
                  className="p-2 text-white hover:text-white/80 hover:bg-white/10 rounded-md transition-colors"
                  aria-label="Close menu"
                >
                  <FaTimes size={20} />
                </button>
              </div>
              <div className="flex flex-col py-2">
                <Link
                  to="/progress"
                  className="px-4 py-3 text-white hover:text-white/80 hover:bg-white/10 transition-colors"
                  onClick={closeMobileMenu}
                >
                  Progress Tracker
                </Link>
                <Link
                  to="/decks"
                  className="px-4 py-3 text-white hover:text-white/80 hover:bg-white/10 transition-colors"
                  onClick={closeMobileMenu}
                >
                  Decks
                </Link>
                <Link
                  to="/db-inspector"
                  className="px-4 py-3 text-white hover:text-white/80 hover:bg-white/10 transition-colors"
                  onClick={closeMobileMenu}
                >
                  DB Inspector
                </Link>
                <button
                  onClick={() => {
                    setShowSearchModal(true);
                    closeMobileMenu();
                  }}
                  className="px-4 py-3 text-white hover:text-white/80 hover:bg-white/10 transition-colors text-left"
                >
                  Search
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search Modal */}
        {showSearchModal && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowSearchModal(false)}
            style={{
              paddingTop: 'clamp(1rem, env(safe-area-inset-top) + 1rem, 2rem)',
              paddingBottom: 'clamp(1rem, env(safe-area-inset-bottom) + 1rem, 2rem)',
            }}
          >
            <div
              className="liquid-glass liquid-glass--card max-w-2xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="liquid-glass__content">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-white" style={{ fontSize: 'clamp(1.25rem, 5vw, 1.5rem)' }}>Search</h2>
                  <button
                    onClick={() => setShowSearchModal(false)}
                    className="p-2 text-white hover:text-white/80 hover:bg-white/10 rounded-md transition-colors"
                    aria-label="Close search"
                  >
                    <FaTimes size={20} />
                  </button>
                </div>
                <SearchBar onSearch={() => setShowSearchModal(false)} />
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-hidden" style={{ position: 'relative', zIndex: 1 }}>
          <Routes>
            <Route path="/landing" element={<Landing />} />
            <Route path="/" element={<Home />} />
            <Route path="/decks" element={<DeckList />} />
            <Route path="/deck/:deckId" element={<DeckView />} />
            <Route path="/search" element={<SearchResults />} />
            <Route path="/progress" element={<ProgressTracker />} />
            <Route path="/merge" element={<MergeWorkflow />} />
            <Route path="/db-inspector" element={<DbInspector />} />
          </Routes>
        </div>
      </div>
      </IntroContext.Provider>
    </SyncProvider>
  );
}

export default App;
