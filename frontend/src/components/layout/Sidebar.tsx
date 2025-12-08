import React, { useState, useEffect, memo } from 'react';
import { useMyBusiness } from '../../context/BusinessContext';
import { Business } from '../../api';
import { getNeighborhoods } from '../../api/endpoints/locations';
import { SearchBar } from '../search';
import { formatNeighborhoodName } from '../../utils';
import { ChevronDown, Trash2 } from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
  businesses?: Business[];
  selectedCity?: string;
  selectedCategory?: string;
  selectedNeighborhood?: string;
  minRating?: number;
  maxRating?: number;
  selectedStatus?: number | null;
  period?: 'month' | 'year';
  selectedYear?: number;
  onCityChange?: (city: string) => void;
  onCategoryChange?: (category: string) => void;
  onNeighborhoodChange?: (neighborhood: string) => void;
  onMinRatingChange?: (rating: number) => void;
  onMaxRatingChange?: (rating: number) => void;
  onStatusChange?: (status: number | null) => void;
  onPeriodChange?: (period: 'month' | 'year') => void;
  onYearChange?: (year: number) => void;
  onResetFilters?: () => void;
  onBusinessSelect?: (business: Business | null) => void;
  comparisonBusinesses?: Business[];
  availableYears?: number[];
}

const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed = false,
  onToggle,
  businesses = [],
  selectedCity = "",
  selectedCategory = "",
  selectedNeighborhood = "",
  minRating = 1,
  maxRating = 5,
  selectedStatus = null,
  period = 'year',
  selectedYear = new Date().getFullYear(),
  onCityChange = () => {},
  onCategoryChange = () => {},
  onNeighborhoodChange = () => {},
  onMinRatingChange = () => {},
  onMaxRatingChange = () => {},
  onStatusChange = () => {},
  onPeriodChange = () => {},
  onYearChange = () => {},
  onResetFilters = () => {},
  onBusinessSelect = () => {},
  comparisonBusinesses = [],
  availableYears = [],
}) => {
  const currentYear = new Date().getFullYear();
  const yearsToDisplay = availableYears.length > 0
    ? [...availableYears].sort((a, b) => b - a) // Sort descending
    : [currentYear]; // Default to current year if no available years
  // Note: myBusiness context is available for future use (e.g., highlighting in comparison)
  const { myBusiness: _myBusiness } = useMyBusiness();

  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [loadingNeighborhoods, setLoadingNeighborhoods] = useState(false);
  
  // Collapsible group states
  const [locationExpanded, setLocationExpanded] = useState(true);
  const [attributesExpanded, setAttributesExpanded] = useState(false);
  const [timeExpanded, setTimeExpanded] = useState(false);

  // Prepare filter options
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
      onNeighborhoodChange('');
    }
  }, [selectedCity, onNeighborhoodChange]);

  const isSpecificCitySelected = selectedCity && selectedCity !== '';

  // Calculate filter counts by category
  const locationFiltersCount = [
    selectedCity && selectedCity !== '',
    selectedNeighborhood && selectedNeighborhood !== '',
  ].filter(Boolean).length;

  const attributeFiltersCount = [
    selectedCategory && selectedCategory !== '',
    minRating !== 1 || maxRating !== 5,
    selectedStatus !== null,
  ].filter(Boolean).length;

  const timeFiltersCount = [
    period === 'month' && selectedYear !== new Date().getFullYear(),
  ].filter(Boolean).length;

  const appliedFiltersCount = locationFiltersCount + attributeFiltersCount + timeFiltersCount;
  const hasComparisonBusinesses = comparisonBusinesses.length > 0;

  return (
    <aside className={`sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <button
        className="sidebar-toggle"
        onClick={onToggle}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isCollapsed ? '→' : '←'}
      </button>

      {!isCollapsed && (
        <div className="sidebar-filters">
          {/* Search Box - Always Visible */}
          <div className="sidebar-search-box">
            {onBusinessSelect && <SearchBar onBusinessSelect={onBusinessSelect} />}
          </div>

          {/* Location Group */}
          <div className="sidebar-filter-group">
            <button
              className="sidebar-filter-group-header"
              onClick={() => setLocationExpanded(!locationExpanded)}
            >
              <div className="sidebar-filter-group-title-wrapper">
                <span className="sidebar-filter-group-title">Location</span>
                {locationFiltersCount > 0 && (
                  <span className="filter-count-badge">{locationFiltersCount}</span>
                )}
              </div>
              <ChevronDown
                size={14}
                className={`sidebar-filter-group-chevron ${locationExpanded ? 'expanded' : ''}`}
              />
            </button>

            {locationExpanded && (
              <div className="sidebar-filter-group-content">
                {/* City Dropdown */}
                <div className="sidebar-form-group">
                  <label className="sidebar-label-text">City</label>
                  <div className="sidebar-select-wrapper">
                    <select
                      value={selectedCity}
                      onChange={(e) => onCityChange(e.target.value)}
                      className="sidebar-select"
                    >
                      <option value="">All Cities</option>
                      {cities.map(({ city, state }) => (
                        <option key={`${city}|${state}`} value={`${city}|${state}`}>
                          {city}, {state}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="sidebar-select-icon" size={14} />
                  </div>
                </div>

                {/* Neighborhood Dropdown (Conditional) */}
                {isSpecificCitySelected && (
                  <div className="sidebar-form-group sidebar-form-group--animate">
                    <label className="sidebar-label-text">Neighborhood</label>
                    <div className="sidebar-select-wrapper">
                      <select
                        value={selectedNeighborhood}
                        onChange={(e) => onNeighborhoodChange(e.target.value)}
                        className="sidebar-select"
                        disabled={loadingNeighborhoods}
                      >
                        <option value="">
                          {loadingNeighborhoods ? 'Loading...' : 'All Neighborhoods'}
                        </option>
                        {neighborhoods.map((neighborhood) => (
                          <option key={neighborhood} value={neighborhood}>
                            {formatNeighborhoodName(neighborhood)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="sidebar-select-icon" size={14} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Attributes Group */}
          <div className="sidebar-filter-group">
            <button
              className="sidebar-filter-group-header"
              onClick={() => setAttributesExpanded(!attributesExpanded)}
            >
              <div className="sidebar-filter-group-title-wrapper">
                <span className="sidebar-filter-group-title">Attributes</span>
                {attributeFiltersCount > 0 && (
                  <span className="filter-count-badge">{attributeFiltersCount}</span>
                )}
              </div>
              <ChevronDown
                size={14}
                className={`sidebar-filter-group-chevron ${attributesExpanded ? 'expanded' : ''}`}
              />
            </button>

            {attributesExpanded && (
              <div className="sidebar-filter-group-content">
                {/* Category Dropdown */}
                <div className="sidebar-form-group">
                  <label className="sidebar-label-text">Category</label>
                  <div className="sidebar-select-wrapper">
                    <select
                      value={selectedCategory}
                      onChange={(e) => onCategoryChange(e.target.value)}
                      className="sidebar-select"
                    >
                      <option value="">All Categories</option>
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="sidebar-select-icon" size={14} />
                  </div>
                </div>

                {/* Rating Threshold */}
                <div className="sidebar-form-group">
                  <label className="sidebar-label-text">Rating Range</label>
                  <div className="sidebar-rating-slider">
                    <div className="sidebar-rating-values">
                      <span className="sidebar-rating-min">{minRating}★</span>
                      <div className="sidebar-slider-container">
                        <input
                          type="range"
                          min="2"
                          max="10"
                          step="1"
                          value={minRating * 2}
                          onChange={(e) => {
                            const newMin = Number(e.target.value) / 2;
                            if (newMin <= maxRating) {
                              onMinRatingChange(newMin);
                            }
                          }}
                          className="sidebar-slider sidebar-slider-min"
                        />
                        <input
                          type="range"
                          min="2"
                          max="10"
                          step="1"
                          value={maxRating * 2}
                          onChange={(e) => {
                            const newMax = Number(e.target.value) / 2;
                            if (newMax >= minRating) {
                              onMaxRatingChange(newMax);
                            }
                          }}
                          className="sidebar-slider sidebar-slider-max"
                        />
                        <div className="sidebar-slider-track" />
                      </div>
                      <span className="sidebar-rating-max">{maxRating}★</span>
                    </div>
                  </div>
                </div>

                {/* Status Toggle */}
                <div className="sidebar-form-group">
                  <label className="sidebar-label-text">Status</label>
                  <div className="sidebar-status-group">
                    <button
                      className={`sidebar-status-btn ${selectedStatus === 1 ? 'active' : ''}`}
                      onClick={() => onStatusChange(selectedStatus === 1 ? null : 1)}
                      title="Filter to open businesses"
                    >
                      Open
                    </button>
                    <button
                      className={`sidebar-status-btn ${selectedStatus === 0 ? 'active' : ''}`}
                      onClick={() => onStatusChange(selectedStatus === 0 ? null : 0)}
                      title="Filter to closed businesses"
                    >
                      Closed
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Time Period Group */}
          <div className="sidebar-filter-group">
            <button
              className="sidebar-filter-group-header"
              onClick={() => setTimeExpanded(!timeExpanded)}
            >
              <div className="sidebar-filter-group-title-wrapper">
                <span className="sidebar-filter-group-title">Time Period</span>
                {timeFiltersCount > 0 && (
                  <span className="filter-count-badge">{timeFiltersCount}</span>
                )}
              </div>
              <ChevronDown
                size={14}
                className={`sidebar-filter-group-chevron ${timeExpanded ? 'expanded' : ''}`}
              />
            </button>

            {timeExpanded && (
              <div className="sidebar-filter-group-content">
                {/* Time Period Dropdown */}
                <div className="sidebar-form-group">
                  <label className="sidebar-label-text">View</label>
                  <div className="sidebar-select-wrapper">
                    <select
                      value={period}
                      onChange={(e) => onPeriodChange(e.target.value as 'month' | 'year')}
                      className="sidebar-select"
                    >
                      <option value="year">Yearly</option>
                      <option value="month">Monthly (per Year)</option>
                    </select>
                    <ChevronDown className="sidebar-select-icon" size={14} />
                  </div>
                </div>

                {/* Year Selector (Conditional) */}
                {period === 'month' && (
                  <div className="sidebar-form-group sidebar-form-group--animate">
                    <label className="sidebar-label-text">Year</label>
                    <div className="sidebar-select-wrapper">
                      <select
                        value={selectedYear}
                        onChange={(e) => onYearChange(Number(e.target.value))}
                        className="sidebar-select"
                      >
                        {yearsToDisplay.map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="sidebar-select-icon" size={14} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Clear All Actions */}
          {(appliedFiltersCount > 0 || hasComparisonBusinesses) && (
            <div className="sidebar-clear-actions">
              <button
                onClick={onResetFilters}
                className="sidebar-clear-btn"
                title="Clear all filters and comparison businesses"
              >
                <Trash2 size={12} />
                <span>Clear Filters</span>
              </button>
            </div>
          )}
        </div>
      )}

      {!isCollapsed && (
        <div className="sidebar-footer">
          <div className="sidebar-info">
            <p className="sidebar-version">v1.0.0</p>
          </div>
        </div>
      )}
    </aside>
  );
};

export default memo(Sidebar);
