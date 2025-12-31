/**
 * Chart helper functions for formatting and data manipulation.
 * Shared utilities for timeline visualizations.
 */

export const VOLUME_COLOR = '#3b2f5c';
export const VOLUME_HIGHLIGHT = '#504278';
export const AXIS_COLOR = '#94a3b8';
export const GRID_COLOR = '#1e293b';
export const FORECAST_COLOR = '#06ffa5';

export const LINE_COLORS = [
  '#3b82f6', // Blue (Primary)
  '#a855f7', // Purple
  '#ef4444', // Red
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
];

export function formatPercentChange(changePercent: number): string {
  const sign = changePercent >= 0 ? '+' : '';
  return `${sign}${(changePercent * 100).toFixed(1)}%`;
}

export function formatDateForPeriod(dateString: string, period: 'month' | 'year'): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return period === 'year'
      ? `${date.getFullYear()}`
      : date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
  } catch {
    return dateString;
  }
}

export function getDateSortKey(dateString: string): number {
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  } catch {
    return 0;
  }
}

export function calculateTickInterval(totalPeriods: number): number {
  if (totalPeriods <= 10) return 1;
  if (totalPeriods <= 20) return 2;
  if (totalPeriods <= 40) return 3;
  if (totalPeriods <= 60) return 4;
  return 6;
}
