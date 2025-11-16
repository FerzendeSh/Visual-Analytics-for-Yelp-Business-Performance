import React, { useState, useMemo, useCallback } from 'react';
import { Layout } from '../components/layout';
import { BusinessMap } from '../components/map';
import TimeSeriesChartOptimized from '../components/timeseries/TimeSeriesChartOptimized';
import { FilterControlPanel } from '../components/controls';
import ScatterPlot from '../components/scatter/ScatterPlot';
import { Business } from '../api';
import { useTimelineData } from '../hooks/useTimelineData';
import { useBusinesses } from '../hooks/useBusinesses';

const Home: React.FC = () => {
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  // Load businesses for scatter plot and filter options only (NOT for map)
  // Map will use viewport-based loading for better performance
  const { data: businesses = [], isLoading: loading, error: queryError } = useBusinesses();
  const error = queryError ? (queryError as Error).message : null;

  // Centralized filter state
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<number | null>(null);
  const [period, setPeriod] = useState<'month' | 'year'>('year');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Memoize reset handler to prevent recreating on every render
  const handleResetFilters = useCallback(() => {
    setSelectedCity("");
    setSelectedCategory("");
    setSelectedRating(null);
    setSelectedStatus(null);
    setPeriod('year');
    setSelectedYear(new Date().getFullYear());
  }, []);

  // Memoize timeline data params to prevent unnecessary API calls
  const timelineParams = useMemo(() => ({
    business: selectedBusiness,
    selectedCity,
    selectedState: selectedBusiness?.state || "PA", // Use business state if selected
    selectedCategory,
    period,
    selectedYear,
  }), [selectedBusiness, selectedCity, selectedCategory, period, selectedYear]);

  // Fetch timeline data once using the custom hook with React Query
  const {
    isLoading: timelineLoading,
    error: timelineError,
    data: timelineData,
    primaryCategory,
  } = useTimelineData(timelineParams);

  return (
    <Layout
      title="Yelp Business Analytics Dashboard"
      showSidebar={true}
    >
      <div style={{ padding: '1.5rem' }}>
        {/* Map and Time Series Section */}
        <section>
          {loading && (
            <div style={{
              padding: '2rem',
              textAlign: 'center',
              color: '#718096',
              background: '#f7fafc',
              borderRadius: '8px'
            }}>
              Loading business data...
            </div>
          )}

          {error && (
            <div style={{
              padding: '1rem',
              background: '#fff5f5',
              border: '1px solid #feb2b2',
              borderRadius: '8px',
              color: '#c53030',
              marginBottom: '1rem'
            }}>
              Error: {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Centralized Filter Control Panel */}
              <FilterControlPanel
                businesses={businesses}
                selectedCity={selectedCity}
                selectedCategory={selectedCategory}
                selectedRating={selectedRating}
                selectedStatus={selectedStatus}
                period={period}
                selectedYear={selectedYear}
                onCityChange={setSelectedCity}
                onCategoryChange={setSelectedCategory}
                onRatingChange={setSelectedRating}
                onStatusChange={setSelectedStatus}
                onPeriodChange={setPeriod}
                onYearChange={setSelectedYear}
                onResetFilters={handleResetFilters}
                onBusinessSelect={setSelectedBusiness}
              />

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.3fr 1fr',
                gridTemplateRows: '1fr 1fr',
                gap: '0.8rem',
                minHeight: '800px',
              }}>
                {/* Left Top: Map View */}
                <div style={{
                  gridRow: '1',
                  gridColumn: '1',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid #e2e8f0',
                  background: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <div style={{
                    flex: 1,
                    position: 'relative',
                    width: '100%',
                  }}>
                    <BusinessMap
                      useViewportLoading={true}
                      selectedCity={selectedCity}
                      selectedCategory={selectedCategory}
                      selectedRating={selectedRating}
                      selectedStatus={selectedStatus}
                      selectedBusiness={selectedBusiness}
                      onBusinessSelect={setSelectedBusiness}
                    />
                  </div>
                </div>

                {/* Left Bottom: Scatter Plot */}
                <div style={{
                  gridRow: '2',
                  gridColumn: '1',
                }}>
                  <ScatterPlot
                    businesses={businesses}
                    selectedCity={selectedCity}
                    selectedCategory={selectedCategory}
                    selectedRating={selectedRating}
                    selectedStatus={selectedStatus}
                    selectedBusiness={selectedBusiness}
                    onBusinessSelect={setSelectedBusiness}
                  />
                </div>
                {/* Ratings Timeline - Right Top */}
                <div style={{
                  gridRow: '1',
                  gridColumn: '2',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  background: '#0f1b2a',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '1px solid rgba(102, 126, 234, 0.25)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(102, 126, 234, 0.15)',
                }}>
                  <div style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #9b9c9eff',
                    background: '#0f1b2a',
                    flexShrink: 0,
                  }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: '#ffffffff'
                    }}>
                      Rating Trends
                    </h3>
                  </div>
                  <div style={{
                    flex: 1,
                    overflow: 'hidden',
                    padding: '0.5rem',
                    minHeight: 0,
                  }}>
                    <TimeSeriesChartOptimized
                      business={selectedBusiness}
                      selectedCity={selectedCity}
                      selectedState={selectedBusiness?.state || "PA"}
                      selectedCategory={selectedCategory}
                      primaryCategory={primaryCategory}
                      isRatingsOnly={true}
                      period={period}
                      ratingsData={(timelineData as any)?.business_ratings || (timelineData as any)?.city_ratings || null}
                      cityRatingsData={(timelineData as any)?.city_ratings || null}
                      categoryRatingsData={(timelineData as any)?.category_ratings || null}
                      isLoading={timelineLoading}
                      error={timelineError}
                    />
                  </div>
                </div>

                {/* Sentiment Timeline - Right Bottom */}
                <div style={{
                  gridRow: '2',
                  gridColumn: '2',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '1px solid rgba(102, 126, 234, 0.25)',
                  background: '#0f1b2a',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(102, 126, 234, 0.15)',
                }}>
                  <div style={{
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid #e2e8f0',
                    background: '#0f1b2a ',
                    flexShrink: 0,
                  }}>
                    <h3 style={{
                      margin: 0,
                      fontSize: '1rem',
                      fontWeight: 600,
                      color: '#ffffffff'
                    }}>
                      Sentiment Trends
                    </h3>
                  </div>
                  <div style={{
                    flex: 1,
                    overflow: 'hidden',
                    padding: '0.5rem',
                    minHeight: 0,
                  }}>
                    <TimeSeriesChartOptimized
                      business={selectedBusiness}
                      selectedCity={selectedCity}
                      selectedState={selectedBusiness?.state || "PA"}
                      selectedCategory={selectedCategory}
                      primaryCategory={primaryCategory}
                      isSentimentOnly={true}
                      period={period}
                      sentimentData={(timelineData as any)?.business_sentiment || (timelineData as any)?.city_sentiment || null}
                      citySentimentData={(timelineData as any)?.city_sentiment || null}
                      categorySentimentData={(timelineData as any)?.category_sentiment || null}
                      isLoading={timelineLoading}
                      error={timelineError}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </Layout>
  );
};

export default Home;
