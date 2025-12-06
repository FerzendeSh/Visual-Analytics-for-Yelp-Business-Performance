import React, { useMemo, useCallback, memo } from 'react';
import { Group } from '@visx/group';
import { Bar, LinePath, Circle, Line } from '@visx/shape';
import { scaleLinear, scaleBand, scaleOrdinal } from '@visx/scale';
import { AxisLeft, AxisRight, AxisBottom } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { useTooltip, useTooltipInPortal, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { ParentSize } from '@visx/responsive';
import { curveMonotoneX } from '@visx/curve';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

import { Business } from '../../api';
import { SentimentTimeline } from '../../api/endpoints/analytics';
import { calculateTrend, calculateCompetitivePosition } from './trendUtils';
import { formatPercentChange } from './chartConstants';
import './SentimentTrendsChart.css';

const BACKGROUND_COLOR = '#0F111A';
const VOLUME_COLOR = '#3b2f5c';
const VOLUME_HIGHLIGHT = '#504278';
const AXIS_COLOR = '#f8fafc';
const GRID_COLOR = '#2d3748';
const LINE_COLORS = [
  '#9c8506ff', // Gold/Yellow
  '#9400fdff', // Purple
  '#8e2315ff', // Red/Brown
  '#05a763ff', // Green
  '#0199ffff', // Bright Blue
  '#ff6b35ff', // Orange
  '#f72585ff', // Pink
  '#06ffa5ff', // Cyan
];

interface ChartDataPoint {
  period: string;
  volume: number;
  [key: string]: number | string;
}

interface LegendItem {
  name: string;
  value: number;
  color: string;
}

interface TooltipData {
  period: string;
  volume: number;
  legendItems: LegendItem[];
  sentiments: Record<string, number>;
  change: { change: number; changePercent: number } | null;
}

interface SentimentTrendsChartProps {
  business: Business | null;
  selectedCity?: string;
  selectedState?: string;
  selectedCategory?: string;
  selectedNeighborhood?: string;
  primaryCategory?: string;
  sentimentData?: SentimentTimeline | null;
  citySentimentData?: SentimentTimeline | null;
  neighborhoodSentimentData?: SentimentTimeline | null;
  categorySentimentData?: SentimentTimeline | null;
  isLoading?: boolean;
  error?: any;
  comparisonBusinesses?: Business[];
  comparisonSentimentDataArray?: (SentimentTimeline | null)[];
  period?: 'month' | 'year';
  compareByCity?: boolean;
  compareByCategory?: boolean;
  compareByNeighborhood?: boolean;
}

function formatDateForPeriod(dateString: string, period: 'month' | 'year'): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return period === 'year'
      ? `${date.getFullYear()}`
      : date.toLocaleString('en-US', { month: 'short' });
  } catch {
    return dateString;
  }
}

function getDateSortKey(dateString: string): number {
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? 0 : date.getTime();
  } catch {
    return 0;
  }
}

interface TooltipContentProps {
  data: TooltipData | null;
  period: 'month' | 'year';
}

const TooltipContent: React.FC<TooltipContentProps> = ({ data, period }) => {
  if (!data) return null;

  const change = data.change;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {/* Period Header */}
      <div
        style={{
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.85rem',
          marginBottom: '0.5rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        {data.period}
      </div>

      {/* Legend Items */}
      {data.legendItems.map((item) => (
        <div
          key={item.name}
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
                backgroundColor: item.color,
              }}
            />
            <span style={{ color: '#d2d2d4', fontSize: '0.85rem' }}>
              {item.name}:
            </span>
          </div>
          <span
            style={{
              fontFamily: 'monospace',
              fontWeight: 700,
              color: '#fff',
              fontSize: '0.85rem',
            }}
          >
            {item.value.toFixed(3)}
          </span>
        </div>
      ))}

      {/* Change indicator */}
      {change && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.25rem 0.5rem',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            width: 'fit-content',
            backgroundColor:
              change.changePercent > 0
                ? 'rgba(16, 185, 129, 0.15)'
                : change.changePercent < 0
                ? 'rgba(239, 68, 68, 0.15)'
                : 'rgba(100, 116, 139, 0.15)',
            border: `1px solid ${
              change.changePercent > 0
                ? 'rgba(16, 185, 129, 0.3)'
                : change.changePercent < 0
                ? 'rgba(239, 68, 68, 0.3)'
                : 'rgba(100, 116, 139, 0.3)'
            }`,
          }}
        >
          {change.changePercent > 0 ? (
            <ArrowUpRight size={12} style={{ color: '#34d399' }} />
          ) : change.changePercent < 0 ? (
            <ArrowDownRight size={12} style={{ color: '#ef4444' }} />
          ) : (
            <Minus size={12} style={{ color: '#94a3b8' }} />
          )}
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 500,
              color:
                change.changePercent > 0
                  ? '#34d399'
                  : change.changePercent < 0
                  ? '#ef4444'
                  : '#94a3b8',
            }}
          >
            {formatPercentChange(change.changePercent)} vs previous {period}
          </span>
        </div>
      )}
    </div>
  );
};

