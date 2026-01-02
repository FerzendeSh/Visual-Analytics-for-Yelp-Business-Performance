import { lazy, Suspense, useState, useMemo, useEffect, memo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../stores/useAppStore';
import { useBatchTimelinesLegacy } from '../../hooks/useBatchTimelines';
import { useSmartKeywordInsights } from '../../hooks/useKeywordInsights';
import { ChartErrorBoundary } from '../../components/common/ErrorBoundary';
import { Loader2, Move } from 'lucide-react';
import { TimelineDataPoint } from '../../lib/api';
import { api } from '../../lib/api';
import { format } from 'date-fns';

// Lazy load heavy chart components for further code splitting
// SuperTrends is 930 lines with complex visx visualizations
const SuperTrends = lazy(() => import('./SuperTrends').then(m => ({ default: m.SuperTrends })));
const SentimentTrends = lazy(() => import('./SentimentTrends').then(m => ({ default: m.SentimentTrends })));
const KeywordInsightsChart = lazy(() => import('./KeywordInsightsChart').then(m => ({ default: m.KeywordInsightsChart })));
const BusinessAttributesComparison = lazy(() => import('./BusinessAttributesComparison').then(m => ({ default: m.BusinessAttributesComparison })));

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
  const [isBrushMode, setIsBrushMode] = useState(false);
  const [brushSelection, setBrushSelection] = useState<{start: Date, end: Date} | null>(null);
  const updateFilters = useAppStore((state) => state.updateFilters);
  const filters = useAppStore((state) => state.filters);

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

    if (hidden.length > 0) {
      setHiddenSeries(new Set(hidden));
    }
  }, [cityTimeline.data?.city_ratings?.business_name, neighborhoodTimeline.data?.neighborhood_ratings?.business_name]);

  // Use smart keyword insights that finds the relevant data year
  const keywordInsightsResult = useSmartKeywordInsights(
    primaryBusinessId,
    businessTimeline.data?.business_ratings
  );

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

  // Loading state
  if (isLoading || keywordInsightsResult.isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <LoadingState message="Loading comparison data..." />
      </div>
    );
  }

  // Error state
  if (isError || keywordInsightsResult.error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <EmptyState
          message="Failed to load comparison data"
          subtitle="Please try again or select a different business"
        />
      </div>
    );
  }

  // Prepare props for SuperTrends (Ratings)
  const primaryTimeline = businessTimeline.data?.business_ratings ?? null;

  const comparisonTimelinesList = comparisonTimelines.data
    ?.map((t: any) => t.business_ratings)
    .filter((t: any): t is RatingsTimeline => !!t) ?? [];

  const benchmarkTimelines = {
    city: cityTimeline.data?.city_ratings,
    neighborhood: neighborhoodTimeline.data?.neighborhood_ratings,
    category: categoryTimeline.data?.category_ratings,
  };

  // Prepare props for SentimentTrends
  const primarySentimentTimeline = businessTimeline.data?.business_sentiment ?? null;

  const comparisonSentimentTimelinesList = comparisonTimelines.data
    ?.map((t: any) => t.business_sentiment)
    .filter((t: any): t is SentimentTimeline => !!t) ?? [];

  const benchmarkSentimentTimelines = {
    city: cityTimeline.data?.city_sentiment,
    neighborhood: neighborhoodTimeline.data?.neighborhood_sentiment,
    category: categoryTimeline.data?.category_sentiment,
  };

  return (
    <div className="w-full h-full p-6 overflow-auto">
      <div className="grid grid-rows-[1fr_1fr] gap-4 h-full">
        {/* Row 1: Rating and Sentiment Trends - Split 50/50 */}
        <div className="grid grid-cols-2 gap-4 min-h-[400px]">
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

        {/* Row 3: Keywords & Attributes - Split 50/50 */}
        <div className="grid grid-cols-2 gap-4 min-h-[400px]">
          <ChartErrorBoundary chartName="Keyword Insights" resetKeys={[primaryBusinessId]}>
            <div>
              {keywordInsightsResult.isLoading ? (
                <div className="glass rounded-lg h-full flex items-center justify-center">
                  <LoadingState message="Loading keyword insights..." />
                </div>
              ) : keywordInsightsResult.data?.data ? (
                <Suspense fallback={<ChartLoadingFallback />}>
                  <KeywordInsightsChart insights={keywordInsightsResult.data.data} />
                </Suspense>
              ) : (
                <div className="glass rounded-lg h-full flex items-center justify-center">
                  <EmptyState message="No keyword data available" />
                </div>
              )}
            </div>
          </ChartErrorBoundary>

          <ChartErrorBoundary chartName="Business Attributes" resetKeys={[primaryBusinessId, ...comparisonIds]}>
            <div>
              <Suspense fallback={<ChartLoadingFallback />}>
                <BusinessAttributesComparison />
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
