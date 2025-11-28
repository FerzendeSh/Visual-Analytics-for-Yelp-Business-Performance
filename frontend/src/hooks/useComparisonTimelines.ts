/**
 * Custom hook for fetching timeline data for comparison businesses
 * Fetches data for each comparison business using useQueries
 */
import { useQueries } from '@tanstack/react-query';
import { getBusinessCombinedTimeline, RatingsTimeline, SentimentTimeline } from '../api/endpoints/analytics';
import { Business } from '../api/types';

interface UseComparisonTimelinesParams {
  comparisonBusinesses: Business[];
  selectedCategory?: string;
  period?: 'month' | 'year';
  startDate?: string;
  endDate?: string;
}

/**
 * Hook for fetching timeline data for all comparison businesses
 * Returns array with data for each comparison business
 */
export const useComparisonTimelines = ({
  comparisonBusinesses = [],
  selectedCategory = '',
  period = 'year',
  startDate = '',
  endDate = '',
}: UseComparisonTimelinesParams) => {
  const queries = useQueries({
    queries: comparisonBusinesses.map(business => ({
      queryKey: ['timeline', 'comparison', business.business_id, period, startDate, endDate, selectedCategory],
      queryFn: () => getBusinessCombinedTimeline(
        business.business_id,
        period,
        startDate || undefined,
        endDate || undefined,
        selectedCategory || undefined
      ),
      enabled: !!business.business_id,
      staleTime: 5 * 60 * 1000,
    })),
  });

  // Combine results
  const isLoading = queries.some(q => q.isLoading);
  const error = queries.find(q => q.error)?.error;

  const ratingsDataArray: (RatingsTimeline | null)[] = queries.map((q) => {
    if (!q.data) return null;
    // The combined timeline returns business_ratings for individual businesses
    return q.data.business_ratings || null;
  });

  const sentimentDataArray: (SentimentTimeline | null)[] = queries.map((q) => {
    if (!q.data) return null;
    // The combined timeline returns business_sentiment for individual businesses
    return q.data.business_sentiment || null;
  });

  return {
    ratingsDataArray,
    sentimentDataArray,
    isLoading,
    error,
  };
};
