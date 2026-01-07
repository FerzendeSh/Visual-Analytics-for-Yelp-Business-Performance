/**
 * Clustering Feature Types
 *
 * Extended types for cluster-related features and UI components
 */

import type { Business, ClusterSummaryDTO } from '@/lib/api';

/**
 * Business enriched with cluster information
 */
export interface BusinessWithCluster extends Business {
  cluster_id: number | null;
  cluster_ai_label: string | null;
  cluster_ai_description: string | null;
}

/**
 * Cluster filter option for dropdowns/comboboxes
 */
export interface ClusterFilterOption {
  value: string;
  label: string;
  description?: string;
  size?: number;
}

/**
 * Cluster context state
 */
export interface ClusterContextState {
  // Data
  allClusters: ClusterSummaryDTO[];
  clusterBusinessMap: Map<string, number>;

  // Primary business cluster
  primaryBusinessCluster: ClusterSummaryDTO | null;
  primaryClusterTimeline: any | null;

  // State
  isLoadingClusters: boolean;
  isLoadingTimeline: boolean;
  hasError: boolean;

  // Actions
  getClusterForBusiness: (businessId: string) => ClusterSummaryDTO | null;
  enrichBusinessWithCluster: (business: Business) => BusinessWithCluster;
  prefetchClusterTimeline: (clusterId: number) => void;
}
