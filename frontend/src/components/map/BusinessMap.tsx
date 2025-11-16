import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Map as MapLibre, Marker, Popup, MapRef } from 'react-map-gl/maplibre';
import Supercluster from 'supercluster';
import 'maplibre-gl/dist/maplibre-gl.css';
import './BusinessMap.css';
import { useViewportBusinesses } from '../../hooks/useViewportBusinesses';

interface Business {
  business_id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  review_count: number;
  stars: number;
  categories: string;
  is_open: number;
  photo_count?: number;
}

interface BusinessMapProps {
  businesses?: Business[]; // Now optional - can use viewport loading instead
  useViewportLoading?: boolean; // Enable dynamic viewport-based loading
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  onBusinessSelect?: (business: Business) => void;
  selectedCity?: string;
  selectedCategory?: string;
  selectedRating?: number | null;
  selectedStatus?: number | null;
  selectedBusiness?: Business | null;
}

// Nashville, TN - default starting location
const NASHVILLE_CENTER = {
  longitude: -86.7816,
  latitude: 36.1627,
  zoom: 12,
};

type PointFeature = GeoJSON.Feature<GeoJSON.Point, Business>;

const BusinessMap: React.FC<BusinessMapProps> = ({
  businesses: propBusinesses,
  useViewportLoading = true, // Default to viewport loading
  initialViewState = NASHVILLE_CENTER, // Default to Nashville
  onBusinessSelect,
  selectedCity = "",
  selectedCategory = "",
  selectedRating = null,
  selectedStatus = null,
  selectedBusiness = null,
}) => {
  const mapRef = useRef<MapRef>(null);
  const [popupInfo, setPopupInfo] = useState<Business | null>(null);
  const [viewport, setViewport] = useState({ ...initialViewState });
  const previousCityRef = useRef<string>("");
  const viewportRef = useRef({ ...initialViewState });
  const isMapClickRef = useRef(false); // Track if selection came from map click

  // Accumulative business storage - keeps all loaded businesses
  const [accumulatedBusinesses, setAccumulatedBusinesses] = useState<Map<string, Business>>(new Map());

  // Track loaded viewport bounds to avoid duplicate fetches
  const loadedBoundsRef = useRef<Set<string>>(new Set());

  // Debounced viewport bounds for API calls (only update after user stops panning)
  const [debouncedBounds, setDebouncedBounds] = useState<{
    south: number;
    north: number;
    west: number;
    east: number;
  } | null>(null);

  // Calculate dynamic limit based on zoom level
  // Zoomed out (zoom < 5): fetch more businesses to cover large area
  // Zoomed in (zoom > 10): fetch fewer businesses for performance
  const dynamicLimit = useMemo(() => {
    const zoom = viewport.zoom;
    if (zoom < 4) return 5000; // Fully zoomed out - get max businesses
    if (zoom < 7) return 3000; // State/region level
    if (zoom < 10) return 2000; // City level
    return 1500; // Neighborhood level
  }, [viewport.zoom]);

  // Load businesses from viewport if enabled
  const { data: viewportBusinesses, isLoading: viewportLoading } = useViewportBusinesses({
    bounds: debouncedBounds || {
      south: initialViewState.latitude - 0.2,
      north: initialViewState.latitude + 0.2,
      west: initialViewState.longitude - 0.2,
      east: initialViewState.longitude + 0.2,
    },
    filters: {
      city: selectedCity || undefined,
      category: selectedCategory || undefined,
      min_rating: selectedRating || undefined,
      is_open: selectedStatus !== null ? selectedStatus : undefined,
    },
    limit: dynamicLimit,
    enabled: useViewportLoading && !!debouncedBounds, // Only fetch if viewport loading is enabled and bounds are set
  });

  // Accumulate businesses as they're loaded (don't replace, add to existing)
  useEffect(() => {
    if (!useViewportLoading || !viewportBusinesses || viewportBusinesses.length === 0) return;

    setAccumulatedBusinesses(prev => {
      const updated = new Map(prev);
      viewportBusinesses.forEach(business => {
        updated.set(business.business_id, business);
      });
      return updated;
    });
  }, [viewportBusinesses, useViewportLoading]);

  // Clear accumulated businesses when filters change
  useEffect(() => {
    if (useViewportLoading) {
      setAccumulatedBusinesses(new Map());
      loadedBoundsRef.current.clear();
    }
  }, [selectedCity, selectedCategory, selectedRating, selectedStatus, useViewportLoading]);

  // Use accumulated businesses if loading mode is enabled, otherwise use prop businesses
  const businesses = useViewportLoading
    ? Array.from(accumulatedBusinesses.values())
    : (propBusinesses || []);

  // For viewport loading mode, businesses are already filtered server-side
  // For prop mode, filter client-side as before
  const filteredBusinesses = useMemo(() => {
    if (useViewportLoading) {
      // Server already filtered, just return businesses
      return businesses;
    }
    // Client-side filtering for prop mode
    return businesses.filter((b) => {
      const cityMatch = selectedCity ? b.city === selectedCity : true;
      const categoryMatch = selectedCategory
        ? b.categories?.toLowerCase().includes(selectedCategory.toLowerCase())
        : true;
      const ratingMatch = selectedRating ? b.stars == selectedRating : true;
      const statusMatch = selectedStatus !== null ? b.is_open === selectedStatus : true;

      return cityMatch && categoryMatch && ratingMatch && statusMatch;
    });
  }, [businesses, selectedCity, selectedCategory, selectedRating, selectedStatus, useViewportLoading]);

  //Supercluster built from filtered businesses
  const supercluster = useMemo(() => {
    const validBusinesses = filteredBusinesses.filter(
      (b) =>
        b.latitude &&
        b.longitude &&
        !isNaN(b.latitude) &&
        !isNaN(b.longitude)
    );

    const points: PointFeature[] = validBusinesses.map((b) => ({
      type: "Feature",
      properties: b,
      geometry: { type: "Point", coordinates: [b.longitude, b.latitude] },
    }));

    const cluster = new Supercluster<Business>({ radius: 75, maxZoom: 20 });
    cluster.load(points);
    return cluster;
  }, [filteredBusinesses]);

  // ✅ Get visible clusters
  const clusters = useMemo(() => {
    const bounds = mapRef.current?.getBounds();
    if (!bounds) {
      return supercluster.getClusters([-180, -85, 180, 85], Math.floor(viewport.zoom));
    }
    return supercluster.getClusters(
      [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
      Math.floor(viewport.zoom)
    );
  }, [supercluster, viewport]);

  // Debounce viewport changes for API calls (wait 500ms after user stops panning)
  useEffect(() => {
    if (!useViewportLoading) return;

    const debounceTimer = setTimeout(() => {
      const bounds = mapRef.current?.getBounds();
      if (bounds) {
        setDebouncedBounds({
          south: bounds.getSouth(),
          north: bounds.getNorth(),
          west: bounds.getWest(),
          east: bounds.getEast(),
        });
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(debounceTimer);
  }, [viewport, useViewportLoading]);

  // Initialize bounds on mount for viewport loading
  useEffect(() => {
    if (!useViewportLoading || debouncedBounds) return;

    const bounds = mapRef.current?.getBounds();
    if (bounds) {
      setDebouncedBounds({
        south: bounds.getSouth(),
        north: bounds.getNorth(),
        west: bounds.getWest(),
        east: bounds.getEast(),
      });
    }
  }, [useViewportLoading, debouncedBounds]);

  useEffect(() => {
    const previousCity = previousCityRef.current;

    if (previousCity === selectedCity) return;
    if (selectedCity !== "") {
      const cityBusinesses = businesses.filter(b => b.city === selectedCity);
      if (cityBusinesses.length > 0) {

        const lats = cityBusinesses.map(b => b.latitude).filter(lat => !isNaN(lat));
        const lngs = cityBusinesses.map(b => b.longitude).filter(lng => !isNaN(lng));

        if (lats.length > 0 && lngs.length > 0) {
          const avgLat = lats.reduce((a, b) => a + b) / lats.length;
          const avgLng = lngs.reduce((a, b) => a + b) / lngs.length;

          mapRef.current?.flyTo({
            center: [avgLng, avgLat],
            zoom: 11,
            duration: 700,
          });
        }
      }
    } else if (selectedCity === "" && previousCity !== "") {
      mapRef.current?.flyTo({
        center: [initialViewState.longitude, initialViewState.latitude],
        zoom: initialViewState.zoom,
        duration: 700,
      });
    }
    previousCityRef.current = selectedCity;
  }, [selectedCity, businesses, initialViewState]);

 // Zoom to selected business when it changes
useEffect(() => {
  // Close popup and clear selection when selectedBusiness becomes null
  if (selectedBusiness === null) {
    setPopupInfo(null);
    isMapClickRef.current = false;
    return;
  }

  if (
    !selectedBusiness ||
    !selectedBusiness.latitude ||
    !selectedBusiness.longitude
  ) {
    return;
  }

  // Show popup when business is selected
  setPopupInfo(selectedBusiness);

  const map = mapRef.current;
  if (!map) return;

  // Skip zoom animation if user clicked directly on map marker
  // Map click selections don't need zoom animation
  if (isMapClickRef.current) {
    isMapClickRef.current = false;
    return;
  }

  const currentZoom = map.getZoom();

  // If we're already zoomed in close to the target location, don't animate zoom-out
  if (currentZoom > 11) {
    map.easeTo({
      center: [selectedBusiness.longitude, selectedBusiness.latitude],
      zoom: 16,
      duration: 300,
    });
  } else {
    // Zoom out slightly for movement then zoom in
    map.easeTo({
      zoom: 7,
      duration: 150,
    });

    setTimeout(() => {
      map.easeTo({
        center: [selectedBusiness.longitude, selectedBusiness.latitude],
        zoom: 17,
        duration: 300,
      });
    }, 160);
  }
}, [selectedBusiness]); // <- IMPORTANT: remove viewport.zoom

  const totalBusinesses = filteredBusinesses.length;

  const handleZoomIn = () => {
    mapRef.current?.easeTo({
      zoom: Math.min(viewportRef.current.zoom + 1, 20),
      duration: 300,
    });
  };

  const handleZoomOut = () => {
    mapRef.current?.easeTo({
      zoom: Math.max(viewportRef.current.zoom - 1, 0),
      duration: 300,
    });
  };

  const handleResetOrientation = () => {
    mapRef.current?.easeTo({
      bearing: 0,
      pitch: 0,
      duration: 500,
    });
  };

  const handleRefreshBusinesses = useCallback(() => {
    if (useViewportLoading) {
      setAccumulatedBusinesses(new Map());
      loadedBoundsRef.current.clear();
      // Trigger a refresh by updating bounds
      const bounds = mapRef.current?.getBounds();
      if (bounds) {
        setDebouncedBounds({
          south: bounds.getSouth(),
          north: bounds.getNorth(),
          west: bounds.getWest(),
          east: bounds.getEast(),
        });
      }
    }
  }, [useViewportLoading]);

  // Keyboard controls for zoom
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow zoom with + and - keys
      if (e.key === '+' || e.key === '=' || e.key === 'Add') {
        e.preventDefault();
        mapRef.current?.easeTo({
          zoom: Math.min(viewportRef.current.zoom + 1, 20),
          duration: 300,
        });
      } else if (e.key === '-' || e.key === 'Subtract') {
        e.preventDefault();
        mapRef.current?.easeTo({
          zoom: Math.max(viewportRef.current.zoom - 1, 0),
          duration: 300,
        });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="business-map-container">
      <MapLibre
        ref={mapRef}
        initialViewState={initialViewState}
        onMove={(evt) => {
          setViewport(evt.viewState);
          viewportRef.current = evt.viewState;
        }}
        onClick={() => {
          setPopupInfo(null);
          onBusinessSelect?.(null as any);
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://tiles.openfreemap.org/styles/positron"
      >
        {clusters.map((cluster: any) => {
          const [longitude, latitude] = cluster.geometry.coordinates;
          const { cluster: isCluster, point_count: pointCount } = cluster.properties;

          if (isCluster) {
            return (
              <Marker
                key={`cluster-${cluster.id}`}
                longitude={longitude}
                latitude={latitude}
                anchor="center"
                onClick={() => {
                  const expansionZoom = Math.min(
                    supercluster.getClusterExpansionZoom(cluster.id as number),
                    20
                  );
                  mapRef.current?.flyTo({
                    center: [longitude, latitude],
                    zoom: expansionZoom,
                    duration: 250,
                  });
                }}
              >
                <div
                  className="cluster-marker"
                  style={{
                    width: `${30 + (pointCount / totalBusinesses) * 50}px`,
                    height: `${30 + (pointCount / totalBusinesses) * 50}px`,
                  }}
                >
                  {pointCount}
                </div>
              </Marker>
            );
          }

          const business = cluster.properties as Business;
          return (
            <Marker
              key={`business-${business.business_id}`}
              longitude={longitude}
              latitude={latitude}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                // Flag that this selection came from a map click (skip zoom animation)
                isMapClickRef.current = true;
                // Show popup IMMEDIATELY without waiting for parent state update
                setPopupInfo(business);
                // Update parent state asynchronously so popup appears instantly
                setTimeout(() => onBusinessSelect?.(business), 0);
              }}
            >
              <div className="marker">
                <div
                  className={`marker-pin ${business.is_open ? "open" : "closed"}`}
                  title={business.name}
                >
                  <span className="marker-star">{business.stars}</span>
                </div>
              </div>
            </Marker>
          );
        })}

        {popupInfo && (
          <Popup
            anchor="top"
            longitude={popupInfo.longitude}
            latitude={popupInfo.latitude}
            onClose={() => setPopupInfo(null)}
            closeOnClick={false}
          >
            <div className="business-popup">
              <h3>{popupInfo.name}</h3>
              <div className="popup-details">
                <p className="popup-location">
                  {popupInfo.city}, {popupInfo.state}
                </p>
                <p className="popup-rating">
                  Rating: <strong>{popupInfo.stars}</strong> ({popupInfo.review_count} reviews)
                </p>
                <p className="popup-status">
                  Status:{" "}
                  <span className={popupInfo.is_open ? "status-open" : "status-closed"}>
                    {popupInfo.is_open ? "Open" : "Closed"}
                  </span>
                </p>
                {popupInfo.categories && (
                  <p className="popup-categories">
                    {popupInfo.categories.split(",").slice(0, 3).join(", ")}
                  </p>
                )}
              </div>
            </div>
          </Popup>
        )}

        <div className="map-info">
          <p>
            {viewportLoading && useViewportLoading ? (
              <>Loading...</>
            ) : (
              <>{totalBusinesses} businesses {useViewportLoading && accumulatedBusinesses.size > 0 ? `(${accumulatedBusinesses.size} loaded)` : ''}</>
            )}
          </p>
        </div>

        <div className="map-controls">
          <button
            className="map-control-btn zoom-in-btn"
            onClick={handleZoomIn}
            title="Zoom In"
            aria-label="Zoom In"
          >
            <span className="control-icon">+</span>
          </button>
          <button
            className="map-control-btn zoom-out-btn"
            onClick={handleZoomOut}
            title="Zoom Out"
            aria-label="Zoom Out"
          >
            <span className="control-icon">−</span>
          </button>
          <button
            className="map-control-btn reset-orientation-btn"
            onClick={handleResetOrientation}
            title="Reset Orientation"
            aria-label="Reset Orientation"
          >
            <img src="/direction.png" alt="Reset Orientation" className="orientation-icon" />
          </button>
          {useViewportLoading && (
            <button
              className="map-control-btn refresh-btn"
              onClick={handleRefreshBusinesses}
              title="Refresh Businesses (Clear Cached)"
              aria-label="Refresh Businesses"
            >
              <span className="control-icon">⟳</span>
            </button>
          )}
          <div className="zoom-level-display">
            <span className="zoom-level-label">Zoom:</span>
            <span className="zoom-level-value">{viewport.zoom.toFixed(1)}</span>
          </div>
        </div>
      </MapLibre>
    </div>
  );
};

export default BusinessMap;