/**
 * Locations API endpoints
 */

import { get } from '../apiClient';

/**
 * Get all available states
 */
export const getStates = (): Promise<string[]> => {
  return get<string[]>('/api/locations/states');
};

/**
 * Get all cities in a specific state
 */
export const getCitiesByState = (state: string): Promise<string[]> => {
  return get<string[]>('/api/locations/cities', {
    params: { state },
  });
};

/**
 * Get neighborhood boundaries as GeoJSON
 */
export const getNeighborhoodBoundaries = (city: string, state: string): Promise<GeoJSON.FeatureCollection> => {
  return get<GeoJSON.FeatureCollection>('/api/neighborhoods/boundaries', {
    params: { city, state },
  });
};
