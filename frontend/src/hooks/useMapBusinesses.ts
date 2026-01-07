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

/**
 * Hook to fetch businesses for the map.
 * 
 * SIMPLIFIED STRATEGY:
 * - When a specific city is selected: Always fetch ALL businesses for that city globally.
 *   This ensures we have data for navigation and the full city view.
 * - When "All Cities" is selected: Use viewport-based fetching for dynamic loading
 *   as the user pans around.
 */
export function useMapBusinesses(viewport: ViewportBounds | null) {
  const filters = useAppStore((state) => state.filters);

  const selectedCity = filters.cityId?.split('_')[0];
  const selectedState = filters.cityId?.split('_')[1];
  const isAllCities = filters.cityId === null;

  // Track previous viewport to detect significant changes (only used for "All Cities" mode)
  const prevSignificantViewportRef = useRef<ViewportBounds | null>(null);

  // Debounce viewport changes - only matters for "All Cities" mode
  const debouncedViewport = useDebounce(viewport, 500);

  // For "All Cities" mode, only update viewport if it changed significantly
  const significantViewport = useMemo(() => {
    if (!isAllCities) {
      // For specific cities, we don't use viewport at all
      return null;
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
      // Only include viewport for "All Cities" mode
      isAllCities ? significantViewport : 'global'
    ],
    queryFn: async () => {
      const baseParams = {
        category: filters.categories[0] || undefined,
        min_rating: filters.ratingRange[0],
        is_open: filters.status === 'OPEN' ? 1 : filters.status === 'CLOSED' ? 0 : undefined,
      };

      // STRATEGY 1: Specific city selected - ALWAYS fetch globally for that city
      // This ensures we have all businesses for navigation and the scatter plot
      if (selectedCity || selectedState) {
        console.log('📍 [BUSINESSES] Fetching ALL businesses for city:', { 
          city: selectedCity, 
          state: selectedState,
          neighborhood: filters.neighborhoodId 
        });
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
        console.log(`📍 [BUSINESSES] Received ${result.length} businesses for city`);
        return result;
      }

      // STRATEGY 2: "All Cities" mode - use viewport for dynamic loading
      if (isAllCities && significantViewport) {
        console.log('📍 [BUSINESSES] "All cities" mode - fetching in viewport');
        const result = await api.businesses.viewport({
          ...significantViewport,
          ...baseParams,
        });
        console.log(`📍 [BUSINESSES] Received ${result.length} businesses from viewport`);
        return result;
      }

      console.log('📍 [BUSINESSES] No city selected and no viewport, returning empty');
      return [];
    },
    // Enable when: city is selected OR (All Cities mode AND viewport available)
    enabled: !!(selectedCity || selectedState) || (isAllCities && !!significantViewport),
    staleTime: 30000, // Cache for 30 seconds - city data doesn't change often
    gcTime: 60000, // Keep in cache for 1 minute
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
