import React, { useState, useEffect, useMemo } from 'react';
import { useMyBusiness } from '../../context/BusinessContext';
import { Business } from '../../api';
import { getNeighborhoods } from '../../api/endpoints/locations';
import { SearchBar } from '../search';
import { formatNeighborhoodName } from '../../utils';
import { ChevronDown, Trash2, X } from 'lucide-react';
import { getSeriesColor } from '../timeseries/chartConstants';
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
  compareByCity?: boolean;
  compareByCategory?: boolean;
  compareByNeighborhood?: boolean;
  comparisonBusinesses?: Business[];
  onCompareByCity?: (compare: boolean) => void;
  onCompareByCategory?: (compare: boolean) => void;
  onCompareByNeighborhood?: (compare: boolean) => void;
  onComparisonBusinessesChange?: (businesses: Business[]) => void;
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
  compareByCity = false,
  compareByCategory = false,
  compareByNeighborhood = false,
  comparisonBusinesses = [],
  onCompareByCity = () => {},
  onCompareByCategory = () => {},
  onCompareByNeighborhood = () => {},
  onComparisonBusinessesChange = () => {},
}) => {
  const { myBusiness } = useMyBusiness();

  const [neighborhoods, setNeighborhoods] = useState<string[]>([]);
  const [loadingNeighborhoods, setLoadingNeighborhoods] = useState(false);
  const [comparisonGroupExpanded, setComparisonGroupExpanded] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(true);

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

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear - 2005 + 1 }, (_, i) => currentYear - i).sort((a, b) => a - b);

  // Calculate color indices for comparison businesses
  // This matches the series order in the charts:
  // 0: Primary business/city/neighborhood
  // 1: City/Neighborhood avg (if compareByCity/compareByNeighborhood is checked)
  // 2: Category avg (if compareByCategory is checked)
  // 3+: Comparison businesses
  const getComparisonBusinessColor = useMemo(() => {
    return (index: number): string => {
      let colorIndex = 1; // Start after primary (which is 0)

      // Add offset if comparing by city/neighborhood
      if (compareByCity || compareByNeighborhood) {
        colorIndex++;
      }

      // Add offset if comparing by category
      if (compareByCategory) {
        colorIndex++;
      }

      // Add the business index
      return getSeriesColor(colorIndex + index);
    };
  }, [compareByCity, compareByCategory, compareByNeighborhood]);

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
  const appliedFiltersCount = [
    selectedCity && selectedCity !== '',
    selectedCategory && selectedCategory !== '',
    selectedNeighborhood && selectedNeighborhood !== '',
    minRating !== 1 || maxRating !== 5,
    selectedStatus !== null,
    compareByCity,
    compareByCategory,
    compareByNeighborhood,
    comparisonBusinesses.length > 0,
  ].filter(Boolean).length;

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
          {/* Filters Header with Clear All and Toggle */}
          <div className="sidebar-filters-header-wrapper">
            <button
              className="sidebar-filters-header-button"
              onClick={() => setFiltersExpanded(!filtersExpanded)}
            >
              <div className="sidebar-filters-header">
                <h3 className="sidebar-filters-title">Filters</h3>
              </div>
              <ChevronDown
                size={12}
                style={{
                  transform: filtersExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </button>
            {appliedFiltersCount > 0 && (
              <button
                onClick={onResetFilters}
                className="sidebar-clear-all"
                title="Clear all filters"
              >
                <Trash2 size={12} />
                <span>Clear All</span>
              </button>
            )}
          </div>

          {filtersExpanded && (
            <>
              {/* Search Box */}
              <div className="sidebar-search-box sidebar-search-box--top">
                {onBusinessSelect && <SearchBar onBusinessSelect={onBusinessSelect} />}
              </div>

              {/* Primary Filters */}
              <div className="sidebar-primary-filters sidebar-form-group--animate">
            {/* City Dropdown */}
            <div className="sidebar-form-group">
              <label className="sidebar-label-text">City</label>
              <div className="sidebar-select-wrapper">
                <select
                  value={selectedCity}
                  onChange={(e) => onCityChange(e.target.value)}
                  className="sidebar-select"
                >
                  <option value="">Cities</option>
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

            {/* Category Dropdown */}
            <div className="sidebar-form-group">
              <label className="sidebar-label-text">Category</label>
              <div className="sidebar-select-wrapper">
                <select
                  value={selectedCategory}
                  onChange={(e) => onCategoryChange(e.target.value)}
                  className="sidebar-select"
                >
                  <option value="">Categories</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <ChevronDown className="sidebar-select-icon" size={14} />
              </div>
            </div>

            {/* Rating Threshold - Dual Range Slider */}
            <div className="sidebar-form-group">
              <label className="sidebar-label-text">Rating Threshold</label>
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

            {/* Time Period */}
            <div className="sidebar-form-group">
              <label className="sidebar-label-text">Time Period</label>
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
                <label className="sidebar-label-text">Select Year</label>
                <div className="sidebar-select-wrapper">
                  <select
                    value={selectedYear}
                    onChange={(e) => onYearChange(Number(e.target.value))}
                    className="sidebar-select"
                  >
                    {years.map((year) => (
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
            </>
          )}

          {/* Comparison Group Section */}
          <div className="sidebar-comparison-group">
            <button
              className="sidebar-comparison-header"
              onClick={() => setComparisonGroupExpanded(!comparisonGroupExpanded)}
            >
              <div className="sidebar-comparison-title-wrapper">
                <h3 className="sidebar-comparison-title">Comparison Group</h3>
              </div>
              <ChevronDown
                size={12}
                style={{
                  transform: comparisonGroupExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </button>

            {comparisonGroupExpanded && (
              <div className="sidebar-comparison-content sidebar-form-group--animate">
                {/* Comparison Checkboxes */}
                <div className="sidebar-benchmark-items">
                  <label className="sidebar-benchmark-item">
                    <input
                      type="checkbox"
                      checked={compareByCity}
                      onChange={(e) => onCompareByCity(e.target.checked)}
                      className="sidebar-benchmark-checkbox"
                    />
                    <span>Compare against City</span>
                  </label>
                  <label className="sidebar-benchmark-item">
                    <input
                      type="checkbox"
                      checked={compareByCategory}
                      onChange={(e) => onCompareByCategory(e.target.checked)}
                      className="sidebar-benchmark-checkbox"
                    />
                    <span>Compare against Category</span>
                  </label>
                  {selectedCity && (
                    <label className="sidebar-benchmark-item">
                      <input
                        type="checkbox"
                        checked={compareByNeighborhood}
                        onChange={(e) => onCompareByNeighborhood(e.target.checked)}
                        className="sidebar-benchmark-checkbox"
                      />
                      <span>Compare against Neighborhood</span>
                    </label>
                  )}
                </div>

                {/* Competitor Chips */}
                {comparisonBusinesses.length > 0 && (
                  <div className="sidebar-competitors">
                    <div className="sidebar-competitor-chips">
                      {comparisonBusinesses.map((business, index) => (
                        <div key={business.business_id} className="sidebar-comparison-business-item">
                          <span
                            className="sidebar-comparison-dot"
                            style={{ backgroundColor: getComparisonBusinessColor(index) }}
                          ></span>
                          <span className="sidebar-comparison-business-name">{business.name}</span>
                          <button
                            onClick={() =>
                              onComparisonBusinessesChange(
                                comparisonBusinesses.filter((b) => b.business_id !== business.business_id)
                              )
                            }
                            className="sidebar-comparison-remove"
                            aria-label="Remove competitor"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Competitors Button */}
                {comparisonBusinesses.length < 3 && (
                  <button className="sidebar-add-competitors-btn">
                    + Select Businesses For Comparsion ({3 - comparisonBusinesses.length} left)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {!isCollapsed && (
        <div className="sidebar-footer">
          <div className="sidebar-info">
            <div className="my-business-info">
              <p className="my-business-label">My Business</p>
              <p className="my-business-name">{myBusiness?.name || 'Loading...'}</p>
            </div>
            <p className="sidebar-version">v1.0.0</p>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
