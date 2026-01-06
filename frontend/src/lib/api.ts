/**
 * API Client for Yelp Business Analytics Backend
 *
 * Centralized API client with typed methods for all backend endpoints.
 * Uses fetch API with proper error handling and type safety.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// ============================================================================
// Types
// ============================================================================

export interface BusinessDTO {
  business_id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
  stars: number;
  review_count: number;
  is_open: number;
  categories: string;
  attributes?: Record<string, any>;
  hours?: Record<string, string>;
}

// Alias for backwards compatibility
export type Business = BusinessDTO;

export interface ViewportParams {
  south: number;
  north: number;
  west: number;
  east: number;
  state?: string;
  city?: string;
  neighborhood?: string;
  category?: string;
  min_rating?: number;
  is_open?: number;
  status?: string;
  limit?: number;
}

export interface TimelineParams {
  period?: 'day' | 'week' | 'month' | 'year';
  start_date?: string;
  end_date?: string;
  category?: string;
}

export interface CompetitiveSnapshotParams {
  business_id?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  category?: string;
  period?: 'day' | 'week' | 'month' | 'year';
  start_date?: string;
  end_date?: string;
}

export interface KeywordInsightsParams {
  year?: number;
  max_years?: number;
  start_date?: string;
  end_date?: string;
}

export interface GeoJSONParams {
  state?: string;
  city?: string;
}

export interface BatchTimelineRequest {
  business_ids: string[];
  period?: 'day' | 'week' | 'month' | 'year';
  start_date?: string;
  end_date?: string;
  include_city_benchmark?: boolean;
  include_neighborhood_benchmark?: boolean;
  include_category_benchmark?: boolean;
  category?: string;
  // Optional location overrides for benchmarks
  city?: string;
  state?: string;
  neighborhood?: string;
}

export interface TimelineData {
  ratings: any;
  sentiment: any;
}

export interface BatchTimelineResponse {
  businesses: Record<string, TimelineData>;
  benchmarks: Record<string, TimelineData>;
  metadata: Record<string, any>;
}

export interface TimelineDataPoint {
  period_start: string;
  period_end?: string;
  avg_rating?: number;
  review_count?: number;
  avg_sentiment_score?: number;
  positive_count?: number;
  negative_count?: number;
  neutral_count?: number;
}

export interface CombinedTimelineResponse {
  business_ratings?: any;
  business_sentiment?: any;
  city_ratings?: any;
  city_sentiment?: any;
  neighborhood_ratings?: any;
  neighborhood_sentiment?: any;
  category_ratings?: any;
  category_sentiment?: any;
}

export interface CompetitiveSnapshot {
  businesses: any[];
  statistics: {
    avg_rating: number;
    median_review_count: number;
    total_businesses: number;
  };
}

// Backend response structure (matches keyword_service.py)
export interface KeywordCluster {
  cluster_id: number;
  size: number;
  keywords: Array<[string, number]>;
  avg_sentiment: number;
  avg_stars: number;
  sample_review: string;
  all_reviews?: string[];
}

export interface KeywordInsightsResponse {
  complaints: KeywordCluster[];
  praises: KeywordCluster[];
  total_reviews: number;
  negative_count: number;
  positive_count: number;
  period?: {
    start_date: string;
    end_date: string;
    year: number;
  };
  message?: string;
}

// Chart-friendly format (what the KeywordInsightsChart expects)
export interface KeywordInsights {
  complaints: Array<{
    keyword: string;
    count: number;
  }>;
  praises: Array<{
    keyword: string;
    count: number;
  }>;
}

export interface ForecastData {
  periods: Array<{
    period: string;
    value: number;
    lower: number;
    upper: number;
  }>;
}

// ============================================================================
// Cluster Types
// ============================================================================

export interface ClusterRunDTO {
  run_id: number;
  level: string;
  created_at: string;
  feature_variant: string;
  dimred_method?: string;
  total_entities_processed: number;
  total_clusters_created: number;
  avg_composite_score?: number;
  execution_time_seconds?: number;
}

export interface ClusterSummaryDTO {
  cluster_id: number;
  run_id: number;
  city: string;
  neighborhood?: string;
  cluster_label: number;
  method: string;
  size: number;
  avg_stars?: number;
  avg_review_count?: number;
  centroid_lat?: number;
  centroid_lon?: number;
  ai_label?: string;
  ai_description?: string;
  top_categories?: Array<{ category: string; count: number }>;
}

export interface ClusterDetailDTO extends ClusterSummaryDTO {
  ai_key_characteristics?: string[];
  attribute_patterns?: Record<string, any>;
  silhouette_score?: number;
  davies_bouldin_score?: number;
  calinski_harabasz_score?: number;
  composite_score?: number;
  method_params?: Record<string, any>;
  avg_price_range?: number;
}

export interface ClusterTimelinePointDTO {
  period_start: string;
  avg_rating: number;
  avg_sentiment_score: number;
  avg_sentiment_expected: number;
  review_count: number;
  business_count: number;
}

export interface ClusterTimelineDTO {
  cluster_id: number;
  cluster_label?: string;
  period: string;
  data: ClusterTimelinePointDTO[];
  statistics: Record<string, any>;
}

export interface ClusterCatalogResponse {
  runs: ClusterRunDTO[];
  latest_run?: ClusterRunDTO;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build URL with query parameters
 */
