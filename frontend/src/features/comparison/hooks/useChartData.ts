/**
 * Chart data transformation hook.
 * Merges primary timeline, comparison timelines, and benchmarks into a unified chart dataset.
 */
import { useMemo } from 'react';
import { RatingsTimeline } from '../SuperTrends';
import { formatDateForPeriod, getDateSortKey } from '../helpers/chartHelpers';

export interface ChartDataPoint {
  period: string;
  periodDate: string; // Original ISO date string for synchronization
  volume: number;
  [key: string]: number | string;
}

interface UseChartDataProps {
  primaryTimeline: RatingsTimeline | null;
  comparisonTimelines: RatingsTimeline[];
  benchmarkTimelines?: {
    city?: RatingsTimeline;
    neighborhood?: RatingsTimeline;
    category?: RatingsTimeline;
  };
  showBenchmarks?: {
    showCityAvg: boolean;
    showNeighborhoodAvg: boolean;
    showCategoryAvg: boolean;
  };
  period: 'month' | 'year';
}

export function useChartData({
  primaryTimeline,
  comparisonTimelines,
  benchmarkTimelines,
  showBenchmarks,
  period,
}: UseChartDataProps): { chartData: ChartDataPoint[]; seriesNames: string[] } {
  return useMemo(() => {
    if (!primaryTimeline?.data || primaryTimeline.data.length === 0) {
      return { chartData: [], seriesNames: [] };
    }

    const primaryPeriods = primaryTimeline.data.map((p) => p.period_start);
    const sortedPeriods = primaryPeriods.sort((a, b) => getDateSortKey(a) - getDateSortKey(b));

    const names: string[] = [];
    const primaryName = primaryTimeline.business_name || 'Primary Business';
    names.push(primaryName);

    // Always add benchmark names if data exists (user can toggle via legend)
    if (benchmarkTimelines?.city) {
      names.push(benchmarkTimelines.city.business_name || 'City Avg');
    }
    if (benchmarkTimelines?.neighborhood) {
      names.push(benchmarkTimelines.neighborhood.business_name || 'Neighborhood Avg');
    }

    // Add comparison names
    comparisonTimelines.forEach((comp) => {
      names.push(comp.business_name || comp.business_id || 'Competitor');
    });

    // Build chart data by merging all timelines
    const data: ChartDataPoint[] = sortedPeriods.map((periodStart) => {
      const primaryPoint = primaryTimeline.data.find((p) => p.period_start === periodStart);

      const point: ChartDataPoint = {
        period: periodStart, // Keep original date to ensure unique keys
        periodDate: periodStart, // Store original date for synchronization
        volume: primaryPoint?.review_count || 0,
        [primaryName]: primaryPoint?.avg_rating || 0,
      };

      // Always add benchmark data if it exists
      if (benchmarkTimelines?.city) {
        const p = benchmarkTimelines.city.data.find((d) => d.period_start === periodStart);
        point[benchmarkTimelines.city.business_name || 'City Avg'] = p?.avg_rating || 0;
      }
      if (benchmarkTimelines?.neighborhood) {
        const p = benchmarkTimelines.neighborhood.data.find((d) => d.period_start === periodStart);
        point[benchmarkTimelines.neighborhood.business_name || 'Neighborhood Avg'] =
          p?.avg_rating || 0;
      }

      // Add comparison data
      comparisonTimelines.forEach((comp) => {
        const p = comp.data.find((d) => d.period_start === periodStart);
        const name = comp.business_name || comp.business_id || 'Competitor';
        point[name] = p?.avg_rating || 0;
      });

      return point;
    });

    return { chartData: data, seriesNames: names };
  }, [primaryTimeline, comparisonTimelines, benchmarkTimelines, showBenchmarks, period]);
}
