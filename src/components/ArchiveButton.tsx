import { FaArchive } from 'react-icons/fa';

interface ArchiveButtonProps {
  onClick: () => void;
  showText?: boolean; // If true, shows "Archive" text; if false, shows only icon
  className?: string;
}

export default function ArchiveButton({ onClick, showText = true, className = '' }: ArchiveButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-2 text-white hover:text-orange-500 transition-colors font-medium text-sm leading-none ${className}`}
      title="Archive goals"
      aria-label="Archive goals"
      style={{
        height: '28px',
        lineHeight: '28px',
      }}
    >
      <FaArchive size={14} style={{ display: 'block' }} />
      {showText && <span className="leading-none">Archive</span>}
    </button>
  );
}

