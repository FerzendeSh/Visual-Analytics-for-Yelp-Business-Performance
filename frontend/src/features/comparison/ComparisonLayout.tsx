import { lazy, Suspense, useState, useEffect, memo, useCallback } from 'react';
import { useAppStore } from '../../stores/useAppStore';
import { useBatchTimelinesLegacy } from '../../hooks/useBatchTimelines';
import { useClusterContext } from '../../hooks/useClusterContext';
import { ChartErrorBoundary } from '../../components/common/ErrorBoundary';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { getSmartClusterLabel } from '../../utils/clusterLabeling';

// Lazy load heavy chart components for further code splitting
// SuperTrends is 930 lines with complex visx visualizations
const SuperTrends = lazy(() => import('./SuperTrends').then(m => ({ default: m.SuperTrends })));
const SentimentTrends = lazy(() => import('./SentimentTrends').then(m => ({ default: m.SentimentTrends })));
const BusinessAttributesComparison = lazy(() => import('./BusinessAttributesComparison').then(m => ({ default: m.BusinessAttributesComparison }))) as React.LazyExoticComponent<React.ComponentType<{ onBusinessHover?: (businessId: string | null) => void }>>;

// Import types for timeline data
import type { RatingsTimeline } from './SuperTrends';
import type { SentimentTimeline } from './SentimentTrends';

// Chart loading fallback
function ChartLoadingFallback() {
  return (
    <div className="glass rounded-lg h-full flex items-center justify-center">
      <div className="flex flex-col items-center space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-muted-foreground text-xs">Loading chart...</p>
      </div>
    </div>
  );
}

const ComparisonLayoutComponent = () => {
  // ✅ Atomic selectors - only re-render when these specific values change
  const primaryBusinessId = useAppStore((state) => state.primaryBusinessId);
  const comparisonIds = useAppStore((state) => state.comparisonIds);
  const benchmarks = useAppStore((state) => state.benchmarks);

  return (
    <ComparisonContent
      primaryBusinessId={primaryBusinessId}
      comparisonIds={comparisonIds}
      benchmarks={benchmarks}
    />
  );
};

// Memoized export
export const ComparisonLayout = memo(ComparisonLayoutComponent);

interface ComparisonContentProps {
  primaryBusinessId: string | null;
  comparisonIds: string[];
  benchmarks: {
    showCityAvg: boolean;
    showNeighborhoodAvg: boolean;
    showCategoryAvg: boolean;
  };
}

