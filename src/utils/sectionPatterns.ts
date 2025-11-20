// Section pattern utilities - CSS class names for visual distinction

export function getSectionPatternClass(sectionTitle: string): string {
  switch (sectionTitle) {
    case 'Reminders':
    case 'Core Reminders':
      return 'section-pattern-triangles';
    case 'Troubleshooting':
      return 'section-pattern-loops';
    case 'Theory':
      return 'section-pattern-dots';
    case 'Exercises':
      return 'section-pattern-legos';
    default:
      return '';
  }
}

