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
import { MapClickPopup } from './components/MapClickPopup';
import { useMapClustering } from './hooks/useMapClustering';
import { useNavigateToCity, useNavigateToNeighborhood } from './hooks/useMapNavigation';
import { usePrefetchComparison } from './hooks/usePrefetchComparison';
import { useMapLayers } from './hooks/useMapLayers';
import { useClustersInViewport, useAllClusters, useClusterBusinessIds, useBusinessesWithClusters } from '@/hooks/useClusterData';

export function DeckMap() {
  // Local state
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [mapRef, setMapRef] = useState<MapRef | null>(null);
  const [deckError, setDeckError] = useState<Error | null>(null);
  const [selectedSearchBusiness, setSelectedSearchBusiness] = useState<Business | null>(null);
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
  const setHighlightedBusiness = useAppStore((state) => state.setHighlightedBusiness);
  const highlightedBusinessId = useAppStore((state) => state.highlightedBusinessId);
  const clickedId = useAppStore((state) => state.clickedBusinessId);
  const setClickedId = useAppStore((state) => state.setClickedBusiness);
  const filters = useAppStore((state) => state.filters);
  const mapColorMode = useAppStore((state) => state.mapColorMode);
  const clusterFilter = useAppStore((state) => state.clusterFilter);

  const selectedState = filters.cityId?.split('_')[1];
  const selectedCity = filters.cityId?.split('_')[0];

  // Custom hooks
  const { prefetchComparisonData } = usePrefetchComparison();

  // Calculate viewport bounds
  // Note: This updates whenever mapViewState changes, which includes during/after navigation
  const viewport = useMemo(() => {
    if (!mapRef) {
      console.log('📐 Viewport: no mapRef yet');
      return null;
    }
    const bounds = mapRef.getBounds();
    if (!bounds) {
      console.log('📐 Viewport: no bounds yet');
      return null;
    }

    const viewportBounds = {
      south: bounds.getSouth(),
      north: bounds.getNorth(),
      west: bounds.getWest(),
      east: bounds.getEast(),
    };

    console.log('📐 Viewport calculated:', viewportBounds, 'zoom:', mapViewState.zoom);
    return viewportBounds;
  }, [mapRef, mapViewState]);

  // Fetch data
  const { data: businesses = [], isLoading } = useMapBusinesses(viewport);
  const { data: neighborhoods } = useNeighborhoods(selectedCity, selectedState);

  // Cluster data
  const { data: allClusters = [] } = useAllClusters();
  const { data: clusterBusinessIds } = useClusterBusinessIds(clusterFilter);

  // Enrich businesses with cluster assignments and apply filter
  const enrichedBusinesses = useBusinessesWithClusters(
    businesses,
    allClusters,
    clusterFilter,
    clusterBusinessIds
  );

  const { data: cityBoundary, isLoading: isCityBoundaryLoading } = useQuery({
    queryKey: ['cityBoundary', selectedCity, selectedState],
    queryFn: async () => {
      console.log('🗺️ Fetching city boundary:', { city: selectedCity, state: selectedState });
      const result = await api.locations.getCityBoundary({ city: selectedCity!, state: selectedState! });
      if (!result) {
        console.log('🗺️ City boundary not available for:', { city: selectedCity, state: selectedState });
      }
      return result;
    },
    enabled: !!selectedState && !!selectedCity,
    retry: false, // Don't retry 404s for missing boundaries
    staleTime: Infinity, // City boundaries don't change
  });

  // Clustering logic (extracted) - use enriched businesses
  const { clusterData, pointData, showClusters, showBoth, supercluster } = useMapClustering(
    enrichedBusinesses,
    viewport,
    mapViewState.zoom
  );

  // Ensure selected search business is included in pointData even if not yet in viewport
  const enhancedPointData = useMemo(() => {
    if (!selectedSearchBusiness) return pointData;

    // Check if the selected business is already in pointData
    const alreadyIncluded = pointData.some(b => b.business_id === selectedSearchBusiness.business_id);
    if (alreadyIncluded) return pointData;

    // Add it if not present
    return [...pointData, selectedSearchBusiness];
  }, [pointData, selectedSearchBusiness]);

  // Auto-navigation (extracted)
  useNavigateToCity(cityBoundary, mapRef, setMapViewState, isProgrammaticMoveRef, filters.cityId, businesses, isCityBoundaryLoading);
  useNavigateToNeighborhood(filters.neighborhoodId, neighborhoods, mapRef, setMapViewState, isProgrammaticMoveRef);

  // Layers (extracted)
  const layers = useMapLayers({
    cityBoundary,
    neighborhoods,
    showClusters,
    showBoth,
    clusterData,
    pointData: enhancedPointData,
    primaryBusinessId,
    comparisonIds,
    highlightedBusinessId,
    clickedBusinessId: clickedId,
    supercluster,
    mapViewState,
    setMapViewState,
    setHoveredId,
    setClickedId,
    toggleComparison,
    setPrimaryBusiness,
    setHighlightedBusiness,
    prefetchComparisonData,
    mapColorMode, // NEW: Pass map color mode
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
      // Store the selected business for the popup
      setSelectedSearchBusiness(business);
      // Set the business as clicked (will show popup and change color)
      setClickedId(business.business_id);
      prefetchComparisonData(business.business_id, business);

      // Navigate directly to the business location with zoom level 16
      // Don't update city filter - just navigate the map view
      isProgrammaticMoveRef.current = true;
      setMapViewState({
        longitude: business.longitude,
        latitude: business.latitude,
        zoom: 16,
        pitch: 0,
        bearing: 0,
        transitionDuration: 1000,
      });
    },
    [setClickedId, setMapViewState, prefetchComparisonData]
  );

  // Navigate to Maggiano's business location
  const handleGoToMyBusiness = useCallback(() => {
    isProgrammaticMoveRef.current = true;
    setMapViewState({
      longitude: -82.526348, // Maggiano's Tampa location
      latitude: 27.946453,
      zoom: 15.1, // Configured zoom level for Maggiano's
      pitch: 0,
      bearing: 0,
      transitionDuration: 1000,
    });
  }, [setMapViewState]);

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

  // Find hovered and clicked businesses
  const hoveredBusiness = hoveredId ? businesses.find((b) => b.business_id === hoveredId) ?? null : null;
  // Use the selected search business if available, otherwise find in the businesses array
  const clickedBusiness = clickedId
    ? (selectedSearchBusiness?.business_id === clickedId
        ? selectedSearchBusiness
        : businesses.find((b) => b.business_id === clickedId) ?? null)
    : null;

  // Comparison handlers
  const handleAddToComparison = useCallback(() => {
    if (clickedId && comparisonIds.length < 3) {
      toggleComparison(clickedId);
    }
  }, [clickedId, comparisonIds.length, toggleComparison]);

  const handleRemoveFromComparison = useCallback(() => {
    if (clickedId) {
      toggleComparison(clickedId);
    }
  }, [clickedId, toggleComparison]);

  const handleClosePopup = useCallback(() => {
    setClickedId(null);
    // Don't clear selectedSearchBusiness - keep it so the dot stays visible
    // It will be cleared when a new search selection is made
    // Also clear highlighted business when closing popup
    setHighlightedBusiness(null);
  }, [setClickedId, setHighlightedBusiness]);

  return (
    <div
      className="relative w-full h-full rounded-lg overflow-hidden"
      onClick={(e) => {
        // Close popup when clicking on the map background
        // Only if the click is directly on the container (not on children)
        if (e.target === e.currentTarget) {
          handleClosePopup();
        }
      }}
    >
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
        getCursor={({ isDragging, isHovering }) => {
          if (isDragging) return 'grabbing';
          if (isHovering) return 'pointer';
          return 'default';
        }}
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
        onClick={() => {
          // Close popup when clicking anywhere on the map
          if (clickedId) {
            handleClosePopup();
          }
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
        onGoToMyBusiness={handleGoToMyBusiness}
        currentZoom={mapViewState.zoom}
      />

      {/* Search Panel - Always visible */}
      <SearchPanel onSelectBusiness={handleSearchSelect} />

      {/* Hover Tooltip - Only show if no clicked popup */}
      {!clickedBusiness && <MapTooltip business={hoveredBusiness} />}

      {/* Click Popup */}
      {clickedBusiness && (
        <MapClickPopup
          business={clickedBusiness}
          isInComparison={comparisonIds.includes(clickedId!)}
          canAddMore={comparisonIds.length < 3}
          onAddToComparison={handleAddToComparison}
          onRemoveFromComparison={handleRemoveFromComparison}
          onClose={handleClosePopup}
        />
      )}

      {/* Loading Indicator - Bottom left */}
      {isLoading && (
        <div className="absolute bottom-3 left-3 z-40 glass px-4 py-2 rounded-full text-sm">
          Loading businesses...
        </div>
      )}
    </div>
  );
}
