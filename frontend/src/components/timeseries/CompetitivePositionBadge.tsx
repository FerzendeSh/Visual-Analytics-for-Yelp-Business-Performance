import React from 'react';
import { CompetitivePosition } from './trendUtils';
import { CHART_COLORS, formatPercentChange } from './chartConstants';

interface CompetitivePositionBadgeProps {
  position: CompetitivePosition | null;
  comparisonType: 'city' | 'category';
  comparisonName?: string;
  className?: string;
}

export const CompetitivePositionBadge: React.FC<CompetitivePositionBadgeProps> = ({
  position,
  comparisonType,
  comparisonName,
  className = '',
}) => {
  if (!position) {
    return null;
  }

  const { isAboveAverage, gapPercent } = position;
  const color = isAboveAverage ? CHART_COLORS.improving : CHART_COLORS.declining;
  const icon = isAboveAverage ? '▲' : '▼';
  const direction = isAboveAverage ? 'above' : 'below';
  const displayName = comparisonName || (comparisonType === 'city' ? 'city' : 'category');

  return (
    <div
      className={`competitive-position-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.6rem 1rem',
        background: `${color}20`,
        border: `2px solid ${color}60`,
        borderRadius: '8px',
        fontSize: '0.9rem',
        fontWeight: 600,
      }}
      role="status"
      aria-label={`${formatPercentChange(Math.abs(gapPercent))} ${direction} ${displayName} average`}
    >
      <span
        style={{
          color: color,
          fontSize: '0.9rem',
          lineHeight: 1,
          fontWeight: 700,
        }}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span
        style={{
          color: color,
          fontWeight: 700,
          fontSize: '1rem',
        }}
      >
        {formatPercentChange(Math.abs(gapPercent))}
      </span>
      <span
        style={{
          color: CHART_COLORS.textSecondary,
          fontSize: '0.85rem',
        }}
      >
        {direction} {displayName} avg
      </span>
    </div>
  );
};

export default CompetitivePositionBadge;
