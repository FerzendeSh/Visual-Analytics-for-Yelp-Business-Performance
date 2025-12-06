import React from 'react';
import { X } from 'lucide-react';
import './FilterSummary.css';

interface FilterTag {
  label: string;
  onRemove: () => void;
}

interface FilterSummaryProps {
  filters: FilterTag[];
  selectedCity?: string;
  selectedCategory?: string;
  selectedNeighborhood?: string;
  minRating?: number;
  maxRating?: number;
  selectedStatus?: number | null;
  onCityChange?: (city: string) => void;
  onCategoryChange?: (category: string) => void;
  onNeighborhoodChange?: (neighborhood: string) => void;
  onMinRatingChange?: (rating: number) => void;
  onMaxRatingChange?: (rating: number) => void;
  onStatusChange?: (status: number | null) => void;
}

const FilterSummary: React.FC<FilterSummaryProps> = ({
  filters,
  selectedCity,
  selectedCategory,
  selectedNeighborhood,
  minRating,
  maxRating,
  selectedStatus,
  onCityChange,
  onCategoryChange,
  onNeighborhoodChange,
  onMinRatingChange,
  onMaxRatingChange,
  onStatusChange,
}) => {
  if (filters.length === 0) {
    return null;
  }

  return (
    <div className="filter-summary">
      <div className="filter-summary-container">
        <span className="filter-summary-label">Active Filters:</span>
        <div className="filter-summary-tags">
          {selectedCity && (
            <div className="filter-tag">
              <span className="filter-tag-label">City: {selectedCity.split('|')[0]}</span>
              <button
                className="filter-tag-remove"
                onClick={() => onCityChange?.('')}
                aria-label="Remove city filter"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {selectedNeighborhood && (
            <div className="filter-tag">
              <span className="filter-tag-label">Neighborhood: {selectedNeighborhood}</span>
              <button
                className="filter-tag-remove"
                onClick={() => onNeighborhoodChange?.('')}
                aria-label="Remove neighborhood filter"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {selectedCategory && (
            <div className="filter-tag">
              <span className="filter-tag-label">Category: {selectedCategory}</span>
              <button
                className="filter-tag-remove"
                onClick={() => onCategoryChange?.('')}
                aria-label="Remove category filter"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {(minRating !== 1 || maxRating !== 5) && (
            <div className="filter-tag">
              <span className="filter-tag-label">Rating: {minRating}★ - {maxRating}★</span>
              <button
                className="filter-tag-remove"
                onClick={() => {
                  onMinRatingChange?.(1);
                  onMaxRatingChange?.(5);
                }}
                aria-label="Remove rating filter"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {selectedStatus !== null && (
            <div className="filter-tag">
              <span className="filter-tag-label">
                Status: {selectedStatus === 1 ? 'Open' : 'Closed'}
              </span>
              <button
                className="filter-tag-remove"
                onClick={() => onStatusChange?.(null)}
                aria-label="Remove status filter"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterSummary;