function ComparisonContent({ primaryBusinessId, comparisonIds, benchmarks }: ComparisonContentProps) {
  const [sharedHoverDate, setSharedHoverDate] = useState<Date | null>(null);
  const [hoveredBusinessId, setHoveredBusinessId] = useState<string | null>(null);
  const [isBrushMode, setIsBrushMode] = useState(false);
  const [brushSelection, setBrushSelection] = useState<{start: Date, end: Date} | null>(null);
  const updateFilters = useAppStore((state) => state.updateFilters);
  const filters = useAppStore((state) => state.filters);

  const handleBusinessHover = useCallback((businessId: string | null) => {
    console.log('Business hover changed:', businessId);
    setHoveredBusinessId(businessId);
  }, []);

  // Convert granularity to period format for charts
  const period: 'month' | 'year' = filters.granularity === 'MONTHLY' ? 'month' : 'year';

  // Handle brush selection - update filters with custom date range
  // Use a ref to debounce filter updates and prevent re-renders during interaction
  const handleBrushChange = useCallback((selection: {start: Date, end: Date} | null) => {
    setBrushSelection(selection);

    if (selection) {
      // Update app store with custom date range
      updateFilters({
        timeRange: 'CUSTOM',
        customDateRange: {
          start: format(selection.start, 'yyyy-MM-dd'),
          end: format(selection.end, 'yyyy-MM-dd'),
        },
      });
    } else {
      // Clear custom range - revert to default 5Y
      updateFilters({
        timeRange: '5Y',
        customDateRange: null,
        granularity: 'YEARLY',
      });
    }
  }, [updateFilters]);

  // Handle year click - drill down to show months for that year
  const handleYearClick = useCallback((year: string) => {
    const startDate = new Date(`${year}-01-01`);
    const endDate = new Date(`${year}-12-31`);

    // Set custom date range for the clicked year and switch to monthly granularity
    updateFilters({
      timeRange: 'CUSTOM',
      customDateRange: {
        start: format(startDate, 'yyyy-MM-dd'),
        end: format(endDate, 'yyyy-MM-dd'),
      },
      granularity: 'MONTHLY',
    });

    // Update brush selection to reflect the year
    setBrushSelection({
      start: startDate,
      end: endDate,
    });
  }, [updateFilters]);

  // Fetch data using batch endpoint - reduces 4-7 requests to 1 (67% faster)
  const {
    businessTimeline,
    cityTimeline,
    neighborhoodTimeline,
    categoryTimeline,
    comparisonTimelines,
    isLoading,
    isError,
  } = useBatchTimelinesLegacy(primaryBusinessId, comparisonIds);

  // Fetch cluster benchmark for primary business or filtered cluster
  const {
    primaryClusterTimeline,
    primaryBusinessCluster,
    filteredClusterTimeline,
    filteredClusterIds,
    allClusters
  } = useClusterContext();

  // DEBUG: Log cluster data
  console.log('[ComparisonLayout] Cluster data:', {
    hasPrimaryClusterTimeline: !!primaryClusterTimeline,
    primaryClusterTimeline,
    primaryBusinessCluster,
  });

  // Shared state for synchronized interactions (legends and tooltips)
  // Persist hidden series across tab switches using localStorage
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('comparison-hidden-series');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  // Save hidden series to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('comparison-hidden-series', JSON.stringify(Array.from(hiddenSeries)));
  }, [hiddenSeries]);

  // Hide benchmarks by default only if nothing is saved in localStorage
  useEffect(() => {
    // Check if user has any saved preferences
    const hasSavedPreferences = localStorage.getItem('comparison-hidden-series');
    if (hasSavedPreferences) return; // User has preferences, don't override

    const hidden: string[] = [];

    // Hide city benchmark by default if it exists
    const cityName = cityTimeline.data?.city_ratings?.business_name;
    if (cityName) {
      hidden.push(cityName);
    }

    // Hide neighborhood benchmark by default if it exists
    const neighborhoodName = neighborhoodTimeline.data?.neighborhood_ratings?.business_name;
    if (neighborhoodName) {
      hidden.push(neighborhoodName);
    }

    // NOTE: Cluster average (Competitor Group) is NOT hidden by default
    // It should be visible like the primary business line

    if (hidden.length > 0) {
      setHiddenSeries(new Set(hidden));
    }
  }, [cityTimeline.data?.city_ratings?.business_name, neighborhoodTimeline.data?.neighborhood_ratings?.business_name]);

  // Show empty state if no primary selected
  if (!primaryBusinessId) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <EmptyState
          message="Select a business from SCAN mode to start comparison"
          subtitle="Click on a business marker in the map to set it as your primary business"
        />
      </div>
    );
  }

  // Loading state - only block on critical timeline data
  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <LoadingState message="Loading comparison data..." />
      </div>
    );
  }

  // Error state - only show error if we can't load the primary business timeline
  if (isError) {
    // Check if we still have primary timeline data despite error (could be benchmark fetch failure)
    const hasPrimaryData = businessTimeline.data?.business_ratings;

    if (!hasPrimaryData) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <EmptyState
            message="Failed to load comparison data"
            subtitle="Please try again or select a different business"
          />
        </div>
      );
    }
    // If we have primary data, continue rendering (benchmark failures are okay)
  }

  // Note: keyword insights errors are handled gracefully in the KeywordInsights section below

  // Prepare props for SuperTrends (Ratings)
  const primaryTimeline = businessTimeline.data?.business_ratings ?? null;

  const comparisonTimelinesList = comparisonTimelines.data
    ?.map((t: any) => t.business_ratings)
    .filter((t: any): t is RatingsTimeline => !!t) ?? [];

  // Transform cluster timeline to match expected format
  // Priority: Use filtered cluster timeline if a cluster filter is active, otherwise use primary business cluster
  const activeClusterTimeline = filteredClusterTimeline || primaryClusterTimeline;
  const activeCluster = filteredClusterIds.length > 0
    ? allClusters.find(c => filteredClusterIds.includes(c.cluster_id))
    : primaryBusinessCluster;

  const clusterRatingsTimeline = activeClusterTimeline ? {
    business_name: activeCluster ? getSmartClusterLabel(activeCluster) : 'Cluster Average',
    data: activeClusterTimeline.data.map(point => ({
      period_start: point.period_start,
      avg_rating: point.avg_rating,
      review_count: point.review_count,
    })),
  } : undefined;

  // DEBUG: Check cluster ratings data
  if (clusterRatingsTimeline) {
    console.log('[ComparisonLayout] Cluster Ratings Timeline:', {
      business_name: clusterRatingsTimeline.business_name,
      dataPoints: clusterRatingsTimeline.data.length,
      firstPoint: clusterRatingsTimeline.data[0],
      lastPoint: clusterRatingsTimeline.data[clusterRatingsTimeline.data.length - 1],
      allData: clusterRatingsTimeline.data,
    });
  }

  console.log('[ComparisonLayout] Transformed cluster ratings timeline:', clusterRatingsTimeline);

  const benchmarkTimelines = {
    city: cityTimeline.data?.city_ratings,
    neighborhood: neighborhoodTimeline.data?.neighborhood_ratings,
    category: categoryTimeline.data?.category_ratings,
    cluster: clusterRatingsTimeline,
  };

  console.log('[ComparisonLayout] All benchmark timelines:', benchmarkTimelines);

  // Prepare props for SentimentTrends
  const primarySentimentTimeline = businessTimeline.data?.business_sentiment ?? null;

  const comparisonSentimentTimelinesList = comparisonTimelines.data
    ?.map((t: any) => t.business_sentiment)
    .filter((t: any): t is SentimentTimeline => !!t) ?? [];

  // Transform cluster sentiment timeline
  // Use the same active cluster timeline (filtered or primary)
  const clusterSentimentTimeline = activeClusterTimeline ? {
    business_name: activeCluster ? getSmartClusterLabel(activeCluster) : 'Cluster Average',
    data: activeClusterTimeline.data.map(point => ({
      period_start: point.period_start,
      avg_sentiment_score: point.avg_sentiment_score,
      avg_sentiment_expected: point.avg_sentiment_expected,
      review_count: point.review_count,
    })),
  } : undefined;

  // DEBUG: Check cluster sentiment data
  if (clusterSentimentTimeline) {
    console.log('[ComparisonLayout] Cluster Sentiment Timeline:', {
      business_name: clusterSentimentTimeline.business_name,
      dataPoints: clusterSentimentTimeline.data.length,
      firstPoint: clusterSentimentTimeline.data[0],
      lastPoint: clusterSentimentTimeline.data[clusterSentimentTimeline.data.length - 1],
      allData: clusterSentimentTimeline.data,
    });
  }

  const benchmarkSentimentTimelines = {
    city: cityTimeline.data?.city_sentiment,
    neighborhood: neighborhoodTimeline.data?.neighborhood_sentiment,
    category: categoryTimeline.data?.category_sentiment,
    cluster: clusterSentimentTimeline,
  };

  return (
    <div className="w-full h-full px-1.5 pt-16 pb-2 overflow-hidden">
      <div className="grid grid-rows-[48%_52%] gap-1.5 h-full">
        {/* Row 1: Rating and Sentiment Trends */}
        <div className="grid grid-cols-2 gap-1.5 h-full overflow-hidden">
          <ChartErrorBoundary chartName="Rating Trends" resetKeys={[primaryBusinessId, ...comparisonIds]}>
            <div>
              {primaryTimeline ? (
                <Suspense fallback={<ChartLoadingFallback />}>
                  <SuperTrends
                    primaryTimeline={primaryTimeline}
                    comparisonTimelines={comparisonTimelinesList}
                    benchmarkTimelines={benchmarkTimelines}
                    period={period}
                    showBenchmarks={benchmarks}
                    hiddenSeries={hiddenSeries}
                    onHiddenSeriesChange={setHiddenSeries}
                    sharedHoverDate={sharedHoverDate}
                    onHoverDateChange={setSharedHoverDate}
                    hoveredBusinessId={hoveredBusinessId}
                    isBrushMode={isBrushMode}
                    brushSelection={brushSelection}
                    onBrushChange={handleBrushChange}
                    onBrushModeChange={setIsBrushMode}
                    onYearClick={handleYearClick}
                  />
                </Suspense>
              ) : (
                <div className="glass rounded-lg h-full flex items-center justify-center">
                  <EmptyState message="No rating data available" />
                </div>
              )}
            </div>
          </ChartErrorBoundary>

          <ChartErrorBoundary chartName="Sentiment Trends" resetKeys={[primaryBusinessId, ...comparisonIds]}>
            <div>
              {primarySentimentTimeline ? (
                <Suspense fallback={<ChartLoadingFallback />}>
                  <SentimentTrends
                    primaryTimeline={primarySentimentTimeline}
                    comparisonTimelines={comparisonSentimentTimelinesList}
                    benchmarkTimelines={benchmarkSentimentTimelines}
                    period={period}
                    showBenchmarks={benchmarks}
                    hiddenSeries={hiddenSeries}
                    onHiddenSeriesChange={setHiddenSeries}
                    sharedHoverDate={sharedHoverDate}
                    onHoverDateChange={setSharedHoverDate}
                    hoveredBusinessId={hoveredBusinessId}
                    isBrushMode={isBrushMode}
                    brushSelection={brushSelection}
                    onBrushChange={handleBrushChange}
                    onBrushModeChange={setIsBrushMode}
                    onYearClick={handleYearClick}
                  />
                </Suspense>
              ) : (
                <div className="glass rounded-lg h-full flex items-center justify-center">
                  <EmptyState message="No sentiment data available" />
                </div>
              )}
            </div>
          </ChartErrorBoundary>
        </div>

        {/* Row 2: Business Attributes - Takes more space */}
        <div className="h-full">
          <ChartErrorBoundary chartName="Business Attributes" resetKeys={[primaryBusinessId, ...comparisonIds]}>
            <div className="h-full">
              <Suspense fallback={<ChartLoadingFallback />}>
                <BusinessAttributesComparison onBusinessHover={handleBusinessHover} />
              </Suspense>
            </div>
          </ChartErrorBoundary>
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  message: string;
  subtitle?: string;
}

function EmptyState({ message, subtitle }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-2 text-center p-6">
      <p className="text-muted-foreground text-sm">{message}</p>
      {subtitle && <p className="text-muted-foreground text-xs opacity-70">{subtitle}</p>}
    </div>
  );
}

interface LoadingStateProps {
  message?: string;
}

function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-3">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
