/**
 * Map layers hook for Deck.gl visualization.
 * Manages city boundary, neighborhood, cluster, and business point layers.
 */
import { useMemo } from 'react';
import { GeoJsonLayer, ScatterplotLayer, IconLayer, TextLayer } from '@deck.gl/layers';
import { scaleLinear } from 'd3-scale';
import Supercluster from 'supercluster';
import { Business } from '@/lib/api';
import { useAppStore, MAGGIANOS_TAMPA_BUSINESS_ID } from '@/stores/useAppStore';

// Quadrant colors matching scatter plot
const QUADRANT_COLORS = {
  'Market Leaders': [34, 197, 94],      // Green #22c55e
  'Hidden Gems': [59, 130, 246],         // Blue #3b82f6
  'Struggling': [239, 68, 68],           // Red #ef4444
  'Volume Drivers': [212, 168, 23],      // Dark yellow #d4a817
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
  supercluster: Supercluster<Business> | null;
  mapViewState: MapViewState;
  setMapViewState: (state: MapViewState) => void;
  setHoveredId: (id: string | null) => void;
  setClickedId: (id: string | null) => void;
  toggleComparison: (id: string) => void;
  setPrimaryBusiness: (id: string) => void;
  setHighlightedBusiness: (id: string | null) => void;
  prefetchComparisonData: (id: string, business: Business) => void;
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
  supercluster,
  mapViewState,
  setMapViewState,
  setHoveredId,
  setClickedId,
  toggleComparison,
  setPrimaryBusiness,
  setHighlightedBusiness,
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
          getSize: 14,
          getColor: [255, 255, 255, 255], // White text
          fontFamily: 'Arial, sans-serif',
          fontWeight: 'bold',
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'center',
          pickable: false,
        })
      );
    }

    // 4. Individual business points layer
    // Show in two scenarios:
    // - Hybrid mode (zoom 10-11): Show both clusters and businesses
    // - Business-only mode (zoom >= 12): Show only businesses
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
            getRadius: (d: Business) => {
              // Highlighted from scatter plot interaction
              if (highlightedBusinessId === d.business_id) return 16;
              if (comparisonIds.includes(d.business_id)) return 14;
              return 8;
            },
            radiusMinPixels: 8,
            radiusMaxPixels: 50,
            getFillColor: (d: Business): [number, number, number, number] => {
              // Highlighted from scatter plot - bright blue
              if (highlightedBusinessId === d.business_id) {
                return [59, 130, 246, 255]; // Blue-500 full opacity
              }

              if (comparisonIds.includes(d.business_id)) {
                return [168, 85, 247, 255]; // Purple for comparisons
              }

              // Color by quadrant (same as scatter plot)
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
            lineWidthMinPixels: (d: Business) => {
              // Thicker border for highlighted
              if (highlightedBusinessId === d.business_id) return 4;
              return 2;
            },
            stroked: true,
            pickable: true,
            getCursor: () => 'pointer',
            onHover: ({ object }) => setHoveredId(object?.business_id || null),
            onClick: ({ object }) => {
              if (!object) return;
              // Open click popup to show business details and comparison options
              setClickedId(object.business_id);
              // Set highlighted for scatter plot sync
              setHighlightedBusiness(object.business_id);
              // Clear highlight after 3 seconds
              setTimeout(() => {
                setHighlightedBusiness(null);
              }, 3000);
            },
            updateTriggers: {
              getRadius: [comparisonIds, highlightedBusinessId],
              getFillColor: [comparisonIds, highlightedBusinessId],
              getLineColor: [highlightedBusinessId],
              lineWidthMinPixels: [highlightedBusinessId],
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
  ]);
}
