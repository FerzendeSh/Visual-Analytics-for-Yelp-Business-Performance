/**
 * Base API Client
 * Handles all HTTP communication with the backend using native fetch API
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Build query parameters string from object
 */
function buildQueryParams(params: Record<string, string | number | boolean | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

/**
 * Generic fetch wrapper for API calls
 */
async function apiRequest<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const { params, ...fetchOptions } = options;

  let url = `${API_BASE}${endpoint}`;

  if (params) {
    url += buildQueryParams(params);
  }

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
      ...fetchOptions,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        detail: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(error.detail || 'API request failed');
    }

    return await response.json() as T;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

/**
 * GET request
 */
export const get = <T,>(endpoint: string, options?: FetchOptions): Promise<T> => {
  return apiRequest<T>(endpoint, { ...options, method: 'GET' });
};

/**
 * POST request
 */
export const post = <T,>(endpoint: string, data?: unknown, options?: FetchOptions): Promise<T> => {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
  });
};

/**
 * PUT request
 */
export const put = <T,>(endpoint: string, data?: unknown, options?: FetchOptions): Promise<T> => {
  return apiRequest<T>(endpoint, {
    ...options,
    method: 'PUT',
    body: data ? JSON.stringify(data) : undefined,
  });
};

/**
 * DELETE request
 */
export const del = <T,>(endpoint: string, options?: FetchOptions): Promise<T> => {
  return apiRequest<T>(endpoint, { ...options, method: 'DELETE' });
};

export const apiClient = {
  get,
  post,
  put,
  delete: del,
};

export default apiClient;
