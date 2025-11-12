/**
 * Business API endpoints
 */

import { get } from '../apiClient';
import { Business } from '../types';

/**
 * Get all businesses with optional filtering
 */
export const getBusinesses = (options?: {
  state?: string;
  city?: string;
  skip?: number;
  limit?: number;
}): Promise<Business[]> => {
  return get<Business[]>('/api/businesses/', {
    params: {
      state: options?.state,
      city: options?.city,
      skip: options?.skip || 0,
      limit: options?.limit || 100,
    },
  });
};

/**
 * Get businesses within map viewport bounds
 */
export const getBusinessesInViewport = (bounds: {
  south: number;
  north: number;
  west: number;
  east: number;
  limit?: number;
}): Promise<Business[]> => {
  return get<Business[]>('/api/businesses/viewport', {
    params: {
      south: bounds.south,
      north: bounds.north,
      west: bounds.west,
      east: bounds.east,
      limit: bounds.limit || 1000,
    },
  });
};

/**
 * Get a single business by ID
 */
export const getBusinessById = (businessId: string): Promise<Business> => {
  return get<Business>(`/api/businesses/${businessId}`);
};
