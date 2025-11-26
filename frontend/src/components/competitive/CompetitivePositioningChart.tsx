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
import { CHART_COLORS, COMPARISON_COLORS } from '../timeseries/chartConstants';
import { USE_CASE_COLORS } from '../../theme/cloudscapeColors';
import { CARD_STYLE } from '../../theme/sharedStyles';

interface CompetitivePositioningChartProps {
  data: CompetitiveSnapshot | null;
  onBusinessSelect?: (businessId: string) => void;
  selectedBusinessId?: string | null;
  comparisonBusinessIds?: string[];
  myBusinessId?: string;
}

const getBusinessColor = (
  rating: number,
  reviewCount: number,
  avgRating: number,
  medianReviewCount: number,
  isMyBusiness: boolean,
  isComparison: boolean
): string => {
  // Highlight own business in primary color
  if (isMyBusiness) return CHART_COLORS.business;
  // Highlight comparison businesses in secondary color
  if (isComparison) return USE_CASE_COLORS.primarySeries;

  // Quadrant-based colors for other businesses
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

// Get comparison business stroke color by index (matches time series line colors)
const getComparisonStrokeColor = (index: number): string => {
  return COMPARISON_COLORS[index % COMPARISON_COLORS.length];
};

export const CompetitivePositioningChart: React.FC<CompetitivePositioningChartProps> = ({
  data,
  onBusinessSelect,
  selectedBusinessId,
  comparisonBusinessIds = [],
  myBusinessId,
}) => {
  const chartData = useMemo(() => {
    if (!data || !data.businesses) return [];

    let businesses = data.businesses
      .filter(b => b.stars !== undefined && b.stars !== null && b.review_count > 0)
      .map(b => ({
        x: Math.log10(b.review_count + 1), // Log scale for better distribution
        y: b.stars,
        rawReviewCount: b.review_count,
        business: b,
        isMyBusiness: b.business_id === myBusinessId,
        isComparison: comparisonBusinessIds.includes(b.business_id),
      }));

    // If myBusiness exists but is not in the current data (e.g., different city),
    // add it to the chart for reference (not part of calculations)
    if (myBusinessId && data.selected_business &&
        !businesses.some(b => b.business.business_id === myBusinessId)) {
      const myBiz = data.selected_business;
      if (myBiz.stars !== undefined && myBiz.stars !== null && myBiz.review_count > 0) {
        businesses.push({
          x: Math.log10(myBiz.review_count + 1),
          y: myBiz.stars,
          rawReviewCount: myBiz.review_count,
          business: myBiz,
          isMyBusiness: true,
          isComparison: false,
        });
      }
    }

    return businesses;
  }, [data, myBusinessId, comparisonBusinessIds]);

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
      const isComparison = comparisonBusinessIds.includes(business.business_id);

      const isMyBusiness = business.business_id === myBusinessId;

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
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>
            {business.name}
            {isMyBusiness && (
              <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: CHART_COLORS.business }}>
                ★ Your Business
              </span>
            )}
            {isComparison && (
              <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: USE_CASE_COLORS.primarySeries }}>
                ★ Comparison
              </span>
            )}
          </p>
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
            <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.85rem', fontStyle: 'italic', color: getBusinessColor(business.stars, business.review_count, avgRating, medianReviewCount, isMyBusiness, isComparison) }}>
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
            >
              {chartData.map((entry, index) => {
                const color = getBusinessColor(
                  entry.y,
                  entry.rawReviewCount,
                  avgRating,
                  medianReviewCount,
                  entry.isMyBusiness,
                  entry.isComparison
                );

                const isSelected = selectedBusinessId === entry.business.business_id;
                const hasSelection = !!selectedBusinessId;

                // Get comparison index from comparisonBusinessIds
                const comparisonIndex = entry.isComparison
                  ? comparisonBusinessIds.findIndex(id => id === entry.business.business_id)
                  : -1;

                // Determine size and stroke based on state
                let radius = entry.isMyBusiness ? 12 : (entry.isComparison ? 9 : 6);
                let opacity = entry.isMyBusiness ? 1 : (entry.isComparison ? 0.85 : 0.6);
                let stroke = entry.isMyBusiness ? '#FFD700' : 'none';
                let strokeWidth = entry.isMyBusiness ? 3 : 0;
                let filter = 'none';

                // If a business is selected, fade out non-selected, non-my-business, non-comparison dots
                if (hasSelection && !isSelected && !entry.isMyBusiness && !entry.isComparison) {
                  opacity = opacity * 0.25;  // Make unselected dots pale
                }

                // For comparison businesses: add stroke matching their time series line color and glow effect
                if (entry.isComparison && comparisonIndex >= 0) {
                  stroke = getComparisonStrokeColor(comparisonIndex);
                  strokeWidth = 2.5;
                  // Add glow/shadow effect
                  filter = `drop-shadow(0 0 8px ${stroke}) drop-shadow(0 0 4px ${stroke}40)`;
                }

                // For selected businesses: add glow effect
                if (isSelected && !entry.isMyBusiness && !entry.isComparison) {
                  radius = 10;
                  stroke = CHART_COLORS.business;  // Purple - matches main business line in time series
                  strokeWidth = 2.5;
                  opacity = 1;
                  filter = `drop-shadow(0 0 10px ${CHART_COLORS.business}) drop-shadow(0 0 6px ${CHART_COLORS.business}60)`;
                }

                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={color}
                    r={radius}
                    opacity={opacity}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    style={{ cursor: 'pointer', filter }}
                    onClick={() => {
                      if (onBusinessSelect && entry.business) {
                        onBusinessSelect(entry.business.business_id);
                      }
                    }}
                  />
                );
              })}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default CompetitivePositioningChart;
