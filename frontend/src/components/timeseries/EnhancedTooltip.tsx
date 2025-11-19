/**
 * Enhanced Tooltip Component
 * Rich tooltip with review count, period-over-period change, and context
 */

import React from 'react';
import { TimeSeriesDataPoint } from '../../api/endpoints/analytics';
import { calculatePeriodChange } from './trendUtils';
import { CHART_COLORS, formatPercentChange } from './chartConstants';

interface EnhancedTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  data: TimeSeriesDataPoint[];
  metric: 'avg_rating' | 'avg_sentiment_score';
  period: 'month' | 'year';
}

function formatDateForPeriod(dateString: string, period: 'month' | 'year'): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return dateString;
    }

    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();

    switch (period) {
      case 'month':
        return `${month} ${year}`;
      case 'year':
        return `${year}`;
      default:
        return dateString;
    }
  } catch {
    return dateString;
  }
}

export const EnhancedTooltip: React.FC<EnhancedTooltipProps> = ({
  active,
  payload,
  label,
  data,
  metric,
  period,
}) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  // Find the data point for this period
  const dataPoint = data.find(d => d.period_start === label);
  const reviewCount = dataPoint?.review_count || 0;

  // Calculate period-over-period change
  const change = calculatePeriodChange(data, label || '', metric);

  return (
    <div
      style={{
        backgroundColor: '#1a202c',
        border: '1px solid #4a5568',
        borderRadius: '8px',
        padding: '0.75rem',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
        minWidth: '200px',
      }}
    >
      {/* Period label */}
      <div
        style={{
          color: CHART_COLORS.textPrimary,
          fontWeight: 600,
          fontSize: '0.85rem',
          marginBottom: '0.5rem',
          paddingBottom: '0.5rem',
          borderBottom: `1px solid ${CHART_COLORS.gridlines}`,
        }}
      >
        {formatDateForPeriod(label || '', period)}
      </div>

      {/* Values */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {payload.map((entry, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div
                style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '2px',
                  backgroundColor: entry.color,
                }}
              />
              <span
                style={{
                  color: CHART_COLORS.textSecondary,
                  fontSize: '0.8rem',
                }}
              >
                {entry.name}:
              </span>
            </div>
            <span
              style={{
                color: CHART_COLORS.textPrimary,
                fontWeight: 600,
                fontSize: '0.85rem',
              }}
            >
              {typeof entry.value === 'number'
                ? entry.value.toFixed(metric === 'avg_rating' ? 2 : 3)
                : entry.value}
            </span>
          </div>
        ))}
      </div>

      {/* Review count context */}
      {reviewCount > 0 && (
        <div
          style={{
            marginTop: '0.5rem',
            paddingTop: '0.5rem',
            borderTop: `1px solid ${CHART_COLORS.gridlines}`,
            color: CHART_COLORS.textMuted,
            fontSize: '0.75rem',
          }}
        >
          Based on {reviewCount.toLocaleString()} review{reviewCount !== 1 ? 's' : ''}
        </div>
      )}

      {/* Period-over-period change */}
      {change && (
        <div
          style={{
            marginTop: '0.35rem',
            padding: '0.3rem 0.5rem',
            background: `${change.change >= 0 ? CHART_COLORS.improving : CHART_COLORS.declining}15`,
            borderRadius: '4px',
            fontSize: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
          }}
        >
          <span
            style={{
              color: change.change >= 0 ? CHART_COLORS.improving : CHART_COLORS.declining,
              fontWeight: 600,
            }}
          >
            {change.change >= 0 ? '↗' : '↘'} {formatPercentChange(change.changePercent)}
          </span>
          <span style={{ color: CHART_COLORS.textMuted }}>vs previous period</span>
        </div>
      )}
    </div>
  );
};

export default EnhancedTooltip;
