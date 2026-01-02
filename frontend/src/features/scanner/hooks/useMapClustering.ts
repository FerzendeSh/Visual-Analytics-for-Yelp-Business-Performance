/**
 * Map clustering hook using Supercluster.
 * Handles business clustering based on zoom level and viewport bounds.
 */
import { useMemo } from 'react';
import Supercluster from 'supercluster';
import { Business } from '@/lib/api';

interface Viewport {
  south: number;
  north: number;
  west: number;
  east: number;
}

interface ClusterPoint {
  position: [number, number];
  count: number;
  id: number;
}

interface UseMapClusteringResult {
  clusters: any[];
  supercluster: Supercluster<Business> | null;
  clusterData: ClusterPoint[];
  pointData: Business[];
  showClusters: boolean;
  showBoth: boolean; // Show both clusters and businesses (zoom 10-11)
}

export function useMapClustering(
  businesses: Business[],
  viewport: Viewport | null,
  zoom: number
): UseMapClusteringResult {
  // Generate clusters using Supercluster
  const { clusters, supercluster } = useMemo(() => {
    if (!businesses.length) return { clusters: [], supercluster: null };

    const index = new Supercluster<Business>({
      radius: 60,
      maxZoom: 14, // Cluster up to zoom 14, then show all individual points
      minZoom: 0,
    });

    const points = businesses.map((business) => ({
      type: 'Feature' as const,
      properties: business,
      geometry: {
        type: 'Point' as const,
        coordinates: [business.longitude, business.latitude],
      },
    }));

    index.load(points);

    const bounds = viewport || {
      west: -180,
      south: -90,
      east: 180,
      north: 90,
    };

    const clusterZoom = Math.floor(zoom);
    const clusters = index.getClusters(
      [bounds.west, bounds.south, bounds.east, bounds.north],
      clusterZoom
    );

    console.log('🔍 Clustering Debug:', {
      totalBusinesses: businesses.length,
      clusters: clusters.length,
      zoom,
      clusterZoom,
      mode: clusterZoom < 10 ? 'clusters-only' : clusterZoom < 12 ? 'hybrid' : 'businesses-only',
    });

    return { clusters, supercluster: index };
  }, [businesses, viewport, zoom]);

  // Determine display mode based on zoom level and cluster data
  // Always show clusters if they exist
  // Show both clusters and individual points when we have both
  const hasAnyClusters = useMemo(() => {
    return clusters.some((cluster) => (cluster.properties as any).cluster);
  }, [clusters]);

  const showClusters = hasAnyClusters;
  const showBoth = hasAnyClusters && clusters.some((cluster) => !(cluster.properties as any).cluster);

  // Separate cluster points from individual business points
  const { clusterData, pointData } = useMemo(() => {
    const clusterPoints: ClusterPoint[] = [];
    const individualPoints: Business[] = [];

    clusters.forEach((cluster) => {
      const props = cluster.properties as any;
      if (props.cluster) {
        clusterPoints.push({
          position: cluster.geometry.coordinates as [number, number],
          count: props.point_count,
          id: props.cluster_id,
        });
      } else {
        individualPoints.push(props as Business);
      }
    });

    return {
      clusterData: clusterPoints,
      pointData: individualPoints,
    };
  }, [clusters]);

  return {
    clusters,
    supercluster,
    clusterData,
    pointData,
    showClusters,
    showBoth,
  };
}
