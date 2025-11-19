/**
 * Competitive Positioning Chart Component
 *
 * Visualizes business competitive positioning using a scatter plot:
 * - X-axis: Review Volume (market presence)
 * - Y-axis: Rating (quality)
 * - Quadrants: Market Leaders, Hidden Gems, At Risk, Challengers
 */

import React, { useMemo } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Label,
  Cell,
} from 'recharts';
import { CompetitiveSnapshot } from '../../api/endpoints/analytics';
import { CHART_COLORS } from '../timeseries/chartConstants';
import { USE_CASE_COLORS } from '../../theme/cloudscapeColors';
import { CARD_STYLE } from '../../theme/sharedStyles';

interface CompetitivePositioningChartProps {
  data: CompetitiveSnapshot | null;
  onBusinessSelect?: (businessId: string) => void;
  selectedBusinessId?: string | null;
}

const getBusinessColor = (
  rating: number,
  reviewCount: number,
  avgRating: number,
  medianReviewCount: number,
  isSelected: boolean
): string => {
  if (isSelected) return CHART_COLORS.business;

  if (rating >= avgRating && reviewCount >= medianReviewCount) {
    return USE_CASE_COLORS.marketLeader;
  } else if (rating >= avgRating && reviewCount < medianReviewCount) {
    return USE_CASE_COLORS.hiddenGem;
  } else if (rating < avgRating && reviewCount >= medianReviewCount) {
    return USE_CASE_COLORS.atRisk;
  } else {
    return USE_CASE_COLORS.challenger;
  }
};

const getQuadrantLabel = (
  rating: number,
  reviewCount: number,
  avgRating: number,
  medianReviewCount: number
): string => {
  if (rating >= avgRating && reviewCount >= medianReviewCount) {
    return 'Market Leader';
  } else if (rating >= avgRating && reviewCount < medianReviewCount) {
    return 'Hidden Gem';
  } else if (rating < avgRating && reviewCount >= medianReviewCount) {
    return 'At Risk';
  } else {
    return 'Challenger';
  }
};

