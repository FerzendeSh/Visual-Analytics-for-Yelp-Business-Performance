/**
 * Trend Analysis Utilities
 * Functions for calculating trends, finding key points, and generating insights
 */

import { TimeSeriesDataPoint } from '../../api/endpoints/analytics';
import { CHART_CONFIG } from './chartConstants';

export interface TrendAnalysis {
  direction: 'improving' | 'declining' | 'stable';
  changePercent: number;
  changeAbsolute: number;
  periodStart: string;
  periodEnd: string;
  startValue: number;
  endValue: number;
}

export interface KeyPoint {
  period: string;
  value: number;
  reviewCount?: number;
  type: 'peak' | 'trough' | 'inflection';
  label: string;
}

export interface CompetitivePosition {
  isAboveAverage: boolean;
  gapPercent: number;
  gapAbsolute: number;
  percentile?: number; // e.g., "top 25%"
}

/**
 * Calculate trend between the most recent period and previous period
 * (or compare last N periods to prior N periods)
 */
export function calculateTrend(
  data: TimeSeriesDataPoint[],
  metric: 'avg_rating' | 'avg_sentiment_score',
  periodsToCompare: number = 3
): TrendAnalysis | null {
  if (!data || data.length < 2) return null;

  const sorted = [...data].sort((a, b) =>
    new Date(b.period_start).getTime() - new Date(a.period_start).getTime()
  );

  const recentPeriods = sorted.slice(0, Math.min(periodsToCompare, sorted.length));
  const previousPeriods = sorted.slice(
    periodsToCompare,
    Math.min(periodsToCompare * 2, sorted.length)
  );

  if (previousPeriods.length === 0) {
    const endValue = sorted[0][metric] || 0;
    const startValue = sorted[sorted.length - 1][metric] || 0;
    const change = endValue - startValue;
    const changePercent = startValue !== 0 ? change / Math.abs(startValue) : 0;

    return {
      direction: getDirection(changePercent),
      changePercent,
      changeAbsolute: change,
      periodStart: sorted[sorted.length - 1].period_start,
      periodEnd: sorted[0].period_start,
      startValue,
      endValue,
    };
  }

  const recentAvg = recentPeriods.reduce((sum, p) => sum + (p[metric] || 0), 0) / recentPeriods.length;
  const previousAvg = previousPeriods.reduce((sum, p) => sum + (p[metric] || 0), 0) / previousPeriods.length;

  const change = recentAvg - previousAvg;
  const changePercent = previousAvg !== 0 ? change / Math.abs(previousAvg) : 0;

  return {
    direction: getDirection(changePercent),
    changePercent,
    changeAbsolute: change,
    periodStart: previousPeriods[0].period_start,
    periodEnd: recentPeriods[0].period_start,
    startValue: previousAvg,
    endValue: recentAvg,
  };
}

/**
 * Helper: Determine trend direction based on percent change
 */
function getDirection(changePercent: number): 'improving' | 'declining' | 'stable' {
  if (changePercent > CHART_CONFIG.trendThreshold) return 'improving';
  if (changePercent < -CHART_CONFIG.trendThreshold) return 'declining';
  return 'stable';
}

/**
 * Find key points in the data (peaks, troughs, large changes)
 */
