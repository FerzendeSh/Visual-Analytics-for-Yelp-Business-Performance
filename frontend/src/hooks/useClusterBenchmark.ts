/**
 * Hook to fetch cluster benchmark data for the primary business
 * Similar to city/neighborhood benchmarks, shows cluster average in timeline charts
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/useAppStore';

/**
 * Find which cluster a business belongs to and fetch its timeline
 */
export function useClusterBenchmark(businessId: string | null) {
  const filters = useAppStore((state) => state.filters);

  // Step 1: Find which cluster contains this business
  const { data: businessCluster } = useQuery({
    queryKey: ['business-cluster-assignment', businessId],
    queryFn: async () => {
      if (!businessId) return null;

      // Get latest cluster run
      const catalog = await api.clusters.getCatalog();
      if (!catalog.latest_run) return null;

      // Get all clusters
      const response = await api.clusters.list({
        run_id: catalog.latest_run.run_id,
        limit: 100,
      });

      // For each cluster, check if our business is in it
      // Note: This is a client-side search. For better performance, the backend
      // could provide a direct endpoint: GET /api/businesses/{id}/cluster
      for (const cluster of response.clusters) {
        const businessIds = await api.clusters.getBusinessIds(cluster.cluster_id);
        if (businessIds.includes(businessId)) {
          return cluster;
        }
      }

      return null; // Business not in any cluster
    },
    enabled: !!businessId,
    staleTime: Infinity, // Cluster assignments don't change
  });

  // Step 2: Fetch cluster timeline if we found the cluster
  const { data: clusterTimeline, isLoading: isLoadingTimeline } = useQuery({
    queryKey: [
      'cluster-timeline',
      businessCluster?.cluster_id,
      filters.granularity,
      filters.timeRange,
      filters.customDateRange,
      filters.categories[0],
    ],
    queryFn: async () => {
      if (!businessCluster) return null;

      // Calculate date range based on filters
      const params: any = {
        period: filters.granularity === 'MONTHLY' ? 'month' : 'year',
      };

      if (filters.timeRange === 'CUSTOM' && filters.customDateRange) {
        params.start_date = filters.customDateRange.start;
        params.end_date = filters.customDateRange.end;
      } else if (filters.timeRange === '1Y') {
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        params.start_date = oneYearAgo.toISOString().split('T')[0];
      } else if (filters.timeRange === '5Y') {
        const fiveYearsAgo = new Date();
        fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
        params.start_date = fiveYearsAgo.toISOString().split('T')[0];
      }

      return api.clusters.getTimeline(businessCluster.cluster_id, params);
    },
    enabled: !!businessCluster,
    staleTime: 15 * 60 * 1000, // 15 minutes (like city/neighborhood benchmarks)
  });

  return {
    clusterData: businessCluster,
    clusterTimeline: clusterTimeline,
    clusterLabel: businessCluster?.ai_label || `Cluster ${businessCluster?.cluster_label}`,
    isLoading: isLoadingTimeline,
    hasCluster: !!businessCluster,
  };
}
