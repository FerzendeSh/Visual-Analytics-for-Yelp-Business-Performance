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
 * Get analytics data for a specific state
 */
export const getStateAnalytics = (state: string): Promise<AnalyticsData> => {
  return get<AnalyticsData>('/api/analytics/state', {
    params: { state },
  });
};

/**
 * Get analytics data for a specific city
 */
export const getCityAnalytics = (city: string, state: string): Promise<AnalyticsData> => {
  return get<AnalyticsData>('/api/analytics/city', {
    params: { city, state },
  });
};

/**
 * Get overall analytics summary
 */
export const getAnalyticsSummary = (): Promise<AnalyticsData> => {
  return get<AnalyticsData>('/api/analytics/summary');
};

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
 * Get ratings timeline for a specific business
 */
export const getBusinessRatingsTimeline = (
  businessId: string,
  period: string = 'month',
  startDate?: string,
  endDate?: string
): Promise<RatingsTimeline> => {
  return get<RatingsTimeline>(
    `/api/analytics/business/${businessId}/ratings-timeline`,
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
 * Get sentiment timeline for a specific business
 */
export const getBusinessSentimentTimeline = (
  businessId: string,
  period: string = 'month',
  startDate?: string,
  endDate?: string
): Promise<SentimentTimeline> => {
  return get<SentimentTimeline>(
    `/api/analytics/business/${businessId}/sentiment-timeline`,
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
 * Get ratings timeline for a specific city
 */
export const getCityRatingsTimeline = (
  city: string,
  state: string,
  period: string = 'month',
  startDate?: string,
  endDate?: string
): Promise<RatingsTimeline> => {
  return get<RatingsTimeline>(
    `/api/analytics/city/${encodeURIComponent(state)}/${encodeURIComponent(city)}/ratings-timeline`,
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
 * Get ratings timeline for a specific state
 */
export const getStateRatingsTimeline = (
  state: string,
  period: string = 'month',
  startDate?: string,
  endDate?: string
): Promise<RatingsTimeline> => {
  return get<RatingsTimeline>(
    `/api/analytics/state/${encodeURIComponent(state)}/ratings-timeline`,
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
 * Get ratings timeline for a specific category
 */
export const getCategoryRatingsTimeline = (
  category: string,
  period: string = 'month',
  startDate?: string,
  endDate?: string
): Promise<RatingsTimeline> => {
  return get<RatingsTimeline>(
    `/api/analytics/category/${encodeURIComponent(category)}/ratings-timeline`,
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
 * Get sentiment timeline for a specific category
 */
export const getCategorySentimentTimeline = (
  category: string,
  period: string = 'month',
  startDate?: string,
  endDate?: string
): Promise<SentimentTimeline> => {
  return get<SentimentTimeline>(
    `/api/analytics/category/${encodeURIComponent(category)}/sentiment-timeline`,
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
 * Get sentiment timeline for a specific city
 */
export const getCitySentimentTimeline = (
  city: string,
  state: string,
  period: string = 'month',
  startDate?: string,
  endDate?: string
): Promise<SentimentTimeline> => {
  return get<SentimentTimeline>(
    `/api/analytics/city/${encodeURIComponent(state)}/${encodeURIComponent(city)}/sentiment-timeline`,
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
  category?: string,
  businessId?: string
): Promise<CompetitiveSnapshot> => {
  return get<CompetitiveSnapshot>('/api/analytics/competitive-snapshot', {
    params: {
      ...(city && { city }),
      ...(state && { state }),
      ...(category && { category }),
      ...(businessId && { business_id: businessId }),
    },
  });
};
