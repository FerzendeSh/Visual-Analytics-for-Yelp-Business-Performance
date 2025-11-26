/**
 * Analytics API endpoints
 */

import { get } from '../apiClient';

export interface AnalyticsData {
  [key: string]: unknown;
}

export interface TimeSeriesDataPoint {
  period_start: string;
  avg_rating?: number;
  avg_sentiment_score?: number;
  avg_sentiment_expected?: number;
  review_count?: number;
}

export interface RatingsTimeline {
  business_id?: string;
  business_name?: string;
  city?: string;
  state?: string;
  period: string;
  metric: string;
  data: TimeSeriesDataPoint[];
}

export interface SentimentTimeline {
  business_id: string;
  business_name: string;
  period: string;
  metric: string;
  data: TimeSeriesDataPoint[];
}

/**
 * Get combined timeline data for a business (ratings + sentiment + comparisons)
 * This reduces API calls from 6 to 1
 */
export const getBusinessCombinedTimeline = (
  businessId: string,
  period: string = 'month',
  startDate?: string,
  endDate?: string,
  category?: string
): Promise<{
  business_ratings: RatingsTimeline;
  business_sentiment: SentimentTimeline;
  city_ratings: RatingsTimeline | null;
  city_sentiment: SentimentTimeline | null;
  category_ratings: RatingsTimeline | null;
  category_sentiment: SentimentTimeline | null;
}> => {
  return get(
    `/api/analytics/business/${businessId}/combined-timeline`,
    {
      params: {
        period,
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(category && { category }),
      },
    }
  );
};

/**
 * Get combined timeline data for a city (ratings + sentiment + category comparison)
 */
export const getCityCombinedTimeline = (
  city: string,
  state: string,
  period: string = 'month',
  startDate?: string,
  endDate?: string,
  category?: string
): Promise<{
  city_ratings: RatingsTimeline;
  city_sentiment: SentimentTimeline;
  category_ratings: RatingsTimeline | null;
  category_sentiment: SentimentTimeline | null;
}> => {
  return get(
    `/api/analytics/city/${encodeURIComponent(state)}/${encodeURIComponent(city)}/combined-timeline`,
    {
      params: {
        period,
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(category && { category }),
      },
    }
  );
};

/**
 * Get combined timeline data for a neighborhood (ratings + sentiment + category comparison)
 */
export const getNeighborhoodCombinedTimeline = (
  neighborhood: string,
  city: string,
  state: string,
  period: string = 'month',
  startDate?: string,
  endDate?: string,
  category?: string
): Promise<{
  neighborhood_ratings: RatingsTimeline;
  neighborhood_sentiment: SentimentTimeline;
  category_ratings: RatingsTimeline | null;
  category_sentiment: SentimentTimeline | null;
}> => {
  return get(
    `/api/analytics/neighborhood/${encodeURIComponent(state)}/${encodeURIComponent(city)}/${encodeURIComponent(neighborhood)}/combined-timeline`,
    {
      params: {
        period,
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
        ...(category && { category }),
      },
    }
  );
};

/**
 * Get combined timeline data for a category (ratings + sentiment)
 * This reduces API calls from 2 to 1
 */
export const getCategoryCombinedTimeline = (
  category: string,
  period: string = 'month',
  startDate?: string,
  endDate?: string
): Promise<{
  category_ratings: RatingsTimeline;
  category_sentiment: SentimentTimeline;
}> => {
  return get(
    `/api/analytics/category/${encodeURIComponent(category)}/combined-timeline`,
    {
      params: {
        period,
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
      },
    }
  );
};

/**
 * Competitive Positioning Types
 */
export interface CompetitiveBusinessData {
  business_id: string;
  name: string;
  stars: number;
  review_count: number;
  city: string;
  state: string;
  categories: string;
  is_open: number;
  latitude: number;
  longitude: number;
}

export interface CompetitiveStatistics {
  avg_rating: number;
  median_review_count: number;
  total_businesses: number;
}

export interface CompetitiveSnapshot {
  businesses: CompetitiveBusinessData[];
  statistics: CompetitiveStatistics;
  selected_business: CompetitiveBusinessData | null;
  filters: {
    city?: string | null;
    state?: string | null;
    category?: string | null;
  };
}

/**
 * Get competitive positioning snapshot for market analysis
 */
export const getCompetitiveSnapshot = (
  city?: string,
  state?: string,
  neighborhood?: string,
  category?: string,
  businessId?: string
): Promise<CompetitiveSnapshot> => {
  return get<CompetitiveSnapshot>('/api/analytics/competitive-snapshot', {
    params: {
      ...(city && { city }),
      ...(state && { state }),
      ...(neighborhood && { neighborhood }),
      ...(category && { category }),
      ...(businessId && { business_id: businessId }),
    },
  });
};
