import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Map from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { scaleLinear } from 'd3-scale';
import Supercluster from 'supercluster';
import { useMapBusinesses, useNeighborhoods } from '@/hooks/useMapBusinesses';
import { useAppStore } from '@/stores/useAppStore';
import { Business } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { MapControls } from './MapControls';
import { SearchPanel } from './SearchPanel';
import { subYears, format } from 'date-fns';

// Color scale for ratings
const ratingColorScale = scaleLinear<string>()
  .domain([1, 2.5, 4, 5])
  .range(['#ef4444', '#f97316', '#eab308', '#22c55e']);

export function DeckMap() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mapRef, setMapRef] = useState<MapRef | null>(null);
  const [deckError, setDeckError] = useState<Error | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const isProgrammaticMoveRef = useRef(false);
  const queryClient = useQueryClient();

  // ✅ Atomic selectors - only re-render when these specific values change
  const mapViewState = useAppStore((state) => state.mapViewState);
  const setMapViewState = useAppStore((state) => state.setMapViewState);
  const primaryBusinessId = useAppStore((state) => state.primaryBusinessId);
  const comparisonIds = useAppStore((state) => state.comparisonIds);
  const toggleComparison = useAppStore((state) => state.toggleComparison);
  const setPrimaryBusiness = useAppStore((state) => state.setPrimaryBusiness);
  const filters = useAppStore((state) => state.filters);

  const selectedState = filters.cityId?.split('_')[1];
  const selectedCity = filters.cityId?.split('_')[0];

  // Helper function to prefetch comparison data in background
  const prefetchComparisonData = useCallback((businessId: string, business: Business) => {
    const cityId = `${business.city}_${business.state}`;
    const categories = business.categories ? business.categories.split(',').map((c: string) => c.trim()) : [];

    // Calculate date range for 5 years
    const endDate = new Date();
    const startDate = subYears(endDate, 5);
    const start_date = format(startDate, 'yyyy-MM-dd');
    const end_date = format(endDate, 'yyyy-MM-dd');

    // Prefetch business timeline (ratings + sentiment combined)
    queryClient.prefetchQuery({
      queryKey: ['businessTimeline', businessId, 'MONTHLY', '5Y', categories],
      queryFn: () => api.analytics.getBusinessTimeline(businessId, {
        period: 'month',
        start_date,
        end_date,
        category: categories[0],
      }),
      staleTime: 10 * 60 * 1000, // 10 minutes
    });

    // Prefetch competitive snapshot
    const city = cityId.split('_')[0];
    const state = cityId.split('_')[1];
    queryClient.prefetchQuery({
      queryKey: ['competitive-snapshot', businessId, cityId, null, categories],
      queryFn: () => api.analytics.getCompetitiveSnapshot({
        city,
        state,
        category: categories[0],
        business_id: businessId,
      }),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });

    console.log('📦 Prefetched comparison data for:', business.name);
  }, [queryClient]);

  // Calculate viewport bounds
  const viewport = useMemo(() => {
    if (!mapRef) return null;
    const bounds = mapRef.getBounds();
    if (!bounds) return null;

    return {
      south: bounds.getSouth(),
      north: bounds.getNorth(),
      west: bounds.getWest(),
      east: bounds.getEast(),
    };
  }, [mapRef, mapViewState]);

  // Fetch businesses and neighborhoods using the viewport endpoint
  const { data: businesses = [], isLoading } = useMapBusinesses(viewport);
  const { data: neighborhoods } = useNeighborhoods(selectedCity, selectedState);

  // Fetch city boundary
  const { data: cityBoundary } = useQuery({
    queryKey: ['cityBoundary', selectedCity, selectedState],
    queryFn: () => api.locations.getCityBoundary({ city: selectedCity!, state: selectedState! }),
    enabled: !!selectedState && !!selectedCity,
  });

  // Debug logging
  useEffect(() => {
    console.log('🗺️ Map Data Debug:', {
      selectedCity,
      selectedState,
      cityId: filters.cityId,
      neighborhoodId: filters.neighborhoodId,
      neighborhoodsFeatures: neighborhoods?.features?.length || 0,
      cityBoundaryFeatures: cityBoundary?.features?.length || 0,
      businessCount: businesses.length,
      viewport
    });
  }, [selectedCity, selectedState, filters.cityId, filters.neighborhoodId, neighborhoods, cityBoundary, businesses.length, viewport]);

  // Auto-navigate to city boundary when city changes
  useEffect(() => {
    if (!cityBoundary || !mapRef) return;

    try {
      // Calculate bounds from city GeoJSON
      let minLng = Infinity, minLat = Infinity;
      let maxLng = -Infinity, maxLat = -Infinity;

      const features = cityBoundary.features || [cityBoundary];

      features.forEach((feature: any) => {
        const coords = feature.geometry?.coordinates || [];
        const flattenCoords = (c: any): void => {
          if (Array.isArray(c[0])) {
            c.forEach(flattenCoords);
          } else {
            const [lng, lat] = c;
            minLng = Math.min(minLng, lng);
            maxLng = Math.max(maxLng, lng);
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
          }
        };
        flattenCoords(coords);
      });

      if (isFinite(minLng) && isFinite(minLat) && isFinite(maxLng) && isFinite(maxLat)) {
        const centerLng = (minLng + maxLng) / 2;
        const centerLat = (minLat + maxLat) / 2;

        // Calculate appropriate zoom level
        const lngDiff = maxLng - minLng;
        const latDiff = maxLat - minLat;
        const maxDiff = Math.max(lngDiff, latDiff);

        // Rough zoom calculation (adjust as needed)
        let zoom = 11;
        if (maxDiff < 0.05) zoom = 13;
        else if (maxDiff < 0.1) zoom = 12;
        else if (maxDiff < 0.2) zoom = 11;
        else if (maxDiff < 0.5) zoom = 10;
        else zoom = 9;

        isProgrammaticMoveRef.current = true;
        setMapViewState({
          longitude: centerLng,
          latitude: centerLat,
          zoom,
          pitch: 0,
          bearing: 0,
          transitionDuration: 1000,
        });
      }
    } catch (error) {
      console.warn('Failed to fit city boundary:', error);
    }
  }, [cityBoundary, mapRef]);

  // Auto-navigate to selected neighborhood
  useEffect(() => {
    if (!filters.neighborhoodId || !neighborhoods || !mapRef) return;

    try {
      // Find the selected neighborhood feature
      const selectedFeature = neighborhoods.features?.find(
        (f: any) => f.properties?.neighborhood === filters.neighborhoodId
      );

      if (!selectedFeature) return;

      // Calculate bounds from neighborhood GeoJSON
      let minLng = Infinity, minLat = Infinity;
      let maxLng = -Infinity, maxLat = -Infinity;

      const coords = selectedFeature.geometry?.coordinates || [];
      const flattenCoords = (c: any): void => {
        if (Array.isArray(c[0])) {
          c.forEach(flattenCoords);
        } else {
          const [lng, lat] = c;
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        }
      };
      flattenCoords(coords);

      if (isFinite(minLng) && isFinite(minLat) && isFinite(maxLng) && isFinite(maxLat)) {
        const centerLng = (minLng + maxLng) / 2;
        const centerLat = (minLat + maxLat) / 2;

        // Zoom to neighborhood level (typically 13-14)
        isProgrammaticMoveRef.current = true;
        setMapViewState({
          longitude: centerLng,
          latitude: centerLat,
          zoom: 13,
          pitch: 0,
          bearing: 0,
          transitionDuration: 1000,
        });
      }
    } catch (error) {
      console.warn('Failed to fit neighborhood boundary:', error);
    }
  }, [filters.neighborhoodId, neighborhoods, mapRef]);

  // Clustering logic
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

    const clusterZoom = Math.floor(mapViewState.zoom);
    const clusters = index.getClusters(
      [bounds.west, bounds.south, bounds.east, bounds.north],
      clusterZoom
    );

    console.log('🔍 Clustering Debug:', {
      totalBusinesses: businesses.length,
      clusters: clusters.length,
      zoom: mapViewState.zoom,
      clusterZoom,
      showingClusters: clusterZoom < 12
    });

    return { clusters, supercluster: index };
  }, [businesses, viewport, mapViewState.zoom]);

  // Determine if we should show clusters or individual points
  const showClusters = mapViewState.zoom < 12;

  // Prepare data for layers
  const { clusterData, pointData } = useMemo(() => {
    const clusterPoints: Array<{ position: [number, number]; count: number; id: number }> = [];
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

  // Map control handlers with smooth transitions
  const handleZoomIn = useCallback(() => {
    isProgrammaticMoveRef.current = true;
    setMapViewState({
      ...mapViewState,
      zoom: Math.min(mapViewState.zoom + 1, 20),
      transitionDuration: 300, // Smooth zoom animation
    });
  }, [mapViewState, setMapViewState]);

  const handleZoomOut = useCallback(() => {
    isProgrammaticMoveRef.current = true;
    setMapViewState({
      ...mapViewState,
      zoom: Math.max(mapViewState.zoom - 1, 0),
      transitionDuration: 300, // Smooth zoom animation
    });
  }, [mapViewState, setMapViewState]);

  const handleResetNorth = useCallback(() => {
    isProgrammaticMoveRef.current = true;
    setMapViewState({
      ...mapViewState,
      bearing: 0,
      pitch: 0,
      transitionDuration: 500, // Smooth rotation animation
    });
  }, [mapViewState, setMapViewState]);

  // Handle search selection with smooth transition
  const handleSearchSelect = useCallback((business: Business) => {
    setPrimaryBusiness(business.business_id);

    // Prefetch comparison data in background
    prefetchComparisonData(business.business_id, business);

    const currentZoom = mapViewState.zoom;

    // Sophisticated animation: if zoomed far out, do two-step zoom
    if (currentZoom <= 11) {
      isProgrammaticMoveRef.current = true;
      // Step 1: Zoom out slightly to show context
      setMapViewState({
        ...mapViewState,
        zoom: 7,
        transitionDuration: 300,
      });

      // Step 2: After brief pause, fly to destination with higher zoom
      setTimeout(() => {
        isProgrammaticMoveRef.current = true;
        setMapViewState({
          longitude: business.longitude,
          latitude: business.latitude,
          zoom: 16,
          pitch: 0,
          bearing: 0,
          transitionDuration: 800,
        });
      }, 350);
    } else {
      isProgrammaticMoveRef.current = true;
      // Already zoomed in, do direct smooth transition
      setMapViewState({
        longitude: business.longitude,
        latitude: business.latitude,
        zoom: 16,
        pitch: 0,
        bearing: 0,
        transitionDuration: 800,
      });
    }
  }, [setPrimaryBusiness, setMapViewState, mapViewState, prefetchComparisonData]);

  // Set filter to current view - analyze visible businesses
  const handleSetFilterToView = useCallback(() => {
    if (businesses.length === 0) return;

    // Count businesses by city
    const cityCounts = new Map<string, number>();
    businesses.forEach((business) => {
      const cityKey = `${business.city}_${business.state}`;
      cityCounts.set(cityKey, (cityCounts.get(cityKey) || 0) + 1);
    });

    // Find most common city in view
    let mostCommonCity = '';
    let maxCount = 0;
    cityCounts.forEach((count, cityKey) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonCity = cityKey;
      }
    });

    if (mostCommonCity) {
      useAppStore.getState().updateFilters({
        cityId: mostCommonCity,
      });
    }
  }, [businesses]);

  // Layers
  const layers = useMemo(() => {
    const result: any[] = [];

    // 1. City boundary
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

    // 2. Neighborhood boundaries
    if (neighborhoods) {
      const selectedNeighborhood = filters.neighborhoodId;

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

    // 3. Cluster layer (zoom < 13)
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
            return [
              255,
              Math.floor(165 - intensity * 65),
              0,
              220
            ];
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

    // 4. Individual business points (zoom >= 13)
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
    hoveredId,
    mapViewState,
    setMapViewState,
    supercluster,
    toggleComparison,
    setPrimaryBusiness,
  ]);

  // Handle deck.gl errors
  const handleDeckError = useCallback((error: Error) => {
    if (error.message?.includes('maxTextureDimension2D') ||
        error.message?.includes('WebGL context')) {
      console.warn('Ignoring WebGL lifecycle error:', error.message);
      return;
    }
    console.error('Deck.gl error:', error);
    setDeckError(error);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '+':
        case '=':
        case 'Add':
          e.preventDefault();
          handleZoomIn();
          break;
        case '-':
        case '_':
        case 'Subtract':
          e.preventDefault();
          handleZoomOut();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [handleZoomIn, handleZoomOut]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setMapRef(null);
    };
  }, []);

  if (deckError) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-background">
        <div className="glass p-6 rounded-lg max-w-md text-center space-y-3">
          <h3 className="font-semibold text-red-500">Map Error</h3>
          <p className="text-sm text-muted-foreground">
            Failed to initialize the map. This may be due to WebGL not being available in your browser.
          </p>
          <Button onClick={() => window.location.reload()} size="sm">
            Reload Page
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <DeckGL
        key="deck-map-instance"
        viewState={mapViewState}
        onViewStateChange={(evt: any) => {
          setMapViewState(evt.viewState);
          // Clear programmatic move flag on user interaction
          if (!evt.viewState.transitionDuration) {
            isProgrammaticMoveRef.current = false;
          }
        }}
        controller={true}
        layers={layers}
        getCursor={() => 'default'}
        onError={handleDeckError}
        onWebGLInitialized={(gl: WebGLRenderingContext) => {
          if (!gl) {
            handleDeckError(new Error('WebGL context not available'));
          }
        }}
        _typedArrayManagerProps={{
          overAlloc: 1,
          poolSize: 0
        }}
      >
        <Map
          ref={setMapRef}
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          attributionControl={false}
        />
      </DeckGL>

      {/* Map Controls (Top Right) */}
      <MapControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetNorth={handleResetNorth}
        onSearchToggle={() => setIsSearchOpen(!isSearchOpen)}
        onSetFilterToView={handleSetFilterToView}
        isSearchOpen={isSearchOpen}
        currentZoom={mapViewState.zoom}
      />

      {/* Search Panel */}
      <SearchPanel
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectBusiness={handleSearchSelect}
      />

      {/* Hover tooltip */}
      {hoveredId && (
        <div className="absolute bottom-20 left-4 glass p-3 rounded-lg max-w-xs">
          {(() => {
            const business = businesses.find((b) => b.business_id === hoveredId);
            if (!business) return null;
            const isOpen = business.is_open === 1;
            return (
              <div className="space-y-1">
                <h4 className="font-semibold text-sm">{business.name}</h4>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">
                    ⭐ {business.stars.toFixed(1)} • {business.review_count} reviews
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      isOpen
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {isOpen ? 'Open' : 'Closed'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {business.neighborhood || business.city}
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 glass px-4 py-2 rounded-full text-sm">
          Loading businesses...
        </div>
      )}
    </div>
  );
}
