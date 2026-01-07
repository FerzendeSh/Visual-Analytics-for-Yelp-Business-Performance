/**
 * Hooks for fetching cluster data
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ClusterSummaryDTO } from '@/lib/api';
import { useDebounce } from './useDebounce';
import { ViewportBounds } from '@/stores/useAppStore';

/**
 * Fetch clusters in the current map viewport
 */
export function useClustersInViewport(viewport: ViewportBounds | null) {
  const debouncedViewport = useDebounce(viewport, 300);

  return useQuery({
    queryKey: ['clusters', 'viewport', debouncedViewport],
    queryFn: async () => {
      if (!debouncedViewport) return [];

      return api.clusters.getInViewport({
        south: debouncedViewport.south,
        north: debouncedViewport.north,
        west: debouncedViewport.west,
        east: debouncedViewport.east,
        min_size: 5, // Filter out very small clusters
      });
    },
    enabled: !!debouncedViewport,
    staleTime: 10 * 60 * 1000, // 10 minutes - clusters don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

/**
 * Fetch all clusters (for dropdown filter)
 */
export function useAllClusters() {
  return useQuery({
    queryKey: ['clusters', 'all'],
    queryFn: async () => {
      const catalog = await api.clusters.getCatalog();
      if (!catalog.latest_run) return [];

      const response = await api.clusters.list({
        run_id: catalog.latest_run.run_id,
        limit: 100, // Get all clusters
      });

      return response.clusters;
    },
    staleTime: Infinity, // Clusters never change once created
  });
}

/**
 * Parse a cluster filter string into an array of cluster IDs
 * Handles both single cluster IDs ("123") and group format ("group:123,456,789")
 */
export function parseClusterFilter(clusterFilter: string | null): number[] {
  if (!clusterFilter) return [];
  
  if (clusterFilter.startsWith('group:')) {
    // Group format: "group:123,456,789"
    const idsStr = clusterFilter.replace('group:', '');
    return idsStr.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  }
  
  // Single cluster ID
  const id = parseInt(clusterFilter, 10);
  return isNaN(id) ? [] : [id];
}

/**
 * Fetch business IDs for one or more clusters (used for filtering)
 * Supports both single cluster IDs and grouped clusters
 */
export function useClusterBusinessIds(clusterFilter: string | null) {
  const clusterIds = parseClusterFilter(clusterFilter);
  
  return useQuery({
    queryKey: ['cluster-businesses', clusterFilter],
    queryFn: async () => {
      if (clusterIds.length === 0) return [];
      
      // Fetch business IDs for all clusters in parallel
      const results = await Promise.all(
        clusterIds.map(id => api.clusters.getBusinessIds(id))
      );
      
      // Combine and deduplicate
      const allIds = new Set<string>();
      results.forEach(ids => ids.forEach(id => allIds.add(id)));
      return Array.from(allIds);
    },
    enabled: clusterIds.length > 0,
    staleTime: Infinity, // Cluster membership doesn't change
  });
}

/**
 * Fetch detailed cluster information
 */
export function useClusterDetail(clusterId: number | null) {
  return useQuery({
    queryKey: ['cluster-detail', clusterId],
    queryFn: async () => {
      if (!clusterId) return null;
      return api.clusters.getDetail(clusterId);
    },
    enabled: !!clusterId,
    staleTime: Infinity,
  });
}

/**
 * Custom hook to enrich businesses with cluster assignments
 * Matches businesses against clusters based on cluster membership
 * OPTIMIZED: Uses useMemo to prevent unnecessary recomputations
 */
export function useBusinessesWithClusters(
  businesses: any[],
  clusters: ClusterSummaryDTO[],
  clusterFilter: string | null,
  clusterBusinessIds: string[] | undefined
) {
  return useMemo(() => {
    // If cluster filter is active, filter businesses to only show those in the cluster(s)
    if (clusterFilter && clusterBusinessIds) {
      const businessIdSet = new Set(clusterBusinessIds);
      const clusterIds = parseClusterFilter(clusterFilter);
      const isGroup = clusterIds.length > 1;
      
      return businesses
        .filter((b) => businessIdSet.has(b.business_id))
        .map((business) => {
          // For grouped clusters, find which specific cluster this business belongs to
          const cluster = clusters.find((c) => clusterIds.includes(c.cluster_id));
          return {
            ...business,
            cluster_id: isGroup ? null : clusterIds[0], // Don't assign specific cluster for groups
            cluster_label: cluster?.cluster_label ?? null,
            cluster_ai_label: isGroup ? 'Independent Businesses' : (cluster?.ai_label ?? null),
          };
        });
    }

    // No filter - return all businesses (we'll add cluster assignment logic later if needed)
    return businesses;
  }, [businesses, clusters, clusterFilter, clusterBusinessIds]);
}
