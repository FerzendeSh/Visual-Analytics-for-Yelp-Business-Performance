/**
 * Hooks for fetching cluster data
 */
import { useQuery } from '@tanstack/react-query';
import { api, ClusterSummaryDTO } from '@/lib/api';
import { useDebounce } from './useDebounce';
import { useAppStore } from '@/stores/useAppStore';

interface ViewportBounds {
  south: number;
  north: number;
  west: number;
  east: number;
}

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
 * Fetch business IDs for a cluster (used for filtering)
 */
export function useClusterBusinessIds(clusterId: number | null) {
  return useQuery({
    queryKey: ['cluster-businesses', clusterId],
    queryFn: async () => {
      if (!clusterId) return [];
      return api.clusters.getBusinessIds(clusterId);
    },
    enabled: !!clusterId,
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
 */
export function useBusinessesWithClusters(
  businesses: any[],
  clusters: ClusterSummaryDTO[],
  clusterFilter: number | null,
  clusterBusinessIds: string[] | undefined
) {
  // If cluster filter is active, filter businesses to only show those in the cluster
  if (clusterFilter && clusterBusinessIds) {
    const businessIdSet = new Set(clusterBusinessIds);
    return businesses
      .filter((b) => businessIdSet.has(b.business_id))
      .map((business) => {
        const cluster = clusters.find((c) => c.cluster_id === clusterFilter);
        return {
          ...business,
          cluster_id: clusterFilter,
          cluster_label: cluster?.cluster_label ?? null,
          cluster_ai_label: cluster?.ai_label ?? null,
        };
      });
  }

  // No filter - return all businesses (we'll add cluster assignment logic later if needed)
  return businesses;
}