interface ChartProps {
  width: number;
  height: number;
  data: ChartDataPoint[];
  seriesNames: string[];
  period: 'month' | 'year';
}

const Chart: React.FC<ChartProps> = ({ width, height, data, seriesNames, period }) => {
  const margin = { top: 20, right: 60, bottom: 40, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const {
    tooltipOpen,
    tooltipLeft,
    tooltipTop,
    tooltipData,
    hideTooltip,
    showTooltip,
  } = useTooltip<TooltipData>();

  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    scroll: true,
  });

  const xScale = useMemo(
    () =>
      scaleBand<string>({
        range: [0, innerWidth],
        domain: data.map((d) => d.period),
        padding: 0.2,
      }),
    [innerWidth, data]
  );

  // Calculate optimal tick interval based on available width
  const tickInterval = useMemo(() => {
    const numPoints = data.length;
    if (numPoints <= 1) return 1;

    const estimatedLabelWidth = period === 'year' ? 40 : 35;
    const maxLabels = Math.floor(innerWidth / estimatedLabelWidth);

    const interval = Math.max(1, Math.ceil(numPoints / maxLabels));
    return interval;
  }, [data.length, innerWidth, period]);

  const y1Scale = useMemo(
    () =>
      scaleLinear<number>({
        range: [innerHeight, 0],
        domain: [-1, 1],
      }),
    [innerHeight]
  );

  const maxVolume = useMemo(() => Math.max(...data.map((d) => d.volume), 10), [data]);

  const y2Scale = useMemo(
    () =>
      scaleLinear<number>({
        range: [innerHeight, 0],
        domain: [0, maxVolume * 1.2],
      }),
    [innerHeight, maxVolume]
  );

  const colorScale = useMemo(
    () =>
      scaleOrdinal<string, string>({
        domain: seriesNames,
        range: LINE_COLORS.slice(0, seriesNames.length),
      }),
    [seriesNames]
  );

  const handleTooltip = useCallback(
    (event: React.TouchEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
      const point = localPoint(event);
      if (!point) return;

      const x0 = point.x - margin.left;
      const domain = xScale.domain();
      const step = xScale.step();
      const index = Math.floor(x0 / step);
      const safeIndex = Math.max(0, Math.min(index, domain.length - 1));
      const selectedData = data[safeIndex];

      if (selectedData) {
        const sentiments: Record<string, number> = {};
        const legendItems = seriesNames.map((name) => {
          const value = (selectedData[name] as number) || 0;
          sentiments[name] = value;
          return {
            name,
            value,
            color: colorScale(name),
          };
        });

        // Calculate period-over-period change for the primary series
        let change: { change: number; changePercent: number } | null = null;
        if (safeIndex > 0 && seriesNames.length > 0) {
          const primaryName = seriesNames[0];
          const currentValue = (selectedData[primaryName] as number) || 0;
          const previousData = data[safeIndex - 1];
          const previousValue = (previousData[primaryName] as number) || 0;
          if (previousValue !== 0) {
            const diff = currentValue - previousValue;
            const percent = diff / Math.abs(previousValue);
            change = { change: diff, changePercent: percent };
          }
        }

        showTooltip({
          tooltipData: {
            period: selectedData.period,
            volume: selectedData.volume,
            legendItems,
            sentiments,
            change,
          },
          tooltipLeft: (xScale(selectedData.period) || 0) + xScale.bandwidth() / 2 + margin.left,
          tooltipTop: innerHeight / 2,
        });
      }
    },
    [xScale, margin.left, innerHeight, showTooltip, data, seriesNames, colorScale]
  );

  if (width < 10) return null;

  return (
    <div className="relative">
      <svg
        ref={containerRef}
        width={width}
        height={height}
        className="touch-none select-none"
        onMouseMove={handleTooltip}
        onMouseLeave={() => hideTooltip()}
        onTouchMove={handleTooltip}
        onTouchEnd={() => hideTooltip()}
      >
        <rect width={width} height={height} fill={BACKGROUND_COLOR} rx={8} />

        <Group left={margin.left} top={margin.top}>
          <GridRows
            scale={y1Scale}
            width={innerWidth}
            strokeDasharray="3,3"
            stroke={GRID_COLOR}
            numTicks={5}
          />

          {/* Volume Bars */}
          {data.map((d) => {
            const barWidth = xScale.bandwidth();
            const barHeight = innerHeight - y2Scale(d.volume);
            const barX = xScale(d.period) || 0;
            const barY = innerHeight - barHeight;
            const isHovered = tooltipData?.period === d.period;

            return (
              <Bar
                key={`bar-${d.period}`}
                x={barX}
                y={barY}
                width={barWidth}
                height={Math.max(0, barHeight)}
                fill={isHovered ? VOLUME_HIGHLIGHT : VOLUME_COLOR}
                rx={4}
                opacity={0.9}
              />
            );
          })}

          {/* Sentiment Lines */}
          {seriesNames.map((name) => (
            <React.Fragment key={`line-group-${name}`}>
              <LinePath
                data={data}
                x={(d) => (xScale(d.period) || 0) + xScale.bandwidth() / 2}
                y={(d) => y1Scale((d[name] as number) || 0)}
                stroke={colorScale(name)}
                strokeWidth={3}
                curve={curveMonotoneX}
                strokeLinecap="round"
              />
              {tooltipOpen && tooltipData && (
                <Circle
                  cx={(xScale(tooltipData.period) || 0) + xScale.bandwidth() / 2}
                  cy={y1Scale(tooltipData.sentiments[name] || 0)}
                  r={6}
                  fill={colorScale(name)}
                  stroke="#fff"
                  strokeWidth={2}
                />
              )}
            </React.Fragment>
          ))}

          {/* Hover Line */}
          {tooltipOpen && tooltipData && (
            <Line
              from={{ x: (xScale(tooltipData.period) || 0) + xScale.bandwidth() / 2, y: 0 }}
              to={{ x: (xScale(tooltipData.period) || 0) + xScale.bandwidth() / 2, y: innerHeight }}
              stroke="#fff"
              strokeWidth={1}
              pointerEvents="none"
              opacity={0.3}
            />
          )}

          {/* Axes */}
          <AxisBottom
            scale={xScale}
            top={innerHeight}
            stroke={AXIS_COLOR}
            tickStroke={AXIS_COLOR}
            tickLabelProps={() => ({
              fill: AXIS_COLOR,
              fontSize: 12,
              textAnchor: 'middle' as const,
              fontFamily: 'sans-serif',
              fontWeight: 500,
            })}
            tickFormat={(value) => formatDateForPeriod(value, period)}
            tickValues={data
              .map((d, i) => (i % tickInterval === 0 ? d.period : null))
              .filter((v): v is string => v !== null)}
          />

          <AxisLeft
            scale={y1Scale}
            stroke="transparent"
            tickStroke="transparent"
            numTicks={5}
            label="Sentiment Score"
            labelOffset={40}
            labelProps={{
              fill: AXIS_COLOR,
              fontSize: 11,
              textAnchor: 'middle' as const,
              fontWeight: 600,
            }}
            tickLabelProps={() => ({
              fill: AXIS_COLOR,
              fontSize: 11,
              textAnchor: 'end' as const,
              dy: 4,
              dx: -5,
              fontWeight: 500,
            })}
          />

          <AxisRight
            scale={y2Scale}
            left={innerWidth}
            stroke="transparent"
            tickStroke="transparent"
            numTicks={5}
            label="Review Count"
            labelOffset={40}
            labelProps={{
              fill: AXIS_COLOR,
              fontSize: 11,
              textAnchor: 'middle' as const,
              fontWeight: 600,
            }}
            tickLabelProps={() => ({
              fill: AXIS_COLOR,
              fontSize: 11,
              textAnchor: 'start' as const,
              dy: 4,
              dx: 5,
              fontWeight: 500,
            })}
          />
        </Group>
      </svg>

      {/* Tooltip */}
      {tooltipOpen && tooltipData && (
        <TooltipInPortal
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...defaultStyles,
            backgroundColor: '#1f2937',
            borderRadius: '6px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
            border: '1px solid #374151',
            color: '#fff',
            padding: '12px',
            zIndex: 100,
          }}
        >
          <TooltipContent data={tooltipData} period={period} />
        </TooltipInPortal>
      )}
    </div>
  );
};

