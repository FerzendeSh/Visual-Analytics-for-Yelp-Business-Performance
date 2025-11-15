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
  getCityRatingsTimeline,
  getCategoryRatingsTimeline,
  getCategorySentimentTimeline,
  getCitySentimentTimeline,
  RatingsTimeline,
  SentimentTimeline,
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

// Calculate filtered city average ratings based on applied filters
function calculateFilteredCityAverageRatings(
  businesses: Business[],
  selectedCity: string,
  selectedCategory: string,
  selectedRating: number | null,
  selectedStatus: number | null,
  period: 'month' | 'year',
  selectedYear?: number
): { [key: string]: { avg_rating: number; count: number } } {
  // Filter businesses based on current filters
  const filteredBusinesses = businesses.filter((b) => {
    const cityMatch = selectedCity ? b.city === selectedCity : true;
    const categoryMatch = selectedCategory
      ? b.categories?.toLowerCase().includes(selectedCategory.toLowerCase())
      : true;
    const ratingMatch = selectedRating ? b.stars === selectedRating : true;
    const statusMatch = selectedStatus !== null ? b.is_open === selectedStatus : true;

    return cityMatch && categoryMatch && ratingMatch && statusMatch;
  });

  // Group by date period and calculate averages
  const periodAverages: { [key: string]: { sum: number; count: number } } = {};

  // For demo purposes, we'll create synthetic data based on filtered businesses
  // In a real scenario, you'd want to fetch this from the API
  const startYear = selectedYear || new Date().getFullYear();

  if (period === 'month') {
    for (let month = 1; month <= 12; month++) {
      const monthStr = String(month).padStart(2, '0');
      const key = `${startYear}-${monthStr}-01`;

      const avgRating = filteredBusinesses.length > 0
        ? filteredBusinesses.reduce((sum, b) => sum + b.stars, 0) / filteredBusinesses.length
        : 0;

      periodAverages[key] = {
        sum: avgRating * filteredBusinesses.length,
        count: filteredBusinesses.length,
      };
    }
  } else {
    const key = `${startYear}-01-01`;
    const avgRating = filteredBusinesses.length > 0
      ? filteredBusinesses.reduce((sum, b) => sum + b.stars, 0) / filteredBusinesses.length
      : 0;

    periodAverages[key] = {
      sum: avgRating * filteredBusinesses.length,
      count: filteredBusinesses.length,
    };
  }

  // Convert to final format
  const result: { [key: string]: { avg_rating: number; count: number } } = {};
  for (const [key, data] of Object.entries(periodAverages)) {
    result[key] = {
      avg_rating: data.count > 0 ? data.sum / data.count : 0,
      count: data.count,
    };
  }

  return result;
}

interface TimeSeriesChartProps {
  business: Business | null;
  isRatingsOnly?: boolean;
  isSentimentOnly?: boolean;
  period?: 'month' | 'year';
  selectedYear?: number;
  selectedCity?: string;
  selectedState?: string;
  selectedCategory?: string;
  selectedRating?: number | null;
  selectedStatus?: number | null;
  businesses?: Business[];
}

