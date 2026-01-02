import { memo, useMemo } from 'react';
import { Star, TrendingUp, TrendingDown, MessageSquare, BarChart3 } from 'lucide-react';
import { useComparisonTimeline } from '../../hooks/useComparisonData';
import { useAppStore } from '../../stores/useAppStore';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  loading?: boolean;
  valueTooltip: string;
  trendTooltip: string;
  color: string;
}

const MetricCard = ({ title, value, icon, trend, loading, valueTooltip, trendTooltip, color }: MetricCardProps) => {
  const trendIcon = trend && trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />;
  const trendColor = trend && trend > 0 ? 'text-green-500' : 'text-red-500';

  return (
    <div className="glass rounded-lg p-5 space-y-3 relative hover:bg-white/[0.03] transition-all duration-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${color}`}>
            {icon}
          </div>
          <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        </div>
        {trend !== undefined && trend !== null && !loading && (
          <div className="relative group/trend">
            <div className={`flex items-center gap-1 text-xs font-medium ${trendColor} cursor-help`}>
              {trendIcon}
              <span>{Math.abs(trend).toFixed(1)}%</span>
            </div>
            {/* Trend Tooltip */}
            <div className="absolute -top-10 right-0 opacity-0 group-hover/trend:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
              <div className="bg-gray-900 text-white text-xs rounded py-1.5 px-2.5 shadow-xl border border-white/10 whitespace-nowrap">
                {trendTooltip}
                <div className="absolute -bottom-1 right-4 w-2 h-2 bg-gray-900 border-r border-b border-white/10 transform rotate-45"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-2">
        {loading ? (
          <div className="h-8 w-24 bg-white/5 rounded animate-pulse" />
        ) : (
          <div className="relative group/value">
            <span className="text-3xl font-bold text-white cursor-help">{value}</span>
            {/* Value Tooltip */}
            <div className="absolute -top-10 left-0 opacity-0 group-hover/value:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
              <div className="bg-gray-900 text-white text-xs rounded py-1.5 px-2.5 shadow-xl border border-white/10 whitespace-nowrap">
                {valueTooltip}
                <div className="absolute -bottom-1 left-4 w-2 h-2 bg-gray-900 border-r border-b border-white/10 transform rotate-45"></div>
              </div>
            </div>
          </div>
        )}
      </div>
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
    <div className="grid grid-cols-3 gap-4 mb-4">
      <MetricCard
        title="Average Rating"
        value={metrics?.rating.value || '0.0'}
        icon={<Star size={18} className="text-yellow-500" fill="currentColor" />}
        loading={isLoading}
        valueTooltip="Avg rating (all time)"
        trendTooltip=""
        color="bg-yellow-500/10"
      />
      <MetricCard
        title="Sentiment Score"
        value={metrics?.sentiment.value || '0.00'}
        icon={<MessageSquare size={18} className="text-green-500" />}
        loading={isLoading}
        valueTooltip="Avg sentiment score"
        trendTooltip=""
        color="bg-green-500/10"
      />
      <MetricCard
        title="Review Volume"
        value={metrics?.volume.value || '0'}
        icon={<BarChart3 size={18} className="text-blue-500" />}
        loading={isLoading}
        valueTooltip="Total reviews (all time)"
        trendTooltip=""
        color="bg-blue-500/10"
      />
    </div>
  );
};

export const ScannerMetricsCards = memo(ScannerMetricsCardsComponent);
