import { useQuery } from '@tanstack/react-query';
import { api, CombinedTimelineResponse } from '../lib/api';
import { useAppStore } from '../stores/useAppStore';
import { subYears, format } from 'date-fns';

// Helper function to calculate date range
const getDateRange = (timeRange: '1Y' | '5Y') => {
  const endDate = new Date();
  const yearsBack = timeRange === '1Y' ? 1 : 5;
  const startDate = subYears(endDate, yearsBack);

  return {
    start_date: format(startDate, 'yyyy-MM-dd'),
    end_date: format(endDate, 'yyyy-MM-dd'),
  };
};

export function useComparisonTimeline(businessId: string | null) {
  const filters = useAppStore(state => state.filters);
  const benchmarks = useAppStore(state => state.benchmarks);

  const { start_date, end_date } = getDateRange(filters.timeRange);

  const businessTimelineQuery = useQuery({
    queryKey: ['businessTimeline', businessId, filters.granularity, filters.timeRange, filters.categories],
    queryFn: async () => {
      if (!businessId) throw new Error('No business ID provided');
      return api.analytics.getBusinessTimeline(businessId, {
        period: filters.granularity === 'MONTHLY' ? 'month' : 'year',
        start_date,
        end_date,
        category: filters.categories[0], // Pass category for business timeline for comparisons
      });
    },
    enabled: !!businessId,
    staleTime: 10 * 60 * 1000, // 10 minutes - historical data changes slowly
  });

  const city = filters.cityId?.split('_')[0];
  const state = filters.cityId?.split('_')[1];

  const cityTimelineQuery = useQuery({
    queryKey: ['cityTimeline', city, state, filters.granularity, filters.timeRange, filters.categories],
    queryFn: async () => {
      if (!city || !state) throw new Error('City or State not provided for city timeline');
      return api.analytics.getCityCombinedTimeline({
        city,
        state,
        period: filters.granularity === 'MONTHLY' ? 'month' : 'year',
        start_date,
        end_date,
        category: filters.categories[0],
      });
    },
    enabled: benchmarks.showCityAvg && !!city && !!state,
    staleTime: 15 * 60 * 1000, // 15 minutes - city aggregates change very slowly
  });

  const neighborhoodTimelineQuery = useQuery({
    queryKey: ['neighborhoodTimeline', filters.neighborhoodId, city, state, filters.granularity, filters.timeRange, filters.categories],
    queryFn: async () => {
      if (!filters.neighborhoodId || !city || !state) throw new Error('Neighborhood, City or State not provided for neighborhood timeline');
      return api.analytics.getNeighborhoodCombinedTimeline({
        neighborhood: filters.neighborhoodId,
        city,
        state,
        period: filters.granularity === 'MONTHLY' ? 'month' : 'year',
        start_date,
        end_date,
      });
    },
    enabled: benchmarks.showNeighborhoodAvg && !!filters.neighborhoodId && !!city && !!state,
    staleTime: 15 * 60 * 1000, // 15 minutes - neighborhood aggregates change very slowly
  });

  const categoryTimelineQuery = useQuery({
    queryKey: ['categoryTimeline', filters.categories[0], filters.granularity, filters.timeRange],
    queryFn: async () => {
      if (!filters.categories[0]) throw new Error('Category not provided for category timeline');
      return api.analytics.getCategoryCombinedTimeline({
        category: filters.categories[0],
        period: filters.granularity === 'MONTHLY' ? 'month' : 'year',
        start_date,
        end_date,
      });
    },
    enabled: benchmarks.showCategoryAvg && !!filters.categories[0],
    staleTime: 15 * 60 * 1000, // 15 minutes - category aggregates change very slowly
  });

  return {
    businessTimeline: businessTimelineQuery,
    cityTimeline: cityTimelineQuery,
    neighborhoodTimeline: neighborhoodTimelineQuery,
    categoryTimeline: categoryTimelineQuery,
    isLoading: businessTimelineQuery.isLoading || cityTimelineQuery.isLoading || neighborhoodTimelineQuery.isLoading || categoryTimelineQuery.isLoading,
    isError: businessTimelineQuery.isError || cityTimelineQuery.isError || neighborhoodTimelineQuery.isError || categoryTimelineQuery.isError,
  };
}


export function useCompetitiveSnapshot() {
  const { primaryBusinessId, filters } = useAppStore();

  return useQuery({
    queryKey: ['competitive-snapshot', primaryBusinessId, filters.cityId, filters.neighborhoodId, filters.categories],
    queryFn: async () => {
      if (!primaryBusinessId) throw new Error('No primary business selected');

      // Extract city and state from cityId (format: "city_STATE")
      const city = filters.cityId?.split('_')[0];
      const state = filters.cityId?.split('_')[1];

      return api.analytics.getCompetitiveSnapshot({
        city,
        state,
        neighborhood: filters.neighborhoodId || undefined,
        category: filters.categories[0],
        business_id: primaryBusinessId,
      });
    },
    enabled: !!primaryBusinessId,
    staleTime: 5 * 60 * 1000, // 5 minutes - competitive data doesn't change frequently
  });
}

export function useKeywordInsights(businessId: string | null) {
  const filters = useAppStore(state => state.filters);

  const { start_date, end_date } = getDateRange(filters.timeRange);

  return useQuery({
    queryKey: ['keyword-insights', businessId, filters.timeRange],
    queryFn: async () => {
      if (!businessId) throw new Error('No business ID provided');
      return api.analytics.getKeywordInsights(businessId, {
        start_date,
        end_date,
      });
    },
    enabled: !!businessId,
  });
}

export function useMultipleTimelines(businessIds: string[]) {
  const filters = useAppStore(state => state.filters);

  const { start_date, end_date } = getDateRange(filters.timeRange);

  return useQuery({
    queryKey: ['multiple-timelines', businessIds, filters.granularity, filters.timeRange],
    queryFn: async () => {
      const promises = businessIds.map(id =>
        api.analytics.getBusinessTimeline(id, {
          period: filters.granularity === 'MONTHLY' ? 'month' : 'year',
          start_date,
          end_date,
          category: filters.categories[0],
        })
      );

      return Promise.all(promises);
    },
    enabled: businessIds.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes - historical data changes slowly
  });
}

/**
 * Fetch comparison businesses that might be from different cities
 * This allows showing cross-city comparisons on the scatter plot
 */
export function useComparisonBusinesses(comparisonIds: string[]) {
  return useQuery({
    queryKey: ['comparison-businesses', comparisonIds],
    queryFn: async () => {
      if (comparisonIds.length === 0) return [];

      const promises = comparisonIds.map(id => api.businesses.getById(id));
      return Promise.all(promises);
    },
    enabled: comparisonIds.length > 0,
    staleTime: 10 * 60 * 1000, // 10 minutes - business data doesn't change often
  });
}
