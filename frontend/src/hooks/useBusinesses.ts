/**
 * Custom hook for fetching businesses with React Query caching
 * Loads only the first batch and caches the result
 */
import { useQuery } from '@tanstack/react-query';
import { getBusinesses, Business } from '../api';

/**
 * Hook for fetching businesses with intelligent caching
 * Only loads first 1000 businesses for map/filter display
 */
export const useBusinesses = () => {
  return useQuery({
    queryKey: ['businesses'],
    queryFn: async () => {
      try {
        // Load first batch of businesses (1000)
        const businesses = await getBusinesses({ skip: 0, limit: 1000 });
        return businesses;
      } catch (apiErr) {
        console.warn('API request failed, falling back to static data:', apiErr);

        // Fallback to static JSON file
        const response = await fetch('/subset_businesses.json');
        if (!response.ok) {
          throw new Error('Failed to load business data from both API and static file');
        }

        const text = await response.text();
        const lines = text.trim().split('\n');
        const parsedBusinesses: Business[] = lines.map(line => JSON.parse(line));

        return parsedBusinesses;
      }
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    retry: 1, // Only retry once on failure
  });
};
