import React, { useMemo } from 'react';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Business } from '../../api';
import {
  RatingsTimeline,
  SentimentTimeline,
} from '../../api/endpoints/analytics';

import { CHART_COLORS, LINE_STYLES, CHART_CONFIG } from './chartConstants';
import {
  calculateTrend,
  calculateCompetitivePosition,
  TrendAnalysis,
  CompetitivePosition,
} from './trendUtils';
import {
  generateRatingInsight,
  generateSentimentInsight,
} from './insightUtils';
import TrendIndicator from './TrendIndicator';
import CompetitivePositionBadge from './CompetitivePositionBadge';
import EnhancedTooltip from './EnhancedTooltip';
import { CARD_STYLE } from '../../theme/sharedStyles';

function formatDateForPeriod(dateString: string, period: 'month' | 'year'): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }

    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();

    switch (period) {
      case 'month':
        return month;
      case 'year':
        return `${year}`;
      default:
        return dateString;
    }
  } catch {
    return dateString;
  }
}

interface TimeSeriesChartOptimizedProps {
  business: Business | null;
  selectedCity?: string;
  selectedState?: string;
  selectedCategory?: string;
  selectedNeighborhood?: string;
  primaryCategory?: string;
  isRatingsOnly?: boolean;
  isSentimentOnly?: boolean;
  period?: 'month' | 'year';
  ratingsData?: RatingsTimeline | null;
  sentimentData?: SentimentTimeline | null;
  cityRatingsData?: RatingsTimeline | null;
  citySentimentData?: SentimentTimeline | null;
  neighborhoodRatingsData?: RatingsTimeline | null;
  neighborhoodSentimentData?: SentimentTimeline | null;
  categoryRatingsData?: RatingsTimeline | null;
  categorySentimentData?: SentimentTimeline | null;
  isLoading?: boolean;
  error?: any;
}

