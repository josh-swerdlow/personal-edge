import { ReactNode } from 'react';

interface LiquidGlassCardProps {
  children: ReactNode;
  className?: string;
}

export default function LiquidGlassCard({ children, className = '' }: LiquidGlassCardProps) {
  return (
    <div className={`liquid-glass liquid-glass--card ${className}`}>
      <div className="liquid-glass__content">
        {children}
      </div>
    </div>
  );
}

