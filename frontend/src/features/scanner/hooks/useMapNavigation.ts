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
 * Auto-navigate to city boundary when city changes
 * Falls back to using business locations if boundaries aren't available
 */
export function useNavigateToCity(
  cityBoundary: GeoJSONFeatureCollection | null | undefined,
  mapRef: MapRef | null,
  setMapViewState: (state: MapViewState) => void,
  isProgrammaticMoveRef: React.MutableRefObject<boolean>,
  cityId?: string | null,
  businesses?: Array<{ longitude: number; latitude: number }>,
  isCityBoundaryLoading?: boolean
) {
  const previousCityRef = useRef<string | null>(null);
  const hasNavigatedForCityRef = useRef<string | null>(null);

  // Effect 1: Detect city changes and reset navigation state
  useEffect(() => {
    // Handle city being cleared
    if (!cityId) {
      previousCityRef.current = null;
      hasNavigatedForCityRef.current = null;
      return;
    }

    // Only process if cityId has actually changed
    if (cityId !== previousCityRef.current) {
      console.log('🗺️ City changed:', { from: previousCityRef.current, to: cityId });
      previousCityRef.current = cityId;
      hasNavigatedForCityRef.current = null; // Reset navigation flag for new city
    }
  }, [cityId]);

  // Effect 2: Navigate to city boundary when available
  useEffect(() => {
    if (!cityId) return;
    if (hasNavigatedForCityRef.current === cityId) return;
    if (!mapRef) {
      console.log('🗺️ Map ref not ready yet');
      return;
    }

    // Use city boundary if available
    if (cityBoundary) {
      try {
        const features = cityBoundary.features || [cityBoundary as any];
        let allCoords: any[] = [];

        features.forEach((feature: any) => {
          if (feature.geometry?.coordinates) {
            allCoords.push(feature.geometry.coordinates);
          }
        });

        if (allCoords.length > 0) {
          const bounds = calculateBounds(allCoords);
          if (bounds) {
            const centerLng = (bounds.minLng + bounds.maxLng) / 2;
            const centerLat = (bounds.minLat + bounds.maxLat) / 2;
            const zoom = calculateZoomLevel(bounds);

            console.log('🗺️ Navigating to city boundary:', cityId, { centerLng, centerLat, zoom });

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
            return;
          }
        }
      } catch (error) {
        console.warn('Failed to fit city boundary:', error);
      }
    }
    // Don't navigate here if no boundary - let the businesses fallback effect handle it
  }, [cityId, cityBoundary, mapRef, setMapViewState, isProgrammaticMoveRef, hasNavigatedForCityRef]);

  // Effect 3: Fallback - navigate to business locations when no city boundary is available
  // This effect fires whenever businesses change for the current city
  useEffect(() => {
    // Skip if no city selected or already navigated for this city
    if (!cityId) {
      console.log('🗺️ [Fallback] No cityId');
      return;
    }
    if (hasNavigatedForCityRef.current === cityId) {
      console.log('🗺️ [Fallback] Already navigated for city:', cityId);
      return;
    }

    // Skip if city boundary exists (Effect 2 handles it)
    if (cityBoundary) {
      console.log('🗺️ [Fallback] City boundary exists, skipping business fallback');
      return;
    }

    // Wait for city boundary query to complete before falling back to businesses
    // This prevents premature navigation while boundary is still loading
    if (isCityBoundaryLoading) {
      console.log('🗺️ [Fallback] Waiting for city boundary query to complete...');
      return;
    }

    console.log('🗺️ [Fallback] City boundary not available (404), using business locations');

    // Skip if map not ready
    if (!mapRef) {
      console.log('🗺️ [Fallback] Map ref not ready');
      return;
    }

    // If no businesses yet, wait for them to load
    if (!businesses || businesses.length === 0) {
      console.log('🗺️ [Fallback] Waiting for businesses to load for city:', cityId);
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

    console.log('🗺️ No city boundary available, fitting map to business locations:', {
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
  }, [businesses, cityId, cityBoundary, isCityBoundaryLoading, mapRef, setMapViewState, isProgrammaticMoveRef]);
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
