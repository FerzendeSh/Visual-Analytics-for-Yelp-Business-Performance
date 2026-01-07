/**
 * useClusterContext - Single source of truth for cluster data
 *
 * This hook provides:
 * - City-scoped cluster fetching (performance optimized)
 * - Business-to-cluster mapping (O(1) lookups)
 * - Primary business cluster and timeline data
 * - Helper functions for enriching business data
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { api, ClusterSummaryDTO, ClusterTimelineDTO, Business } from '@/lib/api';
import { useAppStore } from '@/stores/useAppStore';
import type { BusinessWithCluster } from '@/types/clustering';
import { parseClusterFilter } from './useClusterData';

export function useClusterContext() {
  const filters = useAppStore((state) => state.filters);
  const primaryBusinessId = useAppStore((state) => state.primaryBusinessId);
  const clusterFilter = useAppStore((state) => state.clusterFilter);
  const queryClient = useQueryClient();

  // Extract city and state from cityId (format: "Tampa_FL")
  const city = filters.cityId?.split('_')[0] || null;
  const state = filters.cityId?.split('_')[1] || null;

  // Query 1A: Fetch clusters for current city (for dropdown filtering)
  const {
    data: allClusters = [],
    isLoading: isLoadingClusters,
    error: clustersError,
  } = useQuery({
    queryKey: ['clusters', 'city', filters.cityId],
    queryFn: async () => {
      const catalog = await api.clusters.getCatalog();
      if (!catalog.latest_run) return [];

      // City-scoped query (performance optimized!)
      const response = await api.clusters.list({
        run_id: catalog.latest_run.run_id,
        city: city || undefined,
        state: state || undefined,
        limit: 1000, // Increased limit for "All cities"
      });

      return response.clusters;
    },
    enabled: true, // Always fetch (even for "All cities")
    staleTime: Infinity, // Clusters never change
    gcTime: 30 * 60 * 1000, // 30 min garbage collection
  });

  // Query 1B: Fetch ALL clusters globally (for finding primary business cluster)
  const {
    data: globalClusters = [],
  } = useQuery({
    queryKey: ['clusters', 'global'],
    queryFn: async () => {
      const catalog = await api.clusters.getCatalog();
      if (!catalog.latest_run) return [];

      // Fetch ALL clusters without city filter
      const response = await api.clusters.list({
        run_id: catalog.latest_run.run_id,
        limit: 1000,
      });

      return response.clusters;
    },
    enabled: true,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
  });

  // Query 2: Build business → cluster membership map (using global clusters)
  // This is expensive, so we cache it aggressively
  const {
    data: clusterBusinessMap = new Map(),
    isLoading: isLoadingMap,
  } = useQuery({
    queryKey: ['cluster-business-map', globalClusters.map((c) => c.cluster_id).sort()],
    queryFn: async () => {
      const map = new Map<string, number>();

      // Fetch business IDs for each cluster (in parallel)
      const fetchPromises = globalClusters.map(async (cluster) => {
        try {
          const businessIds = await api.clusters.getBusinessIds(cluster.cluster_id);
          businessIds.forEach((id) => map.set(id, cluster.cluster_id));
        } catch (error) {
          console.error(`Failed to fetch business IDs for cluster ${cluster.cluster_id}:`, error);
        }
      });

      await Promise.all(fetchPromises);
      return map;
    },
    enabled: globalClusters.length > 0,
    staleTime: Infinity, // Membership never changes
    gcTime: 30 * 60 * 1000,
  });

  // Query 3: Find primary business's cluster (search in global clusters)
  const primaryBusinessCluster = useMemo(() => {
    if (!primaryBusinessId || !clusterBusinessMap) {
      console.log('[useClusterContext] No primary business or cluster map', { primaryBusinessId, hasMap: !!clusterBusinessMap });
      return null;
    }
    const clusterId = clusterBusinessMap.get(primaryBusinessId);
    console.log('[useClusterContext] Primary business cluster lookup', {
      primaryBusinessId,
      clusterId,
      mapSize: clusterBusinessMap.size,
      globalClustersCount: globalClusters.length,
    });
    const cluster = globalClusters.find((c) => c.cluster_id === clusterId) || null;
    console.log('[useClusterContext] Found primary business cluster:', cluster);
    return cluster;
  }, [primaryBusinessId, clusterBusinessMap, globalClusters]);

  // Query 4: Fetch primary business cluster timeline
  console.log('[useClusterContext] Timeline query enabled check:', {
    hasPrimaryBusinessCluster: !!primaryBusinessCluster,
    clusterId: primaryBusinessCluster?.cluster_id,
    granularity: filters.granularity,
    timeRange: filters.timeRange,
  });

  const { data: primaryClusterTimeline, isLoading: isLoadingTimeline } = useQuery({
    queryKey: [
      'cluster-timeline',
      primaryBusinessCluster?.cluster_id,
      filters.granularity,
      filters.timeRange,
      filters.customDateRange,
    ],
    queryFn: async () => {
      if (!primaryBusinessCluster) {
        console.log('[useClusterContext] No primary business cluster, skipping timeline fetch');
        return null;
      }

      const params: any = {
        period: filters.granularity === 'MONTHLY' ? 'month' : 'year',
      };

      // Note: For historical datasets (Yelp data ends ~2022), time ranges should be
      // relative to the max date in the data, not today's date.
      // For now, only apply filters for CUSTOM range. '1Y', '5Y', 'ALL' get full data.
      if (filters.timeRange === 'CUSTOM' && filters.customDateRange) {
        params.start_date = filters.customDateRange.start;
        params.end_date = filters.customDateRange.end;
      }
      // Skip date filtering for '1Y', '5Y', 'ALL' to show full historical data
      // TODO: Make these filters relative to dataset's max date instead of current date

      console.log('[useClusterContext] Fetching cluster timeline', {
        clusterId: primaryBusinessCluster.cluster_id,
        params,
      });

      const timeline = await api.clusters.getTimeline(primaryBusinessCluster.cluster_id, params);
      console.log('[useClusterContext] Fetched cluster timeline:', timeline);
      return timeline;
    },
    enabled: !!primaryBusinessCluster,
    staleTime: 15 * 60 * 1000, // 15 min (like city benchmarks)
    gcTime: 30 * 60 * 1000,
  });

  // Query 5: Fetch filtered cluster timeline (when clusterFilter is active)
  // This is used when user selects a specific competitor group from the filter dropdown
  const filteredClusterIds = useMemo(() => parseClusterFilter(clusterFilter), [clusterFilter]);

  const { data: filteredClusterTimeline, isLoading: isLoadingFilteredTimeline } = useQuery({
    queryKey: [
      'cluster-timeline-filtered',
      clusterFilter,
      filters.granularity,
      filters.timeRange,
      filters.customDateRange,
    ],
    queryFn: async () => {
      if (filteredClusterIds.length === 0) {
        console.log('[useClusterContext] No cluster filter, skipping filtered timeline fetch');
        return null;
      }

      const params: any = {
        period: filters.granularity === 'MONTHLY' ? 'month' : 'year',
      };

      if (filters.timeRange === 'CUSTOM' && filters.customDateRange) {
        params.start_date = filters.customDateRange.start;
        params.end_date = filters.customDateRange.end;
      }

      console.log('[useClusterContext] Fetching filtered cluster timeline', {
        clusterIds: filteredClusterIds,
        params,
      });

      // If single cluster, fetch directly
      if (filteredClusterIds.length === 1) {
        const timeline = await api.clusters.getTimeline(filteredClusterIds[0], params);
        console.log('[useClusterContext] Fetched single filtered cluster timeline:', timeline);
        return timeline;
      }

      // If multiple clusters (group), fetch all and aggregate
      const timelines = await Promise.all(
        filteredClusterIds.map(id => api.clusters.getTimeline(id, params))
      );

      // Aggregate timelines by averaging ratings and summing review counts
      const aggregatedData = new Map<string, { total_rating: number; total_reviews: number; total_sentiment: number; total_sentiment_expected: number; count: number }>();

      timelines.forEach(timeline => {
        timeline.data.forEach(point => {
          const existing = aggregatedData.get(point.period_start) || {
            total_rating: 0,
            total_reviews: 0,
            total_sentiment: 0,
            total_sentiment_expected: 0,
            count: 0
          };
          existing.total_rating += point.avg_rating * point.review_count;
          existing.total_reviews += point.review_count;
          existing.total_sentiment += point.avg_sentiment_score * point.review_count;
          existing.total_sentiment_expected += point.avg_sentiment_expected * point.review_count;
          existing.count += 1;
          aggregatedData.set(point.period_start, existing);
        });
      });

      // Convert to timeline format
      const aggregatedTimeline: ClusterTimelineDTO = {
        cluster_id: filteredClusterIds[0], // Use first cluster ID as representative
        period: params.period,
        data: Array.from(aggregatedData.entries()).map(([period_start, agg]) => ({
          period_start,
          avg_rating: agg.total_reviews > 0 ? agg.total_rating / agg.total_reviews : 0,
          review_count: agg.total_reviews,
          avg_sentiment_score: agg.total_reviews > 0 ? agg.total_sentiment / agg.total_reviews : 0,
          avg_sentiment_expected: agg.total_reviews > 0 ? agg.total_sentiment_expected / agg.total_reviews : 0,
          business_count: agg.count,
        })).sort((a, b) => a.period_start.localeCompare(b.period_start)),
        statistics: {},
      };

      console.log('[useClusterContext] Aggregated filtered cluster timeline:', aggregatedTimeline);
      return aggregatedTimeline;
    },
    enabled: filteredClusterIds.length > 0,
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Helper: Get cluster for business (O(1) lookup)
  const getClusterForBusiness = useCallback(
    (businessId: string): ClusterSummaryDTO | null => {
      if (!clusterBusinessMap) return null;
      const clusterId = clusterBusinessMap.get(businessId);
      return globalClusters.find((c) => c.cluster_id === clusterId) || null;
    },
    [clusterBusinessMap, globalClusters]
  );

  // Helper: Enrich business with cluster data
  const enrichBusinessWithCluster = useCallback(
    (business: Business): BusinessWithCluster => {
      const cluster = getClusterForBusiness(business.business_id);
      return {
        ...business,
        cluster_id: cluster?.cluster_id ?? null,
        cluster_ai_label: cluster?.ai_label ?? null,
        cluster_ai_description: cluster?.ai_description ?? null,
      };
    },
    [getClusterForBusiness]
  );

  // Helper: Prefetch cluster timeline
  const prefetchClusterTimeline = useCallback(
    (clusterId: number) => {
      queryClient.prefetchQuery({
        queryKey: ['cluster-timeline', clusterId, 'month'],
        queryFn: () => api.clusters.getTimeline(clusterId, { period: 'month' }),
        staleTime: Infinity,
      });
    },
    [queryClient]
  );

  return {
    // Data
    allClusters,
    clusterBusinessMap,

    // Primary business cluster
    primaryBusinessCluster,
    primaryClusterTimeline: primaryClusterTimeline || null,

    // Filtered cluster (when user selects a competitor group)
    filteredClusterTimeline: filteredClusterTimeline || null,
    filteredClusterIds,

    // State
    isLoadingClusters: isLoadingClusters || isLoadingMap,
    isLoadingTimeline: isLoadingTimeline || isLoadingFilteredTimeline,
    hasError: !!clustersError,

    // Actions
    getClusterForBusiness,
    enrichBusinessWithCluster,
    prefetchClusterTimeline,
  };
}
