import { memo, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useComparisonTimeline } from '../../hooks/useComparisonData';
import { useAppStore } from '../../stores/useAppStore';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: number;
  loading?: boolean;
  valueTooltip: string;
  trendTooltip: string;
}

const MetricCard = ({ title, value, trend, loading, valueTooltip, trendTooltip }: MetricCardProps) => {
  const trendIcon = trend && trend > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />;
  const trendColor = trend && trend > 0 ? 'text-green-500' : 'text-red-500';

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 relative group/card">
      {/* Value and Title */}
      <div className="flex flex-col">
        <h3 className="text-[10px] text-muted-foreground leading-none mb-1">{title}</h3>
        {loading ? (
          <div className="h-5 w-16 bg-white/5 rounded animate-pulse" />
        ) : (
          <div className="relative group/value">
            <span className="text-lg text-white cursor-help leading-none">{value}</span>
            {/* Value Tooltip */}
            <div className="absolute -top-8 left-0 opacity-0 group-hover/value:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
              <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 shadow-xl border border-white/10 whitespace-nowrap">
                {valueTooltip}
                <div className="absolute -bottom-1 left-4 w-2 h-2 bg-gray-900 border-r border-b border-white/10 transform rotate-45"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trend Badge */}
      {trend !== undefined && trend !== null && !loading && (
        <div className="relative group/trend ml-auto">
          <div className={`flex items-center gap-0.5 text-[9px] font-medium ${trendColor} cursor-help`}>
            {trendIcon}
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </div>
          {/* Trend Tooltip */}
          <div className="absolute -top-8 right-0 opacity-0 group-hover/trend:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
            <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 shadow-xl border border-white/10 whitespace-nowrap">
              {trendTooltip}
              <div className="absolute -bottom-1 right-4 w-2 h-2 bg-gray-900 border-r border-b border-white/10 transform rotate-45"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ScannerMetricsCardsComponent = () => {
  const primaryBusinessId = useAppStore((state) => state.primaryBusinessId);

  // Fetch business data directly for rating and review count
  const { data: businessData, isLoading: isLoadingBusiness } = useQuery({
    queryKey: ['business', primaryBusinessId],
    queryFn: () => api.businesses.getById(primaryBusinessId!),
    enabled: !!primaryBusinessId,
  });

  // Fetch timeline data for sentiment
  const { businessTimeline } = useComparisonTimeline(primaryBusinessId);

  // Calculate metrics from business data and timeline
  const metrics = useMemo(() => {
    if (!businessData) {
      return null;
    }

    // Get sentiment average from timeline
    const sentiment = businessTimeline.data?.business_sentiment?.data || [];
    const avgSentiment = sentiment.length > 0
      ? sentiment.reduce((sum: number, s: any) => sum + (s?.avg_sentiment_score || 0), 0) / sentiment.length
      : 0;

    return {
      rating: {
        value: businessData.stars.toFixed(1),
      },
      sentiment: {
        value: avgSentiment.toFixed(2),
      },
      volume: {
        value: businessData.review_count.toLocaleString(),
      },
    };
  }, [businessData, businessTimeline.data]);

  const isLoading = isLoadingBusiness || businessTimeline.isLoading;

  return (
    <div className="glass rounded-lg p-0.7 flex items-center divide-x divide-white/5">
      {/* Business Name */}
      <div className="px-4 pr-6">
        {isLoading ? (
          <div className="h-6 w-32 bg-white/5 rounded animate-pulse" />
        ) : (
          <h2 className="text-base text-white whitespace-nowrap">
            {businessData?.name || 'Select a business'}
          </h2>
        )}
      </div>

      <MetricCard
        title="  Average Rating"
        value={metrics?.rating.value || '0.0'}
        loading={isLoading}
        valueTooltip="Avg rating (all time)"
        trendTooltip=""
      />
      <MetricCard
        title="  Sentiment Score"
        value={metrics?.sentiment.value || '0.00'}
        loading={isLoading}
        valueTooltip="Avg sentiment score"
        trendTooltip=""
      />
      <MetricCard
        title="  Review Volume"
        value={metrics?.volume.value || '0'}
        loading={isLoading}
        valueTooltip="Total reviews (all time)"
        trendTooltip=""
      />
    </div>
  );
};

export const ScannerMetricsCards = memo(ScannerMetricsCardsComponent);
