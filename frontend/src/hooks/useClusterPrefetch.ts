/**
 * useClusterPrefetch - Prefetch cluster data for performance
 *
 * This hook provides prefetching utilities to load cluster data
 * before the user needs it, improving perceived performance.
 */

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { api } from '@/lib/api';

export function useClusterPrefetch() {
  const queryClient = useQueryClient();

  /**
   * Prefetch cluster timeline data
   * Use this when hovering over cluster options or adding businesses to comparison
   */
  const prefetchClusterTimeline = useCallback(
    (clusterId: number) => {
      queryClient.prefetchQuery({
        queryKey: ['cluster-timeline', clusterId, 'month'],
        queryFn: () => api.clusters.getTimeline(clusterId, { period: 'month' }),
        staleTime: 15 * 60 * 1000, // 15 minutes
      });
    },
    [queryClient]
  );

  /**
   * Prefetch clusters for a specific city
   * Use this when city filter is about to change
   */
  const prefetchClustersForCity = useCallback(
    (cityId: string) => {
      const [city, state] = cityId.split('_');
      queryClient.prefetchQuery({
        queryKey: ['clusters', 'city', cityId],
        queryFn: async () => {
          const catalog = await api.clusters.getCatalog();
          if (!catalog.latest_run) return [];

          const response = await api.clusters.list({
            run_id: catalog.latest_run.run_id,
            city,
            state,
            limit: 100,
          });

          return response.clusters;
        },
        staleTime: Infinity,
      });
    },
    [queryClient]
  );

  return {
    prefetchClusterTimeline,
    prefetchClustersForCity,
  };
}
