import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

/**
 * Smart keyword insights hook that uses the optimized backend endpoint
 * to automatically find the most recent year with keyword data.
 *
 * This eliminates the need for multiple parallel API calls from the frontend.
 */
export function useSmartKeywordInsights(
  businessId: string | null,
  _ratingsTimeline?: any // Keep for backward compatibility but unused
) {
  return useQuery({
    queryKey: ['keyword-insights-auto', businessId],
    queryFn: async () => {
      if (!businessId) throw new Error('No business ID');

      const result = await api.analytics.getKeywordInsightsAuto(businessId, {
        max_years: 5,
      });

      return result;
    },
    enabled: !!businessId,
    staleTime: Infinity, // Keyword data never changes
    select: (data) => ({
      data: data,
      activeYear: data.period?.year || null,
      isLoading: false,
      error: null,
    }),
  });
}
