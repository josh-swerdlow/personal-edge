export const DISCIPLINES = ["Spins", "Jumps", "Edges"] as const;

export type Discipline = typeof DISCIPLINES[number];

const DISCIPLINE_DISPLAY_MAP: Record<Discipline, string> = {
  Spins: "Spin",
  Jumps: "Jump",
  Edges: "Edge",
};

const DISCIPLINE_BADGE_CLASS_MAP: Record<Discipline, string> = {
  Spins: "bg-blue-100 text-blue-800 border-blue-300",
  Jumps: "bg-green-100 text-green-800 border-green-300",
  Edges: "bg-purple-100 text-purple-800 border-purple-300",
};

const DISCIPLINE_ACCENT_CLASS_MAP: Record<Discipline, string> = {
  Spins: "bg-blue-600 text-white",
  Jumps: "bg-green-600 text-white",
  Edges: "bg-purple-600 text-white",
};

export function getDisciplineDisplay(discipline: Discipline): string {
  return DISCIPLINE_DISPLAY_MAP[discipline];
}

export function getDisciplineBadgeClasses(discipline: Discipline): string {
  return DISCIPLINE_BADGE_CLASS_MAP[discipline];
}

export function getDisciplineAccentClasses(discipline: Discipline): string {
  return DISCIPLINE_ACCENT_CLASS_MAP[discipline];
}

