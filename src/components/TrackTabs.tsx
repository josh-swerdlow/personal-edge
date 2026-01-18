import { GoalTrack } from '../db/progress-tracker/types';

interface TrackTabsProps {
  activeTrack: GoalTrack;
  onTrackChange: (track: GoalTrack) => void;
}

export function TrackTabs({ activeTrack, onTrackChange }: TrackTabsProps) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        className={`h-6 min-h-0 min-w-0 px-2 py-0 rounded text-xs font-medium transition-colors flex items-center whitespace-nowrap leading-none ${
          activeTrack === 'on-ice'
            ? 'bg-blue-600 text-white'
            : 'bg-white/20 text-white hover:bg-white/30'
        }`}
        onClick={() => onTrackChange('on-ice')}
      >
        On Ice
      </button>
      <button
        type="button"
        className={`h-6 min-h-0 min-w-0 px-2 py-0 rounded text-xs font-medium transition-colors flex items-center whitespace-nowrap leading-none ${
          activeTrack === 'off-ice'
            ? 'bg-blue-600 text-white'
            : 'bg-white/20 text-white hover:bg-white/30'
        }`}
        onClick={() => onTrackChange('off-ice')}
      >
        Off Ice
      </button>
    </div>
  );
}

