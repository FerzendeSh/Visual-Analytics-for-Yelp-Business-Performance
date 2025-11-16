/**
 * Optimized TimeSeriesChart Component
 * Accepts pre-fetched data as props instead of fetching internally
 * This allows data sharing between multiple chart instances
 */
import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import { Business } from '../../api';
import {
  RatingsTimeline,
  SentimentTimeline,
} from '../../api/endpoints/analytics';

// Date formatting utility
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
  primaryCategory?: string;
  isRatingsOnly?: boolean;
  isSentimentOnly?: boolean;
  period?: 'month' | 'year';
  ratingsData?: RatingsTimeline | null;
  sentimentData?: SentimentTimeline | null;
  cityRatingsData?: RatingsTimeline | null;
  citySentimentData?: SentimentTimeline | null;
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
  primaryCategory = '',
  isRatingsOnly = false,
  isSentimentOnly = false,
  period = 'year',
  ratingsData,
  sentimentData,
  cityRatingsData,
  citySentimentData,
  categoryRatingsData,
  categorySentimentData,
  isLoading = false,
  error = null,
}) => {
  // Merge comparison data into main data
  const mergedRatingsData = useMemo(() => {
    if (!ratingsData?.data) return null;

    return {
      ...ratingsData,
      data: ratingsData.data.map((point) => {
        const cityPoint = cityRatingsData?.data?.find(
          (cp) => cp.period_start === point.period_start
        );
        const categoryPoint = categoryRatingsData?.data?.find(
          (cp) => cp.period_start === point.period_start
        );
        return {
          ...point,
          city_avg_rating: cityPoint?.avg_rating || 0,
          category_avg_rating: categoryPoint?.avg_rating || 0,
        };
      }),
    };
  }, [ratingsData, cityRatingsData, categoryRatingsData]);

  const mergedSentimentData = useMemo(() => {
    if (!sentimentData?.data) return null;

    return {
      ...sentimentData,
      data: sentimentData.data.map((point) => {
        const cityPoint = citySentimentData?.data?.find(
          (cp) => cp.period_start === point.period_start
        );
        const categoryPoint = categorySentimentData?.data?.find(
          (cp) => cp.period_start === point.period_start
        );
        return {
          ...point,
          city_avg_sentiment_score: cityPoint?.avg_sentiment_score || 0,
          category_avg_sentiment_score: categoryPoint?.avg_sentiment_score || 0,
        };
      }),
    };
  }, [sentimentData, citySentimentData, categorySentimentData]);

  // Calculate total reviews
  const periodReviewCount = useMemo(() => {
    if (!ratingsData?.data) return 0;
    return ratingsData.data.reduce((sum, point) => sum + (point.review_count || 0), 0);
  }, [ratingsData]);

  // Show empty state
  if (!business && !selectedCity && !selectedCategory) {
    return (
      <div
        style={{
          padding: '2rem',
          textAlign: 'center',
          color: '#aaccff',
          background: 'linear-gradient(135deg, #0d2d7a 0%, #1a3a6e 100%)',
          borderRadius: '8px',
        }}
      >
        Select a city, category, or business to view time-series data
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>
          {business ? business.name : selectedCity ? `${selectedCity}, ${selectedState}` : selectedCategory}
        </h3>
        {business && (
          <p style={{ margin: 0, color: '#d2d2d4ff', fontSize: '0.9rem' }}>
            {business.city}, {business.state} • ★ {business.stars} ({periodReviewCount > 0 ? periodReviewCount : business.review_count} reviews)
          </p>
        )}
        {!business && selectedCity && (
          <p style={{ margin: 0, color: '#d2d2d4ff', fontSize: '0.9rem' }}>
            {selectedCategory ? `${selectedCategory} in ${selectedCity}, ${selectedState}` : `${selectedCity}, ${selectedState}`}
          </p>
        )}
        {!business && !selectedCity && selectedCategory && (
          <p style={{ margin: 0, color: '#d2d2d4ff', fontSize: '0.9rem' }}>
            Category average trends
          </p>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: '#aaccff',
            background: 'linear-gradient(135deg, #0a1529ff 0%, #0a1529ff 100%)',
            borderRadius: '8px',
          }}
        >
          Loading time series data...
        </div>
      )}

      {/* Error State */}
      {error && (
        <div
          style={{
            padding: '1rem',
            background: 'rgba(255, 255, 255, 0.2)',
            border: '1px solid #5588ff',
            borderRadius: '8px',
            color: '#88bbff',
            marginBottom: '1rem',
          }}
        >
          Error: {error.message || 'Failed to load time series data'}
        </div>
      )}

      {/* Charts */}
      {!isLoading && !error && (mergedRatingsData || mergedSentimentData) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {/* Ratings Timeline Chart */}
          {!isSentimentOnly && mergedRatingsData && mergedRatingsData.data.length > 0 && (
            <div style={{ padding: '1rem', backgroundColor: '#0f1b2a', borderRadius: '16px', marginBottom: '1rem', border: '1px solid rgba(102, 126, 234, 0.25)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(102, 126, 234, 0.15)' }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={mergedRatingsData.data}
                  margin={{ top: 5, right: 30, left: 15, bottom: 50 }}
                  style={{ backgroundColor: '#0f1b2a' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(102, 126, 234, 0.15)" />
                  <XAxis
                    dataKey="period_start"
                    stroke="#eeeef0ff"
                    style={{ fontSize: '12px' }}
                    tick={{ fill: '#eeeef0ff' }}
                    tickFormatter={(value) => formatDateForPeriod(value, period)}
                    angle={-55}
                    textAnchor="end"
                    height={10}
                    interval={Math.floor(mergedRatingsData.data.length / 6) || 0}
                  />
                  <YAxis
                    stroke="#eeeef0ff"
                    style={{ fontSize: '12px' }}
                    tick={{ fill: '#eeeef0ff' }}
                    domain={[1, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    width={15}
                    type="number"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#515152ff',
                      border: '1px solid #090253ff',
                      borderRadius: '4px',
                    }}
                    labelStyle={{ color: '#eeeef0ff' }}
                    formatter={(value: any) => {
                      if (typeof value === 'number') {
                        return value.toFixed(2);
                      }
                      return value;
                    }}
                    labelFormatter={(label) => formatDateForPeriod(label, period)}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    wrapperStyle={{ paddingBottom: '10px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg_rating"
                    stroke="#00d4ff"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                    name={business ? business.name : selectedCity ? "City Average Rating" : `${selectedCategory} Average`}
                    isAnimationActive={false}
                  />
                  {business && (
                    <Line
                      type="monotone"
                      dataKey="city_avg_rating"
                      stroke="#b819e8ff"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={{ r: 6 }}
                      name={`${business.city} Average`}
                      isAnimationActive={false}
                    />
                  )}
                  {primaryCategory && business && (
                    <Line
                      type="monotone"
                      dataKey="category_avg_rating"
                      stroke="#ff1493ff"
                      strokeWidth={2}
                      strokeDasharray="8 4"
                      dot={false}
                      activeDot={{ r: 6 }}
                      name={`${primaryCategory} Average`}
                      isAnimationActive={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Sentiment Timeline Chart */}
          {!isRatingsOnly && mergedSentimentData && mergedSentimentData.data.length > 0 && (
            <div style={{ padding: '1rem', backgroundColor: '#0f1b2a', borderRadius: '16px', border: '1px solid rgba(102, 126, 234, 0.25)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(102, 126, 234, 0.15)' }}>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart
                  data={mergedSentimentData.data}
                  margin={{ top: 10, right: 30, left: 15, bottom: 50 }}
                  style={{ backgroundColor: '#0f1b2a' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(102, 126, 234, 0.15)" />
                  <XAxis
                    dataKey="period_start"
                    stroke="#eeeef0ff"
                    style={{ fontSize: '12px' }}
                    tick={{ fill: '#eeeef0ff' }}
                    tickFormatter={(value) => formatDateForPeriod(value, period)}
                    angle={-55}
                    textAnchor="end"
                    height={10}
                    interval={Math.floor(mergedSentimentData.data.length / 6) || 0}
                  />
                  <YAxis
                    stroke="#eeeef0ff"
                    style={{ fontSize: '12px' }}
                    tick={{ fill: '#eeeef0ff' }}
                    domain={[-1, 1]}
                    ticks={[-1, -0.5, 0, 0.5, 1]}
                    width={15}
                    tickFormatter={(value) => value.toFixed(1)}
                    type="number"
                    allowDecimals={true}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#515152ff',
                      border: '1px solid #090253ff',
                      borderRadius: '4px',
                    }}
                    labelStyle={{ color: '#eeeef0ff' }}
                    formatter={(value: any) => {
                      if (typeof value === 'number') {
                        return value.toFixed(3);
                      }
                      return value;
                    }}
                    labelFormatter={(label) => formatDateForPeriod(label, period)}
                  />
                  <Legend
                    verticalAlign="top"
                    height={36}
                    wrapperStyle={{ paddingBottom: '10px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="avg_sentiment_score"
                    stroke="#ff6633"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 6 }}
                    name={business ? business.name : selectedCity ? "City Average Sentiment" : `${selectedCategory} Sentiment Average`}
                    isAnimationActive={false}
                  />
                  {business && (
                    <Line
                      type="monotone"
                      dataKey="city_avg_sentiment_score"
                      stroke="#ffa500"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={{ r: 6 }}
                      name={`${business.city} Sentiment Average`}
                      isAnimationActive={false}
                    />
                  )}
                  {primaryCategory && business && (
                    <Line
                      type="monotone"
                      dataKey="category_avg_sentiment_score"
                      stroke="#00d4ff"
                      strokeWidth={2}
                      strokeDasharray="8 4"
                      dot={false}
                      activeDot={{ r: 6 }}
                      name={`${primaryCategory} Sentiment Average`}
                      isAnimationActive={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* No Data State */}
      {!isLoading && !mergedRatingsData && !mergedSentimentData && !error && (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: '#aaccff',
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
