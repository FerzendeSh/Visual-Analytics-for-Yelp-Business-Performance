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
  const isAllCities = filters.cityId === null;

  // Debounce viewport changes when panning/zooming to reduce API calls
  // Use minimal debounce (50ms) for fast business loading after navigation
  const debouncedViewport = useDebounce(viewport, 50);

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
      // Only include viewport in query key when NOT in "All cities" mode
      // This prevents refetching when panning/zooming with "All cities" selected
      isAllCities ? 'all-cities' : debouncedViewport
    ],
    queryFn: async () => {
      console.log('🔍 [BUSINESSES QUERY] Starting fetch:', {
        hasViewport: !!debouncedViewport,
        city: selectedCity,
        state: selectedState,
        neighborhood: filters.neighborhoodId,
        status: filters.status,
        viewport: debouncedViewport,
        isAllCities
      });

      const baseParams = {
        category: filters.categories[0] || undefined,
        min_rating: filters.ratingRange[0],
        is_open: filters.status === 'OPEN' ? 1 : filters.status === 'CLOSED' ? 0 : undefined,
      };

      // Strategy 1: "All cities" mode - fetch all businesses globally, ignore viewport changes
      if (isAllCities) {
        console.log('📍 [BUSINESSES QUERY] "All cities" mode - fetching all businesses globally');
        const result = await api.businesses.viewport({
          south: -90,
          north: 90,
          west: -180,
          east: 180,
          ...baseParams,
        });
        console.log(`📍 [BUSINESSES QUERY] Received ${result.length} businesses globally`);
        return result;
      }

      // Strategy 2: Specific city/state selected - use viewport for dynamic loading
      if (debouncedViewport) {
        console.log('📍 [BUSINESSES QUERY] Using viewport bounds:', {
          viewport: debouncedViewport,
          hasFilters: !!(selectedCity || selectedState)
        });
        const result = await api.businesses.viewport({
          ...debouncedViewport,
          ...baseParams,
        });
        console.log(`📍 [BUSINESSES QUERY] Received ${result.length} businesses from viewport`);
        return result;
      }

      // Strategy 3: Fallback when city/state filter active but viewport not available yet
      if (selectedCity || selectedState) {
        console.log('📍 [BUSINESSES QUERY] Using global bounds with city/state filter (no viewport):', { city: selectedCity, state: selectedState });
        const result = await api.businesses.viewport({
          south: -90,
          north: 90,
          west: -180,
          east: 180,
          state: selectedState || undefined,
          city: selectedCity || undefined,
          neighborhood: filters.neighborhoodId || undefined,
          ...baseParams,
        });
        console.log(`📍 [BUSINESSES QUERY] Received ${result.length} businesses from global bounds`);
        return result;
      }

      console.log('📍 [BUSINESSES QUERY] No viewport available, returning empty array');
      return [];
    },
    enabled: isAllCities || !!debouncedViewport || !!(selectedCity || selectedState),
    staleTime: isAllCities ? Infinity : 0, // "All cities" data never becomes stale; otherwise refetch on viewport change
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
