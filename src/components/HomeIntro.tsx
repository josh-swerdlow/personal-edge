import { useState, useEffect, useRef } from 'react';
import SearchBar from './SearchBar';

interface HomeIntroProps {
  onTransition: () => void;
}

export default function HomeIntro({ onTransition }: HomeIntroProps) {
  const [searchBarVisible, setSearchBarVisible] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number; randomX: number; randomY: number }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isTransitioningRef = useRef(false);

  // Animation sequence
  useEffect(() => {
    // Search bar appears after a brief delay
    const searchTimer = setTimeout(() => {
      setSearchBarVisible(true);
      // Generate particles with random positions and delays
      const newParticles = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 0.5,
        randomX: Math.random(),
        randomY: Math.random(),
      }));
      setParticles(newParticles);
    }, 1000);

    return () => {
      clearTimeout(searchTimer);
    };
  }, []);

  // Swipe detection
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isTransitioningRef.current) return;
    const touch = e.touches[0];
    swipeStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeStartRef.current || isTransitioningRef.current) return;
    const touch = e.touches[0];
    const deltaY = swipeStartRef.current.y - touch.clientY;
    const deltaX = Math.abs(touch.clientX - swipeStartRef.current.x);

    // Only trigger on upward swipe (not horizontal)
    if (deltaY > 50 && deltaX < 100) {
      handleTransition();
    }
  };

  // Mouse scroll detection
  const handleWheel = (e: React.WheelEvent) => {
    if (isTransitioningRef.current) return;

    // Only trigger on upward scroll
    if (e.deltaY < -10) {
      handleTransition();
    }
  };

  const handleTransition = () => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;

    // Trigger transition (no localStorage - intro shows every time)
    onTransition();
  };

  // Random direction for search bar (left-to-right or right-to-left)
  const searchBarDirection = useRef(Math.random() > 0.5 ? 'left' : 'right').current;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onWheel={handleWheel}
      style={{
        height: '100dvh',
        backgroundImage: 'url(/background.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Ice Particles Container */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="ice-particle"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              animationDelay: `${particle.delay}s`,
              '--random-x': particle.randomX,
              '--random-y': particle.randomY,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Search Bar */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl px-4"
        style={{
          opacity: searchBarVisible ? 1 : 0,
          transform: searchBarVisible
            ? 'translate(-50%, -50%)'
            : `translate(${searchBarDirection === 'left' ? '-150%, -50%' : '50%, -50%'})`,
          transition: 'opacity 1s ease-out, transform 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl p-6 border border-white/50">
          <SearchBar />
        </div>
      </div>

      {/* Swipe hint (subtle) */}
      {searchBarVisible && (
        <div
          className="absolute text-white/60 text-sm animate-bounce pointer-events-none text-center whitespace-nowrap"
          style={{
            left: '50%',
            bottom: 'clamp(1rem, env(safe-area-inset-bottom) + 2rem, 2rem)',
            opacity: searchBarVisible ? 1 : 0,
            transition: 'opacity 0.5s ease-in',
            transform: 'translateX(-50%)',
          }}
        >
          Swipe up to continue
        </div>
      )}
    </div>
  );
}

