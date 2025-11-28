import React, { useMemo, memo } from 'react';
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

import { CHART_COLORS, LINE_STYLES, CHART_CONFIG, COMPARISON_COLORS } from './chartConstants';
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
import { formatDateForPeriod, createLookupMap } from '../../utils';
import './TimeSeriesChart.css';

// Get color and stroke style for comparison business by index
function getComparisonBusinessColor(index: number): { color: string; opacity: number; strokeWidth: number; strokeDasharray: string | undefined } {
  const style = LINE_STYLES.comparison[index % LINE_STYLES.comparison.length];
  return {
    color: COMPARISON_COLORS[index % COMPARISON_COLORS.length],
    opacity: 0.85,
    strokeWidth: style.strokeWidth,
    strokeDasharray: style.strokeDasharray,
  };
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
  comparisonBusinesses?: Business[];
  comparisonRatingsDataArray?: (RatingsTimeline | null)[];
  comparisonSentimentDataArray?: (SentimentTimeline | null)[];
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
  comparisonBusinesses = [],
  comparisonRatingsDataArray = [],
  comparisonSentimentDataArray = [],
}) => {
  // Determine which comparison data to use: neighborhood if selected, otherwise city
  const comparisonRatingsData = selectedNeighborhood ? neighborhoodRatingsData : cityRatingsData;

  // Extended data point type for merged data with comparison fields
  interface MergedRatingsDataPoint {
    period_start: string;
    avg_rating: number;
    review_count: number;
    city_avg_rating: number;
    category_avg_rating: number;
    [key: string]: number | string; // For dynamic comparison fields
  }

  const mergedRatingsData = useMemo(() => {
    if (!ratingsData?.data) return null;

    // Create lookup maps for O(1) access instead of O(n) .find() calls
    const ratingsMap = createLookupMap(ratingsData.data, p => p.period_start);
    const comparisonMap = createLookupMap(comparisonRatingsData?.data, p => p.period_start);
    const categoryMap = createLookupMap(categoryRatingsData?.data, p => p.period_start);
    const comparisonMaps = comparisonRatingsDataArray?.map(data => 
      createLookupMap(data?.data, p => p.period_start)
    ) || [];

    // Get all unique periods from all datasets
    const allPeriods = new Set<string>();
    ratingsData.data.forEach(p => allPeriods.add(p.period_start));
    comparisonRatingsData?.data?.forEach(p => allPeriods.add(p.period_start));
    categoryRatingsData?.data?.forEach(p => allPeriods.add(p.period_start));
    comparisonRatingsDataArray?.forEach(data => {
      data?.data?.forEach(p => allPeriods.add(p.period_start));
    });

    const sortedPeriods = Array.from(allPeriods).sort();

    return {
      ...ratingsData,
      data: sortedPeriods.map((periodKey): MergedRatingsDataPoint => {
        const ratingPoint = ratingsMap.get(periodKey);
        const comparisonPoint = comparisonMap.get(periodKey);
        const categoryPoint = categoryMap.get(periodKey);

        const dataPoint: MergedRatingsDataPoint = {
          period_start: periodKey,
          avg_rating: ratingPoint?.avg_rating || 0,
          review_count: ratingPoint?.review_count || 0,
          city_avg_rating: comparisonPoint?.avg_rating || 0,
          category_avg_rating: categoryPoint?.avg_rating || 0,
        };

        // Add comparison business ratings using O(1) map lookups
        comparisonMaps.forEach((map, index) => {
          const point = map.get(periodKey);
          dataPoint[`comparison_${index}_avg_rating`] = point?.avg_rating || 0;
          dataPoint[`comparison_${index}_review_count`] = point?.review_count || 0;
        });

        return dataPoint;
      }),
    };
  }, [ratingsData, comparisonRatingsData, categoryRatingsData, comparisonRatingsDataArray]);

  // Determine which comparison data to use: neighborhood if selected, otherwise city
  const comparisonSentimentData = selectedNeighborhood ? neighborhoodSentimentData : citySentimentData;

  // Extended data point type for merged sentiment data with comparison fields
  interface MergedSentimentDataPoint {
    period_start: string;
    avg_sentiment_score: number;
    review_count: number;
    city_avg_sentiment_score: number;
    category_avg_sentiment_score: number;
    [key: string]: number | string; // For dynamic comparison fields
  }

  const mergedSentimentData = useMemo(() => {
    if (!sentimentData?.data) return null;

    // Create lookup maps for O(1) access instead of O(n) .find() calls
    const sentimentMap = createLookupMap(sentimentData.data, p => p.period_start);
    const comparisonMap = createLookupMap(comparisonSentimentData?.data, p => p.period_start);
    const categoryMap = createLookupMap(categorySentimentData?.data, p => p.period_start);
    const comparisonMaps = comparisonSentimentDataArray?.map(data => 
      createLookupMap(data?.data, p => p.period_start)
    ) || [];

    // Get all unique periods from all datasets
    const allPeriods = new Set<string>();
    sentimentData.data.forEach(p => allPeriods.add(p.period_start));
    comparisonSentimentData?.data?.forEach(p => allPeriods.add(p.period_start));
    categorySentimentData?.data?.forEach(p => allPeriods.add(p.period_start));
    comparisonSentimentDataArray?.forEach(data => {
      data?.data?.forEach(p => allPeriods.add(p.period_start));
    });

    const sortedPeriods = Array.from(allPeriods).sort();

    return {
      ...sentimentData,
      data: sortedPeriods.map((periodKey): MergedSentimentDataPoint => {
        const sentimentPoint = sentimentMap.get(periodKey);
        const comparisonPoint = comparisonMap.get(periodKey);
        const categoryPoint = categoryMap.get(periodKey);

        const dataPoint: MergedSentimentDataPoint = {
          period_start: periodKey,
          avg_sentiment_score: sentimentPoint?.avg_sentiment_score || 0,
          review_count: sentimentPoint?.review_count || 0,
          city_avg_sentiment_score: comparisonPoint?.avg_sentiment_score || 0,
          category_avg_sentiment_score: categoryPoint?.avg_sentiment_score || 0,
        };

        // Add comparison business sentiment scores using O(1) map lookups
        comparisonMaps.forEach((map, index) => {
          const point = map.get(periodKey);
          dataPoint[`comparison_${index}_avg_sentiment_score`] = point?.avg_sentiment_score || 0;
          dataPoint[`comparison_${index}_review_count`] = point?.review_count || 0;
        });

        return dataPoint;
      }),
    };
  }, [sentimentData, comparisonSentimentData, categorySentimentData, comparisonSentimentDataArray]);

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
      <div className="empty-state">
        <p>Select a city, category, or business to view performance trends and competitive analysis</p>
      </div>
    );
  }

  return (
    <div className="timeseries-chart">
      <div className="timeseries-chart__info">
        {business && (
          <p className="timeseries-chart__subtitle">
            {business.city}, {business.state} • ★ {business.stars} ({displayReviewCount.toLocaleString()} reviews)
          </p>
        )}
        {!business && (selectedCity || selectedNeighborhood) && (
          <p className="timeseries-chart__subtitle">
            {selectedNeighborhood
              ? (selectedCategory ? `${selectedCategory} in ${selectedNeighborhood.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}, ${selectedCity}` : `${selectedNeighborhood.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}, ${selectedCity}`)
              : (selectedCategory ? `${selectedCategory} in ${selectedCity}, ${selectedState}` : `${selectedCity}, ${selectedState}`)}
          </p>
        )}
        {!business && !selectedCity && selectedCategory && (
          <p className="timeseries-chart__subtitle">
            Category average trends
          </p>
        )}
      </div>

      {isLoading && (
        <div className="loading-state">
          Loading time series data...
        </div>
      )}

      {error && (
        <div className="error-state">
          Error: {error.message || 'Failed to load time series data'}
        </div>
      )}

      {!isLoading && !error && (mergedRatingsData || mergedSentimentData) && (
        <div className="timeseries-chart__content">
          {!isSentimentOnly && mergedRatingsData && mergedRatingsData.data.length > 0 && (
            <div className="timeseries-chart__section">
              <div className="timeseries-chart__header">
                <h4 className="timeseries-chart__title">
                  {ratingInsight.title}
                </h4>
                <div className="timeseries-chart__badges">
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

              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={mergedRatingsData.data}
                    margin={CHART_CONFIG.margin}
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
                      iconType="plainline"
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
                        name={selectedNeighborhood ? `${selectedNeighborhood.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Avg` : `${selectedCity || business.city} Avg`}
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
                    {comparisonBusinesses.map((compBusiness, index) => {
                      const colorInfo = getComparisonBusinessColor(index);
                      return (
                        <Line
                          key={`comparison-rating-${index}`}
                          yAxisId="left"
                          type="monotone"
                          dataKey={`comparison_${index}_avg_rating`}
                          stroke={colorInfo.color}
                          strokeWidth={colorInfo.strokeWidth}
                          strokeDasharray={colorInfo.strokeDasharray}
                          strokeOpacity={colorInfo.opacity}
                          dot={false}
                          activeDot={{ r: 6 }}
                          name={compBusiness.name}
                          isAnimationActive={false}
                        />
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {!isRatingsOnly && mergedSentimentData && mergedSentimentData.data.length > 0 && (
            <div className="timeseries-chart__section">
              <div className="timeseries-chart__header">
                <h4 className="timeseries-chart__title">
                  {sentimentInsight.title}
                </h4>
                <div className="timeseries-chart__badges">
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

              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={mergedSentimentData.data}
                    margin={CHART_CONFIG.margin}
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
                      iconType="plainline"
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
                        name={selectedNeighborhood ? `${selectedNeighborhood.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')} Sentiment Avg` : `${selectedCity || business.city} Sentiment Avg`}
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
                    {comparisonBusinesses.map((compBusiness, index) => {
                      const colorInfo = getComparisonBusinessColor(index);
                      return (
                        <Line
                          key={`comparison-sentiment-${index}`}
                          type="monotone"
                          dataKey={`comparison_${index}_avg_sentiment_score`}
                          stroke={colorInfo.color}
                          strokeWidth={colorInfo.strokeWidth}
                          strokeDasharray={colorInfo.strokeDasharray}
                          strokeOpacity={colorInfo.opacity}
                          dot={false}
                          activeDot={{ r: 6 }}
                          name={compBusiness.name}
                          isAnimationActive={false}
                        />
                      );
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {!isLoading && !mergedRatingsData && !mergedSentimentData && !error && (
        <div className="empty-state">
          <p>No time series data available</p>
        </div>
      )}
    </div>
  );
};

export default memo(TimeSeriesChartOptimized);