function buildUrl(endpoint: string, params?: Record<string, any>): string {
  const url = new URL(`${API_BASE_URL}${endpoint}`);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

/**
 * Fetch wrapper with error handling
 */
async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text().catch(() => response.statusText);
    throw new Error(`API Error (${response.status}): ${error}`);
  }

  return response.json();
}

/**
 * Fetch wrapper for optional GeoJSON boundaries (silently handles 404s)
 */
async function fetchBoundary<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Silently return null for 404s (boundary not available)
    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const error = await response.text().catch(() => response.statusText);
      throw new Error(`API Error (${response.status}): ${error}`);
    }

    return response.json();
  } catch (error) {
    // Only log non-404 errors
    if (!(error instanceof Error && error.message.includes('404'))) {
      console.warn('Boundary fetch error:', error);
    }
    return null;
  }
}

// ============================================================================
// API Client
// ============================================================================

export const api = {
  /**
   * Business Endpoints
   */
  businesses: {
    /**
     * List businesses with optional filtering
     */
    list: (params?: { state?: string; city?: string; skip?: number; limit?: number }) =>
      fetchJson<BusinessDTO[]>(buildUrl('/api/businesses', params)),

    /**
     * Get businesses within a viewport (bounding box)
     */
    viewport: (params: ViewportParams) =>
      fetchJson<BusinessDTO[]>(buildUrl('/api/businesses/viewport', params)),

    /**
     * Search businesses by name or keyword
     */
    search: (params: { q: string; limit?: number }) =>
      fetchJson<BusinessDTO[]>(buildUrl('/api/businesses/search', params)),

    /**
     * Get a single business by ID
     */
    getById: (businessId: string) =>
      fetchJson<BusinessDTO>(buildUrl(`/api/businesses/${businessId}`)),
  },

  /**
   * Location Endpoints
   */
  locations: {
    /**
     * Get list of all states
     */
    getStates: () =>
      fetchJson<string[]>(buildUrl('/api/states')),

    /**
     * Get cities for a state
     */
    getCities: (params: { state: string }) =>
      fetchJson<string[]>(buildUrl('/api/cities', params)),

    /**
     * Get neighborhoods for a city
     */
    getNeighborhoods: (params: { state: string; city: string }) =>
      fetchJson<string[]>(buildUrl('/api/neighborhoods', params)),

    /**
     * Get all unique categories
     */
    getCategories: () =>
      fetchJson<string[]>(buildUrl('/api/categories')),

    /**
     * Get neighborhood boundaries as GeoJSON (returns null if not available)
     */
    getNeighborhoodBoundaries: (params: GeoJSONParams) =>
      fetchBoundary<any>(buildUrl('/api/neighborhoods/boundaries', params)),

    /**
     * Get city boundary as GeoJSON (returns null if not available)
     */
    getCityBoundary: (params: GeoJSONParams) =>
      fetchBoundary<any>(buildUrl('/api/cities/boundaries', params)),
  },

  /**
   * Analytics Endpoints
   */
  analytics: {
    /**
     * Get combined timeline for a business (ratings + sentiment + comparisons)
     */
    getBusinessTimeline: (businessId: string, params?: TimelineParams) =>
      fetchJson<any>(
        buildUrl(`/api/analytics/business/${businessId}/combined-timeline`, params)
      ),

    /**
     * Get combined timeline for a city
     */
    getCityCombinedTimeline: (params: {
      state: string;
      city: string;
      period?: string;
      start_date?: string;
      end_date?: string;
      category?: string;
    }) =>
      fetchJson<any>(
        buildUrl(`/api/analytics/city/${params.state}/${params.city}/combined-timeline`, {
          period: params.period,
          start_date: params.start_date,
          end_date: params.end_date,
          category: params.category,
        })
      ),

    /**
     * Get combined timeline for a category
     */
    getCategoryCombinedTimeline: (params: {
      category: string;
      state?: string;
      city?: string;
      period?: string;
      start_date?: string;
      end_date?: string;
    }) =>
      fetchJson<any>(
        buildUrl(`/api/analytics/category/${encodeURIComponent(params.category)}/combined-timeline`, {
          state: params.state,
          city: params.city,
          period: params.period,
          start_date: params.start_date,
          end_date: params.end_date,
        })
      ),

    /**
     * Get combined timeline for a neighborhood
     */
    getNeighborhoodCombinedTimeline: (params: {
      state: string;
      city: string;
      neighborhood: string;
      period?: string;
      start_date?: string;
      end_date?: string;
      category?: string;
    }) =>
      fetchJson<any>(
        buildUrl(
          `/api/analytics/neighborhood/${params.state}/${params.city}/${encodeURIComponent(params.neighborhood)}/combined-timeline`,
          {
            period: params.period,
            start_date: params.start_date,
            end_date: params.end_date,
            category: params.category,
          }
        )
      ),

    /**
     * Get competitive snapshot (business vs competitors)
     */
    getCompetitiveSnapshot: (params: CompetitiveSnapshotParams) =>
      fetchJson<any>(buildUrl('/api/analytics/competitive-snapshot', params)),

    /**
     * Get business forecast
     */
    getBusinessForecast: (businessId: string, params?: { horizon?: number }) =>
      fetchJson<any>(
        buildUrl(`/api/analytics/business/${businessId}/forecast`, params)
      ),

    /**
     * Get keyword insights for a business (manual year selection)
     */
    getKeywordInsights: (businessId: string, params?: KeywordInsightsParams) =>
      fetchJson<any>(
        buildUrl(`/api/analytics/business/${businessId}/keyword-insights`, params)
      ),

    /**
     * Get keyword insights automatically (finds most recent year with data)
     */
    getKeywordInsightsAuto: (businessId: string, params?: { max_years?: number }) =>
      fetchJson<KeywordInsightsResponse>(
        buildUrl(`/api/analytics/business/${businessId}/keyword-insights-auto`, params)
      ),

    /**
     * Get period issues for a business
     */
    getPeriodIssues: (businessId: string) =>
      fetchJson<any>(buildUrl(`/api/analytics/business/${businessId}/period-issues`)),

    /**
     * Get batch timelines for multiple businesses + benchmarks in one request
     */
    getBatchTimelines: (params: BatchTimelineRequest) =>
      fetchJson<BatchTimelineResponse>(`${API_BASE_URL}/api/analytics/batch-timelines`, {
        method: 'POST',
        body: JSON.stringify(params),
      }),
  },

  /**
   * Cluster Endpoints
   */
  clusters: {
    /**
     * Get catalog of available cluster runs
     */
    getCatalog: () =>
      fetchJson<ClusterCatalogResponse>(buildUrl('/api/clusters/catalog')),

    /**
     * Get clusters in viewport for map visualization
     */
    getInViewport: (params: {
      south: number;
      north: number;
      west: number;
      east: number;
      run_id?: number;
      min_size?: number;
    }) =>
      fetchJson<ClusterSummaryDTO[]>(buildUrl('/api/clusters/viewport', params)),

    /**
     * List all clusters with optional filters
     */
    list: (params?: {
      run_id?: number;
      city?: string;
      min_size?: number;
      skip?: number;
      limit?: number;
    }) =>
      fetchJson<{ clusters: ClusterSummaryDTO[]; total: number; skip: number; limit: number }>(
        buildUrl('/api/clusters/', params)
      ),

    /**
     * Get detailed cluster information
     */
    getDetail: (clusterId: number) =>
      fetchJson<ClusterDetailDTO>(buildUrl(`/api/clusters/${clusterId}`)),

    /**
     * Get cluster timeline data
     */
    getTimeline: (clusterId: number, params?: { period?: 'month' | 'year'; start_date?: string; end_date?: string }) =>
      fetchJson<ClusterTimelineDTO>(
        buildUrl(`/api/clusters/${clusterId}/timeline`, params)
      ),

    /**
     * Get business IDs in a cluster
     */
    getBusinessIds: (clusterId: number, limit?: number) =>
      fetchJson<string[]>(
        buildUrl(`/api/clusters/${clusterId}/businesses`, limit ? { limit } : undefined)
      ),
  },
};

export default api;
