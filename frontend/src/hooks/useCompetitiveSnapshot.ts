/**
 * Custom hook for fetching competitive positioning data with React Query
 * Provides automatic caching, deduplication, and optimized refetching
 */
import { useQuery } from '@tanstack/react-query';
import { getCompetitiveSnapshot, CompetitiveSnapshot } from '../api/endpoints/analytics';

interface UseCompetitiveSnapshotParams {
  city?: string;
  state?: string;
  category?: string;
  businessId?: string;
  enabled?: boolean;
}

/**
 * Hook for fetching competitive snapshot data with intelligent caching
 * Returns all businesses in the market with pre-calculated statistics
 */
export const useCompetitiveSnapshot = ({
  city,
  state,
  category,
  businessId,
  enabled = true,
}: UseCompetitiveSnapshotParams) => {
  return useQuery<CompetitiveSnapshot>({
    queryKey: ['competitive-snapshot', city, state, category, businessId],
    queryFn: () => getCompetitiveSnapshot(city, state, category, businessId),
    enabled: enabled && !!city, // City is required - no data without city selection
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes (less frequent changes than time-series)
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
  });
};
