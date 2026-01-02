import { useQuery } from '@tanstack/react-query';
import { useDebounce } from './useDebounce';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/useAppStore';

interface ViewportBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

export function useMapBusinesses(viewport: ViewportBounds | null) {
  const filters = useAppStore((state) => state.filters);

  const selectedCity = filters.cityId?.split('_')[0];
  const selectedState = filters.cityId?.split('_')[1];

  // Use immediate viewport for city/state filter queries (no debounce)
  // Only debounce for pure viewport-based queries
  const shouldUseImmediateViewport = !!(selectedCity || selectedState);
  const debouncedViewport = useDebounce(viewport, shouldUseImmediateViewport ? 0 : 300);

  return useQuery({
    queryKey: [
      'businesses',
      'map',
      selectedCity,
      selectedState,
      filters.neighborhoodId,
      filters.categories[0],
      filters.status,
      filters.ratingRange[0],
      debouncedViewport
    ],
    queryFn: async () => {
      console.log('🔍 Fetching businesses:', {
        hasViewport: !!debouncedViewport,
        city: selectedCity,
        state: selectedState,
        neighborhood: filters.neighborhoodId,
        status: filters.status,
        viewport: debouncedViewport
      });

      // Strategy: Always filter by city/state when selected, using either:
      // 1. Current viewport bounds (if available and stable)
      // 2. Global bounds (if viewport not available or during navigation)

      const baseParams = {
        state: selectedState || undefined,
        city: selectedCity || undefined,
        neighborhood: filters.neighborhoodId || undefined,
        category: filters.categories[0] || undefined,
        min_rating: filters.ratingRange[0],
        is_open: filters.status === 'OPEN' ? 1 : filters.status === 'CLOSED' ? 0 : undefined,
      };

      if (debouncedViewport) {
        // Use actual viewport bounds
        console.log('📍 Fetching with viewport:', { viewport: debouncedViewport, ...baseParams });
        return api.businesses.viewport({
          ...debouncedViewport,
          ...baseParams,
        });
      }

      // Fallback: Use global bounds when viewport not ready
      // This ensures businesses load immediately when city is selected
      if (selectedCity || selectedState) {
        console.log('📍 Using global bounds with city/state filter:', { city: selectedCity, state: selectedState });
        return api.businesses.viewport({
          south: -90,
          north: 90,
          west: -180,
          east: 180,
          ...baseParams,
        });
      }

      return [];
    },
    enabled: !!debouncedViewport || !!(selectedCity || selectedState),
    staleTime: 5000, // Reduce stale time to 5s so viewport changes trigger refetch faster
    gcTime: 30000, // Keep data cached for 30s
  });
}

export function useNeighborhoods(city?: string, state?: string) {
  return useQuery({
    queryKey: ['neighborhood-boundaries', city, state],
    queryFn: () => api.locations.getNeighborhoodBoundaries({ city, state }),
    enabled: !!(city && state),
    staleTime: Infinity, // Neighborhoods don't change
    retry: false, // Don't retry 404s for missing boundaries
    meta: {
      errorMessage: 'Neighborhood boundaries not available'
    }
  });
}
