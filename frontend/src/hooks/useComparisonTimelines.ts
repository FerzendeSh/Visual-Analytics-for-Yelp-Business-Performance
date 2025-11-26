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
    // Extract ratings timeline from combined response
    const ratingsKey = Object.keys(q.data).find(key => key.includes('rating')) as keyof typeof q.data;
    return ratingsKey ? (q.data[ratingsKey] as any as RatingsTimeline) : null;
  });

  const sentimentDataArray: (SentimentTimeline | null)[] = queries.map((q) => {
    if (!q.data) return null;
    // Extract sentiment timeline from combined response
    const sentimentKey = Object.keys(q.data).find(key => key.includes('sentiment')) as keyof typeof q.data;
    return sentimentKey ? (q.data[sentimentKey] as any as SentimentTimeline) : null;
  });

  return {
    ratingsDataArray,
    sentimentDataArray,
    isLoading,
    error,
  };
};
