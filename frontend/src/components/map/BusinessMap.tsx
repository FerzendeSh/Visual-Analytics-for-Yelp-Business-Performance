import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Map as MapLibre, Marker, Popup, MapRef, Source, Layer } from 'react-map-gl/maplibre';
import Supercluster from 'supercluster';
import 'maplibre-gl/dist/maplibre-gl.css';
import './BusinessMap.css';
import { useViewportBusinesses } from '../../hooks/useViewportBusinesses';
import { getNeighborhoodBoundaries, getCityBoundary } from '../../api/endpoints/locations';
import { STATUS_COLORS, BLUE_SCALE } from '../../theme/cloudscapeColors';
import { 
  MAX_ACCUMULATED_BUSINESSES, 
  ZOOM_THRESHOLDS, 
  BUSINESS_LIMITS,
  VIEWPORT_DEBOUNCE_MS 
} from '../../utils';

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
  targetLocation?: { // NEW: Programmatically fly to this location
    longitude: number;
    latitude: number;
    zoom?: number;
  } | null;
  onBusinessSelect?: (business: Business) => void;
  onMapCityChange?: (city: string, state: string) => void; // NEW: Called when map viewport changes to a different city
  onAddComparison?: (business: Business) => void;
  onRemoveComparison?: (businessId: string) => void;
  myBusinessId?: string;
  comparisonBusinessIds?: string[];
  maxComparisons?: number;
  selectedCity?: string;
  selectedNeighborhood?: string;
  selectedCategory?: string;
  minRating?: number;
  maxRating?: number;
  selectedStatus?: number | null;
  selectedBusiness?: Business | null;
}

// Fallback default location - will be replaced by myBusiness location if available
const FALLBACK_CENTER = {
  longitude: -86.1312087,
  latitude: 39.7716811,
  zoom: 12,
};

type PointFeature = GeoJSON.Feature<GeoJSON.Point, Business>;

