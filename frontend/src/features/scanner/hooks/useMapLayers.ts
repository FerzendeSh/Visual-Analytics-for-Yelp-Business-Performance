/**
 * Map layers hook for Deck.gl visualization.
 * Manages city boundary, neighborhood, cluster, and business point layers.
 */
import { useMemo } from 'react';
import { GeoJsonLayer, ScatterplotLayer, IconLayer, TextLayer } from '@deck.gl/layers';
import { scaleLinear } from 'd3-scale';
import Supercluster from 'supercluster';
import { Business } from '@/lib/api';
import { useAppStore, MAGGIANOS_TAMPA_BUSINESS_ID, MapColorMode } from '@/stores/useAppStore';
import { getClusterColor } from '@/utils/clusterColors';

// Quadrant colors matching scatter plot
const QUADRANT_COLORS = {
  'Market Leaders': [0, 255, 238],      // #00ffeeff
  'Hidden Gems': [0, 8, 255],           // #0008ffd1
  'Struggling': [123, 69, 186],         // #7b45baff
  'Volume Drivers': [128, 245, 167],    // #80f5a7a4
};


// Helper to determine quadrant
const getQuadrant = (rating: number, reviewCount: number) => {
  // Using rough averages for Tampa market
  const avgRating = 3.5;
  const medianReviewCount = 100;

  if (rating >= avgRating && reviewCount >= medianReviewCount) return 'Market Leaders';
  if (rating >= avgRating && reviewCount < medianReviewCount) return 'Hidden Gems';
  if (rating < avgRating && reviewCount >= medianReviewCount) return 'Volume Drivers';
  return 'Struggling';
};

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
  showBoth: boolean; // Show both clusters and businesses (zoom 10-11)
  clusterData: ClusterPoint[];
  pointData: Business[];
  primaryBusinessId: string | null;
  comparisonIds: string[];
  highlightedBusinessId: string | null;
  clickedBusinessId: string | null;
  supercluster: Supercluster<Business> | null;
  mapViewState: MapViewState;
  setMapViewState: (state: MapViewState) => void;
  setHoveredId: (id: string | null) => void;
  setClickedId: (id: string | null) => void;
  toggleComparison: (id: string) => void;
  setPrimaryBusiness: (id: string) => void;
  setHighlightedBusiness: (id: string | null) => void;
  prefetchComparisonData: (id: string, business: Business) => void;
  mapColorMode: MapColorMode; // NEW: Map coloring mode
}

