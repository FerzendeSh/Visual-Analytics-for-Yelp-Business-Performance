import { CATEGORICAL_COLORS, STATUS_COLORS, withAlpha } from '../../theme/cloudscapeColors';

export const CHART_COLORS = {
  business: CATEGORICAL_COLORS.categorical4,  // Purple - distinct from scatter plot quadrants
  city: CATEGORICAL_COLORS.categorical5,      // Orange - distinct from scatter plot quadrants
  category: CATEGORICAL_COLORS.categorical3,  // Teal - distinct from scatter plot quadrants
  improving: STATUS_COLORS.positive,
  declining: STATUS_COLORS.high,
  stable: STATUS_COLORS.neutral,
  volumeBars: withAlpha(CATEGORICAL_COLORS.categorical6, 0.5),
  referenceArea: withAlpha(STATUS_COLORS.positive, 0.08),
  gridlines: withAlpha(CATEGORICAL_COLORS.categorical1, 0.08),
  textPrimary: '#ffffffff',
  textSecondary: '#d2d2d4ff',
  textMuted: '#aaccff',
} as const;

// Comparison business colors - distinct and distinguishable from Cloudscape palette
// Carefully selected to avoid conflicts with CHART_COLORS (business=purple, city=orange, category=teal)
export const COMPARISON_COLORS = [
  CATEGORICAL_COLORS.categorical2,   // Pink
  CATEGORICAL_COLORS.categorical6,   // Dark Blue
  CATEGORICAL_COLORS.categorical7,   // Dark Pink
  CATEGORICAL_COLORS.categorical8,   // Dark Teal
  CATEGORICAL_COLORS.categorical9,   // Dark Purple
  CATEGORICAL_COLORS.categorical10,  // Dark Orange
  CATEGORICAL_COLORS.categorical11,  // Navy Blue
  CATEGORICAL_COLORS.categorical12,  // Burgundy
] as const;

export const LINE_STYLES = {
  business: {
    strokeWidth: 3,
    strokeDasharray: undefined,
    opacity: 1,
  },
  city: {
    strokeWidth: 2,
    strokeDasharray: undefined,
    opacity: 0.8,
  },
  category: {
    strokeWidth: 2,
    strokeDasharray: undefined,
    opacity: 0.8,
  },
  // Comparison business line styles - all solid lines
  comparison: [
    { strokeWidth: 2.5, strokeDasharray: undefined, opacity: 0.9 },      // Solid
    { strokeWidth: 2.5, strokeDasharray: undefined, opacity: 0.9 },      // Solid
    { strokeWidth: 2.5, strokeDasharray: undefined, opacity: 0.9 },      // Solid
    { strokeWidth: 2.5, strokeDasharray: undefined, opacity: 0.9 },      // Solid
    { strokeWidth: 2.5, strokeDasharray: undefined, opacity: 0.9 },      // Solid
    { strokeWidth: 2.5, strokeDasharray: undefined, opacity: 0.9 },      // Solid
    { strokeWidth: 2.5, strokeDasharray: undefined, opacity: 0.9 },      // Solid
    { strokeWidth: 2.5, strokeDasharray: undefined, opacity: 0.9 },      // Solid
  ] as const,
} as const;
export const CHART_CONFIG = {
  // Height is now handled by CSS for responsiveness
  // Use 100% in ResponsiveContainer and let parent CSS control size
  minHeight: 500, // Fallback minimum
  margin: { top: 10, right: 10, left: 10, bottom: 40 },
  ratingDomain: [1, 5] as [number, number],
  ratingTicks: [1, 2, 3, 4, 5] as number[],
  sentimentDomain: [-1, 1] as [number, number],
  sentimentTicks: [-1, -0.5, 0, 0.5, 1] as number[],
  xAxisAngle: 0,
  xAxisTextAnchor: 'middle' as const,
  tooltipDecimalPlaces: 2,
  trendThreshold: 0.05,
  stableThreshold: 0.02,
} as const;
export const ACCESSIBILITY = {
  minContrastRatio: 4.5,
  focusOutlineColor: CHART_COLORS.business,
  focusOutlineWidth: '2px',
} as const;
export function getTrendColor(changePercent: number): string {
  if (changePercent > CHART_CONFIG.trendThreshold) {
    return CHART_COLORS.improving;
  } else if (changePercent < -CHART_CONFIG.trendThreshold) {
    return CHART_COLORS.declining;
  }
  return CHART_COLORS.stable;
}

export function formatPercentChange(changePercent: number): string {
  const sign = changePercent >= 0 ? '+' : '';
  return `${sign}${(changePercent * 100).toFixed(1)}%`;
}

export function getTrendIcon(changePercent: number): string {
  if (changePercent > CHART_CONFIG.trendThreshold) {
    return '↗️';
  } else if (changePercent < -CHART_CONFIG.trendThreshold) {
    return '↘️';
  }
  return '→';
}

/**
 * Color palette used in both rating and sentiment charts
 * Keep in sync with LINE_COLORS in RatingTrendsChart.tsx and SentimentTrendsChart.tsx
 */
export const LINE_COLORS = [
  '#9c8506ff', // Gold/Yellow
  '#9400fdff', // Purple
  '#8e2315ff', // Red/Brown
  '#05a763ff', // Green
  '#0199ffff', // Bright Blue
  '#ff6b35ff', // Orange
  '#f72585ff', // Pink
  '#06ffa5ff', // Cyan
] as const;

/**
 * Get the color for a business/series by its index in the series array
 * This ensures consistent colors across charts, sidebar, and scatter plot
 */
export function getSeriesColor(index: number): string {
  return LINE_COLORS[index % LINE_COLORS.length];
}

/**
 * Get the color for a specific business by name from the series names array
 * Used to maintain color consistency across all visualizations
 */
export function getBusinessColor(businessName: string, seriesNames: string[]): string {
  const index = seriesNames.indexOf(businessName);
  return index >= 0 ? getSeriesColor(index) : LINE_COLORS[0];
}
