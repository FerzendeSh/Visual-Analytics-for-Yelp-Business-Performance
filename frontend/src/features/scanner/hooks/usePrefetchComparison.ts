/**
 * Prefetching hook for comparison data.
 * Preloads business timeline and competitive snapshot in the background
 * when a business is selected, improving perceived performance in comparison mode.
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subYears, format } from 'date-fns';
import { api, Business } from '@/lib/api';

export function usePrefetchComparison() {
  const queryClient = useQueryClient();

  const prefetchComparisonData = useCallback(
    (businessId: string, business: Business) => {
      const cityId = `${business.city}_${business.state}`;
      const categories = business.categories
        ? business.categories.split(',').map((c: string) => c.trim())
        : [];

      // Calculate date range for 5 years
      const endDate = new Date();
      const startDate = subYears(endDate, 5);
      const start_date = format(startDate, 'yyyy-MM-dd');
      const end_date = format(endDate, 'yyyy-MM-dd');

      // Prefetch business timeline (ratings + sentiment combined)
      queryClient.prefetchQuery({
        queryKey: ['businessTimeline', businessId, 'MONTHLY', '5Y', categories],
        queryFn: () =>
          api.analytics.getBusinessTimeline(businessId, {
            period: 'month',
            start_date,
            end_date,
            category: categories[0],
          }),
        staleTime: 10 * 60 * 1000, // 10 minutes
      });

      // Prefetch competitive snapshot
      const city = cityId.split('_')[0];
      const state = cityId.split('_')[1];
      queryClient.prefetchQuery({
        queryKey: ['competitive-snapshot', businessId, cityId, null, categories],
        queryFn: () =>
          api.analytics.getCompetitiveSnapshot({
            city,
            state,
            category: categories[0],
            business_id: businessId,
          }),
        staleTime: 5 * 60 * 1000, // 5 minutes
      });

      console.log('📦 Prefetched comparison data for:', business.name);
    },
    [queryClient]
  );

  return { prefetchComparisonData };
}