export function useMapLayers({
  cityBoundary,
  neighborhoods,
  showClusters,
  showBoth,
  clusterData,
  pointData,
  primaryBusinessId,
  comparisonIds,
  highlightedBusinessId,
  clickedBusinessId,
  supercluster,
  mapViewState,
  setMapViewState,
  setHoveredId,
  setClickedId,
  toggleComparison,
  setPrimaryBusiness,
  setHighlightedBusiness,
  prefetchComparisonData,
  mapColorMode,
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
          getCursor: () => 'default',
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
          getCursor: () => 'pointer',
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

    // 3. Cluster layer (zoom < 12, but visibility depends on showBoth)
    // In hybrid mode (zoom 10-11), clusters are shown alongside businesses
    // In cluster-only mode (zoom < 10), only clusters are shown
    if (showClusters && clusterData.length > 0) {
      // Cluster circles
      result.push(
        new ScatterplotLayer({
          id: 'clusters',
          data: clusterData,
          getPosition: (d: any) => d.position,
          getRadius: (d: any) => {
            const baseSize = 30;
            const scaleFactor = 12;
            return baseSize + Math.sqrt(d.count) * scaleFactor;
          },
          radiusMinPixels: 15,
          radiusMaxPixels: 70,
          getFillColor: [128, 128, 128, 220], // Gray with higher opacity
          getLineColor: [255, 255, 255, 255], // White border
          lineWidthMinPixels: 2,
          stroked: true,
          filled: true,
          pickable: true,
          getCursor: () => 'pointer',
          onClick: ({ object }) => {
            if (!object || !supercluster) return;
            const expansionZoom = Math.min(
              supercluster.getClusterExpansionZoom(object.id),
              20
            );
            setMapViewState({
              ...mapViewState,
              longitude: object.position[0],
              latitude: object.position[1],
              zoom: expansionZoom,
              transitionDuration: 400, // Smooth cluster expansion
            });
          },
        })
      );

      // Cluster count labels
      result.push(
        new TextLayer({
          id: 'cluster-labels',
          data: clusterData,
          getPosition: (d: any) => d.position,
          getText: (d: any) => String(d.count),
          getSize: 16,
          getColor: [255, 255, 255, 255], // White text
          fontFamily: 'Arial, sans-serif',
          fontWeight: 'bold',
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'center',
          pickable: false,
        })
      );
    }


    if ((showBoth || !showClusters) && pointData.length > 0) {
      // Separate Maggiano's from other businesses
      const maggianosData = pointData.filter(d => d.business_id === MAGGIANOS_TAMPA_BUSINESS_ID);
      const otherBusinesses = pointData.filter(d => d.business_id !== MAGGIANOS_TAMPA_BUSINESS_ID);

      // Add custom icon layer for Maggiano's (primary business)
      if (maggianosData.length > 0) {
        result.push(
          new IconLayer({
            id: 'maggianos-icon',
            data: maggianosData,
            getPosition: (d: Business) => [d.longitude, d.latitude],
            getIcon: () => ({
              url: '/MyBusiness.png',
              width: 128,
              height: 128,
              anchorY: 128,
            }),
            getSize: 48, // Icon size in pixels
            sizeMinPixels: 40,
            sizeMaxPixels: 60,
            pickable: true,
            getCursor: () => 'pointer',
            onHover: ({ object }) => setHoveredId(object?.business_id || null),
            onClick: ({ object }) => {
              // Maggiano's is hardcoded as primary - prevent changes
              console.log('Maggiano\'s is your primary business');
            },
          })
        );
      }

      // Regular scatterplot layer for other businesses
      if (otherBusinesses.length > 0) {
        result.push(
          new ScatterplotLayer({
            id: 'businesses',
            data: otherBusinesses,
            getPosition: (d: Business) => [d.longitude, d.latitude],
            getRadius: () => {
              // Same size for all businesses
              return 9;
            },
            radiusMinPixels: 8,
            radiusMaxPixels: 80,
            transitions: {
              getRadius: 200,
            },
            getFillColor: (d: Business): [number, number, number, number] => {
              // CRITICAL: Use strict equality and check business_id exists
              const businessId = d.business_id;

              // Clicked business - bright pink (highest priority)
              if (clickedBusinessId && businessId === clickedBusinessId) {
                return [255, 105, 150, 255]; // Bright pink full opacity
              }

              // Highlighted from scatter plot - bright blue
              if (highlightedBusinessId && businessId === highlightedBusinessId) {
                return [59, 130, 246, 255]; // Blue-500 full opacity
              }

              // Comparison businesses - purple
              if (comparisonIds.includes(businessId)) {
                return [255, 265, 0, 255]; // Purple for comparisons
              }

              // Competitive Landscape mode - color by cluster
              if (mapColorMode === 'COMPETITIVE_LANDSCAPE') {
                const clusterLabel = (d as any).cluster_label;
                if (clusterLabel !== null && clusterLabel !== undefined) {
                  const clusterRgb = getClusterColor(clusterLabel);
                  return [clusterRgb[0], clusterRgb[1], clusterRgb[2], 240];
                }
                // No cluster assignment - use gray
                return [150, 150, 150, 180];
              }

              // Market Positioning mode - color by quadrant (default)
              const quadrant = getQuadrant(d.stars, d.review_count);
              const rgb = QUADRANT_COLORS[quadrant];
              return [rgb[0], rgb[1], rgb[2], 240];
            },
            getLineColor: (d: Business): [number, number, number] => {
              // Highlighted gets bright blue border
              if (highlightedBusinessId === d.business_id) {
                return [59, 130, 246]; // Blue-500
              }
              return [255, 255, 255]; // White for others
            },
            getLineWidth: (d: Business) => {
              // Thicker border for highlighted
              if (highlightedBusinessId === d.business_id) return 4;
              return 2;
            },
            lineWidthMinPixels: 2,
            stroked: true,
            pickable: true,
            getCursor: () => 'pointer',
            onHover: ({ object }) => setHoveredId(object?.business_id || null),
            onClick: ({ object }) => {
              if (!object) return;
              // Open click popup - don't set highlighted (that's for scatter plot only)
              console.log('🗺️ MAP CLICK - Setting clickedId to:', object.business_id);
              setClickedId(object.business_id);
            },
            updateTriggers: {
              getFillColor: [comparisonIds, highlightedBusinessId, clickedBusinessId],
              getLineColor: [highlightedBusinessId, clickedBusinessId],
              getLineWidth: [highlightedBusinessId, clickedBusinessId],
            },
          })
        );
      }
    }

    return result;
  }, [
    cityBoundary,
    neighborhoods,
    showClusters,
    showBoth,
    clusterData,
    pointData,
    primaryBusinessId,
    comparisonIds,
    highlightedBusinessId,
    clickedBusinessId,
    mapViewState,
    setMapViewState,
    supercluster,
    toggleComparison,
    setPrimaryBusiness,
    setHighlightedBusiness,
    prefetchComparisonData,
    setHoveredId,
    setClickedId,
    selectedNeighborhood,
    mapColorMode,
  ]);
}
