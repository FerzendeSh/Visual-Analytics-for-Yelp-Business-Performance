/**
 * Map navigation hook for auto-flying to city and neighborhood bounds.
 * Calculates optimal viewport from GeoJSON boundaries.
 */
import { useEffect, useRef } from 'react';
import type { MapRef } from 'react-map-gl/maplibre';

interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
  transitionDuration?: number;
}

interface GeoJSONFeature {
  properties?: Record<string, any>;
  geometry?: {
    coordinates: any;
  };
}

interface GeoJSONFeatureCollection {
  features?: GeoJSONFeature[];
}

/**
 * Calculate bounds from GeoJSON coordinates
 */
function calculateBounds(coords: any): { minLng: number; minLat: number; maxLng: number; maxLat: number } | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

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

  if (!isFinite(minLng) || !isFinite(minLat) || !isFinite(maxLng) || !isFinite(maxLat)) {
    return null;
  }

  return { minLng, minLat, maxLng, maxLat };
}

/**
 * Calculate appropriate zoom level based on bounds size
 */
function calculateZoomLevel(bounds: { minLng: number; minLat: number; maxLng: number; maxLat: number }): number {
  const lngDiff = bounds.maxLng - bounds.minLng;
  const latDiff = bounds.maxLat - bounds.minLat;
  const maxDiff = Math.max(lngDiff, latDiff);

  if (maxDiff < 0.05) return 13;
  if (maxDiff < 0.1) return 12;
  if (maxDiff < 0.2) return 11;
  if (maxDiff < 0.5) return 10;
  return 9;
}

/**
 * Auto-navigate to city when city changes
 * Uses business locations to calculate the view bounds
 */
export function useNavigateToCity(
  mapRef: MapRef | null,
  setMapViewState: (state: MapViewState) => void,
  isProgrammaticMoveRef: React.MutableRefObject<boolean>,
  cityId?: string | null,
  businesses?: Array<{ longitude: number; latitude: number }>,
  isBusinessesLoading?: boolean
) {
  const previousCityRef = useRef<string | null>(null);
  const hasNavigatedForCityRef = useRef<string | null>(null);
  const isInitialMount = useRef(true);

  // Effect 1: Detect city changes and handle "All cities" selection
  useEffect(() => {
    // On initial mount, if cityId is Tampa_FL (our default business city),
    // mark it as already navigated to preserve the initial business-focused view
    if (isInitialMount.current && cityId === 'Tampa_FL') {
      console.log('🗺️ Initial mount with default city (Tampa_FL) - preserving business-focused view');
      previousCityRef.current = cityId;
      hasNavigatedForCityRef.current = cityId;
      isInitialMount.current = false;
      return;
    }
    isInitialMount.current = false;

    // Handle "All cities" being selected (cityId is null or undefined)
    if (!cityId) {
      console.log('🗺️ "All cities" selected - zooming out to show super cluster');
      previousCityRef.current = null;
      hasNavigatedForCityRef.current = null;

      // Zoom out to show entire USA for "All cities" view
      if (mapRef) {
        isProgrammaticMoveRef.current = true;
        setMapViewState({
          longitude: -95.7129, // Center of USA
          latitude: 37.0902,
          zoom: 4, // Zoomed out to show super cluster of all cities
          pitch: 0,
          bearing: 0,
          transitionDuration: 1000, // 1 second smooth transition
        });
      }
      return;
    }

    // Only process if cityId has actually changed
    if (cityId !== previousCityRef.current) {
      console.log('🗺️ City changed:', { from: previousCityRef.current, to: cityId });
      previousCityRef.current = cityId;
      hasNavigatedForCityRef.current = null; // Reset navigation flag for new city
    }
  }, [cityId, mapRef, isProgrammaticMoveRef, setMapViewState]);

  // Effect 2: Navigate to business locations when businesses are loaded
  useEffect(() => {
    // Skip if no city selected or already navigated for this city
    if (!cityId) {
      return;
    }
    if (hasNavigatedForCityRef.current === cityId) {
      console.log('🗺️ Already navigated for city:', cityId);
      return;
    }

    // Skip if map not ready
    if (!mapRef) {
      console.log('🗺️ Map ref not ready');
      return;
    }

    // Wait for businesses to finish loading
    if (isBusinessesLoading) {
      console.log('🗺️ Waiting for businesses to finish loading for city:', cityId);
      return;
    }

    // If no businesses yet, wait for them to load
    if (!businesses || businesses.length === 0) {
      console.log('🗺️ Waiting for businesses to load for city:', cityId);
      return;
    }

    // Filter out invalid coordinates
    const validBusinesses = businesses.filter(
      b => b.longitude && b.latitude && !isNaN(b.longitude) && !isNaN(b.latitude)
    );

    if (validBusinesses.length === 0) {
      console.log('🗺️ No valid businesses found for city:', cityId);
      return;
    }

    // Calculate bounds from business locations
    const lngs = validBusinesses.map(b => b.longitude);
    const lats = validBusinesses.map(b => b.latitude);

    const bounds = {
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
    };

    const centerLng = (bounds.minLng + bounds.maxLng) / 2;
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;
    const zoom = calculateZoomLevel(bounds);

    console.log('🗺️ Navigating to business locations:', {
      cityId,
      centerLng,
      centerLat,
      zoom,
      businessCount: validBusinesses.length,
    });

    isProgrammaticMoveRef.current = true;
    hasNavigatedForCityRef.current = cityId;
    setMapViewState({
      longitude: centerLng,
      latitude: centerLat,
      zoom,
      pitch: 0,
      bearing: 0,
      transitionDuration: 1000,
    });
  }, [businesses, cityId, mapRef, setMapViewState, isProgrammaticMoveRef, isBusinessesLoading]);
}

/**
 * Auto-navigate to selected neighborhood
 */
export function useNavigateToNeighborhood(
  neighborhoodId: string | null,
  neighborhoods: GeoJSONFeatureCollection | null,
  mapRef: MapRef | null,
  setMapViewState: (state: MapViewState) => void,
  isProgrammaticMoveRef: React.MutableRefObject<boolean>
) {
  useEffect(() => {
    if (!neighborhoodId || !neighborhoods || !mapRef) return;

    try {
      // Find the selected neighborhood feature
      const selectedFeature = neighborhoods.features?.find(
        (f: any) => f.properties?.neighborhood === neighborhoodId
      );

      if (!selectedFeature || !selectedFeature.geometry?.coordinates) return;

      // Calculate bounds from neighborhood GeoJSON
      const bounds = calculateBounds(selectedFeature.geometry.coordinates);
      if (!bounds) return;

      const centerLng = (bounds.minLng + bounds.maxLng) / 2;
      const centerLat = (bounds.minLat + bounds.maxLat) / 2;

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
    } catch (error) {
      console.warn('Failed to fit neighborhood boundary:', error);
    }
  }, [neighborhoodId, neighborhoods, mapRef, setMapViewState, isProgrammaticMoveRef]);
}
