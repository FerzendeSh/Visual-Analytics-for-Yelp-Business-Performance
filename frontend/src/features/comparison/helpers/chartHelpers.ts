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
  '#FFD700', // Gold/Yellow (Primary Business - Maggiano's)
  '#a855f7', // Purple (City Avg)
  '#22c55e', // Green (Neighborhood Avg)
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
];

// Fixed colors for benchmarks
export const BENCHMARK_COLORS = {
  CITY: '#a855f7',        // Purple - ALWAYS for City
  NEIGHBORHOOD: '#22c55e', // Green - ALWAYS for Neighborhood
  CATEGORY: '#f59e0b',     // Amber for Category
  CLUSTER: '#14b8a6',      // Teal - ALWAYS for Cluster (Competitor Group)
};

/**
 * Get color for a series name.
 * Ensures benchmarks always get their designated colors regardless of order.
 */
export function getSeriesColor(seriesName: string, index: number): string {
  // Check if it's a benchmark (case-insensitive)
  const lowerName = seriesName.toLowerCase();

  if (lowerName.includes('city avg') || lowerName.includes('city average')) {
    return BENCHMARK_COLORS.CITY;
  }

  if (lowerName.includes('neighborhood avg') || lowerName.includes('neighborhood average')) {
    return BENCHMARK_COLORS.NEIGHBORHOOD;
  }

  if (lowerName.includes('category avg') || lowerName.includes('category average')) {
    return BENCHMARK_COLORS.CATEGORY;
  }

  if (lowerName.includes('cluster avg') || lowerName.includes('cluster average')) {
    return BENCHMARK_COLORS.CLUSTER;
  }

  // For primary business and comparisons, use LINE_COLORS by index
  return LINE_COLORS[index % LINE_COLORS.length];
}

export function formatPercentChange(changePercent: number): string {
  const sign = changePercent >= 0 ? '+' : '';
  return `${sign}${(changePercent * 100).toFixed(1)}%`;
}

export function formatDateForPeriod(dateString: string, period: 'month' | 'year'): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    // Always show only the year, never show months
    return `${date.getFullYear()}`;
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