const BusinessMap: React.FC<BusinessMapProps> = ({
  businesses: propBusinesses,
  useViewportLoading = true, // Default to viewport loading
  initialViewState, // Will be computed from myBusiness if not provided
  targetLocation = null,
  onBusinessSelect,
  onMapCityChange,
  onAddComparison,
  onRemoveComparison,
  myBusinessId,
  comparisonBusinessIds = [],
  maxComparisons = 5,
  selectedCity = "",
  selectedNeighborhood = "",
  selectedCategory = "",
  minRating = 1,
  maxRating = 5,
  selectedStatus = null,
  selectedBusiness = null,
}) => {
  // Compute initial view state from myBusiness if not explicitly provided
  const computedInitialViewState = useMemo(() => {
    if (initialViewState) {
      return initialViewState;
    }

    // Try to get location from myBusinessId in the businesses list
    if (myBusinessId && propBusinesses && propBusinesses.length > 0) {
      const myBiz = propBusinesses.find(b => b.business_id === myBusinessId);
      if (myBiz && myBiz.latitude && myBiz.longitude) {
        return {
          longitude: myBiz.longitude,
          latitude: myBiz.latitude,
          zoom: 12,
        };
      }
    }

    return FALLBACK_CENTER;
  }, [initialViewState, myBusinessId, propBusinesses]);

  const mapRef = useRef<MapRef>(null);
  const [popupInfo, setPopupInfo] = useState<Business | null>(null);
  const [viewport, setViewport] = useState({ ...computedInitialViewState });
  const previousCityRef = useRef<string>("");
  const viewportRef = useRef({ ...computedInitialViewState });
  const isMapClickRef = useRef(false);
  const isProgrammaticMoveRef = useRef(false);

  const [accumulatedBusinesses, setAccumulatedBusinesses] = useState<Map<string, Business>>(new Map());
  const loadedBoundsRef = useRef<Set<string>>(new Set());
  const [neighborhoodBoundaries, setNeighborhoodBoundaries] = useState<GeoJSON.FeatureCollection | null>(null);
  const [cityBoundary, setCityBoundary] = useState<GeoJSON.FeatureCollection | null>(null);

  const [debouncedBounds, setDebouncedBounds] = useState<{
    south: number;
    north: number;
    west: number;
    east: number;
  } | null>(null);

  const dynamicLimit = useMemo(() => {
    const zoom = viewport.zoom;
    if (zoom < ZOOM_THRESHOLDS.FULLY_ZOOMED_OUT) return BUSINESS_LIMITS.FULLY_ZOOMED_OUT;
    if (zoom < ZOOM_THRESHOLDS.STATE_LEVEL) return BUSINESS_LIMITS.STATE_LEVEL;
    if (zoom < ZOOM_THRESHOLDS.CITY_LEVEL) return BUSINESS_LIMITS.CITY_LEVEL;
    return BUSINESS_LIMITS.NEIGHBORHOOD_LEVEL;
  }, [viewport.zoom]);

  // Parse city and state from selectedCity format "City|State"
  const parsedCity = useMemo(() => {
    if (!selectedCity) return undefined;
    const [city] = selectedCity.split('|');
    return city || undefined;
  }, [selectedCity]);

  const parsedState = useMemo(() => {
    if (!selectedCity) return undefined;
    const [, state] = selectedCity.split('|');
    return state || undefined;
  }, [selectedCity]);

  const { data: viewportBusinesses, isLoading: viewportLoading } = useViewportBusinesses({
    bounds: debouncedBounds || {
      south: computedInitialViewState.latitude - 0.2,
      north: computedInitialViewState.latitude + 0.2,
      west: computedInitialViewState.longitude - 0.2,
      east: computedInitialViewState.longitude + 0.2,
    },
    filters: {
      state: parsedState || undefined,
      city: parsedCity || undefined,
      neighborhood: selectedNeighborhood || undefined,
      category: selectedCategory || undefined,
      min_rating: minRating || undefined,
      max_rating: maxRating || undefined,
      is_open: selectedStatus !== null ? selectedStatus : undefined,
    },
    limit: dynamicLimit,
    enabled: useViewportLoading && !!debouncedBounds,
  });

  useEffect(() => {
    if (!useViewportLoading || !viewportBusinesses || viewportBusinesses.length === 0) return;

    setAccumulatedBusinesses(prev => {
      const updated = new Map(prev);
      viewportBusinesses.forEach(business => {
        updated.set(business.business_id, business);
      });
      
      // Implement size limit to prevent memory leak
      // If we exceed the limit, remove oldest entries (first inserted)
      if (updated.size > MAX_ACCUMULATED_BUSINESSES) {
        const keysToDelete = Array.from(updated.keys()).slice(0, updated.size - MAX_ACCUMULATED_BUSINESSES);
        keysToDelete.forEach(key => updated.delete(key));
      }
      
      return updated;
    });
  }, [viewportBusinesses, useViewportLoading]);

  useEffect(() => {
    if (useViewportLoading) {
      setAccumulatedBusinesses(new Map());
      loadedBoundsRef.current.clear();

      // When neighborhood changes, wait for the map to zoom before fetching
      // Otherwise immediately trigger a refetch with current bounds
      if (!selectedNeighborhood) {
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
      // If neighborhood is selected, the zoom effect will trigger the bounds update
    }
  }, [selectedCity, selectedNeighborhood, selectedCategory, minRating, maxRating, selectedStatus, useViewportLoading]);

  const businesses = useViewportLoading
    ? Array.from(accumulatedBusinesses.values())
    : (propBusinesses || []);

  const filteredBusinesses = useMemo(() => {
    if (useViewportLoading) {
      return businesses;
    }
    return businesses.filter((b) => {
      const cityMatch = selectedCity ? b.city === selectedCity : true;
      const categoryMatch = selectedCategory
        ? b.categories?.toLowerCase().includes(selectedCategory.toLowerCase())
        : true;
      const ratingMatch = b.stars >= minRating && b.stars <= maxRating;
      const statusMatch = selectedStatus !== null ? b.is_open === selectedStatus : true;

      return cityMatch && categoryMatch && ratingMatch && statusMatch;
    });
  }, [businesses, selectedCity, selectedCategory, minRating, maxRating, selectedStatus, useViewportLoading]);

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

    const cluster = new Supercluster<Business>({ radius: 75, maxZoom: 14 });
    cluster.load(points);
    return cluster;
  }, [filteredBusinesses]);

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
    }, VIEWPORT_DEBOUNCE_MS);

    return () => clearTimeout(debounceTimer);
  }, [viewport, useViewportLoading]);

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
    if (targetLocation) {
      isProgrammaticMoveRef.current = true;
      mapRef.current?.flyTo({
        center: [targetLocation.longitude, targetLocation.latitude],
        zoom: targetLocation.zoom || 11,
        duration: 700,
      });
    }
  }, [targetLocation]);

  useEffect(() => {
    const previousCity = previousCityRef.current;

    if (previousCity === selectedCity) return;
    if (selectedCity !== "" && !targetLocation) {
      const cityBusinesses = businesses.filter(b => b.city === selectedCity);
      if (cityBusinesses.length > 0) {

        const lats = cityBusinesses.map(b => b.latitude).filter(lat => !isNaN(lat));
        const lngs = cityBusinesses.map(b => b.longitude).filter(lng => !isNaN(lng));

        if (lats.length > 0 && lngs.length > 0) {
          const avgLat = lats.reduce((a, b) => a + b) / lats.length;
          const avgLng = lngs.reduce((a, b) => a + b) / lngs.length;

          isProgrammaticMoveRef.current = true;
          mapRef.current?.flyTo({
            center: [avgLng, avgLat],
            zoom: 11,
            duration: 700,
          });
        }
      }
    } else if (selectedCity === "" && previousCity !== "") {
      isProgrammaticMoveRef.current = true;
      mapRef.current?.flyTo({
        center: [computedInitialViewState.longitude, computedInitialViewState.latitude],
        zoom: computedInitialViewState.zoom,
        duration: 700,
      });
    }
    previousCityRef.current = selectedCity;
  }, [selectedCity, businesses, computedInitialViewState, targetLocation]);

  // Fetch neighborhood and city boundaries when city changes
  useEffect(() => {
    if (selectedCity) {
      const [city, state] = selectedCity.split('|');

      if (city && state) {
        // Fetch city boundary
        getCityBoundary(city, state)
          .then((data) => {
            setCityBoundary(data);
          })
          .catch(() => {
            setCityBoundary(null);
          });

        // Fetch neighborhood boundaries
        getNeighborhoodBoundaries(city, state)
          .then((data) => {
            setNeighborhoodBoundaries(data);
          })
          .catch(() => {
            setNeighborhoodBoundaries(null);
          });
      } else {
        setNeighborhoodBoundaries(null);
        setCityBoundary(null);
      }
    } else {
      setNeighborhoodBoundaries(null);
      setCityBoundary(null);
    }
  }, [selectedCity]);

  // Focus on neighborhood boundary when neighborhood is selected
  useEffect(() => {
    if (selectedNeighborhood && neighborhoodBoundaries && neighborhoodBoundaries.features) {
      // The neighborhood name should already be in the correct format from the dropdown
      // Find the feature for the selected neighborhood
      const selectedFeature = neighborhoodBoundaries.features.find(
        (feature: any) => feature.properties?.Name === selectedNeighborhood
      );

      if (selectedFeature && selectedFeature.geometry && (selectedFeature.geometry as any).coordinates) {
        // Calculate bounds from the neighborhood feature
        let minLng = Infinity, maxLng = -Infinity;
        let minLat = Infinity, maxLat = -Infinity;

        const geometry = selectedFeature.geometry as any;
        const processCoordinates = (coords: any[]) => {
          coords.forEach((coord: any) => {
            if (Array.isArray(coord) && typeof coord[0] === 'number' && typeof coord[1] === 'number') {
              // This is a coordinate pair [lng, lat]
              minLng = Math.min(minLng, coord[0]);
              maxLng = Math.max(maxLng, coord[0]);
              minLat = Math.min(minLat, coord[1]);
              maxLat = Math.max(maxLat, coord[1]);
            } else if (Array.isArray(coord)) {
              // This is a nested array, recurse
              processCoordinates(coord);
            }
          });
        };

        processCoordinates(geometry.coordinates);

        if (minLng !== Infinity && maxLng !== -Infinity && minLat !== Infinity && maxLat !== -Infinity) {
          isProgrammaticMoveRef.current = true;

          // Fit to neighborhood bounds
          mapRef.current?.fitBounds(
            [
              [minLng, minLat],
              [maxLng, maxLat]
            ],
            {
              padding: 60,
              duration: 700,
            }
          );

          // After zoom animation, trigger bounds update to fetch neighborhood businesses
          setTimeout(() => {
            const bounds = mapRef.current?.getBounds();
            if (bounds) {
              setDebouncedBounds({
                south: bounds.getSouth(),
                north: bounds.getNorth(),
                west: bounds.getWest(),
                east: bounds.getEast(),
              });
            }
          }, 750); // Wait for zoom animation to complete
        }
      }
    }
  }, [selectedNeighborhood, neighborhoodBoundaries]);

