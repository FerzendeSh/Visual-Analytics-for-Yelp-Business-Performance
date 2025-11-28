/**
 * Shared utility functions and constants
 */

// ============================================================================
// String Formatting Utilities
// ============================================================================

/**
 * Format neighborhood names for display
 * Converts snake_case to Title Case
 * @example formatNeighborhoodName("downtown_east") => "Downtown East"
 */
export const formatNeighborhoodName = (neighborhood: string): string => {
  if (!neighborhood) return '';
  return neighborhood
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Format date string for display based on period type
 */
export const formatDateForPeriod = (dateString: string, period: 'month' | 'year'): string => {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }

    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();

    switch (period) {
      case 'month':
        return month;
      case 'year':
        return `${year}`;
      default:
        return dateString;
    }
  } catch {
    return dateString;
  }
};

// ============================================================================
// Cache/Performance Constants
// ============================================================================

/** Data stays fresh for 5 minutes */
export const STALE_TIME_DEFAULT = 5 * 60 * 1000;

/** Data stays fresh for 10 minutes (less frequently changing data) */
export const STALE_TIME_LONG = 10 * 60 * 1000;

/** Keep unused data in cache for 15 minutes */
export const GC_TIME_DEFAULT = 15 * 60 * 1000;

/** Keep unused data in cache for 30 minutes */
export const GC_TIME_LONG = 30 * 60 * 1000;

// ============================================================================
// Map/Viewport Constants
// ============================================================================

/** Maximum businesses to keep in accumulated cache before cleanup */
export const MAX_ACCUMULATED_BUSINESSES = 5000;

/** Zoom level thresholds for dynamic limit calculation */
export const ZOOM_THRESHOLDS = {
  FULLY_ZOOMED_OUT: 4,
  STATE_LEVEL: 7,
  CITY_LEVEL: 10,
} as const;

/** Business limits per zoom level */
export const BUSINESS_LIMITS = {
  FULLY_ZOOMED_OUT: 5000,
  STATE_LEVEL: 3000,
  CITY_LEVEL: 2000,
  NEIGHBORHOOD_LEVEL: 1500,
} as const;

/** Debounce delay for viewport updates in ms */
export const VIEWPORT_DEBOUNCE_MS = 500;

/** Search debounce delay in ms */
export const SEARCH_DEBOUNCE_MS = 300;

// ============================================================================
// Comparison/Selection Constants
// ============================================================================

/** Maximum number of businesses that can be compared */
export const MAX_COMPARISONS = 3;

// ============================================================================
// Data Transformation Utilities
// ============================================================================

/**
 * Create a Map from an array for O(1) lookups
 * @param array - Array of items
 * @param keyFn - Function to extract key from each item
 */
export function createLookupMap<T, K>(
  array: T[] | undefined | null,
  keyFn: (item: T) => K
): Map<K, T> {
  const map = new Map<K, T>();
  if (!array) return map;
  
  for (const item of array) {
    map.set(keyFn(item), item);
  }
  return map;
}
