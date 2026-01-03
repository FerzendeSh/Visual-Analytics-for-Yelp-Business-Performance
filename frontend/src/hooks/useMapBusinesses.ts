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

  // Don't use viewport bounds when city/state filter is active
  // The viewport might not include the filtered city yet (before navigation completes)
  // Instead, always use global bounds with city/state filters
  const shouldUseViewport = !selectedCity && !selectedState;

  // Use immediate viewport for pure viewport queries (no debounce when no filters)
  // Debounce viewport changes when panning/zooming
  const debouncedViewport = useDebounce(viewport, 300);

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
      // Only include viewport in query key when NOT filtering by city/state
      // This prevents unnecessary refetches when map zooms after city selection
      shouldUseViewport ? debouncedViewport : null
    ],
    queryFn: async () => {
      console.log('🔍 [BUSINESSES QUERY] Starting fetch:', {
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

      // When city/state filter is active, ALWAYS use global bounds
      // This prevents getting 0 results when viewport doesn't include the filtered city yet
      if (selectedCity || selectedState) {
        console.log('📍 [BUSINESSES QUERY] Using global bounds with city/state filter:', { city: selectedCity, state: selectedState });
        const result = await api.businesses.viewport({
          south: -90,
          north: 90,
          west: -180,
          east: 180,
          ...baseParams,
        });
        console.log(`📍 [BUSINESSES QUERY] Received ${result.length} businesses from global bounds`);
        return result;
      }

      // No filters - use viewport bounds for exploring the map
      if (debouncedViewport && shouldUseViewport) {
        console.log('📍 [BUSINESSES QUERY] Fetching with viewport (no filters):', { viewport: debouncedViewport });
        const result = await api.businesses.viewport({
          ...debouncedViewport,
          ...baseParams,
        });
        console.log(`📍 [BUSINESSES QUERY] Received ${result.length} businesses from viewport`);
        return result;
      }

      console.log('📍 [BUSINESSES QUERY] No viewport or filters, returning empty array');
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
    queryFn: async () => {
      const result = await api.locations.getNeighborhoodBoundaries({ city, state });
      if (!result) {
        console.log('🗺️ Neighborhood boundaries not available for:', { city, state });
      }
      return result;
    },
    enabled: !!(city && state),
    staleTime: Infinity, // Neighborhoods don't change
    retry: false, // Don't retry 404s for missing boundaries
  });
}
