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
  businesses?: Array<{ longitude: number; latitude: number }>
) {
  const previousCityRef = useRef<string | null>(null);
  const boundaryLoadingRef = useRef<boolean>(false);

  useEffect(() => {
    // Handle city being cleared
    if (!cityId) {
      previousCityRef.current = null;
      return;
    }

    // Only navigate if cityId has actually changed
    if (cityId !== previousCityRef.current) {
      console.log('🗺️ City changed:', { from: previousCityRef.current, to: cityId });
      previousCityRef.current = cityId;

      if (!mapRef) {
        console.log('🗺️ Map ref not ready yet');
        return;
      }

      // Strategy 1: Use city boundary if available
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
              setMapViewState({
                longitude: centerLng,
                latitude: centerLat,
                zoom,
                pitch: 0,
                bearing: 0,
                transitionDuration: 1000,
              });
              boundaryLoadingRef.current = false;
              return;
            }
          }
        } catch (error) {
          console.warn('Failed to fit city boundary:', error);
        }
      }

      // Strategy 2: Fallback - zoom to default city level, let businesses load after
      console.log('🗺️ No city boundary available, zooming to default city level (businesses will load)');
      isProgrammaticMoveRef.current = true;
      setMapViewState({
        longitude: mapRef.getCenter().lng,
        latitude: mapRef.getCenter().lat,
        zoom: 11, // Default city-level zoom - shows typical city area
        pitch: 0,
        bearing: 0,
        transitionDuration: 1000,
      });
    }
  }, [cityId, cityBoundary, mapRef, setMapViewState, isProgrammaticMoveRef]);

  // Separate effect: Once businesses load for new city without boundary, fit to them
  useEffect(() => {
    if (!cityId || !businesses || businesses.length === 0) return;
    if (cityBoundary) return; // Only use this fallback if no boundary exists
    if (previousCityRef.current !== cityId) return; // Only for current city

    // Check if we need to fit to businesses (haven't done so yet)
    const lngs = businesses.map(b => b.longitude);
    const lats = businesses.map(b => b.latitude);

    const bounds = {
      minLng: Math.min(...lngs),
      maxLng: Math.max(...lngs),
      minLat: Math.min(...lats),
      maxLat: Math.max(...lats),
    };

    const centerLng = (bounds.minLng + bounds.maxLng) / 2;
    const centerLat = (bounds.minLat + bounds.maxLat) / 2;

    // Only navigate if we're not already centered on these businesses
    if (!mapRef) return;
    const currentCenter = mapRef.getCenter();
    const distance = Math.sqrt(
      Math.pow(currentCenter.lng - centerLng, 2) +
      Math.pow(currentCenter.lat - centerLat, 2)
    );

    // If we're far from the business center (>0.1 degrees ~11km), navigate there
    if (distance > 0.1) {
      const zoom = calculateZoomLevel(bounds);
      console.log('🗺️ Fitting map to business locations:', {
        centerLng,
        centerLat,
        zoom,
        businessCount: businesses.length,
        distance
      });

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
  }, [businesses, cityId, cityBoundary, mapRef, setMapViewState, isProgrammaticMoveRef]);
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