export function findKeyPoints(
  data: TimeSeriesDataPoint[],
  metric: 'avg_rating' | 'avg_sentiment_score',
  limit: number = 3
): KeyPoint[] {
  if (!data || data.length < 3) return [];

  const keyPoints: KeyPoint[] = [];

  const sorted = [...data].sort((a, b) =>
    new Date(a.period_start).getTime() - new Date(b.period_start).getTime()
  );

  const peak = sorted.reduce((max, point) =>
    (point[metric] || 0) > (max[metric] || 0) ? point : max
  );
  keyPoints.push({
    period: peak.period_start,
    value: peak[metric] || 0,
    reviewCount: peak.review_count,
    type: 'peak',
    label: `Peak: ${(peak[metric] || 0).toFixed(2)}`,
  });

  const trough = sorted.reduce((min, point) =>
    (point[metric] || 0) < (min[metric] || 0) ? point : min
  );
  if (trough.period_start !== peak.period_start) {
    keyPoints.push({
      period: trough.period_start,
      value: trough[metric] || 0,
      reviewCount: trough.review_count,
      type: 'trough',
      label: `Low: ${(trough[metric] || 0).toFixed(2)}`,
    });
  }

  let maxImprovement = 0;
  let improvementIndex = -1;
  for (let i = 1; i < sorted.length; i++) {
    const change = (sorted[i][metric] || 0) - (sorted[i - 1][metric] || 0);
    if (change > maxImprovement) {
      maxImprovement = change;
      improvementIndex = i;
    }
  }

  if (improvementIndex > 0 && maxImprovement > 0.1) {
    const point = sorted[improvementIndex];
    keyPoints.push({
      period: point.period_start,
      value: point[metric] || 0,
      reviewCount: point.review_count,
      type: 'inflection',
      label: `↗️ +${maxImprovement.toFixed(2)}`,
    });
  }

  let maxDecline = 0;
  let declineIndex = -1;
  for (let i = 1; i < sorted.length; i++) {
    const change = (sorted[i][metric] || 0) - (sorted[i - 1][metric] || 0);
    if (change < maxDecline) {
      maxDecline = change;
      declineIndex = i;
    }
  }

  if (declineIndex > 0 && maxDecline < -0.1) {
    const point = sorted[declineIndex];
    keyPoints.push({
      period: point.period_start,
      value: point[metric] || 0,
      reviewCount: point.review_count,
      type: 'inflection',
      label: `↘️ ${maxDecline.toFixed(2)}`,
    });
  }

  return keyPoints.slice(0, limit);
}

/**
 * Calculate competitive position relative to comparison average
 */
export function calculateCompetitivePosition(
  businessData: TimeSeriesDataPoint[],
  comparisonData: TimeSeriesDataPoint[] | null,
  metric: 'avg_rating' | 'avg_sentiment_score'
): CompetitivePosition | null {
  if (!businessData || !comparisonData || businessData.length === 0 || comparisonData.length === 0) {
    return null;
  }

  const businessAvg = businessData.reduce((sum, p) => sum + (p[metric] || 0), 0) / businessData.length;
  const comparisonAvg = comparisonData.reduce((sum, p) => sum + (p[metric] || 0), 0) / comparisonData.length;

  const gap = businessAvg - comparisonAvg;
  const gapPercent = comparisonAvg !== 0 ? gap / Math.abs(comparisonAvg) : 0;

  return {
    isAboveAverage: gap > 0,
    gapPercent,
    gapAbsolute: gap,
  };
}

/**
 * Calculate period-over-period change for tooltip enhancement
 */
export function calculatePeriodChange(
  data: TimeSeriesDataPoint[],
  currentPeriod: string,
  metric: 'avg_rating' | 'avg_sentiment_score'
): { change: number; changePercent: number } | null {
  if (!data || data.length < 2) return null;

  const sorted = [...data].sort((a, b) =>
    new Date(a.period_start).getTime() - new Date(b.period_start).getTime()
  );

  const currentIndex = sorted.findIndex(p => p.period_start === currentPeriod);
  if (currentIndex <= 0) return null;

  const currentValue = sorted[currentIndex][metric] || 0;
  const previousValue = sorted[currentIndex - 1][metric] || 0;

  const change = currentValue - previousValue;
  const changePercent = previousValue !== 0 ? change / Math.abs(previousValue) : 0;

  return { change, changePercent };
}

/**
 * Calculate linear regression trend line
 * Returns slope and intercept for y = mx + b
 */
export function calculateTrendLine(
  data: TimeSeriesDataPoint[],
  metric: 'avg_rating' | 'avg_sentiment_score'
): { slope: number; intercept: number; r2: number } | null {
  if (!data || data.length < 2) return null;

  const sorted = [...data].sort((a, b) =>
    new Date(a.period_start).getTime() - new Date(b.period_start).getTime()
  );

  // Convert dates to numeric indices (0, 1, 2, ...)
  const n = sorted.length;
  const x = Array.from({ length: n }, (_, i) => i);
  const y = sorted.map(p => p[metric] || 0);

  // Calculate means
  const xMean = x.reduce((sum, val) => sum + val, 0) / n;
  const yMean = y.reduce((sum, val) => sum + val, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (x[i] - xMean) * (y[i] - yMean);
    denominator += (x[i] - xMean) ** 2;
  }
  const slope = denominator !== 0 ? numerator / denominator : 0;

  // Calculate intercept (b)
  const intercept = yMean - slope * xMean;

  // Calculate R² (coefficient of determination)
  const yPred = x.map(xi => slope * xi + intercept);
  const ssRes = y.reduce((sum, yi, i) => sum + (yi - yPred[i]) ** 2, 0);
  const ssTot = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0);
  const r2 = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, r2 };
}
