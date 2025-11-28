import React, { useState, useEffect } from 'react';
import { Business } from '../../api';
import { getNeighborhoods } from '../../api/endpoints/locations';
import { SearchBar } from '../search';
import { formatNeighborhoodName } from '../../utils';
import './FilterControlPanel.css';

interface FilterControlPanelProps {
  businesses: Business[];
  selectedCity: string;
  selectedCategory: string;
  selectedNeighborhood: string;
  selectedRating: number | null;
  selectedStatus: number | null;
  period: 'month' | 'year';
  selectedYear: number;
  onCityChange: (city: string) => void;
  onCategoryChange: (category: string) => void;
  onNeighborhoodChange: (neighborhood: string) => void;
  onRatingChange: (rating: number | null) => void;
  onStatusChange: (status: number | null) => void;
  onPeriodChange: (period: 'month' | 'year') => void;
  onYearChange: (year: number) => void;
  onResetFilters: () => void;
  onBusinessSelect?: (business: Business | null) => void;
}

const FilterControlPanel: React.FC<FilterControlPanelProps> = ({
  businesses,
  selectedCity,
  selectedCategory,
  selectedNeighborhood,
  selectedRating,
  selectedStatus,
  period,
  selectedYear,
  onCityChange,
  onCategoryChange,
  onNeighborhoodChange,
  onRatingChange,
  onStatusChange,
  onPeriodChange,
  onYearChange,
  onResetFilters,
  onBusinessSelect,
}) => {
  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [loadingNeighborhoods, setLoadingNeighborhoods] = useState(false);

  const cityStateMap = new Map<string, string>();
  businesses.forEach((b) => {
    if (b.city && b.state && !cityStateMap.has(b.city)) {
      cityStateMap.set(b.city, b.state);
    }
  });

  const cities = Array.from(cityStateMap.entries())
    .map(([city, state]) => ({ city, state }))
    .sort((a, b) => a.city.localeCompare(b.city));

  const categories = [
    ...new Set(
      businesses.flatMap((b) =>
        b.categories ? b.categories.split(",").map((c) => c.trim()) : []
      )
    ),
  ]
    .slice(0, 200)
    .sort();

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2005 + 1 }, (_, i) => currentYear - i).sort((a, b) => a - b);

  // Fetch neighborhoods when city changes
  useEffect(() => {
    if (selectedCity) {
      const [city, state] = selectedCity.split('|');
      if (city && state) {
        setLoadingNeighborhoods(true);
        getNeighborhoods(city, state)
          .then((data: string[]) => {
            setNeighborhoods(data);
            setLoadingNeighborhoods(false);
          })
          .catch(() => {
            setNeighborhoods([]);
            setLoadingNeighborhoods(false);
          });
      } else {
        setNeighborhoods([]);
      }
    } else {
      setNeighborhoods([]);
      onNeighborhoodChange(''); // Clear neighborhood when city is cleared
    }
  }, [selectedCity, onNeighborhoodChange]);

  return (
    <div className="filter-control-panel">
      <div className="control-section">
        <div className="control-group">
          <label htmlFor="city-filter">City</label>
          <select
            id="city-filter"
            value={selectedCity}
            onChange={(e) => onCityChange(e.target.value)}
            className="filter-select"
          >
            <option value="">All Cities</option>
            {cities.map(({ city, state }) => (
              <option key={`${city}|${state}`} value={`${city}|${state}`}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="category-filter">Category</label>
          <select
            id="category-filter"
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            className="filter-select"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="neighborhood-filter">Neighborhood</label>
          <select
            id="neighborhood-filter"
            value={selectedNeighborhood}
            onChange={(e) => onNeighborhoodChange(e.target.value)}
            className="filter-select"
            disabled={!selectedCity || loadingNeighborhoods}
          >
            <option value="">
              {!selectedCity
                ? 'Select a city first'
                : loadingNeighborhoods
                ? 'Loading...'
                : 'All Neighborhoods'}
            </option>
            {neighborhoods.map((neighborhood) => (
              <option key={neighborhood} value={neighborhood}>
                {formatNeighborhoodName(neighborhood)}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="rating-filter">Rating</label>
          <select
            id="rating-filter"
            value={selectedRating ?? ""}
            onChange={(e) => onRatingChange(Number(e.target.value) || null)}
            className="filter-select"
          >
            <option value="">All Ratings</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r}★
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>Status</label>
          <div className="status-toggle-group">
            <button
              className={`status-toggle-btn ${selectedStatus === 1 ? 'active' : ''}`}
              onClick={() => onStatusChange(selectedStatus === 1 ? null : 1)}
              title="Filter to open businesses"
            >
              Open
            </button>
            <button
              className={`status-toggle-btn ${selectedStatus === 0 ? 'active' : ''}`}
              onClick={() => onStatusChange(selectedStatus === 0 ? null : 0)}
              title="Filter to closed businesses"
            >
              Closed
            </button>
          </div>
        </div>

        <div className="control-group">
          <label htmlFor="period-filter">Time Period</label>
          <select
            id="period-filter"
            value={period}
            onChange={(e) => onPeriodChange(e.target.value as 'month' | 'year')}
            className="filter-select"
          >
            <option value="year">Yearly</option>
            <option value="month">Monthly (per Year)</option>
          </select>
        </div>

        {period === 'month' && (
          <div className="control-group">
            <label htmlFor="year-filter">Select Year</label>
            <select
              id="year-filter"
              value={selectedYear}
              onChange={(e) => onYearChange(Number(e.target.value))}
              className="filter-select"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          className="reset-filters-btn"
          onClick={onResetFilters}
          title="Reset all filters to default"
        >
          Reset Filters
        </button>

        <div className="search-box-wrapper">
          {onBusinessSelect && <SearchBar onBusinessSelect={onBusinessSelect} />}
        </div>
      </div>
    </div>
  );
};

export default FilterControlPanel;
