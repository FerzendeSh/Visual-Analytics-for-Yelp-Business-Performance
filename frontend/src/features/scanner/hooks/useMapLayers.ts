/**
 * Map layers hook for Deck.gl visualization.
 * Manages city boundary, neighborhood, cluster, and business point layers.
 */
import { useMemo } from 'react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { scaleLinear } from 'd3-scale';
import Supercluster from 'supercluster';
import { Business } from '@/lib/api';
import { useAppStore } from '@/stores/useAppStore';

// Color scale for ratings
const ratingColorScale = scaleLinear<string>()
  .domain([1, 2.5, 4, 5])
  .range(['#ef4444', '#f97316', '#eab308', '#22c55e']);

interface ClusterPoint {
  position: [number, number];
  count: number;
  id: number;
}

interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
  transitionDuration?: number;
}

interface UseMapLayersProps {
  cityBoundary: any;
  neighborhoods: any;
  showClusters: boolean;
  clusterData: ClusterPoint[];
  pointData: Business[];
  primaryBusinessId: string | null;
  comparisonIds: string[];
  supercluster: Supercluster<Business> | null;
  mapViewState: MapViewState;
  setMapViewState: (state: MapViewState) => void;
  setHoveredId: (id: string | null) => void;
  toggleComparison: (id: string) => void;
  setPrimaryBusiness: (id: string) => void;
  prefetchComparisonData: (id: string, business: Business) => void;
}

export function useMapLayers({
  cityBoundary,
  neighborhoods,
  showClusters,
  clusterData,
  pointData,
  primaryBusinessId,
  comparisonIds,
  supercluster,
  mapViewState,
  setMapViewState,
  setHoveredId,
  toggleComparison,
  setPrimaryBusiness,
  prefetchComparisonData,
}: UseMapLayersProps) {
  const filters = useAppStore((state) => state.filters);
  const selectedNeighborhood = filters.neighborhoodId;

  return useMemo(() => {
    const result: any[] = [];

    // 1. City boundary layer
    if (cityBoundary) {
      result.push(
        new GeoJsonLayer({
          id: 'city-boundary',
          data: cityBoundary as any,
          filled: false,
          stroked: true,
          getLineColor: [255, 0, 0, 200], // Red color for city boundary
          getLineWidth: 3,
          lineWidthMinPixels: 1,
          pickable: false,
        })
      );
    }

    // 2. Neighborhood boundaries layer
    if (neighborhoods) {
      result.push(
        new GeoJsonLayer({
          id: 'neighborhoods',
          data: neighborhoods as any,
          filled: true,
          stroked: true,
          getFillColor: (d: any) => {
            // Highlight selected neighborhood
            if (selectedNeighborhood && d.properties?.neighborhood === selectedNeighborhood) {
              return [59, 130, 246, 40]; // Blue fill for selected
            }
            return [100, 116, 139, 0]; // Transparent for others
          },
          getLineColor: (d: any) => {
            // Bright border for selected neighborhood
            if (selectedNeighborhood && d.properties?.neighborhood === selectedNeighborhood) {
              return [59, 130, 246, 200]; // Bright blue
            }
            return [100, 116, 139, 120]; // Slate gray for all others
          },
          getLineWidth: (d: any) => {
            if (selectedNeighborhood && d.properties?.neighborhood === selectedNeighborhood) {
              return 3; // Thicker for selected
            }
            return 1.5; // Thinner for others
          },
          lineWidthMinPixels: 1,
          pickable: true,
          onClick: ({ object }) => {
            if (object?.properties?.neighborhood) {
              useAppStore.getState().updateFilters({
                neighborhoodId: object.properties.neighborhood,
              });
            }
          },
          updateTriggers: {
            getFillColor: [selectedNeighborhood],
            getLineColor: [selectedNeighborhood],
            getLineWidth: [selectedNeighborhood],
          },
        })
      );
    }

    // 3. Cluster layer (zoom < 12)
    if (showClusters && clusterData.length > 0) {
      result.push(
        new ScatterplotLayer({
          id: 'clusters',
          data: clusterData,
          getPosition: (d: any) => d.position,
          getRadius: (d: any) => {
            const baseSize = 30;
            const scaleFactor = 15;
            return baseSize + Math.sqrt(d.count) * scaleFactor;
          },
          getFillColor: (d: any) => {
            const intensity = Math.min(d.count / 50, 1);
            return [255, Math.floor(165 - intensity * 65), 0, 220];
          },
          getLineColor: [255, 255, 255],
          lineWidthMinPixels: 3,
          pickable: true,
          onClick: ({ object }) => {
            if (!object || !supercluster) return;
            const expansionZoom = Math.min(
              supercluster.getClusterExpansionZoom(object.id),
              20
            );
            setMapViewState({
              ...mapViewState,
              zoom: expansionZoom,
              transitionDuration: 400, // Smooth cluster expansion
            });
          },
        })
      );
    }

    // 4. Individual business points layer (zoom >= 12)
    if (!showClusters && pointData.length > 0) {
      result.push(
        new ScatterplotLayer({
          id: 'businesses',
          data: pointData,
          getPosition: (d: Business) => [d.longitude, d.latitude],
          getRadius: (d: Business) => {
            if (d.business_id === primaryBusinessId) return 16;
            if (comparisonIds.includes(d.business_id)) return 14;
            return 8;
          },
          radiusMinPixels: 8,
          radiusMaxPixels: 50,
          getFillColor: (d: Business): [number, number, number, number] => {
            if (d.business_id === primaryBusinessId) {
              return [59, 130, 246, 255]; // Blue for primary
            }
            if (comparisonIds.includes(d.business_id)) {
              return [168, 85, 247, 255]; // Purple for comparisons
            }

            // Color by status (open/closed) and rating
            const isOpen = d.is_open === 1;

            if (!isOpen) {
              // Closed businesses: Red tones
              return [239, 68, 68, 220]; // Red-500 with slight transparency
            }

            // Open businesses: Color by rating
            const color = ratingColorScale(d.stars);
            const rgb = color.match(/\d+/g)?.map(Number) || [100, 100, 100];
            return [rgb[0], rgb[1], rgb[2], 240];
          },
          getLineColor: [255, 255, 255],
          lineWidthMinPixels: 2,
          stroked: true,
          pickable: true,
          onHover: ({ object }) => setHoveredId(object?.business_id || null),
          onClick: ({ object }) => {
            if (!object) return;
            if (!primaryBusinessId) {
              setPrimaryBusiness(object.business_id);

              // Prefetch comparison data in background
              prefetchComparisonData(object.business_id, object);
            } else if (object.business_id !== primaryBusinessId) {
              // Only toggle comparison if it's not the primary business
              toggleComparison(object.business_id);
            }
          },
          updateTriggers: {
            getRadius: [primaryBusinessId, comparisonIds],
            getFillColor: [primaryBusinessId, comparisonIds],
            getLineColor: [primaryBusinessId],
          },
        })
      );
    }

    return result;
  }, [
    cityBoundary,
    neighborhoods,
    showClusters,
    clusterData,
    pointData,
    primaryBusinessId,
    comparisonIds,
    mapViewState,
    setMapViewState,
    supercluster,
    toggleComparison,
    setPrimaryBusiness,
    prefetchComparisonData,
    setHoveredId,
    selectedNeighborhood,
  ]);
}
