/**
 * Utility function to combine class names conditionally.
 * Handles strings, arrays, objects, and undefined/null values.
 *
 * @example
 * cn('base-class', condition && 'conditional-class')
 * cn('foo', { 'bar': isActive, 'baz': isDisabled })
 * cn(['a', 'b'], 'c')
 */
export function cn(...classes: (string | undefined | null | Record<string, boolean> | (string | undefined | null)[])[]): string {
  return classes
    .flat()
    .filter(Boolean)
    .map((cls) => {
      if (typeof cls === 'string') return cls;
      if (typeof cls === 'object' && cls !== null) {
        return Object.entries(cls)
          .filter(([, condition]) => condition)
          .map(([className]) => className)
          .join(' ');
      }
      return '';
    })
    .filter(Boolean)
    .join(' ');
}


