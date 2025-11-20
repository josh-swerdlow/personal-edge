import { Section } from '../db/training-coach/types';

// Generate UUID for sections
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createDefaultSections(): Section[] {
  return [
    {
      id: generateUUID(),
      title: 'Reminders',
      cards: [],
    },
    {
      id: generateUUID(),
      title: 'Troubleshooting',
      cards: [],
    },
    {
      id: generateUUID(),
      title: 'Theory',
      cards: [],
    },
    {
      id: generateUUID(),
      title: 'Exercises',
      cards: [],
    },
  ];
}

export function createCoreRemindersSection(): Section {
  return {
    id: generateUUID(),
    title: 'Core Reminders',
    cards: [],
  };
}

export const SECTION_DESCRIPTIONS: Record<string, string> = {
  'Core Reminders': 'Priority reminders that bubble to the top - automatically populated from priority items',
  'Reminders': 'Quick cues and reminders to keep in mind during practice',
  'Troubleshooting': 'Common problems, their causes, and solutions. Can link to Exercises as Remedies',
  'Theory': 'Technical understanding from foot to head, organized by body part',
  'Exercises': 'On-ice and off-ice exercises. Can be selected as Remedies in Troubleshooting',
};

export const SECTION_ORDER = ['Core Reminders', 'Reminders', 'Troubleshooting', 'Theory', 'Exercises'];

export function formatContentForSection(_sectionTitle: string, content: string): string {
  // No automatic formatting - user controls the format
  return content;
}

export interface SectionStyle {
  badge: string;
  badgeText: string;
  carouselContainer: string;
  tabText: string;
  tabBorder: string;
}

const DEFAULT_SECTION_STYLE: SectionStyle = {
  badge: 'bg-gray-100 border-gray-300',
  badgeText: 'text-gray-700',
  carouselContainer: 'border-gray-200 bg-gray-50/30',
  tabText: 'text-gray-600',
  tabBorder: 'bg-gray-600',
};

const SECTION_STYLE_MAP: Record<string, SectionStyle> = {
  'Core Reminders': {
    badge: 'bg-red-100 border-red-300',
    badgeText: 'text-red-700',
    carouselContainer: 'border-red-200 bg-red-50/30',
    tabText: 'text-red-600',
    tabBorder: 'bg-red-600',
  },
  Reminders: {
    badge: 'bg-blue-100 border-blue-300',
    badgeText: 'text-blue-700',
    carouselContainer: 'border-blue-200 bg-blue-50/30',
    tabText: 'text-blue-600',
    tabBorder: 'bg-blue-600',
  },
  Troubleshooting: {
    badge: 'bg-orange-100 border-orange-300',
    badgeText: 'text-orange-700',
    carouselContainer: 'border-orange-200 bg-orange-50/30',
    tabText: 'text-orange-600',
    tabBorder: 'bg-orange-600',
  },
  Theory: {
    badge: 'bg-purple-100 border-purple-300',
    badgeText: 'text-purple-700',
    carouselContainer: 'border-purple-200 bg-purple-50/30',
    tabText: 'text-purple-600',
    tabBorder: 'bg-purple-600',
  },
  Exercises: {
    badge: 'bg-green-100 border-green-300',
    badgeText: 'text-green-700',
    carouselContainer: 'border-green-200 bg-green-50/30',
    tabText: 'text-green-600',
    tabBorder: 'bg-green-600',
  },
};

export function getSectionStyle(sectionTitle?: string): SectionStyle {
  if (!sectionTitle) {
    return DEFAULT_SECTION_STYLE;
  }
  return SECTION_STYLE_MAP[sectionTitle] ?? DEFAULT_SECTION_STYLE;
}

