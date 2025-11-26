/**
 * Custom hook for fetching timeline data with React Query
 * Provides automatic caching, deduplication, and optimized refetching
 */
import { useQuery } from '@tanstack/react-query';
import {
  getBusinessCombinedTimeline,
  getCityCombinedTimeline,
  getNeighborhoodCombinedTimeline,
  getCategoryCombinedTimeline,
} from '../api/endpoints/analytics';
import { Business } from '../api/types';

interface UseTimelineDataParams {
  business: Business | null;
  selectedCity?: string;
  selectedState?: string;
  selectedCategory?: string;
  selectedNeighborhood?: string;
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
  selectedNeighborhood = '',
  period = 'year',
  selectedYear,
}: UseTimelineDataParams) => {
  let startDate: string = '';
  let endDate: string = '';

  if (period === 'month' && selectedYear) {
    startDate = `${selectedYear}-01-01`;
    endDate = `${selectedYear}-12-31`;
  }

  const businessQuery = useQuery({
    queryKey: ['timeline', 'business', business?.business_id || '', period, startDate, endDate, selectedCategory],
    queryFn: () => getBusinessCombinedTimeline(business!.business_id, period, startDate || undefined, endDate || undefined, selectedCategory || undefined),
    enabled: !!business?.business_id,
    staleTime: 5 * 60 * 1000,
  });

  const neighborhoodQuery = useQuery({
    queryKey: ['timeline', 'neighborhood', selectedState, selectedCity, selectedNeighborhood, selectedCategory, period, startDate, endDate],
    queryFn: () => getNeighborhoodCombinedTimeline(
      selectedNeighborhood,
      selectedCity,
      selectedState,
      period,
      startDate || undefined,
      endDate || undefined,
      selectedCategory || undefined
    ),
    enabled: !!selectedNeighborhood && !!selectedCity && !!selectedState,
    staleTime: 5 * 60 * 1000,
  });

  const cityQuery = useQuery({
    queryKey: ['timeline', 'city', selectedState, selectedCity, selectedCategory, period, startDate, endDate],
    queryFn: () => getCityCombinedTimeline(
      selectedCity,
      selectedState,
      period,
      startDate || undefined,
      endDate || undefined,
      selectedCategory || undefined
    ),
    enabled: !selectedNeighborhood && !!selectedCity && !!selectedState,
    staleTime: 5 * 60 * 1000,
  });

  const categoryQuery = useQuery({
    queryKey: ['timeline', 'category', selectedCategory, period, startDate, endDate],
    queryFn: () => getCategoryCombinedTimeline(selectedCategory, period, startDate || undefined, endDate || undefined),
    enabled: false,
    staleTime: 5 * 60 * 1000,
  });

  if (business?.business_id) {
    // When business is selected, combine business data with neighborhood/city data if available
    if (selectedNeighborhood && neighborhoodQuery.data) {
      return {
        isLoading: businessQuery.isLoading || neighborhoodQuery.isLoading,
        error: businessQuery.error || neighborhoodQuery.error,
        data: businessQuery.data ? {
          ...businessQuery.data,
          neighborhood_ratings: neighborhoodQuery.data.neighborhood_ratings,
          neighborhood_sentiment: neighborhoodQuery.data.neighborhood_sentiment,
        } : null,
        primaryCategory: business.categories ? business.categories.split(',')[0].trim() : '',
      };
    }
    // Include city data if a city is selected
    if (selectedCity && selectedState && cityQuery.data) {
      return {
        isLoading: businessQuery.isLoading || cityQuery.isLoading,
        error: businessQuery.error || cityQuery.error,
        data: businessQuery.data ? {
          ...businessQuery.data,
          city_ratings: cityQuery.data.city_ratings,
          city_sentiment: cityQuery.data.city_sentiment,
        } : null,
        primaryCategory: business.categories ? business.categories.split(',')[0].trim() : '',
      };
    }
    return {
      isLoading: businessQuery.isLoading,
      error: businessQuery.error,
      data: businessQuery.data,
      primaryCategory: business.categories ? business.categories.split(',')[0].trim() : '',
    };
  }

  if (selectedNeighborhood && selectedCity && selectedState) {
    return {
      isLoading: neighborhoodQuery.isLoading,
      error: neighborhoodQuery.error,
      data: neighborhoodQuery.data,
      primaryCategory: selectedCategory,
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

  return {
    isLoading: false,
    error: null,
    data: null,
    primaryCategory: '',
  };
};
