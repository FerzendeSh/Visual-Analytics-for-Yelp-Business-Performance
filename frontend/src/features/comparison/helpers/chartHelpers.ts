/**
 * Chart helper functions for formatting and data manipulation.
 * Shared utilities for timeline visualizations.
 */

export const VOLUME_COLOR = '#3b2f5c';
export const VOLUME_HIGHLIGHT = '#504278';
export const AXIS_COLOR = '#94a3b8';
export const GRID_COLOR = '#1e293b';
export const FORECAST_COLOR = '#06ffa5';

// Fixed colors for benchmarks
export const BENCHMARK_COLORS = {
  CITY: '#a855f7',           // Purple - ALWAYS for City
  NEIGHBORHOOD: '#3d9201ff', // Green - ALWAYS for Neighborhood
  CATEGORY: '#f59e0b',       // Amber for Category
  CLUSTER: '#3b82f6',        // Blue - ALWAYS for Cluster (Competitor Group)
};

// Color palette for primary business and comparisons
// Excludes benchmark colors to avoid conflicts
export const LINE_COLORS = [
  '#FFD700', // Gold/Yellow (Primary Business)
  '#ff0080', // Hot Pink (Comparison 1)
  '#00ffd5', // Bright Cyan (Comparison 2)
  '#ffa200', // Orange (Comparison 3)
  '#06b6d4', // Teal (Comparison 4)
  '#e879f9', // Light Purple (Comparison 5)
  '#fb923c', // Coral (Comparison 6)
  '#22d3ee', // Sky Blue (Comparison 7)
  '#a78bfa', // Lavender (Comparison 8)
  '#f472b6', // Rose (Comparison 9)
  '#34d399', // Emerald (Comparison 10)
  '#fbbf24', // Yellow (Comparison 11)
  '#c084fc', // Violet (Comparison 12)
];

/**
 * Get color for a series name.
 * Ensures benchmarks always get their designated colors regardless of order.
 * Ensures comparison businesses get distinct colors that don't conflict with benchmarks.
 */
export function getSeriesColor(
  seriesName: string,
  index: number,
  benchmarkMap?: Map<string, 'city' | 'neighborhood' | 'cluster'>
): string {
  // First, check if this series is explicitly marked as a benchmark
  if (benchmarkMap) {
    const benchmarkType = benchmarkMap.get(seriesName);
    if (benchmarkType === 'city') {
      return BENCHMARK_COLORS.CITY;
    }
    if (benchmarkType === 'neighborhood') {
      return BENCHMARK_COLORS.NEIGHBORHOOD;
    }
    if (benchmarkType === 'cluster') {
      return BENCHMARK_COLORS.CLUSTER;
    }
  }

  // Fallback: Check by name pattern (case-insensitive)
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

  // Cluster/Competitor Group - matches various cluster label formats
  if (
    lowerName.includes('cluster avg') ||
    lowerName.includes('cluster average') ||
    lowerName.includes('competitor group') ||
    lowerName.includes('independent businesses') ||
    lowerName.includes('isolated businesses') ||
    lowerName.startsWith('cluster ')
  ) {
    return BENCHMARK_COLORS.CLUSTER;
  }

  // For primary business and comparisons, use LINE_COLORS by index
  // The LINE_COLORS array is designed to avoid benchmark colors
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
