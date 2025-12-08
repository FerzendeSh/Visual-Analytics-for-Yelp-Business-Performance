import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Layout } from '../components/layout';
import { BusinessMap } from '../components/map';
import RatingTrendsChart from '../components/timeseries/RatingTrendsChart';
import SentimentTrendsChart from '../components/timeseries/SentimentTrendsChart';
import FilterSummary from '../components/dashboard/FilterSummary';
import MetricsCards from '../components/dashboard/MetricsCards';
import CompetitivePositioningChart from '../components/competitive/CompetitivePositioningChart';
import KeywordInsightsChart from '../components/keywords/KeywordInsightsChart';
import { MetricsCardsSkeleton, EmptyState } from '../components/common';
import { useTimelineData, TimelineData } from '../hooks/useTimelineData';
import { useBusinesses } from '../hooks/useBusinesses';
import { useCompetitiveSnapshot } from '../hooks/useCompetitiveSnapshot';
import { useForecast } from '../hooks/useForecast';
import { useMyBusiness } from '../context/BusinessContext';
import { useComparisonTimelines } from '../hooks/useComparisonTimelines';
import { Business } from '../api';
import toast from 'react-hot-toast';
import { LayoutGrid, List } from 'lucide-react';
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

  // Layout toggle state (grid or list view)
  const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');

  // Handler for year change
  const handleYearChange = useCallback((year: number) => {
    setSelectedYear(year);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Escape - clear selected business
      if (e.key === 'Escape') {
        setSelectedBusiness(null);
      }
      
      // G - toggle grid/list layout
      if (e.key === 'g' || e.key === 'G') {
        setLayoutMode(prev => prev === 'grid' ? 'list' : 'grid');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedBusiness]);

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
    const currentYear = new Date().getFullYear();
    setSelectedYear(currentYear);
    setPeriod('year');
    // Set selected business back to myBusiness to center map on it
    setSelectedBusiness(myBusiness);
    clearComparisons();
  }, [setSelectedBusiness, clearComparisons, myBusiness]);

  const handleScatterPlotSelect = useCallback((business: Business | null) => {
    setSelectedBusiness(business);
  }, [setSelectedBusiness]);

  // Handler for map popup "Add to Comparison" button click
  const handleMapAddComparison = useCallback((business: Business) => {
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
  }, [addComparison, comparisonBusinesses, maxComparisons]);

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
    selectedYear: period === 'month' ? selectedYear : undefined,
  }), [myBusiness, selectedCity, selectedState, selectedCategory, selectedNeighborhood, period, selectedYear]);

  // Fetch timeline data for ALL years to get available years (no date filter)
  // Only fetch for the business itself, not city/neighborhood/category
  const allYearsTimelineParams = useMemo(() => ({
    business: myBusiness,
    selectedCity: "",
    selectedState: "",
    selectedCategory: "",
    selectedNeighborhood: "",
    period: 'year' as const, // Always fetch yearly to get all years
    selectedYear: undefined, // No year filter
  }), [myBusiness]);

  const {
    isLoading: timelineLoading,
    error: timelineError,
    data: timelineData,
    primaryCategory,
  } = useTimelineData(timelineParams);

  // Fetch all years data separately to populate year dropdown
  const {
    data: allYearsData,
  } = useTimelineData(allYearsTimelineParams);

  // Extract available years from ALL timeline data (not filtered by selected year)
  const availableYears = useMemo(() => {
    const dataToUse = allYearsData || timelineData;
    if (!dataToUse) return [];

    const ratingsData = (dataToUse as TimelineData)?.business_ratings;
    if (!ratingsData?.data || ratingsData.data.length === 0) return [];

    // Extract years from period_start dates
    const yearsSet = new Set<number>();
    ratingsData.data.forEach((dataPoint) => {
      if (dataPoint.period_start) {
        const year = new Date(dataPoint.period_start).getFullYear();
        if (!isNaN(year)) {
          yearsSet.add(year);
        }
      }
    });

    return Array.from(yearsSet).sort((a, b) => a - b);
  }, [allYearsData, timelineData]);

  const lastAvailableYear = availableYears.length > 0 ? availableYears[availableYears.length - 1] : new Date().getFullYear();

  // Check if the selected year has incomplete months (less than 12 months of data)
  const hasIncompleteYear = useMemo(() => {
    if (!timelineData || period !== 'month') return false;

    const ratingsData = (timelineData as TimelineData)?.business_ratings;
    if (!ratingsData?.data || ratingsData.data.length === 0) return false;

    // Filter data points for the selected year
    const yearData = ratingsData.data.filter((dataPoint) => {
      if (!dataPoint.period_start) return false;
      const year = new Date(dataPoint.period_start).getFullYear();
      return year === selectedYear;
    });

    // If we have less than 12 months for the selected year, it's incomplete
    return yearData.length < 12;
  }, [timelineData, selectedYear, period]);

  const shouldShowForecast = useMemo(() => {
    if (!myBusiness?.business_id) return false; // No forecast if no business selected

    if (period === 'year') {
      // For time series (all years view), show forecast
      return true;
    }

    if (period === 'month') {
      // For monthly view, only show forecast if:
      // 1. The selected year is the most recent year, AND
      // 2. That year has incomplete months
      return selectedYear === lastAvailableYear && hasIncompleteYear;
    }

    return false;
  }, [myBusiness?.business_id, period, selectedYear, lastAvailableYear, hasIncompleteYear]);

  // Fetch forecast data for the selected business
  const {
    ratingForecast,
    sentimentForecast,
    isLoading: forecastLoading,
  } = useForecast({
    businessId: myBusiness?.business_id,
    periods: 4,
    periodType: period,
    enabled: !!myBusiness?.business_id && shouldShowForecast, // Only fetch forecast if we intend to show it
  });

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
    // Add comparison businesses to filter tags
    ...comparisonBusinesses.map(business => ({
      label: `Comparison: ${business.name}`,
      onRemove: () => removeComparison(business.business_id),
    })),
  ].filter(Boolean) as Array<{ label: string; onRemove: () => void }>;

  // Calculate metrics for the cards (use allYearsData for overall metrics, not filtered by year)
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

    // Use allYearsData for business metrics (not filtered by selected year)
    // Use timelineData for city/category/neighborhood comparisons (respects filters)
    const ratingsData = (allYearsData as TimelineData)?.business_ratings;
    const sentimentData = (allYearsData as TimelineData)?.business_sentiment;
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
  }, [myBusiness, allYearsData, timelineData]);

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
      onYearChange={handleYearChange}
      onResetFilters={handleResetFilters}
      onBusinessSelect={handleFilterBusinessSelect}
      comparisonBusinesses={comparisonBusinesses}
      availableYears={availableYears}
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
              {/* Filter Summary and Layout Controls */}
              <div className="dashboard-controls">
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
                
                {/* Layout Toggle */}
                <div className="layout-toggle">
                  <button
                    className={`layout-toggle__btn ${layoutMode === 'grid' ? 'layout-toggle__btn--active' : ''}`}
                    onClick={() => setLayoutMode('grid')}
                    title="Grid view (press G)"
                    aria-label="Grid view"
                  >
                    <LayoutGrid size={18} />
                  </button>
                  <button
                    className={`layout-toggle__btn ${layoutMode === 'list' ? 'layout-toggle__btn--active' : ''}`}
                    onClick={() => setLayoutMode('list')}
                    title="List view (press G)"
                    aria-label="List view"
                  >
                    <List size={18} />
                  </button>
                </div>
              </div>

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

              <div className={`dashboard-grid ${layoutMode === 'list' ? 'dashboard-grid--list' : ''}`}>
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
                      onAddComparison={handleMapAddComparison}
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
                      compareByCity={false}
                      compareByCategory={false}
                      compareByNeighborhood={false}
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
                    isLoading={timelineLoading || forecastLoading}
                    error={timelineError}
                    comparisonBusinesses={comparisonBusinesses}
                    comparisonRatingsDataArray={comparisonRatingsDataArray}
                    compareByCity={!!selectedCity}
                    compareByCategory={!!selectedCategory}
                    compareByNeighborhood={!!selectedNeighborhood}
                    forecastData={shouldShowForecast ? ratingForecast : null}
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
                    isLoading={timelineLoading || forecastLoading}
                    error={timelineError}
                    comparisonBusinesses={comparisonBusinesses}
                    comparisonSentimentDataArray={comparisonSentimentDataArray}
                    compareByCity={!!selectedCity}
                    compareByCategory={!!selectedCategory}
                    compareByNeighborhood={false}
                    forecastData={shouldShowForecast ? sentimentForecast : null}
                  />
                </div>

                {/* Keyword Insights Card */}
                <div className="dashboard-card keyword-insights-card keyword-insights-card--visx">
                  <KeywordInsightsChart
                    business={myBusiness}
                    comparisonBusinesses={comparisonBusinesses}
                    ratingsTimeline={(timelineData as TimelineData)?.business_ratings || null}
                    isLoading={timelineLoading}
                    error={timelineError}
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