export const CompetitivePositioningChart: React.FC<CompetitivePositioningChartProps> = ({
  data,
  onBusinessSelect,
  selectedBusinessId,
}) => {
  const chartData = useMemo(() => {
    if (!data || !data.businesses) return [];

    return data.businesses
      .filter(b => b.stars !== undefined && b.stars !== null && b.review_count > 0)
      .map(b => ({
        x: Math.log10(b.review_count + 1), // Log scale for better distribution
        y: b.stars,
        rawReviewCount: b.review_count,
        business: b,
        isSelected: b.business_id === selectedBusinessId,
      }));
  }, [data, selectedBusinessId]);

  if (!data || chartData.length === 0) {
    return (
      <div
        style={{
          padding: '3rem',
          textAlign: 'center',
          color: CHART_COLORS.textMuted,
          background: '#0f1b2a',
          borderRadius: '16px',
          border: '1px solid rgba(102, 126, 234, 0.25)',
        }}
      >
        <p style={{ margin: 0, fontSize: '1rem' }}>
          No competitive data available
        </p>
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: CHART_COLORS.textSecondary }}>
          Select a city or category to view market positioning
        </p>
      </div>
    );
  }

  const { statistics } = data;
  const avgRating = statistics.avg_rating;
  const medianReviewCount = statistics.median_review_count;
  const logMedianReviewCount = Math.log10(medianReviewCount + 1);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const business = data.business;
      const quadrant = getQuadrantLabel(
        business.stars,
        business.review_count,
        avgRating,
        medianReviewCount
      );

      return (
        <div
          style={{
            background: '#1a2638',
            border: `2px solid ${CHART_COLORS.business}`,
            borderRadius: '8px',
            padding: '0.75rem',
            color: CHART_COLORS.textPrimary,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
          }}
        >
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>{business.name}</p>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: CHART_COLORS.textSecondary }}>
            {business.city}, {business.state}
          </p>
          <div style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            <p style={{ margin: '0.2rem 0' }}>
              <span style={{ color: CHART_COLORS.textSecondary }}>Rating:</span>{' '}
              <span style={{ fontWeight: 600 }}>{business.stars}★</span>
            </p>
            <p style={{ margin: '0.2rem 0' }}>
              <span style={{ color: CHART_COLORS.textSecondary }}>Reviews:</span>{' '}
              <span style={{ fontWeight: 600 }}>{business.review_count.toLocaleString()}</span>
            </p>
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.85rem', fontStyle: 'italic', color: getBusinessColor(business.stars, business.review_count, avgRating, medianReviewCount, false) }}>
              {quadrant}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: CHART_COLORS.textPrimary }}>
          Competitive Market Positioning
        </h3>
        <p style={{ margin: '0.4rem 0 0.75rem 0', fontSize: '0.9rem', color: CHART_COLORS.textSecondary }}>
          {data.filters.city && data.filters.state
            ? `${data.filters.category ? data.filters.category + ' in ' : ''}${data.filters.city}, ${data.filters.state}`
            : data.filters.category || 'Market Overview'}
        </p>

        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', marginBottom: '1rem' }}>
          <div>
            <span style={{ color: CHART_COLORS.textSecondary }}>Businesses:</span>{' '}
            <span style={{ fontWeight: 600, color: CHART_COLORS.textPrimary }}>
              {statistics.total_businesses.toLocaleString()}
            </span>
          </div>
          <div>
            <span style={{ color: CHART_COLORS.textSecondary }}>Avg Rating:</span>{' '}
            <span style={{ fontWeight: 600, color: CHART_COLORS.textPrimary }}>
              {avgRating.toFixed(2)}★
            </span>
          </div>
          <div>
            <span style={{ color: CHART_COLORS.textSecondary }}>Median Reviews:</span>{' '}
            <span style={{ fontWeight: 600, color: CHART_COLORS.textPrimary }}>
              {medianReviewCount.toLocaleString()}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '13px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: USE_CASE_COLORS.marketLeader }} />
            <span style={{ color: CHART_COLORS.textPrimary, fontWeight: 500 }}>Market Leaders</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: USE_CASE_COLORS.hiddenGem }} />
            <span style={{ color: CHART_COLORS.textPrimary, fontWeight: 500 }}>Hidden Gems</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: USE_CASE_COLORS.atRisk }} />
            <span style={{ color: CHART_COLORS.textPrimary, fontWeight: 500 }}>At Risk</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: USE_CASE_COLORS.challenger }} />
            <span style={{ color: CHART_COLORS.textPrimary, fontWeight: 500 }}>Challengers</span>
          </div>
          {selectedBusinessId && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: CHART_COLORS.business }} />
              <span style={{ color: CHART_COLORS.textPrimary, fontWeight: 500 }}>Selected</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ ...CARD_STYLE, padding: '1rem' }}>
        <ResponsiveContainer width="100%" height={380}>
          <ScatterChart margin={{ top: 20, right: 30, bottom: 60, left: 60 }}>
            <CartesianGrid stroke={CHART_COLORS.gridlines} />

            <XAxis
              type="number"
              dataKey="x"
              stroke={CHART_COLORS.textPrimary}
              tick={{ fill: CHART_COLORS.textPrimary, fontSize: 12 }}
              label={{
                value: 'Review Volume (Market Presence)',
                position: 'insideBottom',
                offset: -10,
                style: { fill: CHART_COLORS.textPrimary, fontSize: 13, fontWeight: 600 },
              }}
              domain={['auto', 'auto']}
              tickFormatter={(value) => Math.round(Math.pow(10, value)).toLocaleString()}
            />

            <YAxis
              type="number"
              dataKey="y"
              stroke={CHART_COLORS.textPrimary}
              tick={{ fill: CHART_COLORS.textPrimary, fontSize: 12 }}
              label={{
                value: 'Rating (Quality)',
                angle: -90,
                position: 'insideLeft',
                style: { fill: CHART_COLORS.textPrimary, fontSize: 13, fontWeight: 600 },
              }}
              domain={[1, 5]}
              ticks={[1, 2, 3, 4, 5]}
            />

            <ReferenceLine
              y={avgRating}
              stroke={CHART_COLORS.city}
              strokeWidth={2}
              strokeOpacity={0.6}
            >
              <Label
                value={`Avg: ${avgRating.toFixed(2)}★`}
                position="right"
                style={{ fill: CHART_COLORS.city, fontSize: 11, fontWeight: 600 }}
              />
            </ReferenceLine>

            <ReferenceLine
              x={logMedianReviewCount}
              stroke={CHART_COLORS.category}
              strokeWidth={2}
              strokeOpacity={0.6}
            >
              <Label
                value={`Median: ${medianReviewCount}`}
                position="top"
                style={{ fill: CHART_COLORS.category, fontSize: 11, fontWeight: 600 }}
              />
            </ReferenceLine>

            <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />

            <Scatter
              data={chartData}
              fill={CHART_COLORS.business}
              onClick={(data: any) => {
                if (onBusinessSelect && data.business) {
                  onBusinessSelect(data.business.business_id);
                }
              }}
              style={{ cursor: 'pointer' }}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getBusinessColor(
                    entry.y,
                    entry.rawReviewCount,
                    avgRating,
                    medianReviewCount,
                    entry.isSelected
                  )}
                  r={entry.isSelected ? 10 : 6}
                  opacity={entry.isSelected ? 1 : 0.7}
                  stroke={entry.isSelected ? '#fff' : 'none'}
                  strokeWidth={entry.isSelected ? 2 : 0}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CompetitivePositioningChart;
