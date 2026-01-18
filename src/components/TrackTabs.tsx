import { GoalTrack } from '../db/progress-tracker/types';

interface TrackTabsProps {
  activeTrack: GoalTrack;
  onTrackChange: (track: GoalTrack) => void;
}

export function TrackTabs({ activeTrack, onTrackChange }: TrackTabsProps) {
  return (
    <div className="flex gap-1.5">
      <button
        type="button"
        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
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
        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
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

