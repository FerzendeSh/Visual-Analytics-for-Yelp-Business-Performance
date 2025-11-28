import React, { useState, useMemo, useCallback } from 'react';
import { Layout } from '../components/layout';
import { BusinessMap } from '../components/map';
import TimeSeriesChartOptimized from '../components/timeseries/TimeSeriesChartOptimized';
import RatingTrendsChart from '../components/timeseries/RatingTrendsChart';
import { FilterControlPanel } from '../components/controls';
import CompetitivePositioningChart from '../components/competitive/CompetitivePositioningChart';
import ComparisonBar from '../components/dashboard/ComparisonBar';
import { useTimelineData, TimelineData } from '../hooks/useTimelineData';
import { useBusinesses } from '../hooks/useBusinesses';
import { useCompetitiveSnapshot } from '../hooks/useCompetitiveSnapshot';
import { useMyBusiness } from '../context/BusinessContext';
import { useComparisonTimelines } from '../hooks/useComparisonTimelines';
import { Business } from '../api';
import './Home.css';

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

  const handleScatterPlotSelect = useCallback((business: Business | null) => {
    setSelectedBusiness(business);
  }, [setSelectedBusiness]);

  // Handler for FilterControlPanel business select (add to comparison)
  const handleFilterBusinessSelect = useCallback((business: Business | null) => {
    if (business) {
      addComparison(business);
    }
  }, [addComparison]);

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

  // Calculate date range for monthly view
  const comparisonDateRange = useMemo(() => {
    if (period === 'month' && selectedYear) {
      return {
        startDate: `${selectedYear}-01-01`,
        endDate: `${selectedYear}-12-31`,
      };
    }
    return { startDate: '', endDate: '' };
  }, [period, selectedYear]);

  // Fetch timeline data for comparison businesses
  const {
    ratingsDataArray: comparisonRatingsDataArray,
    sentimentDataArray: comparisonSentimentDataArray,
  } = useComparisonTimelines({
    comparisonBusinesses,
    selectedCategory,
    period,
    startDate: comparisonDateRange.startDate,
    endDate: comparisonDateRange.endDate,
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

  // Handler for competitive chart business select (defined after competitiveData)
  const handleCompetitiveBusinessSelect = useCallback((businessId: string | null) => {
    if (businessId === null) {
      setSelectedBusiness(null);
    } else {
      const business = competitiveData?.businesses?.find(b => b.business_id === businessId);
      if (business) {
        handleScatterPlotSelect(business);
      }
    }
  }, [competitiveData?.businesses, handleScatterPlotSelect, setSelectedBusiness]);

  return (
    <Layout
      title="Yelp Business Analytics Dashboard"
      showSidebar={true}
    >
      <div className="home-content">
        <section className="home-section">
          {loading && (
            <div className="loading-state">
              Loading business data...
            </div>
          )}

          {error && (
            <div className="error-state">
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
                onBusinessSelect={handleFilterBusinessSelect}
              />

              <div className="dashboard-grid">
                {/* Map Card */}
                <div className="dashboard-card map-card">
                  <div className="dashboard-card__body">
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

                {/* Competitive Positioning Card */}
                <div className="dashboard-card competitive-card competitive-card--visx">
                  {competitiveLoading ? (
                    <div className="loading-state">
                      Loading competitive data...
                    </div>
                  ) : competitiveError ? (
                    <div className="error-state">
                      Error loading competitive data
                    </div>
                  ) : (
                    <CompetitivePositioningChart
                      data={competitiveData || null}
                      comparisonBusinessIds={comparisonBusinesses.map(b => b.business_id)}
                      myBusinessId={myBusiness?.business_id}
                      onBusinessSelect={handleCompetitiveBusinessSelect}
                      selectedBusinessId={selectedBusiness?.business_id}
                    />
                  )}
                </div>

                {/* Rating Trends Card */}
                <div className="dashboard-card ratings-card ratings-card--visx">
                  <RatingTrendsChart
                    business={myBusiness}
                    selectedCity={selectedCity}
                    selectedState={selectedState || myBusiness?.state || "PA"}
                    selectedCategory={selectedCategory}
                    selectedNeighborhood={selectedNeighborhood}
                    primaryCategory={primaryCategory}
                    period={period}
                    ratingsData={(timelineData as TimelineData)?.business_ratings || (timelineData as TimelineData)?.neighborhood_ratings || (timelineData as TimelineData)?.city_ratings || null}
                    cityRatingsData={(timelineData as TimelineData)?.city_ratings || null}
                    neighborhoodRatingsData={(timelineData as TimelineData)?.neighborhood_ratings || null}
                    categoryRatingsData={(timelineData as TimelineData)?.category_ratings || null}
                    isLoading={timelineLoading}
                    error={timelineError}
                    comparisonBusinesses={comparisonBusinesses}
                    comparisonRatingsDataArray={comparisonRatingsDataArray}
                  />
                </div>

                {/* Sentiment Trends Card */}
                <div className="dashboard-card sentiment-card">
                  <div className="dashboard-card__header">
                    <h3 className="dashboard-card__title">Sentiment Trends</h3>
                  </div>
                  <div className="dashboard-card__body">
                    <TimeSeriesChartOptimized
                      business={myBusiness}
                      selectedCity={selectedCity}
                      selectedState={selectedState || myBusiness?.state || "PA"}
                      selectedCategory={selectedCategory}
                      selectedNeighborhood={selectedNeighborhood}
                      primaryCategory={primaryCategory}
                      isSentimentOnly={true}
                      period={period}
                      sentimentData={(timelineData as TimelineData)?.business_sentiment || (timelineData as TimelineData)?.neighborhood_sentiment || (timelineData as TimelineData)?.city_sentiment || null}
                      citySentimentData={(timelineData as TimelineData)?.city_sentiment || null}
                      neighborhoodSentimentData={(timelineData as TimelineData)?.neighborhood_sentiment || null}
                      categorySentimentData={(timelineData as TimelineData)?.category_sentiment || null}
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
