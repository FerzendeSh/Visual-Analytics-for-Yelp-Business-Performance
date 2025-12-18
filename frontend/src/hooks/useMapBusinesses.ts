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

  // Debounce viewport changes to avoid excessive API calls
  const debouncedViewport = useDebounce(viewport, 300);

  return useQuery({
    queryKey: ['businesses', 'viewport', debouncedViewport, filters],
    queryFn: async () => {
      if (!debouncedViewport) return [];

      return api.businesses.viewport({
        ...debouncedViewport,
        state: filters.cityId?.split('_')[1] || undefined,
        city: filters.cityId?.split('_')[0] || undefined,
        neighborhood: filters.neighborhoodId || undefined,
        category: filters.categories[0] || undefined,
        status: filters.status,
        min_rating: filters.ratingRange[0],
      });
    },
    enabled: !!debouncedViewport,
    staleTime: 30000, // 30 seconds
  });
}

export function useNeighborhoods(city?: string, state?: string) {
  return useQuery({
    queryKey: ['neighborhood-boundaries', city, state],
    queryFn: () => api.locations.getNeighborhoodBoundaries({ city, state }),
    enabled: !!(city && state),
    staleTime: Infinity, // Neighborhoods don't change
  });
}
