import { useQuery } from '@tanstack/react-query';
import { useDebounce } from './useDebounce';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/useAppStore';
import { useMemo, useRef } from 'react';

interface ViewportBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

/**
 * Calculate if viewport has moved significantly enough to warrant a refetch
 * Returns true if any dimension changed by more than the threshold percentage
 */
function hasSignificantViewportChange(
  prev: ViewportBounds | null,
  current: ViewportBounds | null,
  thresholdPercent: number = 15
): boolean {
  if (!prev || !current) return true;

  const latRange = prev.north - prev.south;
  const lonRange = prev.east - prev.west;

  const latChange = Math.abs(current.north - prev.north) + Math.abs(current.south - prev.south);
  const lonChange = Math.abs(current.east - prev.east) + Math.abs(current.west - prev.west);

  const latChangePercent = (latChange / latRange) * 100;
  const lonChangePercent = (lonChange / lonRange) * 100;

  return latChangePercent > thresholdPercent || lonChangePercent > thresholdPercent;
}

export function useMapBusinesses(viewport: ViewportBounds | null) {
  const filters = useAppStore((state) => state.filters);

  const selectedCity = filters.cityId?.split('_')[0];
  const selectedState = filters.cityId?.split('_')[1];
  const isAllCities = filters.cityId === null;

  // Track previous viewport to detect significant changes
  const prevSignificantViewportRef = useRef<ViewportBounds | null>(null);

  // Debounce viewport changes when panning/zooming to reduce API calls
  // Use longer debounce (500ms) for "All Cities" mode to wait until user stops moving
  // Use shorter debounce (50ms) for specific city for fast loading after navigation
  const debounceTime = isAllCities ? 500 : 50;
  const debouncedViewport = useDebounce(viewport, debounceTime);

  // For "All Cities" mode, only update viewport if it changed significantly
  // This prevents tiny movements from triggering refetches
  const significantViewport = useMemo(() => {
    if (!isAllCities) {
      // For specific cities, always use debounced viewport (existing behavior)
      return debouncedViewport;
    }

    // For "All Cities", check if viewport changed significantly
    if (hasSignificantViewportChange(prevSignificantViewportRef.current, debouncedViewport)) {
      prevSignificantViewportRef.current = debouncedViewport;
      return debouncedViewport;
    }

    // Return previous significant viewport if change was too small
    return prevSignificantViewportRef.current;
  }, [debouncedViewport, isAllCities]);

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
      // Include significant viewport in query key for both modes
      // For "All Cities", this only changes when viewport moves significantly
      // For specific city, this changes with every debounced viewport update
      significantViewport
    ],
    queryFn: async () => {
      console.log('🔍 [BUSINESSES QUERY] Starting fetch:', {
        hasViewport: !!significantViewport,
        city: selectedCity,
        state: selectedState,
        neighborhood: filters.neighborhoodId,
        status: filters.status,
        viewport: significantViewport,
        isAllCities
      });

      const baseParams = {
        category: filters.categories[0] || undefined,
        min_rating: filters.ratingRange[0],
        is_open: filters.status === 'OPEN' ? 1 : filters.status === 'CLOSED' ? 0 : undefined,
      };

      // Strategy 1: "All cities" mode - use viewport for dynamic loading (NEW BEHAVIOR)
      if (isAllCities && significantViewport) {
        console.log('📍 [BUSINESSES QUERY] "All cities" mode - fetching businesses in viewport');
        const result = await api.businesses.viewport({
          ...significantViewport,
          ...baseParams,
        });
        console.log(`📍 [BUSINESSES QUERY] Received ${result.length} businesses from viewport (All Cities)`);
        return result;
      }

      // Strategy 2: Specific city/state selected - use viewport for dynamic loading
      if (significantViewport) {
        console.log('📍 [BUSINESSES QUERY] Using viewport bounds:', {
          viewport: significantViewport,
          hasFilters: !!(selectedCity || selectedState)
        });
        const result = await api.businesses.viewport({
          ...significantViewport,
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
    enabled: !!significantViewport || !!(selectedCity || selectedState),
    staleTime: 0, // Always refetch when viewport changes significantly
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
