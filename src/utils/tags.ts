// Tag definitions for training coach

export const BODY_SECTION_TAGS = [
  { id: 'front', label: 'Front (Anterior)' },
  { id: 'back', label: 'Back (Posterior)' },
  { id: 'free-side', label: 'Free Side' },
  { id: 'glide-side', label: 'Skating Side' },
  { id: 'upper-body', label: 'Upper Body (Superior)' },
  { id: 'lower-body', label: 'Lower Body (Inferior)' },
] as const;

// Mutually exclusive tag groups
export const TAG_GROUPS = {
  frontBack: ['front', 'back'],
  freeGlide: ['free-side', 'glide-side'],
  upperLower: ['upper-body', 'lower-body'],
  sequence: ['set', 'load', 'jump', 'hook', 'snap', 'hold', 'exit'],
} as const;

export const SPIN_TAGS = [
  { id: 'set', label: 'Set' },
  { id: 'load', label: 'Load' },
  { id: 'hook', label: 'Hook' },
  { id: 'snap', label: 'Snap' },
  { id: 'hold', label: 'Hold' },
  { id: 'exit', label: 'Exit' },
] as const;

export const JUMP_TAGS = [
  { id: 'set', label: 'Set' },
  { id: 'load', label: 'Load' },
  { id: 'jump', label: 'Jump' },
  { id: 'snap', label: 'Snap' },
  { id: 'exit', label: 'Exit' },
] as const;

export const EXERCISE_TAGS = [
  { id: 'on-ice', label: 'On Ice' },
  { id: 'off-ice', label: 'Off Ice' },
] as const;

export function getDisciplineTags(discipline?: 'Spins' | 'Jumps' | 'Edges'): Array<{ id: string; label: string }> {
  switch (discipline) {
    case 'Spins':
      return [...SPIN_TAGS];
    case 'Jumps':
      return [...JUMP_TAGS];
    default:
      return [];
  }
}

// Get sequence tags for exercises (combines all sequence options)
export function getExerciseSequenceTags(): Array<{ id: string; label: string }> {
  // Combine unique sequence tags from both spins and jumps
  const allTags = [...SPIN_TAGS, ...JUMP_TAGS];
  const uniqueTags = new Map<string, { id: string; label: string }>();
  allTags.forEach(tag => {
    if (!uniqueTags.has(tag.id)) {
      uniqueTags.set(tag.id, tag);
    }
  });
  return Array.from(uniqueTags.values());
}

