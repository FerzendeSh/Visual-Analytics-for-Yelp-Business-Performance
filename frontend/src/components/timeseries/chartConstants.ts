/**
 * Chart Constants & Configuration
 * Centralized color scheme and visual settings for consistent charts
 */

import { CATEGORICAL_COLORS, STATUS_COLORS, withAlpha } from '../../theme/cloudscapeColors';

/**
 * CLOUDSCAPE DESIGN SYSTEM COLOR SCHEME
 * Based on AWS Cloudscape data visualization palette
 * https://cloudscape.design/foundation/visual-foundation/data-vis-colors/
 *
 * Design rationale:
 * - Business/Primary: Blue (Cloudscape categorical-1, primary entity)
 * - City Average: Teal (Cloudscape categorical-3, secondary comparison)
 * - Category Average: Pink (Cloudscape categorical-2, tertiary comparison)
 * - Improvement: Green (Cloudscape status-positive, positive trend)
 * - Decline: Red (Cloudscape status-high, warning/decline)
 * - Neutral: Gray (Cloudscape status-neutral, stable/inactive)
 */
export const CHART_COLORS = {
  // Entity colors (Cloudscape categorical palette)
  business: CATEGORICAL_COLORS.categorical1,      // #688ae8 - primary entity line
  city: CATEGORICAL_COLORS.categorical3,          // #2ea597 - city average comparison
  category: CATEGORICAL_COLORS.categorical2,      // #c33d69 - category average comparison

  // Trend direction colors (Cloudscape status palette)
  improving: STATUS_COLORS.positive,              // #67a353 - positive trend
  declining: STATUS_COLORS.high,                  // #ba2e0f - negative trend
  stable: STATUS_COLORS.neutral,                  // #8c8c94 - flat/stable trend

  // Background & context (using Cloudscape colors with transparency)
  volumeBars: withAlpha(CATEGORICAL_COLORS.categorical4, 0.5),  // Purple bars 
  referenceArea: withAlpha(STATUS_COLORS.positive, 0.08), // Very light green
  gridlines: withAlpha(CATEGORICAL_COLORS.categorical1, 0.08), // Subtle gridlines

  // Text & UI
  textPrimary: '#ffffffff',
  textSecondary: '#d2d2d4ff',
  textMuted: '#aaccff',
} as const;

/**
 * Line styling configuration
 */
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
} as const;

/**
 * Chart dimensions and spacing
 */
export const CHART_CONFIG = {
  height: 300,  
  margin: { top: 10, right: 10, left: 10, bottom: 10 },  

  // Rating chart specific
  ratingDomain: [1, 5] as [number, number],
  ratingTicks: [1, 2, 3, 4, 5] as number[],

  // Sentiment chart specific
  sentimentDomain: [-1, 1] as [number, number],
  sentimentTicks: [-1, -0.5, 0, 0.5, 1] as number[],

  // X-axis configuration
  xAxisAngle: 0, 
  xAxisTextAnchor: 'middle' as const,

  // Tooltip
  tooltipDecimalPlaces: 2,

  // Trend detection
  trendThreshold: 0.05, 
  stableThreshold: 0.02, 
} as const;

/**
 * Accessibility configuration
 */
export const ACCESSIBILITY = {
  minContrastRatio: 4.5, 
  focusOutlineColor: CHART_COLORS.business,
  focusOutlineWidth: '2px',
} as const;

/**
 * Helper function to get color based on trend direction
 */
export function getTrendColor(changePercent: number): string {
  if (changePercent > CHART_CONFIG.trendThreshold) {
    return CHART_COLORS.improving;
  } else if (changePercent < -CHART_CONFIG.trendThreshold) {
    return CHART_COLORS.declining;
  }
  return CHART_COLORS.stable;
}

/**
 * Helper function to format percentage change
 */
export function formatPercentChange(changePercent: number): string {
  const sign = changePercent >= 0 ? '+' : '';
  return `${sign}${(changePercent * 100).toFixed(1)}%`;
}

/**
 * Helper function to get trend icon
 */
export function getTrendIcon(changePercent: number): string {
  if (changePercent > CHART_CONFIG.trendThreshold) {
    return '↗️';
  } else if (changePercent < -CHART_CONFIG.trendThreshold) {
    return '↘️';
  }
  return '→';
}
