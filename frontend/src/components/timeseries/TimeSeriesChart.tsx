import React, { useState, useEffect } from 'react';
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
  getBusinessRatingsTimeline,
  getBusinessSentimentTimeline,
  RatingsTimeline,
  SentimentTimeline,
  TimeSeriesDataPoint,
} from '../../api/endpoints/analytics';

// Date formatting utility for human-readable x-axis labels
function formatDateForPeriod(dateString: string, period: 'month' | 'year'): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString; // Fallback if date parsing fails
    }

    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();

    switch (period) {
      case 'month':
        // Format: "Jan" (month name only when viewing monthly data within a year)
        return month;
      case 'year':
        // Format: "2024"
        return `${year}`;
      default:
        return dateString;
    }
  } catch {
    return dateString;
  }
}

interface TimeSeriesChartProps {
  business: Business | null;
  isRatingsOnly?: boolean;
  isSentimentOnly?: boolean;
  period?: 'month' | 'year';
  selectedYear?: number;
}

const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  business,
  isRatingsOnly = false,
  isSentimentOnly = false,
  period = 'year',
  selectedYear
}) => {
  const [ratingsData, setRatingsData] = useState<RatingsTimeline | null>(null);
  const [sentimentData, setSentimentData] = useState<SentimentTimeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodReviewCount, setPeriodReviewCount] = useState<number>(0);

  useEffect(() => {
    if (!business?.business_id) {
      setRatingsData(null);
      setSentimentData(null);
      return;
    }

    const fetchTimeSeriesData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Calculate date range for monthly view
        let startDate: string | undefined;
        let endDate: string | undefined;

        if (period === 'month' && selectedYear) {
          startDate = `${selectedYear}-01-01`;
          endDate = `${selectedYear}-12-31`;
        }

        const [ratings, sentiment] = await Promise.all([
          getBusinessRatingsTimeline(business.business_id, period, startDate, endDate),
          getBusinessSentimentTimeline(business.business_id, period, startDate, endDate),
        ]);

        setRatingsData(ratings);
        setSentimentData(sentiment);

        // Calculate total reviews for the period
        const totalReviews = ratings.data.reduce((sum, point) => sum + (point.review_count || 0), 0);
        setPeriodReviewCount(totalReviews);
      } catch (err) {
        console.error('Error fetching time series data:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load time series data'
        );
      } finally {
        setLoading(false);
      }
    };

    fetchTimeSeriesData();
  }, [business?.business_id, period, selectedYear]);

  if (!business) {
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
        Select a business from the map to view its time-series data
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>
          {business.name}
        </h3>
        <p style={{ margin: 0, color: '#d2d2d4ff', fontSize: '0.9rem' }}>
          {business.city}, {business.state} • ★ {business.stars} ({periodReviewCount > 0 ? periodReviewCount : business.review_count} reviews)
        </p>
      </div>

      {loading && (
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
          Error: {error}
        </div>
      )}

      {!loading && !error && (ratingsData || sentimentData) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {/* Ratings Timeline Chart */}
          {!isSentimentOnly && ratingsData && ratingsData.data.length > 0 && (
            <div style={{ padding: '1rem', backgroundColor: '#0f1b2a', borderRadius: '16px', marginBottom: '1rem', border: '1px solid rgba(102, 126, 234, 0.25)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(102, 126, 234, 0.15)' }}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart
                  data={transformData(ratingsData.data)}
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
                    interval={Math.floor(ratingsData.data.length / 6) || 0}
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
                    name="Average Rating"
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Sentiment Timeline Chart */}
          {!isRatingsOnly && sentimentData && sentimentData.data.length > 0 && (
            <div style={{ padding: '1rem', backgroundColor: '#0f1b2a', borderRadius: '16px', border: '1px solid rgba(102, 126, 234, 0.25)', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(102, 126, 234, 0.15)' }}>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart
                  data={transformData(sentimentData.data)}
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
                    interval={Math.floor(sentimentData.data.length / 6) || 0}
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
                    name="Sentiment Score"
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {!loading && !ratingsData && !sentimentData && !error && (
        <div
          style={{
            padding: '2rem',
            textAlign: 'center',
            color: '#aaccff',
            background: 'linear-gradient(135deg, #0d2d7a 0%, #1a3a6e 100%)',
            borderRadius: '8px',
          }}
        >
          No time series data available for this business
        </div>
      )}
    </div>
  );
};

// Helper function to transform data for recharts
function transformData(data: TimeSeriesDataPoint[]) {
  return data.map((item) => ({
    period_start: item.period_start,
    avg_rating: item.avg_rating,
    avg_sentiment_score: item.avg_sentiment_score,
    avg_sentiment_expected: item.avg_sentiment_expected,
    review_count: item.review_count,
  }));
}

export default TimeSeriesChart;
