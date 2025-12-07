import React, { useMemo, useCallback, memo, useState } from 'react';
import { Group } from '@visx/group';
import { Bar, LinePath, Circle, Line } from '@visx/shape';
import { scaleLinear, scaleBand, scaleOrdinal } from '@visx/scale';
import { AxisLeft, AxisRight, AxisBottom } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { useTooltip, useTooltipInPortal, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { ParentSize } from '@visx/responsive';
import { curveMonotoneX } from '@visx/curve';
import { Text } from '@visx/text';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

import { Business } from '../../api';
import { RatingsTimeline, ForecastDataPoint } from '../../api/endpoints/analytics';
// NOTE: Trend utilities available for future enhancements
// import { calculateTrend, calculateCompetitivePosition } from './trendUtils';
import { formatPercentChange } from './chartConstants';
import './RatingTrendsChart.css';

const BACKGROUND_COLOR = '#0F111A';
const VOLUME_COLOR = '#3b2f5c';
const VOLUME_HIGHLIGHT = '#504278';
const AXIS_COLOR = '#f8fafc';
const GRID_COLOR = '#2d3748';
const FORECAST_COLOR = '#06ffa5'; // Cyan for forecast
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
  ratings: Record<string, number>;
  change: { change: number; changePercent: number } | null;
  // Forecast-specific fields
  isForecast?: boolean;
  forecastValue?: number;
  forecastLower?: number;
  forecastUpper?: number;
}

interface RatingTrendsChartProps {
  business: Business | null;
  selectedCity?: string;
  selectedState?: string;
  selectedCategory?: string;
  selectedNeighborhood?: string;
  primaryCategory?: string;
  ratingsData?: RatingsTimeline | null;
  cityRatingsData?: RatingsTimeline | null;
  neighborhoodRatingsData?: RatingsTimeline | null;
  categoryRatingsData?: RatingsTimeline | null;
  isLoading?: boolean;
  error?: any;
  comparisonBusinesses?: Business[];
  comparisonRatingsDataArray?: (RatingsTimeline | null)[];
  period?: 'month' | 'year';
  compareByCity?: boolean;
  compareByCategory?: boolean;
  compareByNeighborhood?: boolean;
  /** Forecast data points for rating predictions */
  forecastData?: ForecastDataPoint[] | null;
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

// Helper to get sortable date key for proper chronological ordering
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

  // Forecast tooltip rendering
  if (data.isForecast) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        {/* Period Header */}
        <div
          style={{
            color: '#06ffa5',
            fontWeight: 600,
            fontSize: '0.85rem',
            marginBottom: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontSize: '0.7rem', padding: '2px 6px', background: 'rgba(6, 255, 165, 0.2)', borderRadius: '4px' }}>FORECAST</span>
          {data.period}
        </div>

