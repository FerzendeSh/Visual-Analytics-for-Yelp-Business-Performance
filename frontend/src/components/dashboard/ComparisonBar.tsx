import React from 'react';
import { Business } from '../../api';
import { CATEGORICAL_COLORS } from '../../theme/cloudscapeColors';
import './ComparisonBar.css';

interface ComparisonBarProps {
  myBusiness: Business | null;
  comparisonBusinesses: Business[];
  onRemove: (businessId: string) => void;
  onClear: () => void;
}

// Color palette for comparison businesses (matching chart colors)
const COMPARISON_COLORS = [
  CATEGORICAL_COLORS.categorical2, // Pink
  CATEGORICAL_COLORS.categorical3, // Teal
  CATEGORICAL_COLORS.categorical4, // Purple
  CATEGORICAL_COLORS.categorical5, // Orange
  CATEGORICAL_COLORS.categorical6, // Dark Blue
] as const;

const getComparisonColor = (index: number): string => {
  return COMPARISON_COLORS[index % COMPARISON_COLORS.length];
};

const ComparisonBar: React.FC<ComparisonBarProps> = ({
  myBusiness,
  comparisonBusinesses,
  onRemove,
  onClear,
}) => {
  if (!myBusiness && comparisonBusinesses.length === 0) {
    return null;
  }

  return (
    <div className="comparison-bar">
      <div className="comparison-bar-content">
        <div className="comparison-label">
          <span className="comparison-count">
            Comparing {1 + comparisonBusinesses.length} businesses
          </span>
        </div>

        <div className="comparison-chips">
          {/* My Business chip */}
          {myBusiness && (
            <div className="business-chip my-business">
              <div
                className="chip-color"
                style={{ backgroundColor: CATEGORICAL_COLORS.categorical1 }}
              ></div>
              <span className="chip-name">{myBusiness.name}</span>
              <span className="chip-label">(My Business)</span>
            </div>
          )}

          {/* Comparison businesses chips */}
          {comparisonBusinesses.map((business, index) => (
            <div key={business.business_id} className="business-chip comparison">
              <div
                className="chip-color"
                style={{ backgroundColor: getComparisonColor(index) }}
              ></div>
              <span className="chip-name">{business.name}</span>
              <button
                className="chip-remove"
                onClick={() => onRemove(business.business_id)}
                aria-label={`Remove ${business.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        {comparisonBusinesses.length > 0 && (
          <button className="clear-all-btn" onClick={onClear}>
            Clear All
          </button>
        )}
      </div>
    </div>
  );
};

export default ComparisonBar;
