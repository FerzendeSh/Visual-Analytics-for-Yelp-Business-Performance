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

export function useClusterContext() {
  const filters = useAppStore((state) => state.filters);
  const primaryBusinessId = useAppStore((state) => state.primaryBusinessId);
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

    // State
    isLoadingClusters: isLoadingClusters || isLoadingMap,
    isLoadingTimeline,
    hasError: !!clustersError,

    // Actions
    getClusterForBusiness,
    enrichBusinessWithCluster,
    prefetchClusterTimeline,
  };
}