const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({
  business,
  isRatingsOnly = false,
  isSentimentOnly = false,
  period = 'year',
  selectedYear,
  selectedCity = '',
  selectedState = '',
  selectedCategory = '',
  selectedRating = null,
  selectedStatus = null,
  businesses = []
}) => {
  const [ratingsData, setRatingsData] = useState<RatingsTimeline | null>(null);
  const [sentimentData, setSentimentData] = useState<SentimentTimeline | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periodReviewCount, setPeriodReviewCount] = useState<number>(0);
  const [primaryCategory, setPrimaryCategory] = useState<string>('');

  useEffect(() => {
    console.log('TimeSeriesChart useEffect triggered with:', { business: business?.business_id, selectedCity, selectedState, selectedCategory });
    // If business is selected, show business data with city and category comparison
    if (business?.business_id) {
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

          // Extract primary category (first category from comma-separated list)
          const primaryCat = business.categories ? business.categories.split(',')[0].trim() : null;
          setPrimaryCategory(primaryCat || '');

          const promises = [
            getBusinessRatingsTimeline(business.business_id, period, startDate, endDate),
            getBusinessSentimentTimeline(business.business_id, period, startDate, endDate),
            business.city && business.state ? getCityRatingsTimeline(business.city, business.state, period, startDate, endDate) : Promise.resolve(null),
            business.city && business.state ? getCitySentimentTimeline(business.city, business.state, period, startDate, endDate) : Promise.resolve(null),
            primaryCat ? getCategoryRatingsTimeline(primaryCat, period, startDate, endDate) : Promise.resolve(null),
            primaryCat ? getCategorySentimentTimeline(primaryCat, period, startDate, endDate) : Promise.resolve(null),
          ];

          const [ratings, sentiment, cityRatings, citySentiment, categoryRatings, categorySentiment] = await Promise.all(promises);

          console.log('Fetched data lengths:', {
            ratings: ratings?.data?.length || 0,
            sentiment: sentiment?.data?.length || 0,
            cityRatings: cityRatings?.data?.length || 0,
            citySentiment: citySentiment?.data?.length || 0,
            categoryRatings: categoryRatings?.data?.length || 0,
            categorySentiment: categorySentiment?.data?.length || 0,
          });

          // Calculate filtered city averages based on applied filters
          const filteredCityAverages = calculateFilteredCityAverageRatings(
            businesses,
            selectedCity,
            selectedCategory,
            selectedRating,
            selectedStatus,
            period as 'month' | 'year',
            selectedYear
          );

          // Merge city and category averages into ratings data for comparison
          if (ratings && ratings.data) {
            const mergedRatingsData = ratings.data.map((point) => {
              const cityPoint = cityRatings?.data.find(
                (cp) => cp.period_start === point.period_start
              );
              const categoryPoint = categoryRatings?.data.find(
                (cp) => cp.period_start === point.period_start
              );
              const filteredAvg = filteredCityAverages[point.period_start];
              return {
                ...point,
                city_avg_rating: cityPoint?.avg_rating || 0,
                category_avg_rating: categoryPoint?.avg_rating || 0,
                filtered_avg_rating: filteredAvg?.avg_rating || 0,
              };
            });
            setRatingsData({
              ...ratings,
              data: mergedRatingsData as any,
            });

            // Calculate total reviews for the period
            const totalReviews = ratings.data.reduce((sum, point) => sum + (point.review_count || 0), 0);
            setPeriodReviewCount(totalReviews);
          }

          // Merge city and category averages into sentiment data for comparison
          if (sentiment && sentiment.data) {
            const mergedSentimentData = sentiment.data.map((point) => {
              const cityPoint = citySentiment?.data.find(
                (cp) => cp.period_start === point.period_start
              );
              const categoryPoint = categorySentiment?.data.find(
                (cp) => cp.period_start === point.period_start
              );
              return {
                ...point,
                city_avg_sentiment_score: cityPoint?.avg_sentiment_score || 0,
                category_avg_sentiment_score: categoryPoint?.avg_sentiment_score || 0,
              };
            });
            setSentimentData({
              business_id: sentiment.business_id || '',
              business_name: sentiment.business_name || '',
              period: sentiment.period,
              metric: sentiment.metric,
              data: mergedSentimentData,
            });
          }
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
    }
    // If no business selected but a city is selected, show city averages with category comparison
    else if (selectedCity && selectedState) {
      const fetchCityData = async () => {
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

          // Extract primary category if one is selected
          const primaryCat = selectedCategory ? selectedCategory : null;
          setPrimaryCategory(primaryCat || '');

          const promises = [
            getCityRatingsTimeline(selectedCity, selectedState, period, startDate, endDate),
            getCitySentimentTimeline(selectedCity, selectedState, period, startDate, endDate),
            primaryCat ? getCategoryRatingsTimeline(primaryCat, period, startDate, endDate) : Promise.resolve(null),
            primaryCat ? getCategorySentimentTimeline(primaryCat, period, startDate, endDate) : Promise.resolve(null),
          ];

          const [cityRatings, citySentiment, categoryRatings, categorySentiment] = await Promise.all(promises);

          console.log('City fetch - raw responses:', {
            cityRatings: cityRatings,
            citySentiment: citySentiment,
          });
          console.log('City fetch - data lengths:', {
            cityRatings: cityRatings?.data?.length || 0,
            citySentiment: citySentiment?.data?.length || 0,
            categoryRatings: categoryRatings?.data?.length || 0,
            categorySentiment: categorySentiment?.data?.length || 0,
          });

          // Calculate filtered city averages based on applied filters
          const filteredCityAverages = calculateFilteredCityAverageRatings(
            businesses,
            selectedCity,
            selectedCategory,
            selectedRating,
            selectedStatus,
            period as 'month' | 'year',
            selectedYear
          );

          // Merge category and filtered averages into ratings data
          if (cityRatings && cityRatings.data) {
            const mergedRatingsData = cityRatings.data.map((point) => {
              const categoryPoint = categoryRatings?.data?.find(
                (cp) => cp.period_start === point.period_start
              );
              const filteredAvg = filteredCityAverages[point.period_start];
              return {
                ...point,
                category_avg_rating: categoryPoint?.avg_rating || 0,
                filtered_avg_rating: filteredAvg?.avg_rating || 0,
              };
            });

            console.log('Setting ratings data with', mergedRatingsData.length, 'points');
            console.log('First data point:', mergedRatingsData[0]);
            const ratingDataToSet = {
              ...cityRatings,
              data: mergedRatingsData as any,
            };
            console.log('Full ratings data object:', ratingDataToSet);
            setRatingsData(ratingDataToSet);
          } else {
            console.log('cityRatings or cityRatings.data is falsy:', { cityRatings, hasData: cityRatings?.data });
          }

          // Merge category sentiment into sentiment data
          if (citySentiment && citySentiment.data) {
            const mergedSentimentData = citySentiment.data.map((point) => {
              const categoryPoint = categorySentiment?.data?.find(
                (cp) => cp.period_start === point.period_start
              );
              return {
                ...point,
                category_avg_sentiment_score: categoryPoint?.avg_sentiment_score || 0,
              };
            });

            console.log('Setting sentiment data with', mergedSentimentData.length, 'points');
            setSentimentData({
              business_id: citySentiment.business_id || '',
              business_name: citySentiment.business_name || '',
              period: citySentiment.period,
              metric: citySentiment.metric,
              data: mergedSentimentData,
            });
          }

          setPeriodReviewCount(0);
        } catch (err) {
          console.error('Error fetching city data:', err);
          setError(
            err instanceof Error ? err.message : 'Failed to load city data'
          );
        } finally {
          setLoading(false);
        }
      };

      fetchCityData();
    } else {
      // No business and no city selected
      setRatingsData(null);
      setSentimentData(null);
      setPeriodReviewCount(0);
    }
  }, [business?.business_id, selectedCity, selectedState, period, selectedYear, selectedCategory, selectedRating, selectedStatus, businesses]);

  // Handle category-only view when no business or city is selected
  useEffect(() => {
    if (!business && !selectedCity && selectedCategory) {
      const fetchCategoryData = async () => {
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

          setPrimaryCategory(selectedCategory);

          const promises = [
            getCategoryRatingsTimeline(selectedCategory, period, startDate, endDate),
            getCategorySentimentTimeline(selectedCategory, period, startDate, endDate),
          ];

          const [categoryRatings, categorySentiment] = await Promise.all(promises);

          console.log('Category fetch - data lengths:', {
            categoryRatings: categoryRatings?.data?.length || 0,
            categorySentiment: categorySentiment?.data?.length || 0,
          });

          if (categoryRatings && categoryRatings.data) {
            setRatingsData(categoryRatings);
          }

          if (categorySentiment && categorySentiment.data) {
            setSentimentData({
              business_id: categorySentiment.business_id || '',
              business_name: categorySentiment.business_name || '',
              period: categorySentiment.period,
              metric: categorySentiment.metric,
              data: categorySentiment.data,
            });
          }

          setPeriodReviewCount(0);
        } catch (err) {
          console.error('Error fetching category data:', err);
          setError(
            err instanceof Error ? err.message : 'Failed to load category data'
          );
        } finally {
          setLoading(false);
        }
      };

      fetchCategoryData();
    } else if (!business && !selectedCity && !selectedCategory) {
      setRatingsData(null);
      setSentimentData(null);
      setPeriodReviewCount(0);
    }
  }, [selectedCategory, period, selectedYear]);

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

      {(() => {
        if (!loading && !error && (ratingsData || sentimentData)) {
          console.log('Render check - ratingsData:', { hasData: !!ratingsData, length: ratingsData?.data?.length, isSentimentOnly });
        }
        return null;
      })()}

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
function transformData(data: any[]) {
  return data.map((item) => ({
    ...item,
    period_start: item.period_start,
  }));
}

export default TimeSeriesChart;
