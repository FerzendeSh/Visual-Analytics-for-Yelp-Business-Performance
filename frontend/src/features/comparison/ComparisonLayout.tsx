import { useAppStore } from '../../stores/useAppStore';
import { useComparisonTimeline, useMultipleTimelines } from '../../hooks/useComparisonData';
import { useSmartKeywordInsights } from '../../hooks/useKeywordInsights';
import { MetricsCards } from './MetricsCards';
import { SuperTrends, RatingsTimeline } from './SuperTrends';
import { SentimentTrends, SentimentTimeline } from './SentimentTrends';
import { KeywordInsightsChart } from './KeywordInsightsChart';
import { BusinessAttributesComparison } from './BusinessAttributesComparison';
import { Loader2 } from 'lucide-react';
import { TimelineDataPoint } from '../../lib/api';
import { useState } from 'react';

interface RatingsTimeline {
  business_name?: string;
  business_id?: string;
  data: TimelineDataPoint[];
}

export function ComparisonLayout() {
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
}

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
  // Shared state for synchronized interactions (legends and tooltips)
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [hideVolume, setHideVolume] = useState(false);
  const [sharedHoverDate, setSharedHoverDate] = useState<Date | null>(null);

  // Fetch data - hooks must ALWAYS be called, so we pass null and let the query handle it
  const {
    businessTimeline,
    cityTimeline,
    neighborhoodTimeline,
    categoryTimeline,
    isLoading,
    isError,
  } = useComparisonTimeline(primaryBusinessId);

  const comparisonTimelines = useMultipleTimelines(comparisonIds);

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
  if (isLoading || comparisonTimelines.isLoading || keywordInsightsResult.isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <LoadingState message="Loading comparison data..." />
      </div>
    );
  }

  // Error state
  if (isError || comparisonTimelines.isError || keywordInsightsResult.error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <EmptyState
          message="Failed to load comparison data"
          subtitle="Please try again or select a different business"
        />
      </div>
    );
  }

  // Process timeline data for MetricsCards (Keep original logic for cards)
  const timelineData = businessTimeline.data?.business_ratings?.data || [];
  const metricsData = {
    ratingTrend: timelineData.map((d: any) => ({
      date: new Date(d.period_start),
      value: d.avg_rating ?? 0,
    })),
    sentimentTrend: timelineData.map((d: any) => ({
      date: new Date(d.period_start),
      value: d.avg_sentiment_score ?? 0,
    })),
    volumeTrend: timelineData.map((d: any) => ({
      date: new Date(d.period_start),
      value: d.review_count ?? 0,
    })),
    currentRating: timelineData.length > 0 ? timelineData[timelineData.length - 1]?.avg_rating ?? 0 : 0,
    currentSentiment: timelineData.length > 0 ? timelineData[timelineData.length - 1]?.avg_sentiment_score ?? 0 : 0,
    currentVolume: timelineData.length > 0 ? timelineData[timelineData.length - 1]?.review_count ?? 0 : 0,
  };

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
      <div className="grid grid-rows-[auto_1fr_1fr] gap-4 h-full">
        {/* Row 1: Metrics Cards - Full width */}
        <div>
          <MetricsCards {...metricsData} />
        </div>

        {/* Row 2: Rating and Sentiment Trends - Split 50/50 */}
        <div className="grid grid-cols-2 gap-4 min-h-[400px]">
          <div>
            {primaryTimeline ? (
              <SuperTrends
                primaryTimeline={primaryTimeline}
                comparisonTimelines={comparisonTimelinesList}
                benchmarkTimelines={benchmarkTimelines}
                showBenchmarks={benchmarks}
                hiddenSeries={hiddenSeries}
                onHiddenSeriesChange={setHiddenSeries}
                hideVolume={hideVolume}
                onHideVolumeChange={setHideVolume}
                sharedHoverDate={sharedHoverDate}
                onHoverDateChange={setSharedHoverDate}
              />
            ) : (
              <div className="glass rounded-lg h-full flex items-center justify-center">
                <EmptyState message="No rating data available" />
              </div>
            )}
          </div>

          <div>
            {primarySentimentTimeline ? (
              <SentimentTrends
                primaryTimeline={primarySentimentTimeline}
                comparisonTimelines={comparisonSentimentTimelinesList}
                benchmarkTimelines={benchmarkSentimentTimelines}
                showBenchmarks={benchmarks}
                hiddenSeries={hiddenSeries}
                onHiddenSeriesChange={setHiddenSeries}
                hideVolume={hideVolume}
                onHideVolumeChange={setHideVolume}
                sharedHoverDate={sharedHoverDate}
                onHoverDateChange={setSharedHoverDate}
              />
            ) : (
              <div className="glass rounded-lg h-full flex items-center justify-center">
                <EmptyState message="No sentiment data available" />
              </div>
            )}
          </div>
        </div>

        {/* Row 3: Keywords & Attributes - Split 50/50 */}
        <div className="grid grid-cols-2 gap-4 min-h-[400px]">
          <div>
            {keywordInsightsResult.isLoading ? (
              <div className="glass rounded-lg h-full flex items-center justify-center">
                <LoadingState message="Loading keyword insights..." />
              </div>
            ) : keywordInsightsResult.data?.data ? (
              <KeywordInsightsChart insights={keywordInsightsResult.data.data} />
            ) : (
              <div className="glass rounded-lg h-full flex items-center justify-center">
                <EmptyState message="No keyword data available" />
              </div>
            )}
          </div>

          <div>
            <BusinessAttributesComparison />
          </div>
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
