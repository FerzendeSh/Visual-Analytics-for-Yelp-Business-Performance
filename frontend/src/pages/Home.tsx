import React, { useState, useEffect } from 'react';
import { Layout } from '../components/layout';
import { BusinessMap } from '../components/map';
import { TimeSeriesChart } from '../components/timeseries';
import { FilterControlPanel } from '../components/controls';
import ScatterPlot from '../components/scatter/ScatterPlot';
import { getBusinesses, Business } from '../api';

const Home: React.FC = () => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  // Centralized filter state
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<number | null>(null);
  const [period, setPeriod] = useState<'month' | 'year'>('year');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    const loadBusinesses = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all businesses with pagination
        let allBusinesses: Business[] = [];
        let skip = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
          const data = await getBusinesses({ skip, limit });
          if (data.length === 0) {
            hasMore = false;
          } else {
            allBusinesses = [...allBusinesses, ...data];
            if (data.length < limit) {
              hasMore = false;
            } else {
              skip += limit;
            }
          }
        }

        setBusinesses(allBusinesses);
      } catch (apiErr) {
        console.warn('API request failed, falling back to static data:', apiErr);

        // Fallback to static JSON file
        try {
          const response = await fetch('/subset_businesses.json');
          if (!response.ok) {
            throw new Error('Failed to load business data from both API and static file');
          }

          const text = await response.text();
          const lines = text.trim().split('\n');
          const parsedBusinesses = lines.map(line => JSON.parse(line));

          setBusinesses(parsedBusinesses);
          setError(null);
        } catch (fallbackErr) {
          console.error('Error loading businesses:', fallbackErr);
          setError(
            fallbackErr instanceof Error
              ? fallbackErr.message
              : 'Failed to load businesses'
          );
        }
      } finally {
        setLoading(false);
      }
    };

    loadBusinesses();
  }, []);

  const handleResetFilters = () => {
    setSelectedCity("");
    setSelectedCategory("");
    setSelectedRating(null);
    setSelectedStatus(null);
    setPeriod('year');
    setSelectedYear(new Date().getFullYear());
  };

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
                      businesses={businesses}
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
                    <TimeSeriesChart
                      business={selectedBusiness}
                      isRatingsOnly={true}
                      period={period}
                      selectedYear={selectedYear}
                      selectedCity={selectedCity}
                      selectedState="PA"
                      selectedCategory={selectedCategory}
                      selectedRating={selectedRating}
                      selectedStatus={selectedStatus}
                      businesses={businesses}
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
                    <TimeSeriesChart
                      business={selectedBusiness}
                      isSentimentOnly={true}
                      period={period}
                      selectedYear={selectedYear}
                      selectedCity={selectedCity}
                      selectedState="PA"
                      selectedCategory={selectedCategory}
                      selectedRating={selectedRating}
                      selectedStatus={selectedStatus}
                      businesses={businesses}
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
