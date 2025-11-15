import React from 'react';
import { Business } from '../../api';
import { SearchBar } from '../search';
import './FilterControlPanel.css';

interface FilterControlPanelProps {
  businesses: Business[];
  selectedCity: string;
  selectedCategory: string;
  selectedRating: number | null;
  selectedStatus: number | null;
  period: 'month' | 'year';
  selectedYear: number;
  onCityChange: (city: string) => void;
  onCategoryChange: (category: string) => void;
  onRatingChange: (rating: number | null) => void;
  onStatusChange: (status: number | null) => void;
  onPeriodChange: (period: 'month' | 'year') => void;
  onYearChange: (year: number) => void;
  onResetFilters: () => void;
  onBusinessSelect?: (business: Business) => void;
}

const FilterControlPanel: React.FC<FilterControlPanelProps> = ({
  businesses,
  selectedCity,
  selectedCategory,
  selectedRating,
  selectedStatus,
  period,
  selectedYear,
  onCityChange,
  onCategoryChange,
  onRatingChange,
  onStatusChange,
  onPeriodChange,
  onYearChange,
  onResetFilters,
  onBusinessSelect,
}) => {
  // Extract unique cities from businesses
  const cities = [...new Set(businesses.map((b) => b.city))].sort();

  // Extract unique categories from businesses
  const categories = [
    ...new Set(
      businesses.flatMap((b) =>
        b.categories ? b.categories.split(",").map((c) => c.trim()) : []
      )
    ),
  ]
    .slice(0, 200)
    .sort();

  // Generate year range (from 2005 to current year)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2005 + 1 }, (_, i) => currentYear - i).sort((a, b) => a - b);

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
            {cities.map((city) => (
              <option key={city} value={city}>
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