const SentimentTrendsChart: React.FC<SentimentTrendsChartProps> = ({
  business,
  selectedCity = '',
  selectedCategory = '',
  selectedNeighborhood = '',
  primaryCategory = '',
  sentimentData,
  citySentimentData,
  neighborhoodSentimentData,
  categorySentimentData,
  isLoading = false,
  error = null,
  comparisonBusinesses = [],
  comparisonSentimentDataArray = [],
  period = 'year',
  compareByCity = false,
  compareByCategory = false,
  compareByNeighborhood = false,
}) => {
  // Determine comparison data source
  const comparisonSentimentSource = selectedNeighborhood ? neighborhoodSentimentData : citySentimentData;

  // Build chart data and series names
  const { chartData, seriesNames, sentimentTrend, competitivePosition } = useMemo(() => {
    if (!sentimentData?.data || sentimentData.data.length === 0) {
      return { chartData: [], seriesNames: [], sentimentTrend: null, competitivePosition: null };
    }

    // Collect periods only from the primary data source (business/city/category being viewed)
    // This ensures the chart only shows periods where the primary entity has data
    const primaryPeriods = sentimentData.data.map((p) => p.period_start);

    // Sort periods chronologically by actual date
    const sortedPeriods = primaryPeriods.sort((a, b) => getDateSortKey(a) - getDateSortKey(b));

    // Build series names
    const names: string[] = [];

    // Primary series name
    const primaryName = business?.name
      ? business.name
      : selectedNeighborhood
      ? `${selectedNeighborhood
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')} Avg`
      : selectedCity
      ? `${selectedCity} Avg`
      : selectedCategory
      ? `${selectedCategory} Avg`
      : 'Avg Sentiment';

    names.push(primaryName);

    // Comparison series name (city/neighborhood avg when viewing a business)
    if (business && comparisonSentimentSource?.data) {
      const shouldShowComparison = selectedNeighborhood
        ? compareByNeighborhood && selectedNeighborhood
        : compareByCity;

      if (shouldShowComparison) {
        const comparisonName = selectedNeighborhood
          ? `${selectedNeighborhood
              .split('_')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ')} Avg`
          : `${selectedCity || business.city} Avg`;
        names.push(comparisonName);
      }
    }

    // Category average if available
    // Only add if the checkbox is checked
    if (categorySentimentData?.data && compareByCategory) {
      const categoryName = selectedCategory
        ? `${selectedCategory} in ${selectedCity}`
        : `${primaryCategory} Avg`;
      names.push(categoryName);
    }

    // Comparison businesses
    comparisonBusinesses.forEach((cb) => {
      names.push(cb.name);
    });

    // Build chart data points
    const data: ChartDataPoint[] = sortedPeriods.map((periodStart) => {
      const sentimentPoint = sentimentData.data.find((p) => p.period_start === periodStart);
      const comparisonPoint = comparisonSentimentSource?.data?.find((p) => p.period_start === periodStart);
      const categoryPoint = categorySentimentData?.data?.find((p) => p.period_start === periodStart);

      const point: ChartDataPoint = {
        period: formatDateForPeriod(periodStart, period),
        volume: sentimentPoint?.review_count || 0,
        [primaryName]: sentimentPoint?.avg_sentiment_score || 0,
      };

      // Add comparison data (only if checkbox is checked)
      if (business && comparisonSentimentSource?.data) {
        const shouldShowComparison = selectedNeighborhood
          ? compareByNeighborhood && selectedNeighborhood
          : compareByCity;

        if (shouldShowComparison) {
          const comparisonName = selectedNeighborhood
            ? `${selectedNeighborhood
                .split('_')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ')} Avg`
            : `${selectedCity || business.city} Avg`;
          point[comparisonName] = comparisonPoint?.avg_sentiment_score || 0;
        }
      }

      // Add category data (only if checkbox is checked)
      if (categorySentimentData?.data && compareByCategory) {
        const categoryName = selectedCategory
          ? `${selectedCategory} in ${selectedCity}`
          : `${primaryCategory} Avg`;
        point[categoryName] = categoryPoint?.avg_sentiment_score || 0;
      }

      // Add comparison businesses
      comparisonSentimentDataArray?.forEach((compData, index) => {
        const compPoint = compData?.data?.find((p) => p.period_start === periodStart);
        if (comparisonBusinesses[index]) {
          point[comparisonBusinesses[index].name] = compPoint?.avg_sentiment_score || 0;
        }
      });

      return point;
    });

    // Calculate trend
    const trend = calculateTrend(sentimentData.data, 'avg_sentiment_score', 3);

    // Calculate competitive position
    const position = comparisonSentimentSource?.data
      ? calculateCompetitivePosition(sentimentData.data, comparisonSentimentSource.data, 'avg_sentiment_score')
      : null;

    return {
      chartData: data,
      seriesNames: names,
      sentimentTrend: trend,
      competitivePosition: position,
    };
  }, [
    sentimentData,
    comparisonSentimentSource,
    categorySentimentData,
    comparisonSentimentDataArray,
    comparisonBusinesses,
    business,
    selectedCity,
    selectedNeighborhood,
    selectedCategory,
    primaryCategory,
    period,
    compareByCity,
    compareByCategory,
    compareByNeighborhood,
  ]);

  // Determine title text
  const primaryName = seriesNames[0] || 'Sentiments';

  if (!business && !selectedCity && !selectedCategory) {
    return (
      <div className="sentiment-trends-empty">
        <p>Select a city, category, or business to view sentiment trends</p>
      </div>
    );
  }

  return (
    <div className="sentiment-trends-chart" style={{ backgroundColor: BACKGROUND_COLOR }}>
      {/* Header Section */}
      <div className="sentiment-trends-chart__header">
        <h2 className="sentiment-trends-chart__title">Sentiment Trends</h2>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="sentiment-trends-chart__loading">Loading sentiment trends...</div>
      )}

      {/* Error State */}
      {error && (
        <div className="sentiment-trends-chart__error">
          Error: {error.message || 'Failed to load sentiment trends'}
        </div>
      )}

      {/* Chart */}
      {!isLoading && !error && chartData.length > 0 && (
        <div className="sentiment-trends-chart__chart">
          <ParentSize>
            {({ width, height }) => (
              <Chart
                width={width}
                height={Math.max(height, 180)}
                data={chartData}
                seriesNames={seriesNames}
                period={period}
              />
            )}
          </ParentSize>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && chartData.length === 0 && (
        <div className="sentiment-trends-chart__empty">
          <p>No sentiment trends data available</p>
        </div>
      )}

      {/* Legend at the bottom */}
      {chartData.length > 0 && (
        <div className="sentiment-trends-chart__legend">
          <div className="sentiment-trends-chart__legend-items">
            {/* Review Volume Legend Item */}
            <div className="sentiment-trends-chart__legend-item">
              <div
                className="sentiment-trends-chart__legend-bar"
                style={{ backgroundColor: VOLUME_COLOR }}
              />
              <span className="sentiment-trends-chart__legend-text">Review Volume</span>
            </div>

            {/* Line Legend Items */}
            {seriesNames.map((name, i) => (
              <div key={`legend-${i}`} className="sentiment-trends-chart__legend-item">
                <div
                  className="sentiment-trends-chart__legend-line"
                  style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }}
                />
                <span className="sentiment-trends-chart__legend-text">{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(SentimentTrendsChart);
