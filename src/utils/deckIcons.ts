export const ANIMALS = ['bee', 'duck', 'cow', 'rabbit', 'dolphin', 'squid'] as const;
export type Animal = typeof ANIMALS[number];

// Map section titles to folder names
const SECTION_TO_FOLDER: Record<string, string> = {
  'Reminders': 'reminders',
  'Core Reminders': 'reminders', // Map to reminders folder
  'Troubleshooting': 'troubleshooting',
  'Theory': 'theory',
  'Exercises': 'troubleshooting', // Fallback - or add exercises folder later
};

// Map discipline to folder name (normalize case)
const DISCIPLINE_TO_FOLDER: Record<string, string> = {
  'Jumps': 'jump',
  'Spins': 'spins',
  'Edges': 'edges',
};

export function getRandomAnimal(): Animal {
  return ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
}

export function getDeckIconPath(
  animal: Animal | undefined,
  discipline: string | undefined,
  sectionTitle: string
): string {
  // Fallback to bee if no animal assigned
  const animalName = animal || 'bee';

  // Normalize discipline
  const disciplineFolder = discipline
    ? DISCIPLINE_TO_FOLDER[discipline] || discipline.toLowerCase()
    : 'spins'; // Default to spins

  // Normalize section
  const sectionFolder = SECTION_TO_FOLDER[sectionTitle] || sectionTitle.toLowerCase();

  return `/deck-icons/${animalName}/${disciplineFolder}/${sectionFolder}/icon.svg`;
}

