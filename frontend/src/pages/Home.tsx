import React, { useState, useMemo, useCallback } from 'react';
import { Layout } from '../components/layout';
import { BusinessMap } from '../components/map';
import RatingTrendsChart from '../components/timeseries/RatingTrendsChart';
import SentimentTrendsChart from '../components/timeseries/SentimentTrendsChart';
import FilterSummary from '../components/dashboard/FilterSummary';
import MetricsCards from '../components/dashboard/MetricsCards';
import CompetitivePositioningChart from '../components/competitive/CompetitivePositioningChart';
import { MetricsCardsSkeleton, EmptyState } from '../components/common';
import { useTimelineData, TimelineData } from '../hooks/useTimelineData';
import { useBusinesses } from '../hooks/useBusinesses';
import { useCompetitiveSnapshot } from '../hooks/useCompetitiveSnapshot';
import { useMyBusiness } from '../context/BusinessContext';
import { useComparisonTimelines } from '../hooks/useComparisonTimelines';
import { Business } from '../api';
import toast from 'react-hot-toast';
import './Home.css';

const Home: React.FC = () => {
  const { myBusiness, comparisonBusinesses, addComparison, removeComparison, clearComparisons, maxComparisons, selectedBusiness, setSelectedBusiness } = useMyBusiness();

  const { data: businesses = [], isLoading: loading, error: queryError } = useBusinesses();
  const error = queryError ? (queryError as Error).message : null;

  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedNeighborhood, setSelectedNeighborhood] = useState<string>("");
  const [minRating, setMinRating] = useState<number>(1);
  const [maxRating, setMaxRating] = useState<number>(5);
  const [selectedStatus, setSelectedStatus] = useState<number | null>(null);
  const [period, setPeriod] = useState<'month' | 'year'>('year');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [compareByCity, setCompareByCity] = useState<boolean>(false);
  const [compareByCategory, setCompareByCategory] = useState<boolean>(false);
  const [compareByNeighborhood, setCompareByNeighborhood] = useState<boolean>(false);

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
    setMinRating(1);
    setMaxRating(5);
    setSelectedStatus(null);
    setPeriod('year');
    setSelectedYear(new Date().getFullYear());
    setCompareByCity(false);
    setCompareByCategory(false);
    setCompareByNeighborhood(false);
    clearComparisons();
  }, [clearComparisons]);

  const handleScatterPlotSelect = useCallback((business: Business | null) => {
    setSelectedBusiness(business);
  }, [setSelectedBusiness]);

  // Handler for FilterControlPanel business select (add to comparison)
  const handleFilterBusinessSelect = useCallback((business: Business | null) => {
    if (business) {
      const isAlreadyAdded = comparisonBusinesses.some(b => b.business_id === business.business_id);
      if (isAlreadyAdded) {
        toast.error(`${business.name} is already in comparison group`, { duration: 2000 });
        return;
      }

      if (comparisonBusinesses.length >= maxComparisons) {
        toast(
          `Maximum ${maxComparisons} businesses allowed. Remove one to add another.`,
          {
            duration: 4000,
            icon: '⚠️',
            style: {
              background: '#1e293b',
              color: '#f59e0b',
              border: '1px solid #f59e0b',
            }
          }
        );
        return;
      }

      addComparison(business);
      toast.success(
        `${business.name} added to comparison group (${comparisonBusinesses.length + 1}/${maxComparisons})`,
        { duration: 3000 }
      );
    }
  }, [addComparison, comparisonBusinesses, maxComparisons]);

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

  // Build filter tags for summary
  const filterTags = [
    selectedCity && selectedState && {
      label: `City: ${selectedCity}`,
      onRemove: () => handleCityChange(''),
    },
    selectedNeighborhood && {
      label: `Neighborhood: ${selectedNeighborhood}`,
      onRemove: () => setSelectedNeighborhood(''),
    },
    selectedCategory && {
      label: `Category: ${selectedCategory}`,
      onRemove: () => setSelectedCategory(''),
    },
    (minRating !== 1 || maxRating !== 5) && {
      label: `Rating: ${minRating} - ${maxRating}★`,
      onRemove: () => { setMinRating(1); setMaxRating(5); },
    },
    selectedStatus !== null && {
      label: `Status: ${selectedStatus === 1 ? 'Open' : 'Closed'}`,
      onRemove: () => setSelectedStatus(null),
    },
  ].filter(Boolean) as Array<{ label: string; onRemove: () => void }>;

  // Calculate metrics for the cards
  const metricsData = useMemo(() => {
    if (!myBusiness) {
      return {
        starRating: undefined,
        sentimentScore: undefined,
        reviewVolume: undefined,
        ratingChange: 0,
        sentimentChange: 0,
        reviewVolumeChange: 0,
        cityAvgRating: undefined,
        cityAvgSentiment: undefined,
        categoryAvgRating: undefined,
        categoryAvgSentiment: undefined,
        neighborhoodAvgRating: undefined,
      };
    }

    const ratingsData = (timelineData as TimelineData)?.business_ratings;
    const sentimentData = (timelineData as TimelineData)?.business_sentiment;
    const cityRatingsData = (timelineData as TimelineData)?.city_ratings;
    const citySentimentData = (timelineData as TimelineData)?.city_sentiment;
    const categoryRatingsData = (timelineData as TimelineData)?.category_ratings;
    const categorySentimentData = (timelineData as TimelineData)?.category_sentiment;
    const neighborhoodRatingsData = (timelineData as TimelineData)?.neighborhood_ratings;

    // Current values
    const starRating = myBusiness.stars || 0;
    const sentimentScore = sentimentData?.data?.[sentimentData.data.length - 1]?.avg_sentiment_score || 0;
    const reviewVolume = myBusiness.review_count || 0;

    // Calculate averages from comparison data (latest period)
    const cityAvgRating = cityRatingsData?.data?.[cityRatingsData.data.length - 1]?.avg_rating;
    const cityAvgSentiment = citySentimentData?.data?.[citySentimentData.data.length - 1]?.avg_sentiment_score;
    const categoryAvgRating = categoryRatingsData?.data?.[categoryRatingsData.data.length - 1]?.avg_rating;
    const categoryAvgSentiment = categorySentimentData?.data?.[categorySentimentData.data.length - 1]?.avg_sentiment_score;
    const neighborhoodAvgRating = neighborhoodRatingsData?.data?.[neighborhoodRatingsData.data.length - 1]?.avg_rating;

    // Calculate changes from latest vs previous period
    let ratingChange = 0;
    let sentimentChange = 0;
    let reviewVolumeChange = 0;

    if (ratingsData?.data && ratingsData.data.length >= 2) {
      const latest = ratingsData.data[ratingsData.data.length - 1];
      const previous = ratingsData.data[ratingsData.data.length - 2];
      if (latest.avg_rating && previous.avg_rating) {
        ratingChange = (latest.avg_rating - previous.avg_rating) / previous.avg_rating;
      }
      if (latest.review_count && previous.review_count) {
        reviewVolumeChange = (latest.review_count - previous.review_count) / previous.review_count;
      }
    }

    if (sentimentData?.data && sentimentData.data.length >= 2) {
      const latest = sentimentData.data[sentimentData.data.length - 1];
      const previous = sentimentData.data[sentimentData.data.length - 2];
      if (latest.avg_sentiment_score !== undefined && previous.avg_sentiment_score !== undefined) {
        sentimentChange = (latest.avg_sentiment_score - previous.avg_sentiment_score) / Math.abs(previous.avg_sentiment_score || 1);
      }
    }

    return {
      starRating,
      sentimentScore,
      reviewVolume,
      ratingChange,
      sentimentChange,
      reviewVolumeChange,
      cityAvgRating,
      cityAvgSentiment,
      categoryAvgRating,
      categoryAvgSentiment,
      neighborhoodAvgRating,
    };
  }, [myBusiness, timelineData]);

  return (
    <Layout
      title="Business and Market Analytics Dashboard"
      showSidebar={true}
      businesses={businesses}
      selectedCity={selectedCity && selectedState ? `${selectedCity}|${selectedState}` : ""}
      selectedCategory={selectedCategory}
      selectedNeighborhood={selectedNeighborhood}
      minRating={minRating}
      maxRating={maxRating}
      selectedStatus={selectedStatus}
      period={period}
      selectedYear={selectedYear}
      onCityChange={handleCityChange}
      onCategoryChange={setSelectedCategory}
      onNeighborhoodChange={setSelectedNeighborhood}
      onMinRatingChange={setMinRating}
      onMaxRatingChange={setMaxRating}
      onStatusChange={setSelectedStatus}
      onPeriodChange={setPeriod}
      onYearChange={setSelectedYear}
      onResetFilters={handleResetFilters}
      onBusinessSelect={handleFilterBusinessSelect}
      compareByCity={compareByCity}
      compareByCategory={compareByCategory}
      compareByNeighborhood={compareByNeighborhood}
      comparisonBusinesses={comparisonBusinesses}
      onCompareByCity={setCompareByCity}
      onCompareByCategory={setCompareByCategory}
      onCompareByNeighborhood={setCompareByNeighborhood}
      onComparisonBusinessesChange={(businesses) => {
        businesses.forEach((b) => {
          if (!comparisonBusinesses.find((cb) => cb.business_id === b.business_id)) {
            addComparison(b);
          }
        });
        comparisonBusinesses.forEach((cb) => {
          if (!businesses.find((b) => b.business_id === cb.business_id)) {
            removeComparison(cb.business_id);
          }
        });
      }}
    >
      <div className="home-content">
        <section className="home-section">
          {loading && (
            <div className="loading-container">
              <MetricsCardsSkeleton />
              <div className="loading-message">Loading business data...</div>
            </div>
          )}

          {error && (
            <EmptyState
              variant="error"
              title="Failed to load business data"
              description={`Error: ${error}`}
              actionLabel="Retry"
              onAction={() => window.location.reload()}
            />
          )}

          {!loading && !error && businesses.length === 0 && (
            <EmptyState
              variant="no-results"
              title="No businesses found"
              description="There are no businesses available in the database."
            />
          )}

          {!loading && !error && businesses.length > 0 && (
            <>
              <FilterSummary
                filters={filterTags}
                selectedCity={selectedCity && selectedState ? `${selectedCity}|${selectedState}` : ""}
                selectedCategory={selectedCategory}
                selectedNeighborhood={selectedNeighborhood}
                minRating={minRating}
                maxRating={maxRating}
                selectedStatus={selectedStatus}
                onCityChange={handleCityChange}
                onCategoryChange={setSelectedCategory}
                onNeighborhoodChange={setSelectedNeighborhood}
                onMinRatingChange={setMinRating}
                onMaxRatingChange={setMaxRating}
                onStatusChange={setSelectedStatus}
              />

              {timelineLoading ? (
                <MetricsCardsSkeleton />
              ) : (
                <MetricsCards
                  starRating={metricsData.starRating}
                  sentimentScore={metricsData.sentimentScore}
                  reviewVolume={metricsData.reviewVolume}
                  ratingChange={metricsData.ratingChange}
                  sentimentChange={metricsData.sentimentChange}
                  reviewVolumeChange={metricsData.reviewVolumeChange}
                  cityAvgRating={metricsData.cityAvgRating}
                  cityAvgSentiment={metricsData.cityAvgSentiment}
                  neighborhoodAvgRating={metricsData.neighborhoodAvgRating}
                  isLoading={timelineLoading}
                />
              )}

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
                      minRating={minRating}
                      maxRating={maxRating}
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
                      compareByCity={compareByCity}
                      compareByCategory={compareByCategory}
                      compareByNeighborhood={compareByNeighborhood}
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
                    compareByCity={compareByCity}
                    compareByCategory={compareByCategory}
                    compareByNeighborhood={compareByNeighborhood}
                  />
                </div>

                {/* Sentiment Trends Card */}
                <div className="dashboard-card sentiment-card sentiment-card--visx">
                  <SentimentTrendsChart
                    business={myBusiness}
                    selectedCity={selectedCity}
                    selectedState={selectedState || myBusiness?.state || "PA"}
                    selectedCategory={selectedCategory}
                    selectedNeighborhood={selectedNeighborhood}
                    primaryCategory={primaryCategory}
                    period={period}
                    sentimentData={(timelineData as TimelineData)?.business_sentiment || (timelineData as TimelineData)?.neighborhood_sentiment || (timelineData as TimelineData)?.city_sentiment || null}
                    citySentimentData={(timelineData as TimelineData)?.city_sentiment || null}
                    neighborhoodSentimentData={(timelineData as TimelineData)?.neighborhood_sentiment || null}
                    categorySentimentData={(timelineData as TimelineData)?.category_sentiment || null}
                    isLoading={timelineLoading}
                    error={timelineError}
                    comparisonBusinesses={comparisonBusinesses}
                    comparisonSentimentDataArray={comparisonSentimentDataArray}
                    compareByCity={compareByCity}
                    compareByCategory={compareByCategory}
                    compareByNeighborhood={compareByNeighborhood}
                  />
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
