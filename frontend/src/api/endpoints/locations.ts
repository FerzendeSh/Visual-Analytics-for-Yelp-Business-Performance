/**
 * Locations API endpoints
 */

import { get } from '../apiClient';

export interface Location {
  city: string;
  state: string;
  business_count: number;
  avg_rating: number;
}

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
 * Get location summary
 */
export const getLocationSummary = (): Promise<Location[]> => {
  return get<Location[]>('/api/locations/summary');
};
