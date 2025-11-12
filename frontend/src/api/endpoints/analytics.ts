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
  business_id: string;
  business_name: string;
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
