import { useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import bbox from '@turf/bbox';

/**
 * Custom hook that automatically zooms the map to a city when the city filter changes
 */
export function useCityMapZoom() {
  const filters = useAppStore((state) => state.filters);
  const setMapViewState = useAppStore((state) => state.setMapViewState);

  // Extract city and state from cityId (format: "City_STATE")
  const city = filters.cityId?.split('_')[0];
  const state = filters.cityId?.split('_')[1];

  // Fetch city boundaries when city changes
  const { data: cityBoundary } = useQuery({
    queryKey: ['cityBoundary', city, state],
    queryFn: async () => {
      if (!city || !state) return null;
      try {
        return await api.locations.getCityBoundary({ city, state });
      } catch (error) {
        console.warn(`Failed to fetch boundary for ${city}, ${state}:`, error);
        return null;
      }
    },
    enabled: !!city && !!state,
    staleTime: 30 * 60 * 1000, // 30 minutes - boundaries don't change
    retry: 1,
  });

  // Update map view when city boundary is loaded
  useEffect(() => {
    if (!cityBoundary || !cityBoundary.features || cityBoundary.features.length === 0) {
      return;
    }

    try {
      // Calculate bounding box of the city
      const boundingBox = bbox(cityBoundary as any);

      // Calculate center point
      const centerLongitude = (boundingBox[0] + boundingBox[2]) / 2;
      const centerLatitude = (boundingBox[1] + boundingBox[3]) / 2;

      // Calculate appropriate zoom level based on bbox size
      const latDiff = boundingBox[3] - boundingBox[1];
      const lonDiff = boundingBox[2] - boundingBox[0];
      const maxDiff = Math.max(latDiff, lonDiff);

      // Estimate zoom level (approximate formula for Mapbox)
      let zoom = 11;
      if (maxDiff < 0.05) zoom = 13;
      else if (maxDiff < 0.1) zoom = 12;
      else if (maxDiff < 0.2) zoom = 11;
      else if (maxDiff < 0.5) zoom = 10;
      else zoom = 9;

      // Update map view state with smooth transition
      setMapViewState({
        longitude: centerLongitude,
        latitude: centerLatitude,
        zoom,
        pitch: 0,
        bearing: 0,
        transitionDuration: 1000, // 1 second smooth transition
      });
    } catch (error) {
      console.error('Error calculating city bounds:', error);
    }
  }, [cityBoundary, setMapViewState]);
}
