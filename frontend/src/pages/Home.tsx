import React, { useState, useMemo, useCallback } from 'react';
import { Layout } from '../components/layout';
import { BusinessMap } from '../components/map';
import TimeSeriesChartOptimized from '../components/timeseries/TimeSeriesChartOptimized';
import { FilterControlPanel } from '../components/controls';
import CompetitivePositioningChart from '../components/competitive/CompetitivePositioningChart';
import ComparisonBar from '../components/dashboard/ComparisonBar';
import { Business } from '../api';
import { useTimelineData } from '../hooks/useTimelineData';
import { useBusinesses } from '../hooks/useBusinesses';
import { useCompetitiveSnapshot } from '../hooks/useCompetitiveSnapshot';
import { useMyBusiness } from '../context/BusinessContext';
import { useComparisonTimelines } from '../hooks/useComparisonTimelines';
import { CARD_STYLE } from '../theme/sharedStyles';

const Home: React.FC = () => {
  const { myBusiness, comparisonBusinesses, addComparison, removeComparison, clearComparisons, maxComparisons, selectedBusiness, setSelectedBusiness } = useMyBusiness();

  const { data: businesses = [], isLoading: loading, error: queryError } = useBusinesses();
  const error = queryError ? (queryError as Error).message : null;

  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>("");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<number | null>(null);
  const [period, setPeriod] = useState<'month' | 'year'>('year');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const handleCityChange = useCallback((cityState: string) => {
    if (!cityState) {
      setSelectedCity("");
      setSelectedState("");
      setSelectedNeighborhood(""); // Clear neighborhood when city changes
    } else {
      const [city, state] = cityState.split('|');
      setSelectedCity(city || "");
      setSelectedState(state || "");
      setSelectedNeighborhood(""); // Clear neighborhood when city changes
    }
  }, []);

  const handleMapCityChange = useCallback((city: string, state: string) => {
    setSelectedCity(city);
    setSelectedState(state);
  }, []);

  const handleResetFilters = useCallback(() => {
    setSelectedCity("");
    setSelectedState("");
    setSelectedCategory("");
    setSelectedNeighborhood("");
    setSelectedRating(null);
    setSelectedStatus(null);
    setPeriod('year');
    setSelectedYear(new Date().getFullYear());
  }, []);

  const handleScatterPlotSelect = useCallback((business: any) => {
    setSelectedBusiness(business);
  }, [setSelectedBusiness]);

  const timelineParams = useMemo(() => ({
    business: myBusiness,
    selectedCity: selectedCity || "",
    selectedState: selectedState || "PA",
    selectedCategory: selectedCategory || "",
    selectedNeighborhood: selectedNeighborhood || "",
    period,
    selectedYear,
  }), [myBusiness, selectedCity, selectedState, selectedCategory, selectedNeighborhood, period, selectedYear]);

  const {
    isLoading: timelineLoading,
    error: timelineError,
    data: timelineData,
    primaryCategory,
  } = useTimelineData(timelineParams);

  const competitiveCity = selectedCity || myBusiness?.city || "";
  const competitiveState = selectedState || myBusiness?.state || "PA";

  const {
    data: competitiveData,
    isLoading: competitiveLoading,
    error: competitiveError,
  } = useCompetitiveSnapshot({
    city: competitiveCity,
    state: competitiveState,
    neighborhood: selectedNeighborhood || "",
    category: selectedCategory || "",
    businessId: myBusiness?.business_id || "",
  });

  // Fetch timeline data for comparison businesses
  const {
    ratingsDataArray: comparisonRatingsDataArray,
    sentimentDataArray: comparisonSentimentDataArray,
  } = useComparisonTimelines({
    comparisonBusinesses,
    selectedCategory,
    period,
  });

  const cityCenter = useMemo(() => {
    if (!competitiveData?.businesses || competitiveData.businesses.length === 0) {
      return null;
    }

    const lats = competitiveData.businesses.map(b => b.latitude).filter(lat => !isNaN(lat));
    const lngs = competitiveData.businesses.map(b => b.longitude).filter(lng => !isNaN(lng));

    if (lats.length === 0 || lngs.length === 0) return null;

    return {
      latitude: lats.reduce((a, b) => a + b) / lats.length,
      longitude: lngs.reduce((a, b) => a + b) / lngs.length,
      zoom: selectedNeighborhood ? 14 : 11, // Zoom closer for neighborhoods
    };
  }, [competitiveData, selectedNeighborhood]);

  return (
    <Layout
      title="Yelp Business Analytics Dashboard"
      showSidebar={true}
    >
      <div style={{ padding: '1.5rem' }}>
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
              <FilterControlPanel
                businesses={businesses}
                selectedCity={selectedCity && selectedState ? `${selectedCity}|${selectedState}` : ""}
                selectedCategory={selectedCategory}
                selectedNeighborhood={selectedNeighborhood}
                selectedRating={selectedRating}
                selectedStatus={selectedStatus}
                period={period}
                selectedYear={selectedYear}
                onCityChange={handleCityChange}
                onCategoryChange={setSelectedCategory}
                onNeighborhoodChange={setSelectedNeighborhood}
                onRatingChange={setSelectedRating}
                onStatusChange={setSelectedStatus}
                onPeriodChange={setPeriod}
                onYearChange={setSelectedYear}
                onResetFilters={handleResetFilters}
                onBusinessSelect={(business) => {
                  if (business) {
                    addComparison(business);
                  }
                }}
              />

              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.3fr 1fr',
                gridTemplateRows: '1fr 1fr',
                gap: '0.8rem',
                minHeight: '800px',
              }}>
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
                      targetLocation={cityCenter}
                      selectedCity={selectedCity && selectedState ? `${selectedCity}|${selectedState}` : ""}
                      selectedNeighborhood={selectedNeighborhood}
                      selectedCategory={selectedCategory}
                      selectedRating={selectedRating}
                      selectedStatus={selectedStatus}
                      onMapCityChange={handleMapCityChange}
                      onAddComparison={addComparison}
                      onRemoveComparison={removeComparison}
                      onBusinessSelect={setSelectedBusiness}
                      myBusinessId={myBusiness?.business_id}
                      comparisonBusinessIds={comparisonBusinesses.map(b => b.business_id)}
                      maxComparisons={maxComparisons}
                      selectedBusiness={selectedBusiness}
                    />
                  </div>
                </div>

                <div style={{
                  ...CARD_STYLE,
                  gridRow: '2',
                  gridColumn: '1',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  {competitiveLoading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#718096' }}>
                      Loading competitive data...
                    </div>
                  ) : competitiveError ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
                      Error loading competitive data
                    </div>
                  ) : (
                    <CompetitivePositioningChart
                      data={competitiveData || null}
                      comparisonBusinessIds={comparisonBusinesses.map(b => b.business_id)}
                      myBusinessId={myBusiness?.business_id}
                      onBusinessSelect={(businessId) => {
                        const business = competitiveData?.businesses?.find(b => b.business_id === businessId);
                        if (business) {
                          handleScatterPlotSelect(business);
                        }
                      }}
                      selectedBusinessId={selectedBusiness?.business_id}
                    />
                  )}
                </div>
                <div style={{
                  ...CARD_STYLE,
                  gridRow: '1',
                  gridColumn: '2',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
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
                      business={myBusiness}
                      selectedCity={selectedCity}
                      selectedState={selectedState || myBusiness?.state || "PA"}
                      selectedCategory={selectedCategory}
                      selectedNeighborhood={selectedNeighborhood}
                      primaryCategory={primaryCategory}
                      isRatingsOnly={true}
                      period={period}
                      ratingsData={(timelineData as any)?.business_ratings || (timelineData as any)?.neighborhood_ratings || (timelineData as any)?.city_ratings || null}
                      cityRatingsData={(timelineData as any)?.city_ratings || null}
                      neighborhoodRatingsData={(timelineData as any)?.neighborhood_ratings || null}
                      categoryRatingsData={(timelineData as any)?.category_ratings || null}
                      isLoading={timelineLoading}
                      error={timelineError}
                      comparisonBusinesses={comparisonBusinesses}
                      comparisonRatingsDataArray={comparisonRatingsDataArray}
                      comparisonSentimentDataArray={comparisonSentimentDataArray}
                    />
                  </div>
                </div>

                <div style={{
                  ...CARD_STYLE,
                  gridRow: '2',
                  gridColumn: '2',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
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
                      business={myBusiness}
                      selectedCity={selectedCity}
                      selectedState={selectedState || myBusiness?.state || "PA"}
                      selectedCategory={selectedCategory}
                      selectedNeighborhood={selectedNeighborhood}
                      primaryCategory={primaryCategory}
                      isSentimentOnly={true}
                      period={period}
                      sentimentData={(timelineData as any)?.business_sentiment || (timelineData as any)?.neighborhood_sentiment || (timelineData as any)?.city_sentiment || null}
                      citySentimentData={(timelineData as any)?.city_sentiment || null}
                      neighborhoodSentimentData={(timelineData as any)?.neighborhood_sentiment || null}
                      categorySentimentData={(timelineData as any)?.category_sentiment || null}
                      isLoading={timelineLoading}
                      error={timelineError}
                      comparisonBusinesses={comparisonBusinesses}
                      comparisonRatingsDataArray={comparisonRatingsDataArray}
                      comparisonSentimentDataArray={comparisonSentimentDataArray}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
      <ComparisonBar
        myBusiness={myBusiness}
        comparisonBusinesses={comparisonBusinesses}
        onRemove={removeComparison}
        onClear={clearComparisons}
      />
    </Layout>
  );
};

export default Home;
