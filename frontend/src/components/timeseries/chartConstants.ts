import { CATEGORICAL_COLORS, STATUS_COLORS, withAlpha } from '../../theme/cloudscapeColors';

export const CHART_COLORS = {
  business: CATEGORICAL_COLORS.categorical1,
  city: CATEGORICAL_COLORS.categorical3,
  category: CATEGORICAL_COLORS.categorical2,
  improving: STATUS_COLORS.positive,
  declining: STATUS_COLORS.high,
  stable: STATUS_COLORS.neutral,
  volumeBars: withAlpha(CATEGORICAL_COLORS.categorical4, 0.5),
  referenceArea: withAlpha(STATUS_COLORS.positive, 0.08),
  gridlines: withAlpha(CATEGORICAL_COLORS.categorical1, 0.08),
  textPrimary: '#ffffffff',
  textSecondary: '#d2d2d4ff',
  textMuted: '#aaccff',
} as const;
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
export const CHART_CONFIG = {
  height: 300,
  margin: { top: 10, right: 10, left: 10, bottom: 10 },
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
