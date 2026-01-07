/**
 * Map layers hook for Deck.gl visualization.
 * Manages neighborhood, cluster, and business point layers.
 */
import { useMemo } from 'react';
import { GeoJsonLayer, ScatterplotLayer, IconLayer, TextLayer } from '@deck.gl/layers';
import { scaleLinear } from 'd3-scale';
import Supercluster from 'supercluster';
import { Business } from '@/lib/api';
import { useAppStore, MAGGIANOS_TAMPA_BUSINESS_ID, MapColorMode } from '@/stores/useAppStore';
import { getClusterColor } from '@/utils/clusterColors';
import { LINE_COLORS } from '@/features/comparison/CompetitivePositioningChart';

// Quadrant colors matching scatter plot
const QUADRANT_COLORS = {
  'Market Leaders': [37, 99, 235],    // Deep blue #2563eb
  'Hidden Gems':    [139, 92, 246],   // Violet #8b5cf6
  'Struggling':     [251, 113, 133],  // Pink/rose #fb7185
  'Volume Drivers': [245, 158, 11],   // Amber #f59e0b
};




// Helper to determine quadrant (moved inside useMemo to access dynamic stats)
// Note: This is now defined inside the useMemo callback

// Helper to convert hex to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 0, g: 0, b: 0 };
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
  avgRating: number;
  medianReviewCount: number;
}

export function useMapLayers({
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
  avgRating,
  medianReviewCount,
}: UseMapLayersProps) {
  const filters = useAppStore((state) => state.filters);
  const selectedNeighborhood = filters.neighborhoodId;

  return useMemo(() => {
    // Helper to determine quadrant using dynamic statistics
    const getQuadrant = (rating: number, reviewCount: number) => {
      if (rating >= avgRating && reviewCount >= medianReviewCount) return 'Market Leaders';
      if (rating >= avgRating && reviewCount < medianReviewCount) return 'Hidden Gems';
      if (rating < avgRating && reviewCount >= medianReviewCount) return 'Volume Drivers';
      return 'Struggling';
    };

    const result: any[] = [];

    // 1. Neighborhood boundaries layer
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
              if (!object) return;
              // Open click popup for Maggiano's to show cluster info and highlight on scatter plot
              console.log('🗺️ MAP CLICK - Maggiano\'s (hardcoded primary):', object.business_id);
              setClickedId(object.business_id);
              setHighlightedBusiness(object.business_id);
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
              // Keep original color for all businesses (quadrant or cluster)
              // Clicked and highlighted businesses will be distinguished by outline only
              
              // Competitive Landscape mode - color by cluster
              if (mapColorMode === 'COMPETITIVE_LANDSCAPE') {
                const clusterLabel = (d as any).cluster_label;
                if (clusterLabel !== null && clusterLabel !== undefined) {
                  const clusterRgb = getClusterColor(clusterLabel);
                  return [clusterRgb[0], clusterRgb[1], clusterRgb[2], 255];
                }
                // No cluster assignment - use gray
                return [150, 150, 150, 255];
              }

              // Market Positioning mode - color by quadrant (default)
              const quadrant = getQuadrant(d.stars, d.review_count);
              const rgb = QUADRANT_COLORS[quadrant];
              return [rgb[0], rgb[1], rgb[2], 255];
            },
            getLineColor: (d: Business): [number, number, number] => {
              // Clicked business gets bright pink outline (highest priority)
              if (clickedBusinessId === d.business_id) {
                return [236, 72, 153]; // Bright pink #ec4899
              }
              
              // Highlighted gets yellow border (matching scatter plot)
              if (highlightedBusinessId === d.business_id) {
                return [255, 234, 0]; // Yellow #ffea00ff
              }
              
              // Comparison businesses get matching outline color
              const comparisonIndex = comparisonIds.indexOf(d.business_id);
              if (comparisonIndex !== -1) {
                const color = LINE_COLORS[(comparisonIndex + 1) % LINE_COLORS.length];
                const rgb = hexToRgb(color);
                return [rgb.r, rgb.g, rgb.b];
              }
              
              // Base stroke - dark for separation (matching scatter plot)
              return [13, 13, 13]; // #0d0d0dff
            },
            getLineWidth: (d: Business) => {
              // Clicked business gets prominent outline (highest priority)
              if (clickedBusinessId === d.business_id) return 3;
              
              // Highlighted border (matching scatter plot)
              if (highlightedBusinessId === d.business_id) return 2;
              
              // Comparison businesses border (matching scatter plot)
              const comparisonIndex = comparisonIds.indexOf(d.business_id);
              if (comparisonIndex !== -1) return 2.5;
              
              // Base stroke for separation (matching scatter plot)
              return 0.3;
            },
            lineWidthMinPixels: 0.3,
            stroked: true,
            pickable: true,
            getCursor: () => 'pointer',
            onHover: ({ object }) => setHoveredId(object?.business_id || null),
            onClick: ({ object }) => {
              if (!object) return;
              // Open click popup and highlight on scatter plot
              console.log('🗺️ MAP CLICK - Setting clickedId and highlighted:', object.business_id);
              setClickedId(object.business_id);
              setHighlightedBusiness(object.business_id);
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
    avgRating,
    medianReviewCount,
  ]);
}
