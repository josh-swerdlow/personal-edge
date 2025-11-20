import { ReactNode } from 'react';

interface PageLayoutProps {
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '7xl';
  hasSettingsBar?: boolean;
}

export default function PageLayout({ children, maxWidth = '4xl', hasSettingsBar = false }: PageLayoutProps) {
  const maxWidthClass = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '7xl': 'max-w-7xl',
  }[maxWidth];

  return (
    <div
      className="relative overflow-y-auto h-full"
      style={{
        minHeight: '100%',
        position: 'relative',
        paddingTop: 'clamp(0.5rem, 2vw, 1rem)',
        paddingLeft: 'clamp(0.5rem, 2vw, 1rem)',
        paddingRight: 'clamp(0.5rem, 2vw, 1rem)',
        paddingBottom: 'clamp(0.5rem, env(safe-area-inset-bottom) + 0.5rem, 1rem)',
      }}
    >
      {/* Crisp Background Image */}
      <div
        className="fixed inset-0"
        style={{
          backgroundImage: 'url(/background.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Main Content */}
      <div
        className={`${maxWidthClass} mx-auto relative`}
        style={{
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}