useEffect(() => {
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

  // Don't automatically show popup - only show when user clicks marker
  // setPopupInfo(selectedBusiness);

  const map = mapRef.current;
  if (!map) return;

  if (isMapClickRef.current) {
    isMapClickRef.current = false;
    return;
  }

  const currentZoom = map.getZoom();

  if (currentZoom > 11) {
    isProgrammaticMoveRef.current = true;
    map.easeTo({
      center: [selectedBusiness.longitude, selectedBusiness.latitude],
      zoom: 16,
      duration: 300,
    });
  } else {
    isProgrammaticMoveRef.current = true;
    map.easeTo({
      zoom: 7,
      duration: 150,
    });

    setTimeout(() => {
      isProgrammaticMoveRef.current = true;
      map.easeTo({
        center: [selectedBusiness.longitude, selectedBusiness.latitude],
        zoom: 17,
        duration: 300,
      });
    }, 160);
  }
}, [selectedBusiness]);

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

  // Note: Available for future use to refresh map businesses via a UI button
  // Commented out to avoid unused variable TS error until a refresh button is added
  /*
  const handleRefreshBusinesses = useCallback(() => {
    if (useViewportLoading) {
      setAccumulatedBusinesses(new Map());
      loadedBoundsRef.current.clear();
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
  */

  const handleGoToMyBusiness = useCallback(() => {
    const myBiz = filteredBusinesses.find(b => b.business_id === myBusinessId);
    if (myBiz && myBiz.latitude && myBiz.longitude) {
      isProgrammaticMoveRef.current = true;
      mapRef.current?.flyTo({
        center: [myBiz.longitude, myBiz.latitude],
        zoom: 16,
        duration: 700,
      });
      // Open popup for my business
      setPopupInfo(myBiz);
      onBusinessSelect?.(myBiz);
    }
  }, [filteredBusinesses, myBusinessId, onBusinessSelect]);

  // Automatically fly to my business on initial load
  const hasFlownToBusinessRef = useRef(false);
  useEffect(() => {
    // Only fly to business once on initial load
    if (hasFlownToBusinessRef.current || !myBusinessId) return;

    // Wait for businesses to load
    const myBiz = filteredBusinesses.find(b => b.business_id === myBusinessId);
    if (myBiz && myBiz.latitude && myBiz.longitude) {
      hasFlownToBusinessRef.current = true;
      isProgrammaticMoveRef.current = true;

      // Use flyTo with shorter duration for initial load
      mapRef.current?.flyTo({
        center: [myBiz.longitude, myBiz.latitude],
        zoom: 12,
        duration: 0, // No animation on initial load for instant appearance
      });

      // Don't automatically open popup - only show when user clicks marker
      // setPopupInfo(myBiz);
      onBusinessSelect?.(myBiz);
    }
  }, [filteredBusinesses, myBusinessId, onBusinessSelect]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

  const handleMoveEnd = useCallback(() => {
    if (isProgrammaticMoveRef.current) {
      isProgrammaticMoveRef.current = false;
    }
  }, []);

  const handleSetFilterToView = useCallback(() => {
    if (!onMapCityChange || !mapRef.current) return;

    const bounds = mapRef.current.getBounds();
    if (!bounds) return;

    const businessesInView = businesses.filter((business) => {
      const lat = business.latitude;
      const lng = business.longitude;
      return (
        lat >= bounds.getSouth() &&
        lat <= bounds.getNorth() &&
        lng >= bounds.getWest() &&
        lng <= bounds.getEast()
      );
    });

    if (businessesInView.length === 0) return;

    const cityCounts = new Map<string, { count: number; state: string }>();
    businessesInView.forEach((business) => {
      const city = business.city;
      const existing = cityCounts.get(city);
      if (existing) {
        existing.count++;
      } else {
        cityCounts.set(city, { count: 1, state: business.state });
      }
    });

    let dominantCity = '';
    let dominantState = '';
    let maxCount = 0;

    cityCounts.forEach((data, city) => {
      if (data.count > maxCount) {
        maxCount = data.count;
        dominantCity = city;
        dominantState = data.state;
      }
    });

    if (dominantCity && dominantCity !== selectedCity) {
      onMapCityChange(dominantCity, dominantState);
    }
  }, [onMapCityChange, businesses, selectedCity]);

  return (
    <div className="business-map-container">
      <MapLibre
        ref={mapRef}
        initialViewState={computedInitialViewState}
        onMove={(evt) => {
          setViewport(evt.viewState);
          viewportRef.current = evt.viewState;
        }}
        onMoveEnd={handleMoveEnd}
        onClick={() => {
          setPopupInfo(null);
          onBusinessSelect?.(null as any);
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="https://tiles.openfreemap.org/styles/positron"
      >
        {cityBoundary && cityBoundary.features && cityBoundary.features.length > 0 && !selectedNeighborhood && (
          <Source id="city-boundary" type="geojson" data={cityBoundary}>
            <Layer
              id="city-fill"
              type="fill"
              source="city-boundary"
              paint={{
                'fill-color': STATUS_COLORS.high,
                'fill-opacity': 0.15,
              }}
            />
            <Layer
              id="city-outline"
              type="line"
              source="city-boundary"
              paint={{
                'line-color': STATUS_COLORS.high,
                'line-width': 3,
                'line-opacity': 0.9,
              }}
              layout={{
                'line-join': 'round',
                'line-cap': 'round',
              }}
            />
          </Source>
        )}

        {neighborhoodBoundaries && selectedNeighborhood && (() => {
          return (
            <Source id="neighborhood-boundaries" type="geojson" data={neighborhoodBoundaries}>
              <Layer
                id="neighborhood-fill"
                type="fill"
                source="neighborhood-boundaries"
                paint={{
                  'fill-color': BLUE_SCALE.blue500,
                  'fill-opacity': 0.2,
                }}
                filter={['==', ['get', 'Name'], selectedNeighborhood]}
              />
              <Layer
                id="neighborhood-outline"
                type="line"
                source="neighborhood-boundaries"
                paint={{
                  'line-color': BLUE_SCALE.blue900,
                  'line-width': 4,
                  'line-opacity': 1,
                }}
                filter={['==', ['get', 'Name'], selectedNeighborhood]}
              />
            </Source>
          );
        })()}

        {neighborhoodBoundaries && !selectedNeighborhood && (
          <Source id="neighborhood-boundaries-all" type="geojson" data={neighborhoodBoundaries}>
            <Layer
              id="neighborhood-fill-all"
              type="fill"
              source="neighborhood-boundaries-all"
              paint={{
                'fill-color': BLUE_SCALE.blue500,
                'fill-opacity': 0.08,
              }}
            />
            <Layer
              id="neighborhood-outline-all"
              type="line"
              source="neighborhood-boundaries-all"
              paint={{
                'line-color': '#94a3b8',
                'line-width': 1,
                'line-opacity': 0.4,
              }}
            />
          </Source>
        )}
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
          const isMyBusiness = business.business_id === myBusinessId;

          return (
            <Marker
              key={`business-${business.business_id}`}
              longitude={longitude}
              latitude={latitude}
              anchor="bottom"
              onClick={(e) => {
                e.originalEvent.stopPropagation();
                isMapClickRef.current = true;
                setPopupInfo(business);
                setTimeout(() => onBusinessSelect?.(business), 0);
              }}
            >
              {isMyBusiness ? (
                <div className="marker marker-my-business">
                  <img
                    src="/MyBusiness.png"
                    alt={business.name}
                    className="my-business-marker-icon"
                    title={business.name}
                  />
                </div>
              ) : (
                <div className="marker">
                  <div
                    className={`marker-pin ${business.is_open ? "open" : "closed"}`}
                    title={business.name}
                    style={{
                      borderWidth: comparisonBusinessIds.includes(business.business_id) ? '3px' : '0px',
                      borderColor: 'rgba(255, 255, 255, 0.8)',
                      boxSizing: 'border-box'
                    }}
                  >
                    <span className="marker-star">{business.stars}</span>
                  </div>
                </div>
              )}
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
                    <strong>Categories:</strong> {popupInfo.categories.split(",").map(c => c.trim()).join(", ")}
                  </p>
                )}
              </div>
              {popupInfo.business_id !== myBusinessId && (
                <div className="popup-actions">
                  {comparisonBusinessIds.includes(popupInfo.business_id) ? (
                    <button
                      className="popup-btn popup-btn-remove"
                      onClick={() => {
                        onRemoveComparison?.(popupInfo.business_id);
                      }}
                    >
                      ✓ In Comparison
                    </button>
                  ) : comparisonBusinessIds.length >= maxComparisons ? (
                    <button
                      className="popup-btn popup-btn-disabled"
                      disabled
                      title="Maximum 5 businesses allowed"
                    >
                      Max 5 Reached
                    </button>
                  ) : (
                    <button
                      className="popup-btn popup-btn-add"
                      onClick={() => {
                        onAddComparison?.(popupInfo);
                      }}
                    >
                      + Add to Comparison
                    </button>
                  )}
                </div>
              )}
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
          {onMapCityChange && (
            <button
              className="map-control-btn set-filter-btn"
              onClick={handleSetFilterToView}
              title="Set Filter to Current View"
              aria-label="Set Filter to Current View"
            >
              <span className="control-icon">📍</span>
            </button>
          )}
          {myBusinessId && (
            <button
              className="map-control-btn my-business-btn"
              onClick={handleGoToMyBusiness}
              title="Go to My Business"
              aria-label="Go to My Business"
            >
              <img src="/MyBusiness.png" alt="My Business" className="my-business-icon" />
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