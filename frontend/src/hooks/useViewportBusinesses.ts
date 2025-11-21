/**
 * Custom hook for fetching businesses within a viewport with React Query caching
 * Implements smart viewport-based loading with debouncing and filter support
 */
import { useQuery } from '@tanstack/react-query';
import { getBusinessesInViewport } from '../api/endpoints/businesses';
import { Business } from '../api/types';

export interface ViewportBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

export interface ViewportFilters {
  state?: string;
  city?: string;
  neighborhood?: string;
  category?: string;
  min_rating?: number;
  is_open?: number;
}

interface UseViewportBusinessesOptions {
  bounds: ViewportBounds;
  filters?: ViewportFilters;
  limit?: number;
  enabled?: boolean; // Allow disabling the query
}

/**
 * Hook for fetching businesses within a viewport with intelligent caching
 *
 * Features:
 * - Viewport-based loading (only loads visible businesses)
 * - Server-side filtering (city, state, category, rating, status)
 * - React Query caching (automatically caches by viewport + filters)
 * - Can be disabled to prevent fetching
 *
 * Usage:
 * ```tsx
 * const { data: businesses, isLoading } = useViewportBusinesses({
 *   bounds: { south: 36.0, north: 36.3, west: -87.0, east: -86.5 },
 *   filters: { city: 'Nashville', min_rating: 4, is_open: 1 }
 * });
 * ```
 */
export const useViewportBusinesses = ({
  bounds,
  filters,
  limit = 1000,
  enabled = true,
}: UseViewportBusinessesOptions) => {
  // Create stable query key that includes bounds and filters
  // This ensures proper cache invalidation when viewport or filters change
  const queryKey = [
    'businesses',
    'viewport',
    bounds.south.toFixed(4), // Round to ~11m precision
    bounds.north.toFixed(4),
    bounds.west.toFixed(4),
    bounds.east.toFixed(4),
    filters?.state,
    filters?.city,
    filters?.neighborhood,
    filters?.category,
    filters?.min_rating,
    filters?.is_open,
    limit,
  ];

  return useQuery<Business[], Error>({
    queryKey,
    queryFn: async () => {
      const businesses = await getBusinessesInViewport({
        ...bounds,
        ...filters,
        limit,
      });
      return businesses;
    },
    enabled, // Only run query if enabled
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes (viewport data changes more frequently)
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 minutes
    retry: 2, // Retry twice on failure
    refetchOnWindowFocus: false, // Don't refetch when user returns to tab
  });
};
