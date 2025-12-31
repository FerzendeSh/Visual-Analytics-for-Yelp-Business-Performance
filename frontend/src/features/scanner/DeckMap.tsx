/**
 * DeckMap - Main map visualization component (REFACTORED)
 * Reduced from 747 lines to ~200 lines by extracting logic into custom hooks and components.
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Map from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import DeckGL from '@deck.gl/react';
import { useQuery } from '@tanstack/react-query';
import { useMapBusinesses, useNeighborhoods } from '@/hooks/useMapBusinesses';
import { useAppStore } from '@/stores/useAppStore';
import { Business, api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { MapControls } from './MapControls';
import { SearchPanel } from './SearchPanel';
import { MapTooltip } from './components/MapTooltip';
import { useMapClustering } from './hooks/useMapClustering';
import { useNavigateToCity, useNavigateToNeighborhood } from './hooks/useMapNavigation';
import { usePrefetchComparison } from './hooks/usePrefetchComparison';
import { useMapLayers } from './hooks/useMapLayers';

export function DeckMap() {
  // Local state
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mapRef, setMapRef] = useState<MapRef | null>(null);
  const [deckError, setDeckError] = useState<Error | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const isProgrammaticMoveRef = useRef(false);
  const deckGLRef = useRef<any>(null);
  const previousLayersRef = useRef<any[]>([]);

  // Global state (atomic selectors)
  const mapViewState = useAppStore((state) => state.mapViewState);
  const setMapViewState = useAppStore((state) => state.setMapViewState);
  const primaryBusinessId = useAppStore((state) => state.primaryBusinessId);
  const comparisonIds = useAppStore((state) => state.comparisonIds);
  const toggleComparison = useAppStore((state) => state.toggleComparison);
  const setPrimaryBusiness = useAppStore((state) => state.setPrimaryBusiness);
  const filters = useAppStore((state) => state.filters);

  const selectedState = filters.cityId?.split('_')[1];
  const selectedCity = filters.cityId?.split('_')[0];

  // Custom hooks
  const { prefetchComparisonData } = usePrefetchComparison();

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

  // Fetch data
  const { data: businesses = [], isLoading } = useMapBusinesses(viewport);
  const { data: neighborhoods } = useNeighborhoods(selectedCity, selectedState);
  const { data: cityBoundary } = useQuery({
    queryKey: ['cityBoundary', selectedCity, selectedState],
    queryFn: () => api.locations.getCityBoundary({ city: selectedCity!, state: selectedState! }),
    enabled: !!selectedState && !!selectedCity,
  });

  // Clustering logic (extracted)
  const { clusterData, pointData, showClusters, supercluster } = useMapClustering(
    businesses,
    viewport,
    mapViewState.zoom
  );

  // Auto-navigation (extracted)
  useNavigateToCity(cityBoundary, mapRef, setMapViewState, isProgrammaticMoveRef);
  useNavigateToNeighborhood(filters.neighborhoodId, neighborhoods, mapRef, setMapViewState, isProgrammaticMoveRef);

  // Layers (extracted)
  const layers = useMapLayers({
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
  });

  // Map control handlers
  const handleZoomIn = useCallback(() => {
    isProgrammaticMoveRef.current = true;
    setMapViewState({
      ...mapViewState,
      zoom: Math.min(mapViewState.zoom + 1, 20),
      transitionDuration: 300,
    });
  }, [mapViewState, setMapViewState]);

  const handleZoomOut = useCallback(() => {
    isProgrammaticMoveRef.current = true;
    setMapViewState({
      ...mapViewState,
      zoom: Math.max(mapViewState.zoom - 1, 0),
      transitionDuration: 300,
    });
  }, [mapViewState, setMapViewState]);

  const handleResetNorth = useCallback(() => {
    isProgrammaticMoveRef.current = true;
    setMapViewState({
      ...mapViewState,
      bearing: 0,
      pitch: 0,
      transitionDuration: 500,
    });
  }, [mapViewState, setMapViewState]);

  const handleSearchSelect = useCallback(
    (business: Business) => {
      setPrimaryBusiness(business.business_id);
      prefetchComparisonData(business.business_id, business);

      const currentZoom = mapViewState.zoom;

      // Sophisticated animation: if zoomed far out, do two-step zoom
      if (currentZoom <= 11) {
        isProgrammaticMoveRef.current = true;
        setMapViewState({
          ...mapViewState,
          zoom: 7,
          transitionDuration: 300,
        });

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
        setMapViewState({
          longitude: business.longitude,
          latitude: business.latitude,
          zoom: 16,
          pitch: 0,
          bearing: 0,
          transitionDuration: 800,
        });
      }
    },
    [setPrimaryBusiness, setMapViewState, mapViewState, prefetchComparisonData]
  );

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

  // Handle deck.gl errors
  const handleDeckError = useCallback((error: Error) => {
    if (
      error.message?.includes('maxTextureDimension2D') ||
      error.message?.includes('WebGL context')
    ) {
      console.warn('Ignoring WebGL lifecycle error:', error.message);
      return;
    }
    console.error('Deck.gl error:', error);
    setDeckError(error);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
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

  // Clean up layers when they change to prevent WebGL resource leaks
  useEffect(() => {
    const prevLayers = previousLayersRef.current;

    // Finalize old layers that are no longer in use
    if (prevLayers.length > 0) {
      prevLayers.forEach((layer) => {
        if (layer && typeof layer.finalize === 'function') {
          try {
            layer.finalize();
          } catch (error) {
            console.warn('Error finalizing layer:', error);
          }
        }
      });
    }

    // Store current layers for next cleanup
    previousLayersRef.current = layers;
  }, [layers]);

  // Cleanup on unmount - critical for preventing WebGL context leaks
  useEffect(() => {
    return () => {
      // Clean up all layers
      const layersToClean = previousLayersRef.current;
      if (layersToClean.length > 0) {
        layersToClean.forEach((layer) => {
          if (layer && typeof layer.finalize === 'function') {
            try {
              layer.finalize();
            } catch (error) {
              console.warn('Error finalizing layer on unmount:', error);
            }
          }
        });
      }

      // Clean up DeckGL instance
      if (deckGLRef.current && typeof deckGLRef.current.finalize === 'function') {
        try {
          deckGLRef.current.finalize();
        } catch (error) {
          console.warn('Error finalizing DeckGL:', error);
        }
      }

      // Clean up map ref
      setMapRef(null);

      console.log('🧹 WebGL resources cleaned up on DeckMap unmount');
    };
  }, []);

  // Error state
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

  // Find hovered business for tooltip
  const hoveredBusiness = hoveredId ? businesses.find((b) => b.business_id === hoveredId) : null;

  return (
    <div className="relative w-full h-full">
      <DeckGL
        ref={deckGLRef}
        key="deck-map-instance"
        viewState={mapViewState}
        onViewStateChange={(evt: any) => {
          setMapViewState(evt.viewState);
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
          poolSize: 0,
        }}
      >
        <Map
          ref={setMapRef}
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          attributionControl={false}
        />
      </DeckGL>

      {/* Map Controls */}
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

      {/* Hover Tooltip */}
      <MapTooltip business={hoveredBusiness} />

      {/* Loading Indicator */}
      {isLoading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 glass px-4 py-2 rounded-full text-sm">
          Loading businesses...
        </div>
      )}
    </div>
  );
}
