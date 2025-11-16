/**
 * Custom hook for fetching timeline data with React Query
 * Provides automatic caching, deduplication, and optimized refetching
 */
import { useQuery } from '@tanstack/react-query';
import {
  getBusinessCombinedTimeline,
  getCityCombinedTimeline,
  getCategoryCombinedTimeline,
} from '../api/endpoints/analytics';
import { Business } from '../api/types';

interface UseTimelineDataParams {
  business: Business | null;
  selectedCity?: string;
  selectedState?: string;
  selectedCategory?: string;
  period?: 'month' | 'year';
  selectedYear?: number;
}

/**
 * Hook for fetching timeline data with intelligent caching
 * Automatically determines which endpoint to use based on selection
 */
export const useTimelineData = ({
  business,
  selectedCity = '',
  selectedState = '',
  selectedCategory = '',
  period = 'year',
  selectedYear,
}: UseTimelineDataParams) => {
  // Calculate date range for monthly view
  let startDate: string | undefined;
  let endDate: string | undefined;

  if (period === 'month' && selectedYear) {
    startDate = `${selectedYear}-01-01`;
    endDate = `${selectedYear}-12-31`;
  }

  // Scenario 1: Business is selected - fetch combined business data
  const businessQuery = useQuery({
    queryKey: ['timeline', 'business', business?.business_id, period, startDate, endDate],
    queryFn: () => getBusinessCombinedTimeline(business!.business_id, period, startDate, endDate),
    enabled: !!business?.business_id,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Scenario 2: City is selected (no business) - fetch combined city data
  const cityQuery = useQuery({
    queryKey: ['timeline', 'city', selectedState, selectedCity, selectedCategory, period, startDate, endDate],
    queryFn: () => getCityCombinedTimeline(
      selectedCity,
      selectedState,
      period,
      startDate,
      endDate,
      selectedCategory || undefined
    ),
    enabled: !business && !!selectedCity && !!selectedState,
    staleTime: 5 * 60 * 1000,
  });

  // Scenario 3: Only category is selected (no business, no city) - USE COMBINED ENDPOINT
  const categoryQuery = useQuery({
    queryKey: ['timeline', 'category', selectedCategory, period, startDate, endDate],
    queryFn: () => getCategoryCombinedTimeline(selectedCategory, period, startDate, endDate),
    enabled: !business && !selectedCity && !!selectedCategory,
    staleTime: 5 * 60 * 1000,
  });

  // Determine which data source to use
  if (business?.business_id) {
    return {
      isLoading: businessQuery.isLoading,
      error: businessQuery.error,
      data: businessQuery.data,
      primaryCategory: business.categories ? business.categories.split(',')[0].trim() : '',
    };
  }

  if (selectedCity && selectedState) {
    return {
      isLoading: cityQuery.isLoading,
      error: cityQuery.error,
      data: cityQuery.data,
      primaryCategory: selectedCategory,
    };
  }

  if (selectedCategory) {
    return {
      isLoading: categoryQuery.isLoading,
      error: categoryQuery.error,
      data: categoryQuery.data ? {
        city_ratings: categoryQuery.data.category_ratings || null,
        city_sentiment: categoryQuery.data.category_sentiment || null,
        category_ratings: null,
        category_sentiment: null,
      } : null,
      primaryCategory: selectedCategory,
    };
  }

  // No selection
  return {
    isLoading: false,
    error: null,
    data: null,
    primaryCategory: '',
  };
};
