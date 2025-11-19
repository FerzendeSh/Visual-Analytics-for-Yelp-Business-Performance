import React from 'react';
import { TrendAnalysis } from './trendUtils';
import { CHART_COLORS, getTrendColor, getTrendIcon, formatPercentChange } from './chartConstants';

interface TrendIndicatorProps {
  trend: TrendAnalysis | null;
  metric: 'rating' | 'sentiment';
  className?: string;
}

export const TrendIndicator: React.FC<TrendIndicatorProps> = ({ trend, className = '' }) => {
  if (!trend) {
    return null;
  }

  const trendColor = getTrendColor(trend.changePercent);
  const trendIcon = getTrendIcon(trend.changePercent);
  const changeText = formatPercentChange(trend.changePercent);

  let description = '';
  if (trend.direction === 'improving') {
    description = 'Improving trend';
  } else if (trend.direction === 'declining') {
    description = 'Declining trend';
  } else {
    description = 'Stable trend';
  }

  return (
    <div
      className={`trend-indicator ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.6rem',
        padding: '0.6rem 1rem',
        background: `${trendColor}20`,
        border: `2px solid ${trendColor}60`,
        borderRadius: '8px',
        fontSize: '0.95rem',
        fontWeight: 600,
      }}
      role="status"
      aria-label={`${description}: ${changeText}`}
    >
      <span
        style={{
          fontSize: '1.3rem',
          lineHeight: 1,
        }}
        aria-hidden="true"
      >
        {trendIcon}
      </span>
      <span
        style={{
          color: trendColor,
          fontWeight: 700,
          fontSize: '1rem',
        }}
      >
        {changeText}
      </span>
      <span
        style={{
          color: CHART_COLORS.textSecondary,
          fontSize: '0.85rem',
        }}
      >
        vs previous
      </span>
    </div>
  );
};

export default TrendIndicator;