const TimeSeriesChartOptimized: React.FC<TimeSeriesChartOptimizedProps> = ({
  business,
  selectedCity = '',
  selectedState = '',
  selectedCategory = '',
  selectedNeighborhood = '',
  primaryCategory = '',
  isRatingsOnly = false,
  isSentimentOnly = false,
  period = 'year',
  ratingsData,
  sentimentData,
  cityRatingsData,
  citySentimentData,
  neighborhoodRatingsData,
  neighborhoodSentimentData,
  categoryRatingsData,
  categorySentimentData,
  isLoading = false,
  error = null,
}) => {
  // Determine which comparison data to use: neighborhood if selected, otherwise city
  const comparisonRatingsData = selectedNeighborhood && business ? neighborhoodRatingsData : cityRatingsData;

  const mergedRatingsData = useMemo(() => {
    if (!ratingsData?.data) return null;

    // Get all unique periods from both datasets
    const allPeriods = new Set<string>();
    ratingsData.data.forEach(p => allPeriods.add(p.period_start));
    comparisonRatingsData?.data?.forEach(p => allPeriods.add(p.period_start));
    categoryRatingsData?.data?.forEach(p => allPeriods.add(p.period_start));

    const sortedPeriods = Array.from(allPeriods).sort();

    return {
      ...ratingsData,
      data: sortedPeriods.map((period) => {
        const ratingPoint = ratingsData.data.find(p => p.period_start === period);
        const comparisonPoint = comparisonRatingsData?.data?.find(p => p.period_start === period);
        const categoryPoint = categoryRatingsData?.data?.find(p => p.period_start === period);

        return {
          period_start: period,
          avg_rating: ratingPoint?.avg_rating || 0,
          review_count: ratingPoint?.review_count || 0,
          city_avg_rating: comparisonPoint?.avg_rating || 0,
          category_avg_rating: categoryPoint?.avg_rating || 0,
        };
      }),
    };
  }, [ratingsData, comparisonRatingsData, categoryRatingsData]);

  // Determine which comparison data to use: neighborhood if selected, otherwise city
  const comparisonSentimentData = selectedNeighborhood && business ? neighborhoodSentimentData : citySentimentData;

  const mergedSentimentData = useMemo(() => {
    if (!sentimentData?.data) return null;

    // Get all unique periods from both datasets
    const allPeriods = new Set<string>();
    sentimentData.data.forEach(p => allPeriods.add(p.period_start));
    comparisonSentimentData?.data?.forEach(p => allPeriods.add(p.period_start));
    categorySentimentData?.data?.forEach(p => allPeriods.add(p.period_start));

    const sortedPeriods = Array.from(allPeriods).sort();

    return {
      ...sentimentData,
      data: sortedPeriods.map((period) => {
        const sentimentPoint = sentimentData.data.find(p => p.period_start === period);
        const comparisonPoint = comparisonSentimentData?.data?.find(p => p.period_start === period);
        const categoryPoint = categorySentimentData?.data?.find(p => p.period_start === period);

        return {
          period_start: period,
          avg_sentiment_score: sentimentPoint?.avg_sentiment_score || 0,
          review_count: sentimentPoint?.review_count || 0,
          city_avg_sentiment_score: comparisonPoint?.avg_sentiment_score || 0,
          category_avg_sentiment_score: categoryPoint?.avg_sentiment_score || 0,
        };
      }),
    };
  }, [sentimentData, comparisonSentimentData, categorySentimentData]);

  // Calculate shared x-axis domain for both charts
  const sharedXAxisDomain = useMemo(() => {
    const allPeriods: string[] = [];

    if (mergedRatingsData?.data) {
      allPeriods.push(...mergedRatingsData.data.map(d => d.period_start));
    }
    if (mergedSentimentData?.data) {
      allPeriods.push(...mergedSentimentData.data.map(d => d.period_start));
    }

    if (allPeriods.length === 0) return null;

    const sortedPeriods = allPeriods.sort();
    return [sortedPeriods[0], sortedPeriods[sortedPeriods.length - 1]];
  }, [mergedRatingsData, mergedSentimentData]);

  const periodReviewCount = useMemo(() => {
    if (!ratingsData?.data) return 0;
    return ratingsData.data.reduce((sum, point) => sum + (point.review_count || 0), 0);
  }, [ratingsData]);

  const periodSentimentReviewCount = useMemo(() => {
    if (!sentimentData?.data) return 0;
    return sentimentData.data.reduce((sum, point) => sum + (point.review_count || 0), 0);
  }, [sentimentData]);

  const ratingTrend: TrendAnalysis | null = useMemo(() => {
    if (!mergedRatingsData?.data) return null;
    return calculateTrend(mergedRatingsData.data, 'avg_rating', 3);
  }, [mergedRatingsData]);

  const sentimentTrend: TrendAnalysis | null = useMemo(() => {
    if (!mergedSentimentData?.data) return null;
    return calculateTrend(mergedSentimentData.data, 'avg_sentiment_score', 3);
  }, [mergedSentimentData]);

  const ratingCompetitivePosition: CompetitivePosition | null = useMemo(() => {
    if (!mergedRatingsData?.data || !comparisonRatingsData?.data) return null;
    return calculateCompetitivePosition(
      mergedRatingsData.data,
      comparisonRatingsData.data,
      'avg_rating'
    );
  }, [mergedRatingsData, comparisonRatingsData]);

  const sentimentCompetitivePosition: CompetitivePosition | null = useMemo(() => {
    if (!mergedSentimentData?.data || !comparisonSentimentData?.data) return null;
    return calculateCompetitivePosition(
      mergedSentimentData.data,
      comparisonSentimentData.data,
      'avg_sentiment_score'
    );
  }, [mergedSentimentData, comparisonSentimentData]);

  const ratingInsight = useMemo(() => {
    return generateRatingInsight(
      business?.name || null,
      selectedCity || null,
      selectedCategory || null,
      ratingTrend,
      ratingCompetitivePosition
    );
  }, [business, selectedCity, selectedCategory, ratingTrend, ratingCompetitivePosition]);

  const sentimentInsight = useMemo(() => {
    return generateSentimentInsight(
      business?.name || null,
      selectedCity || null,
      selectedCategory || null,
      sentimentTrend,
      sentimentCompetitivePosition
    );
  }, [business, selectedCity, selectedCategory, sentimentTrend, sentimentCompetitivePosition]);

  // Determine which review count to display based on available data and mode
  // MUST be before any early returns to maintain hook order!
  const displayReviewCount = useMemo(() => {
    // If showing only sentiment, use sentiment review count
    if (isSentimentOnly && periodSentimentReviewCount > 0) {
      return periodSentimentReviewCount;
    }
    // If showing only ratings, use ratings review count
    if (isRatingsOnly && periodReviewCount > 0) {
      return periodReviewCount;
    }
    // If showing both, use the maximum (they should be the same if from same business/periods)
    const maxCount = Math.max(periodReviewCount, periodSentimentReviewCount);
    return maxCount > 0 ? maxCount : business?.review_count || 0;
  }, [periodReviewCount, periodSentimentReviewCount, business, isRatingsOnly, isSentimentOnly]);

  if (!business && !selectedCity && !selectedCategory) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: CHART_COLORS.textMuted,
          background: 'linear-gradient(135deg, #0d2d7a 0%, #1a3a6e 100%)',
          borderRadius: '8px',
        }}
      >
        Select a city, category, or business to view performance trends and competitive analysis
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        {business && (
          <p style={{ margin: 0, color: CHART_COLORS.textSecondary, fontSize: '0.9rem' }}>
            {business.city}, {business.state} • ★ {business.stars} ({displayReviewCount.toLocaleString()} reviews)
          </p>
        )}
        {!business && (selectedCity || selectedNeighborhood) && (
          <p style={{ margin: 0, color: CHART_COLORS.textSecondary, fontSize: '0.9rem' }}>
            {selectedNeighborhood
              ? (selectedCategory ? `${selectedCategory} in ${selectedNeighborhood.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}, ${selectedCity}` : `${selectedNeighborhood.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}, ${selectedCity}`)
              : (selectedCategory ? `${selectedCategory} in ${selectedCity}, ${selectedState}` : `${selectedCity}, ${selectedState}`)}
          </p>
        )}
        {!business && !selectedCity && selectedCategory && (
          <p style={{ margin: 0, color: CHART_COLORS.textSecondary, fontSize: '0.9rem' }}>
            Category average trends
          </p>
        )}
      </div>

      {isLoading && (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: CHART_COLORS.textMuted,
            background: 'linear-gradient(135deg, #0a1529ff 0%, #0a1529ff 100%)',
            borderRadius: '8px',
          }}
        >
          Loading time series data...
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '1rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            color: '#ef4444',
            marginBottom: '1rem',
          }}
        >
          Error: {error.message || 'Failed to load time series data'}
        </div>
      )}

      {!isLoading && !error && (mergedRatingsData || mergedSentimentData) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {!isSentimentOnly && mergedRatingsData && mergedRatingsData.data.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1.15rem', fontWeight: 700, color: CHART_COLORS.textPrimary }}>
                  {ratingInsight.title}
                </h4>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {ratingTrend && <TrendIndicator trend={ratingTrend} metric="rating" />}
                  {business && ratingCompetitivePosition && (
                    <CompetitivePositionBadge
                      position={ratingCompetitivePosition}
                      comparisonType={selectedNeighborhood ? "neighborhood" : "city"}
                      comparisonName={selectedNeighborhood ? selectedNeighborhood.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : business.city}
                    />
                  )}
                </div>
              </div>

              <div style={{ ...CARD_STYLE, padding: '1rem' }}>
                <ResponsiveContainer width="100%" height={CHART_CONFIG.height}>
                  <ComposedChart
                    data={mergedRatingsData.data}
                    margin={CHART_CONFIG.margin}
                    style={{ backgroundColor: CARD_STYLE.background }}
                    aria-label={ratingInsight.ariaLabel}
                  >
                    <CartesianGrid
                      stroke={CHART_COLORS.gridlines}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="period_start"
                      stroke={CHART_COLORS.textPrimary}
                      style={{ fontSize: '13px' }}
                      tick={{ fill: CHART_COLORS.textPrimary }}
                      tickFormatter={(value) => formatDateForPeriod(value, period)}
                      angle={CHART_CONFIG.xAxisAngle}
                      textAnchor={CHART_CONFIG.xAxisTextAnchor}
                      height={50}
                      domain={sharedXAxisDomain || ['auto', 'auto']}
                      interval="preserveStartEnd"
                      minTickGap={30}
                    />
                    <YAxis
                      yAxisId="left"
                      stroke={CHART_COLORS.textPrimary}
                      style={{ fontSize: '13px' }}
                      tick={{ fill: CHART_COLORS.textPrimary }}
                      domain={CHART_CONFIG.ratingDomain}
                      ticks={CHART_CONFIG.ratingTicks}
                      width={45}
                      type="number"
                      label={{ value: 'Star Rating', angle: -90, position: 'insideLeft', style: { fill: CHART_COLORS.textPrimary, fontSize: '13px' } }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke={CHART_COLORS.textSecondary}
                      style={{ fontSize: '12px' }}
                      tick={{ fill: CHART_COLORS.textSecondary }}
                      width={40}
                      label={{ value: 'Reviews', angle: 90, position: 'insideRight', style: { fill: CHART_COLORS.textSecondary, fontSize: '12px' } }}
                    />

                    <Tooltip
                      content={
                        <EnhancedTooltip
                          data={mergedRatingsData.data}
                          metric="avg_rating"
                          period={period}
                        />
                      }
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      wrapperStyle={{
                        paddingTop: '16px',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: CHART_COLORS.textPrimary,
                      }}
                      iconSize={12}
                      iconType="circle"
                    />

                    <Bar
                      yAxisId="right"
                      dataKey="review_count"
                      fill={CHART_COLORS.volumeBars}
                      radius={[4, 4, 0, 0]}
                      name="Review Volume"
                      isAnimationActive={false}
                    />

                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="avg_rating"
                      stroke={CHART_COLORS.business}
                      strokeWidth={LINE_STYLES.business.strokeWidth}
                      dot={false}
                      activeDot={{ r: 6 }}
                      name={business ? business.name : selectedNeighborhood ? `${selectedNeighborhood.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Avg` : selectedCity ? "City Avg Rating" : `${selectedCategory} Avg`}
                      isAnimationActive={false}
                    />
                    {business && (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="city_avg_rating"
                        stroke={CHART_COLORS.city}
                        strokeWidth={LINE_STYLES.city.strokeWidth}
                        strokeDasharray={LINE_STYLES.city.strokeDasharray}
                        strokeOpacity={LINE_STYLES.city.opacity}
                        dot={false}
                        activeDot={{ r: 6 }}
                        name={selectedNeighborhood ? `${selectedNeighborhood.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Avg` : `${business.city} Avg`}
                        isAnimationActive={false}
                      />
                    )}
                    {categoryRatingsData && (
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="category_avg_rating"
                        stroke={CHART_COLORS.category}
                        strokeWidth={LINE_STYLES.category.strokeWidth}
                        strokeDasharray={LINE_STYLES.category.strokeDasharray}
                        strokeOpacity={LINE_STYLES.category.opacity}
                        dot={false}
                        activeDot={{ r: 6 }}
                        name={selectedCategory ? `${selectedCategory} in ${selectedCity}` : `${primaryCategory} Avg`}
                        isAnimationActive={false}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {!isRatingsOnly && mergedSentimentData && mergedSentimentData.data.length > 0 && (
            <div>
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1.15rem', fontWeight: 700, color: CHART_COLORS.textPrimary }}>
                  {sentimentInsight.title}
                </h4>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {sentimentTrend && <TrendIndicator trend={sentimentTrend} metric="sentiment" />}
                  {business && sentimentCompetitivePosition && (
                    <CompetitivePositionBadge
                      position={sentimentCompetitivePosition}
                      comparisonType={selectedNeighborhood ? "neighborhood" : "city"}
                      comparisonName={selectedNeighborhood ? selectedNeighborhood.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : business.city}
                    />
                  )}
                </div>
              </div>

              <div style={{ ...CARD_STYLE, padding: '1rem' }}>
                <ResponsiveContainer width="100%" height={CHART_CONFIG.height}>
                  <ComposedChart
                    data={mergedSentimentData.data}
                    margin={CHART_CONFIG.margin}
                    style={{ backgroundColor: CARD_STYLE.background }}
                    aria-label={sentimentInsight.ariaLabel}
                  >
                    <CartesianGrid
                      stroke={CHART_COLORS.gridlines}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="period_start"
                      stroke={CHART_COLORS.textPrimary}
                      style={{ fontSize: '13px' }}
                      tick={{ fill: CHART_COLORS.textPrimary }}
                      tickFormatter={(value) => formatDateForPeriod(value, period)}
                      angle={CHART_CONFIG.xAxisAngle}
                      textAnchor={CHART_CONFIG.xAxisTextAnchor}
                      height={50}
                      domain={sharedXAxisDomain || ['auto', 'auto']}
                      interval="preserveStartEnd"
                      minTickGap={30}
                    />
                    <YAxis
                      stroke={CHART_COLORS.textPrimary}
                      style={{ fontSize: '13px' }}
                      tick={{ fill: CHART_COLORS.textPrimary }}
                      domain={CHART_CONFIG.sentimentDomain}
                      ticks={CHART_CONFIG.sentimentTicks}
                      width={45}
                      tickFormatter={(value) => value.toFixed(1)}
                      type="number"
                      allowDecimals={true}
                      label={{ value: 'Sentiment', angle: -90, position: 'insideLeft', style: { fill: CHART_COLORS.textPrimary, fontSize: '13px' } }}
                    />

                    <Tooltip
                      content={
                        <EnhancedTooltip
                          data={mergedSentimentData.data}
                          metric="avg_sentiment_score"
                          period={period}
                        />
                      }
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      wrapperStyle={{
                        paddingTop: '16px',
                        fontSize: '13px',
                        fontWeight: 500,
                        color: CHART_COLORS.textPrimary,
                      }}
                      iconSize={12}
                      iconType="circle"
                    />

                    <Line
                      type="monotone"
                      dataKey="avg_sentiment_score"
                      stroke={CHART_COLORS.business}
                      strokeWidth={LINE_STYLES.business.strokeWidth}
                      dot={false}
                      activeDot={{ r: 6 }}
                      name={business ? business.name : selectedNeighborhood ? `${selectedNeighborhood.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Sentiment` : selectedCity ? "City Avg Sentiment" : `${selectedCategory} Sentiment Avg`}
                      isAnimationActive={false}
                    />
                    {business && (
                      <Line
                        type="monotone"
                        dataKey="city_avg_sentiment_score"
                        stroke={CHART_COLORS.city}
                        strokeWidth={LINE_STYLES.city.strokeWidth}
                        strokeDasharray={LINE_STYLES.city.strokeDasharray}
                        strokeOpacity={LINE_STYLES.city.opacity}
                        dot={false}
                        activeDot={{ r: 6 }}
                        name={selectedNeighborhood ? `${selectedNeighborhood.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Sentiment Avg` : `${business.city} Sentiment Avg`}
                        isAnimationActive={false}
                      />
                    )}
                    {categorySentimentData && (
                      <Line
                        type="monotone"
                        dataKey="category_avg_sentiment_score"
                        stroke={CHART_COLORS.category}
                        strokeWidth={LINE_STYLES.category.strokeWidth}
                        strokeDasharray={LINE_STYLES.category.strokeDasharray}
                        strokeOpacity={LINE_STYLES.category.opacity}
                        dot={false}
                        activeDot={{ r: 6 }}
                        name={selectedCategory ? `${selectedCategory} in ${selectedCity}` : `${primaryCategory} Sentiment Avg`}
                        isAnimationActive={false}
                      />
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && !mergedRatingsData && !mergedSentimentData && !error && (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: CHART_COLORS.textMuted,
            background: 'linear-gradient(135deg, #0d2d7a 0%, #1a3a6e 100%)',
            borderRadius: '8px',
          }}
        >
          No time series data available
        </div>
      )}
    </div>
  );
};

export default TimeSeriesChartOptimized;