        {/* Predicted Value */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <span style={{ color: '#d2d2d4', fontSize: '0.85rem' }}>Predicted</span>
          <span
            style={{
              fontFamily: 'monospace',
              fontWeight: 700,
              color: '#06ffa5',
              fontSize: '0.95rem',
            }}
          >
            {data.forecastValue?.toFixed(2)}
          </span>
        </div>

        {/* Upper Bound */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Upper bound</span>
          <span
            style={{
              fontFamily: 'monospace',
              color: '#d2d2d4',
              fontSize: '0.85rem',
            }}
          >
            {data.forecastUpper?.toFixed(2)}
          </span>
        </div>

        {/* Lower Bound */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Lower bound</span>
          <span
            style={{
              fontFamily: 'monospace',
              color: '#d2d2d4',
              fontSize: '0.85rem',
            }}
          >
            {data.forecastLower?.toFixed(2)}
          </span>
        </div>
      </div>
    );
  }

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
  isPrimaryBusiness?: boolean;
  hiddenSeries: Set<string>;
  hideVolume?: boolean;
  hideForecast?: boolean;
  /** Forecast data points to render as dashed line with confidence band */
  forecastData?: ForecastDataPoint[] | null;
}

const Chart: React.FC<ChartProps> = ({
  width,
  height,
  data,
  seriesNames,
  period,
  isPrimaryBusiness = false,
  hiddenSeries,
  hideVolume = false,
  hideForecast = false,
  forecastData,
}) => {
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

  // Build combined domain: historical periods + forecast periods
  const allPeriods = useMemo(() => {
    const historicalPeriods = data.map((d) => d.period);
    if (forecastData && forecastData.length > 0) {
      const forecastPeriods = forecastData.map((fp) => formatDateForPeriod(fp.period, period));
      return [...historicalPeriods, ...forecastPeriods];
    }
    return historicalPeriods;
  }, [data, forecastData, period]);

  const xScale = useMemo(
    () =>
      scaleBand<string>({
        range: [0, innerWidth],
        domain: allPeriods,
        padding: 0.2,
      }),
    [innerWidth, allPeriods]
  );

  // Get formatted forecast period labels
  const forecastPeriodLabels = useMemo(() => {
    if (!forecastData || forecastData.length === 0) return [];
    return forecastData.map((fp) => formatDateForPeriod(fp.period, period));
  }, [forecastData, period]);

  // Calculate optimal tick interval based on available width
  const tickInterval = useMemo(() => {
    const numHistoricalPoints = data.length;
    const numForecastPoints = forecastPeriodLabels.length;
    const totalPoints = numHistoricalPoints + numForecastPoints;

    if (totalPoints <= 1) return 1;

    // Estimate space needed per label (approximate width in pixels)
    const estimatedLabelWidth = period === 'year' ? 40 : 35;
    const maxLabels = Math.floor(innerWidth / estimatedLabelWidth);

    // Reserve space for forecast labels
    const availableLabelsForHistorical = numForecastPoints > 0
      ? Math.max(1, maxLabels - numForecastPoints)
      : maxLabels;

    // Calculate interval to show appropriate number of labels
    const interval = Math.max(1, Math.ceil(numHistoricalPoints / availableLabelsForHistorical));
    return interval;
  }, [data.length, forecastPeriodLabels.length, innerWidth, period]);

  const y1Scale = useMemo(
    () =>
      scaleLinear<number>({
        range: [innerHeight, 0],
        domain: [0, 5.5],
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

  // Build formatted forecast data for tooltip lookup
  const formattedForecastData = useMemo(() => {
    if (!forecastData || forecastData.length === 0) return [];
    return forecastData.map((fp) => ({
      period: formatDateForPeriod(fp.period, period),
      value: fp.value,
      lower: fp.lower,
      upper: fp.upper,
    }));
  }, [forecastData, period]);

  const handleTooltip = useCallback(
    (event: React.TouchEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>) => {
      const point = localPoint(event);
      if (!point) return;

      const x0 = point.x - margin.left;
      const domain = xScale.domain();
      const step = xScale.step();
      const index = Math.floor(x0 / step);
      const safeIndex = Math.max(0, Math.min(index, domain.length - 1));
      const hoveredPeriod = domain[safeIndex];

      // Check if this is a forecast period
      const forecastPoint = formattedForecastData.find(fp => fp.period === hoveredPeriod);
      
      if (forecastPoint) {
        // Show forecast tooltip
        showTooltip({
          tooltipData: {
            period: forecastPoint.period,
            volume: 0,
            legendItems: [],
            ratings: {},
            change: null,
            isForecast: true,
            forecastValue: forecastPoint.value,
            forecastLower: forecastPoint.lower,
            forecastUpper: forecastPoint.upper,
          },
          tooltipLeft: (xScale(hoveredPeriod) || 0) + xScale.bandwidth() / 2 + margin.left,
          tooltipTop: innerHeight / 2,
        });
        return;
      }

      // Historical data tooltip
      const selectedData = data[safeIndex];
      if (selectedData) {
        const ratings: Record<string, number> = {};
        const legendItems = seriesNames.map((name) => {
          const value = (selectedData[name] as number) || 0;
          ratings[name] = value;
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
            ratings,
            change,
          },
          tooltipLeft: (xScale(selectedData.period) || 0) + xScale.bandwidth() / 2 + margin.left,
          tooltipTop: innerHeight / 2,
        });
      }
    },
    [xScale, margin.left, innerHeight, showTooltip, data, seriesNames, colorScale, formattedForecastData]
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
        <defs>
          {/* Glow filter for primary business line */}
          <filter id="primaryGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
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
          {!hideVolume && data.map((d) => {
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

          {/* Rating Lines */}
          {seriesNames.map((name, index) => {
            // Skip hidden series
            if (hiddenSeries.has(name)) return null;
            
            // Primary series (index 0) gets enhanced styling
            const isPrimary = index === 0;
            const strokeWidth = isPrimary ? 4 : 2.5;
            const glowFilter = isPrimary ? 'url(#primaryGlow)' : undefined;
            
            return (
              <React.Fragment key={`line-group-${name}`}>
                <LinePath
                  data={data}
                  x={(d) => (xScale(d.period) || 0) + xScale.bandwidth() / 2}
                  y={(d) => y1Scale((d[name] as number) || 0)}
                  stroke={colorScale(name)}
                  strokeWidth={strokeWidth}
                  curve={curveMonotoneX}
                  strokeLinecap="round"
                  style={{ filter: glowFilter }}
                />
                {/* Only show historical data circles when NOT hovering a forecast period */}
                {tooltipOpen && tooltipData && !tooltipData.isForecast && (
                  <Circle
                    cx={(xScale(tooltipData.period) || 0) + xScale.bandwidth() / 2}
                    cy={y1Scale(tooltipData.ratings[name] || 0)}
                    r={isPrimary ? 8 : 6}
                    fill={colorScale(name)}
                    stroke="#fff"
                    strokeWidth={isPrimary ? 3 : 2}
                  />
                )}
                {/* "YOU" label on last point for primary business line */}
                {isPrimary && isPrimaryBusiness && data.length > 0 && (
                  <Text
                    x={(xScale(data[data.length - 1].period) || 0) + xScale.bandwidth() / 2 + 8}
                    y={y1Scale((data[data.length - 1][name] as number) || 0)}
                    fill={colorScale(name)}
                    fontSize={10}
                    fontWeight={700}
                    textAnchor="start"
                    verticalAnchor="middle"
                  >
                    YOU
                  </Text>
                )}
              </React.Fragment>
            );
          })}

          {/* Forecast Hover Circle - show when hovering forecast periods */}
          {!hideForecast && tooltipOpen && tooltipData?.isForecast && tooltipData.forecastValue !== undefined && (
            <Circle
              cx={(xScale(tooltipData.period) || 0) + xScale.bandwidth() / 2}
              cy={y1Scale(tooltipData.forecastValue)}
              r={8}
              fill={FORECAST_COLOR}
              stroke="#fff"
              strokeWidth={3}
            />
          )}

          {/* Forecast Confidence Band & Line */}
          {!hideForecast && forecastData && forecastData.length > 0 && data.length > 0 && (() => {
            // Get the last historical data point position
            const lastDataPeriod = data[data.length - 1].period;
            const lastDataX = (xScale(lastDataPeriod) || 0) + xScale.bandwidth() / 2;

            // Calculate forecast point positions using the extended xScale
            const forecastPoints = forecastData.map((fp) => {
              const formattedPeriod = formatDateForPeriod(fp.period, period);
              return {
                x: (xScale(formattedPeriod) || 0) + xScale.bandwidth() / 2,
                value: fp.value,
                lower: fp.lower,
                upper: fp.upper,
                period: formattedPeriod,
              };
            });

            // Connection point from last historical value to first forecast
            const lastHistoricalValue = data[data.length - 1][seriesNames[0]] as number || 0;
            const connectionPoints = [
              { x: lastDataX, y: y1Scale(lastHistoricalValue) },
              ...forecastPoints.map(fp => ({ x: fp.x, y: y1Scale(fp.value) })),
            ];

            // Confidence band data points for smooth area
            const confidenceAreaData = [
              { x: lastDataX, lower: lastHistoricalValue, upper: lastHistoricalValue },
              ...forecastPoints.map(fp => ({
                x: fp.x,
                lower: Math.max(1, fp.lower),
                upper: Math.min(5, fp.upper),
              })),
            ];

            // Create path for upper bound
            const upperBoundPath = confidenceAreaData.map(d => ({ x: d.x, y: y1Scale(d.upper) }));
            // Create path for lower bound (reversed for proper area fill)
            const lowerBoundPath = [...confidenceAreaData].reverse().map(d => ({ x: d.x, y: y1Scale(d.lower) }));

            return (
              <React.Fragment key="forecast-group">
                {/* Confidence Band Area - Smooth Fill */}
                <path
                  d={`
                    M ${upperBoundPath[0].x},${upperBoundPath[0].y}
                    ${upperBoundPath.slice(1).map(p => `L ${p.x},${p.y}`).join(' ')}
                    ${lowerBoundPath.map(p => `L ${p.x},${p.y}`).join(' ')}
                    Z
                  `}
                  fill={FORECAST_COLOR}
                  opacity={0.2}
                />

                {/* Forecast Dashed Line */}
                <LinePath
                  data={connectionPoints}
                  x={(d) => d.x}
                  y={(d) => d.y}
                  stroke={FORECAST_COLOR}
                  strokeWidth={3}
                  strokeDasharray="8,6"
                  curve={curveMonotoneX}
                  strokeLinecap="round"
                />
              </React.Fragment>
            );
          })()}

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
            hideAxisLine={false}
            hideTicks={true}
            tickLabelProps={() => ({
              fill: AXIS_COLOR,
              fontSize: 12,
              textAnchor: 'middle' as const,
              fontFamily: 'sans-serif',
              fontWeight: 500,
            })}
            tickFormat={(value) => value}
            tickValues={[
              ...data
                .map((d, i) => (i % tickInterval === 0 ? d.period : null))
                .filter((v): v is string => v !== null),
              ...(hideForecast ? [] : forecastPeriodLabels.filter((label) => {
                const year = parseInt(label);
                return !isNaN(year) && year % 2 === 0;
              })),
            ]}
          />

          <AxisLeft
            scale={y1Scale}
            stroke="transparent"
            tickStroke="transparent"
            numTicks={5}
            label="Star Rating"
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
            border: tooltipData.isForecast ? '1px solid rgba(6, 255, 165, 0.4)' : '1px solid #374151',
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

const RatingTrendsChart: React.FC<RatingTrendsChartProps> = ({
  business,
  selectedCity = '',
  selectedCategory = '',
  selectedNeighborhood = '',
  primaryCategory = '',
  ratingsData,
  cityRatingsData,
  neighborhoodRatingsData,
  categoryRatingsData,
  isLoading = false,
  error = null,
  comparisonBusinesses = [],
  comparisonRatingsDataArray = [],
  period = 'year',
  compareByCity = false,
  compareByCategory = false,
  compareByNeighborhood = false,
  forecastData,
}) => {
  // Determine comparison data source
  const comparisonRatingsSource = selectedNeighborhood ? neighborhoodRatingsData : cityRatingsData;

  // Build chart data and series names
  const { chartData, seriesNames } = useMemo(() => {
    if (!ratingsData?.data || ratingsData.data.length === 0) {
      return { chartData: [], seriesNames: [] };
    }

    // Collect periods only from the primary data source (business/city/category being viewed)
    // This ensures the chart only shows periods where the primary entity has data
    const primaryPeriods = ratingsData.data.map((p) => p.period_start);

    // Sort periods chronologically by actual date, not alphabetically
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
      : 'Avg Rating';

    names.push(primaryName);

    // Comparison series name (city/neighborhood avg when viewing a business)
    // Only add if the checkbox is checked (use business's city as default if not filtered)
    if (business && comparisonRatingsSource?.data) {
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
    if (categoryRatingsData?.data && compareByCategory) {
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
      const ratingPoint = ratingsData.data.find((p) => p.period_start === periodStart);
      const comparisonPoint = comparisonRatingsSource?.data?.find((p) => p.period_start === periodStart);
      const categoryPoint = categoryRatingsData?.data?.find((p) => p.period_start === periodStart);

      const point: ChartDataPoint = {
        period: formatDateForPeriod(periodStart, period),
        volume: ratingPoint?.review_count || 0,
        [primaryName]: ratingPoint?.avg_rating || 0,
      };

      // Add comparison data (only if checkbox is checked, use business's city as default if not filtered)
      if (business && comparisonRatingsSource?.data) {
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
          point[comparisonName] = comparisonPoint?.avg_rating || 0;
        }
      }

      // Add category data (only if checkbox is checked)
      if (categoryRatingsData?.data && compareByCategory) {
        const categoryName = selectedCategory
          ? `${selectedCategory} in ${selectedCity}`
          : `${primaryCategory} Avg`;
        point[categoryName] = categoryPoint?.avg_rating || 0;
      }

      // Add comparison businesses
      comparisonRatingsDataArray?.forEach((compData, index) => {
        const compPoint = compData?.data?.find((p) => p.period_start === periodStart);
        if (comparisonBusinesses[index]) {
          point[comparisonBusinesses[index].name] = compPoint?.avg_rating || 0;
        }
      });

      return point;
    });

    // NOTE: Trend and competitive position calculated but not currently displayed
    // These could be used for future enhancements like trend indicators
    // const trend = calculateTrend(ratingsData.data, 'avg_rating', 3);
    // const position = comparisonRatingsSource?.data
    //   ? calculateCompetitivePosition(ratingsData.data, comparisonRatingsSource.data, 'avg_rating')
    //   : null;

    return {
      chartData: data,
      seriesNames: names,
    };
  }, [
    ratingsData,
    comparisonRatingsSource,
    categoryRatingsData,
    comparisonRatingsDataArray,
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

  // State for hidden series (interactive legend)
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [hideVolume, setHideVolume] = useState(false);
  const [hideForecast, setHideForecast] = useState(false);

  // Toggle series visibility when clicking legend items
  const toggleSeries = useCallback((seriesName: string) => {
    setHiddenSeries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(seriesName)) {
        newSet.delete(seriesName);
      } else {
        newSet.add(seriesName);
      }
      return newSet;
    });
  }, []);

  if (!business && !selectedCity && !selectedCategory) {
    return (
      <div className="rating-trends-empty">
        <p>Select a city, category, or business to view rating trends</p>
      </div>
    );
  }

  return (
    <div className="rating-trends-chart" style={{ backgroundColor: BACKGROUND_COLOR }}>
      {/* Header Section */}
      <div className="rating-trends-chart__header">
        <h2 className="rating-trends-chart__title">Rating Trends</h2>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="rating-trends-chart__loading">Loading rating trends...</div>
      )}

      {/* Error State */}
      {error && (
        <div className="rating-trends-chart__error">
          Error: {error.message || 'Failed to load rating trends'}
        </div>
      )}

      {/* Chart */}
      {!isLoading && !error && chartData.length > 0 && (
        <div className="rating-trends-chart__chart">
          <ParentSize>
            {({ width, height }) => (
              <Chart
                width={width}
                height={Math.max(height, 180)}
                data={chartData}
                seriesNames={seriesNames}
                period={period}
                hiddenSeries={hiddenSeries}
                hideVolume={hideVolume}
                hideForecast={hideForecast}
                forecastData={forecastData}
                isPrimaryBusiness={!!business}
              />
            )}
          </ParentSize>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && chartData.length === 0 && (
        <div className="rating-trends-chart__empty">
          <p>No rating trends data available</p>
        </div>
      )}

      {/* Legend at the bottom - click to toggle series visibility */}
      {chartData.length > 0 && (
        <div className="rating-trends-chart__legend">
          <div className="rating-trends-chart__legend-items">
            {/* Review Volume Legend Item - clickable */}
            <button
              className={`rating-trends-chart__legend-item rating-trends-chart__legend-item--interactive ${hideVolume ? 'rating-trends-chart__legend-item--hidden' : ''}`}
              onClick={() => setHideVolume(!hideVolume)}
              title={hideVolume ? 'Show Review Volume' : 'Hide Review Volume'}
              type="button"
            >
              <div
                className="rating-trends-chart__legend-bar"
                style={{
                  backgroundColor: VOLUME_COLOR,
                  opacity: hideVolume ? 0.3 : 1
                }}
              />
              <span
                className="rating-trends-chart__legend-text"
                style={{ opacity: hideVolume ? 0.5 : 1 }}
              >
                Review Volume
              </span>
            </button>

            {/* Line Legend Items - clickable to toggle visibility */}
            {seriesNames.map((name, i) => {
              const isHidden = hiddenSeries.has(name);
              const isPrimary = i === 0;
              return (
                <button
                  key={`legend-${i}`}
                  className={`rating-trends-chart__legend-item rating-trends-chart__legend-item--interactive ${isHidden ? 'rating-trends-chart__legend-item--hidden' : ''} ${isPrimary ? 'rating-trends-chart__legend-item--primary' : ''}`}
                  onClick={() => toggleSeries(name)}
                  title={isHidden ? `Show ${name}` : `Hide ${name}`}
                  type="button"
                >
                  <div
                    className="rating-trends-chart__legend-line"
                    style={{
                      backgroundColor: LINE_COLORS[i % LINE_COLORS.length],
                      opacity: isHidden ? 0.3 : 1
                    }}
                  />
                  <span
                    className="rating-trends-chart__legend-text"
                    style={{ opacity: isHidden ? 0.5 : 1 }}
                  >
                    {name}
                    {isPrimary && ' (You)'}
                  </span>
                </button>
              );
            })}

            {/* Forecast Legend Item - clickable */}
            {forecastData && forecastData.length > 0 && (
              <button
                className={`rating-trends-chart__legend-item rating-trends-chart__legend-item--interactive ${hideForecast ? 'rating-trends-chart__legend-item--hidden' : ''}`}
                onClick={() => setHideForecast(!hideForecast)}
                title={hideForecast ? 'Show Forecast' : 'Hide Forecast'}
                type="button"
              >
                <div
                  className="rating-trends-chart__legend-line"
                  style={{
                    backgroundColor: FORECAST_COLOR,
                    backgroundImage: `repeating-linear-gradient(90deg, ${FORECAST_COLOR} 0, ${FORECAST_COLOR} 4px, transparent 4px, transparent 8px)`,
                    opacity: hideForecast ? 0.3 : 1
                  }}
                />
                <span
                  className="rating-trends-chart__legend-text"
                  style={{ opacity: hideForecast ? 0.5 : 1 }}
                >
                  Forecast (80% CI)
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(RatingTrendsChart);