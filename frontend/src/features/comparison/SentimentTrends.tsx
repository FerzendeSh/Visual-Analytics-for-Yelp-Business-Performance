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
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

import { TimelineDataPoint, ForecastData } from '@/lib/api';

// Local type definition
export interface ForecastDataPoint {
  period: string;
  predicted_value: number;
  lower_80: number;
  upper_80: number;
}

// --- Constants & Helpers ---

const VOLUME_COLOR = '#3b2f5c';
const VOLUME_HIGHLIGHT = '#504278';
const AXIS_COLOR = '#94a3b8'; // text-muted-foreground
const GRID_COLOR = '#1e293b'; // slate-800
const FORECAST_COLOR = '#06ffa5'; // Cyan for forecast

const LINE_COLORS = [
  '#3b82f6', // Blue (Primary)
  '#a855f7', // Purple
  '#ef4444', // Red
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
];

function formatPercentChange(changePercent: number): string {
  const sign = changePercent >= 0 ? '+' : '';
  return `${sign}${(changePercent * 100).toFixed(1)}%`;
}

function formatDateForPeriod(dateString: string, period: 'month' | 'year'): string {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return period === 'year'
      ? `${date.getFullYear()}`
      : date.toLocaleString('en-US', { month: 'short', year: '2-digit' });
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

// --- Interfaces ---

interface ChartDataPoint {
  period: string;
  periodDate: string; // Original ISO date string for synchronization
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
  isForecast?: boolean;
  forecastValue?: number;
  forecastLower?: number;
  forecastUpper?: number;
}

export interface SentimentTimeline {
  business_name?: string;
  business_id?: string;
  data: TimelineDataPoint[];
}

export interface SentimentTrendsProps {
  primaryTimeline: SentimentTimeline | null;
  comparisonTimelines?: SentimentTimeline[];
  benchmarkTimelines?: {
    city?: SentimentTimeline | null;
    neighborhood?: SentimentTimeline | null;
    category?: SentimentTimeline | null;
  };
  forecastData?: ForecastDataPoint[] | null;
  period?: 'month' | 'year';
  showBenchmarks?: {
    showCityAvg: boolean;
    showNeighborhoodAvg: boolean;
    showCategoryAvg: boolean;
  };
  // Shared state for synchronization with SuperTrends
  sharedHoverDate?: Date | null;
  onHoverDateChange?: (date: Date | null) => void;
  hiddenSeries?: Set<string>;
  onHiddenSeriesChange?: (hidden: Set<string>) => void;
  hideVolume?: boolean;
  onHideVolumeChange?: (hidden: boolean) => void;
}

// --- Sub-components ---

interface TooltipContentProps {
  data: TooltipData | null;
  period: 'month' | 'year';
}

const TooltipContent: React.FC<TooltipContentProps> = ({ data, period }) => {
  if (!data) return null;

  if (data.isForecast) {
    return (
      <div className="flex flex-col gap-1.5 min-w-[180px]">
        <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-[#06ffa5]">
          <span className="px-1.5 py-0.5 rounded bg-[#06ffa5]/20">FORECAST</span>
          {data.period}
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400">Predicted</span>
          <span className="font-mono font-bold text-[#06ffa5]">
            {(data.forecastValue ?? 0) >= 0 ? '+' : ''}{data.forecastValue?.toFixed(3)}
          </span>
        </div>
        <div className="flex justify-between items-center text-xs text-gray-400">
          <span>Upper bound</span>
          <span className="font-mono text-gray-300">{data.forecastUpper?.toFixed(3)}</span>
        </div>
        <div className="flex justify-between items-center text-xs text-gray-400">
          <span>Lower bound</span>
          <span className="font-mono text-gray-300">{data.forecastLower?.toFixed(3)}</span>
        </div>
      </div>
    );
  }

  const change = data.change;

  return (
    <div className="flex flex-col gap-1.5 min-w-[200px]">
      <div className="text-sm font-semibold text-white pb-2 mb-2 border-b border-white/10">
        {data.period}
      </div>

      <div className="flex justify-between items-center text-xs pb-2 mb-2 border-b border-white/10">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: VOLUME_COLOR }} />
          <span className="text-gray-400">Review Volume:</span>
        </div>
        <span className="font-mono font-bold text-white">{data.volume.toLocaleString()}</span>
      </div>

      {data.legendItems.map((item) => (
        <div key={item.name} className="flex justify-between items-center text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-gray-300 max-w-[120px] truncate">{item.name}:</span>
          </div>
          <span className="font-mono font-bold text-white">{item.value.toFixed(3)}</span>
        </div>
      ))}

      {change && (
        <div className={`mt-2 px-2 py-1 rounded flex items-center gap-1.5 w-fit text-xs font-medium border
          ${change.changePercent > 0 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
            change.changePercent < 0 ? 'bg-red-500/10 border-red-500/20 text-red-400' :
            'bg-slate-500/10 border-slate-500/20 text-slate-400'}`}
        >
          {change.changePercent > 0 ? <ArrowUpRight size={12} /> : change.changePercent < 0 ? <ArrowDownRight size={12} /> : <Minus size={12} />}
          <span>{formatPercentChange(change.changePercent)} vs prev.</span>
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
  hiddenSeries: Set<string>;
  hideVolume?: boolean;
  hideForecast?: boolean;
  forecastData?: ForecastDataPoint[] | null;
  sharedHoverDate?: Date | null;
  onHoverDateChange?: (date: Date | null) => void;
}

const Chart: React.FC<ChartProps> = ({
  width,
  height,
  data,
  seriesNames,
  period,
  hiddenSeries,
  hideVolume = false,
  hideForecast = false,
  forecastData,
  sharedHoverDate,
  onHoverDateChange,
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

  const forecastPeriodLabels = useMemo(() => {
    if (!forecastData || forecastData.length === 0) return [];
    return forecastData.map((fp) => formatDateForPeriod(fp.period, period));
  }, [forecastData, period]);

  const tickInterval = useMemo(() => {
    const numHistoricalPoints = data.length;
    const numForecastPoints = forecastPeriodLabels.length;
    const totalPoints = numHistoricalPoints + numForecastPoints;
    if (totalPoints <= 1) return 1;
    const estimatedLabelWidth = period === 'year' ? 40 : 40;
    const maxLabels = Math.floor(innerWidth / estimatedLabelWidth);
    const availableLabelsForHistorical = numForecastPoints > 0
      ? Math.max(1, maxLabels - numForecastPoints)
      : maxLabels;
    return Math.max(1, Math.ceil(numHistoricalPoints / availableLabelsForHistorical));
  }, [data.length, forecastPeriodLabels.length, innerWidth, period]);

  const y1Scale = useMemo(() => {
    // Calculate min/max from actual data
    let minSentiment = -1;
    let maxSentiment = 1;

    if (data.length > 0) {
      const allSentiments = data.flatMap(d =>
        seriesNames.map(name => (d[name] as number) || 0)
      );

      if (allSentiments.length > 0) {
        minSentiment = Math.min(...allSentiments);
        maxSentiment = Math.max(...allSentiments);
      }
    }

    // Ensure we always stay within reasonable bounds with some padding
    const padding = (maxSentiment - minSentiment) * 0.1 || 0.2;
    return scaleLinear<number>({
      range: [innerHeight, 0],
      domain: [
        Math.max(-1, minSentiment - padding),
        Math.min(1, maxSentiment + padding)
      ],
      clamp: true, // This prevents values from going outside the domain
    });
  }, [innerHeight, data, seriesNames]);

  const maxVolume = useMemo(() => Math.max(...data.map((d) => d.volume), 10), [data]);

  const y2Scale = useMemo(
    () =>
      scaleLinear<number>({
        range: [innerHeight, 0],
        domain: [0, maxVolume * 1.5],
        nice: true,
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

  const formattedForecastData = useMemo(() => {
    if (!forecastData || forecastData.length === 0) return [];
    return forecastData.map((fp) => ({
      period: formatDateForPeriod(fp.period, period),
      value: fp.value,
      lower: fp.lower,
      upper: fp.upper,
    }));
  }, [forecastData, period]);

  // React to shared hover date changes from other charts
  React.useEffect(() => {
    if (!sharedHoverDate || !data || data.length === 0) {
      hideTooltip();
      return;
    }

    // Find the closest data point to the shared hover date
    // Compare dates by converting both to date-only strings (YYYY-MM-DD)
    const sharedDateStr = sharedHoverDate.toISOString().split('T')[0];
    const dataIndex = data.findIndex(d => {
      const periodDateStr = new Date(d.periodDate).toISOString().split('T')[0];
      return periodDateStr === sharedDateStr;
    });

    if (dataIndex >= 0) {
      const selectedData = data[dataIndex];
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

      let change: { change: number; changePercent: number } | null = null;
      if (dataIndex > 0 && seriesNames.length > 0) {
        const primaryName = seriesNames[0];
        const currentValue = (selectedData[primaryName] as number) || 0;
        const previousData = data[dataIndex - 1];
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
    } else {
      hideTooltip();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedHoverDate]);

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

      // Update shared hover date if callback provided
      if (onHoverDateChange) {
        // Use the original date from the data
        const dataPoint = data[safeIndex];
        if (dataPoint) {
          const periodDate = new Date(dataPoint.periodDate);
          onHoverDateChange(periodDate);
        }
      }

      const forecastPoint = formattedForecastData.find(fp => fp.period === hoveredPeriod);

      if (forecastPoint) {
        showTooltip({
          tooltipData: {
            period: forecastPoint.period,
            volume: 0,
            legendItems: [],
            sentiments: {},
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
    [xScale, margin.left, innerHeight, showTooltip, data, seriesNames, colorScale, formattedForecastData, onHoverDateChange]
  );

  if (width < 10) return null;

  return (
    <div className="relative font-sans">
      <svg
        ref={containerRef}
        width={width}
        height={height}
        className="touch-none select-none"
        onMouseMove={handleTooltip}
        onMouseLeave={() => {
          hideTooltip();
          onHoverDateChange?.(null);
        }}
        onTouchMove={handleTooltip}
        onTouchEnd={() => {
          hideTooltip();
          onHoverDateChange?.(null);
        }}
      >
        <defs>
          <filter id="primaryGlowSentiment" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="chart-clip-sentiment">
            <rect x="0" y="0" width={innerWidth} height={innerHeight} />
          </clipPath>
        </defs>

        <Group left={margin.left} top={margin.top}>
          <GridRows
            scale={y1Scale}
            width={innerWidth}
            strokeDasharray="3,3"
            stroke={GRID_COLOR}
            numTicks={5}
          />

          {/* Clipped chart elements group */}
          <Group clipPath="url(#chart-clip-sentiment)">
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
                opacity={0.8}
              />
            );
          })}

          {/* Sentiment Lines */}
          {seriesNames.map((name, index) => {
            if (hiddenSeries.has(name)) return null;

            const isPrimary = index === 0;
            const strokeWidth = isPrimary ? 3 : 2;
            const glowFilter = isPrimary ? 'url(#primaryGlowSentiment)' : undefined;

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
                {tooltipOpen && tooltipData && !tooltipData.isForecast && (
                  <Circle
                    cx={(xScale(tooltipData.period) || 0) + xScale.bandwidth() / 2}
                    cy={y1Scale(tooltipData.sentiments[name] || 0)}
                    r={isPrimary ? 6 : 4}
                    fill={colorScale(name)}
                    stroke="#1e293b"
                    strokeWidth={2}
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* Forecast Visualization */}
          {!hideForecast && forecastData && forecastData.length > 0 && data.length > 0 && (() => {
            const lastDataPeriod = data[data.length - 1].period;
            const lastDataX = (xScale(lastDataPeriod) || 0) + xScale.bandwidth() / 2;
            const lastHistoricalValue = data[data.length - 1][seriesNames[0]] as number || 0;

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

            const connectionPoints = [
              { x: lastDataX, y: y1Scale(lastHistoricalValue) },
              ...forecastPoints.map(fp => ({ x: fp.x, y: y1Scale(fp.value) })),
            ];

            const confidenceAreaData = [
              { x: lastDataX, lower: lastHistoricalValue, upper: lastHistoricalValue },
              ...forecastPoints.map(fp => ({
                x: fp.x,
                lower: Math.max(-1, fp.lower),
                upper: Math.min(1, fp.upper),
              })),
            ];

            const upperBoundPath = confidenceAreaData.map(d => ({ x: d.x, y: y1Scale(d.upper) }));
            const lowerBoundPath = [...confidenceAreaData].reverse().map(d => ({ x: d.x, y: y1Scale(d.lower) }));

            return (
              <React.Fragment key="forecast-group">
                <path
                  d={`
                    M ${upperBoundPath[0].x},${upperBoundPath[0].y}
                    ${upperBoundPath.slice(1).map(p => `L ${p.x},${p.y}`).join(' ')}
                    ${lowerBoundPath.map(p => `L ${p.x},${p.y}`).join(' ')}
                    Z
                  `}
                  fill={FORECAST_COLOR}
                  opacity={0.15}
                />
                <LinePath
                  data={connectionPoints}
                  x={(d) => d.x}
                  y={(d) => d.y}
                  stroke={FORECAST_COLOR}
                  strokeWidth={2}
                  strokeDasharray="4,4"
                  curve={curveMonotoneX}
                  strokeLinecap="round"
                />
              </React.Fragment>
            );
          })()}

          {/* Tooltip Hover Line */}
          {tooltipOpen && tooltipData && (
            <Line
              from={{ x: (xScale(tooltipData.period) || 0) + xScale.bandwidth() / 2, y: 0 }}
              to={{ x: (xScale(tooltipData.period) || 0) + xScale.bandwidth() / 2, y: innerHeight }}
              stroke="#fff"
              strokeWidth={1}
              pointerEvents="none"
              opacity={0.2}
            />
          )}
          </Group>
          {/* End of clipped chart elements */}

          {/* Axes - not clipped */}
          <AxisBottom
            scale={xScale}
            top={innerHeight}
            stroke={AXIS_COLOR}
            hideAxisLine={false}
            hideTicks={true}
            tickLabelProps={() => ({
              fill: AXIS_COLOR,
              fontSize: 10,
              textAnchor: 'middle' as const,
              fontFamily: 'sans-serif',
            })}
            tickFormat={(value) => value}
            tickValues={
              data
                .map((d, i) => (i % tickInterval === 0 ? d.period : null))
                .filter((v): v is string => v !== null)
            }
          />

          <AxisLeft
            scale={y1Scale}
            stroke="transparent"
            tickStroke="transparent"
            numTicks={5}
            label="Sentiment"
            labelOffset={40}
            labelProps={{
              fill: AXIS_COLOR,
              fontSize: 11,
              textAnchor: 'middle' as const,
              fontWeight: 600,
            }}
            tickLabelProps={() => ({
              fill: AXIS_COLOR,
              fontSize: 10,
              textAnchor: 'end' as const,
              dy: 3,
              dx: -5,
            })}
          />

          <AxisRight
            scale={y2Scale}
            left={innerWidth}
            stroke="transparent"
            tickStroke="transparent"
            numTicks={5}
            label="Reviews"
            labelOffset={40}
            labelProps={{
              fill: AXIS_COLOR,
              fontSize: 11,
              textAnchor: 'middle' as const,
              fontWeight: 600,
            }}
            tickLabelProps={() => ({
              fill: AXIS_COLOR,
              fontSize: 10,
              textAnchor: 'start' as const,
              dy: 3,
              dx: 5,
            })}
          />
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        <TooltipInPortal
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            ...defaultStyles,
            backgroundColor: '#0f172a', // slate-900
            borderRadius: '0.5rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(148, 163, 184, 0.2)',
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

// ✅ Memoized component with custom equality check
const SentimentTrendsComponent: React.FC<SentimentTrendsProps> = ({
  primaryTimeline,
  comparisonTimelines = [],
  benchmarkTimelines,
  forecastData,
  period = 'month',
  showBenchmarks,
  sharedHoverDate,
  onHoverDateChange,
  hiddenSeries,
  onHiddenSeriesChange,
  hideVolume: hideVolumeProp,
  onHideVolumeChange,
}) => {
  const { chartData, seriesNames } = useMemo(() => {
    if (!primaryTimeline?.data || primaryTimeline.data.length === 0) {
      return { chartData: [], seriesNames: [] };
    }

    const primaryPeriods = primaryTimeline.data.map((p) => p.period_start);
    const sortedPeriods = primaryPeriods.sort((a, b) => getDateSortKey(a) - getDateSortKey(b));

    const names: string[] = [];
    const primaryName = primaryTimeline.business_name || 'Primary Business';
    names.push(primaryName);

    // Benchmarks
    if (showBenchmarks?.showCityAvg && benchmarkTimelines?.city) {
      names.push(benchmarkTimelines.city.business_name || 'City Avg');
    }
    if (showBenchmarks?.showNeighborhoodAvg && benchmarkTimelines?.neighborhood) {
      names.push(benchmarkTimelines.neighborhood.business_name || 'Neighborhood Avg');
    }
    if (showBenchmarks?.showCategoryAvg && benchmarkTimelines?.category) {
      names.push(benchmarkTimelines.category.business_name || 'Category Avg');
    }

    // Comparisons
    comparisonTimelines.forEach((comp) => {
      names.push(comp.business_name || comp.business_id || 'Competitor');
    });

    const data: ChartDataPoint[] = sortedPeriods.map((periodStart) => {
      const primaryPoint = primaryTimeline.data.find((p) => p.period_start === periodStart);

      const point: ChartDataPoint = {
        period: formatDateForPeriod(periodStart, period),
        periodDate: periodStart, // Store original date for synchronization
        volume: primaryPoint?.review_count || 0,
        [primaryName]: primaryPoint?.avg_sentiment_score || 0,
      };

      // Add Benchmarks
      if (showBenchmarks?.showCityAvg && benchmarkTimelines?.city) {
        const p = benchmarkTimelines.city.data.find(d => d.period_start === periodStart);
        point[benchmarkTimelines.city.business_name || 'City Avg'] = p?.avg_sentiment_score || 0;
      }
      if (showBenchmarks?.showNeighborhoodAvg && benchmarkTimelines?.neighborhood) {
        const p = benchmarkTimelines.neighborhood.data.find(d => d.period_start === periodStart);
        point[benchmarkTimelines.neighborhood.business_name || 'Neighborhood Avg'] = p?.avg_sentiment_score || 0;
      }
      if (showBenchmarks?.showCategoryAvg && benchmarkTimelines?.category) {
        const p = benchmarkTimelines.category.data.find(d => d.period_start === periodStart);
        point[benchmarkTimelines.category.business_name || 'Category Avg'] = p?.avg_sentiment_score || 0;
      }

      // Add Comparisons
      comparisonTimelines.forEach((comp) => {
        const p = comp.data.find(d => d.period_start === periodStart);
        const name = comp.business_name || comp.business_id || 'Competitor';
        point[name] = p?.avg_sentiment_score || 0;
      });

      return point;
    });

    return { chartData: data, seriesNames: names };
  }, [primaryTimeline, comparisonTimelines, benchmarkTimelines, showBenchmarks, period]);

  // Use shared hiddenSeries if provided, otherwise use local state
  const [localHiddenSeries, setLocalHiddenSeries] = useState<Set<string>>(new Set());
  const effectiveHiddenSeries = hiddenSeries ?? localHiddenSeries;
  const effectiveSetHiddenSeries = onHiddenSeriesChange ?? setLocalHiddenSeries;

  // Use shared hideVolume if provided, otherwise use local state
  const [localHideVolume, setLocalHideVolume] = useState(false);
  const hideVolume = hideVolumeProp ?? localHideVolume;
  const setHideVolume = onHideVolumeChange ?? setLocalHideVolume;

  const [hideForecast, setHideForecast] = useState(false);

  const toggleSeries = useCallback((seriesName: string) => {
    effectiveSetHiddenSeries(prev => {
      const newSet = new Set(prev);
      if (newSet.has(seriesName)) newSet.delete(seriesName);
      else newSet.add(seriesName);
      return newSet;
    });
  }, [effectiveSetHiddenSeries]);

  if (!primaryTimeline) return null;

  return (
    <div className="glass rounded-lg p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Sentiment Trends</h2>
      </div>

      <div className="flex-1 min-h-0">
        <ParentSize>
          {({ width, height }) => (
            <Chart
              width={width}
              height={height}
              data={chartData}
              seriesNames={seriesNames}
              period={period}
              hiddenSeries={effectiveHiddenSeries}
              hideVolume={hideVolume}
              hideForecast={hideForecast}
              forecastData={forecastData}
              sharedHoverDate={sharedHoverDate}
              onHoverDateChange={onHoverDateChange}
            />
          )}
        </ParentSize>
      </div>

      {/* Interactive Legend */}
      <div className="mt-4 flex flex-wrap gap-3 justify-center border-t border-white/10 pt-3">
        <button
          className={`flex items-center gap-2 text-xs transition-opacity ${hideVolume ? 'opacity-50' : 'opacity-100'}`}
          onClick={() => setHideVolume(!hideVolume)}
        >
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: VOLUME_COLOR }} />
          <span className="text-slate-300">Volume</span>
        </button>

        {seriesNames.map((name, i) => {
          const isHidden = effectiveHiddenSeries.has(name);
          return (
            <button
              key={name}
              className={`flex items-center gap-2 text-xs transition-opacity ${isHidden ? 'opacity-50' : 'opacity-100'}`}
              onClick={() => toggleSeries(name)}
            >
              <div className="w-3 h-1 rounded-full" style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }} />
              <span className="text-slate-300">{name}</span>
            </button>
          );
        })}

        {forecastData && forecastData.length > 0 && (
          <button
            className={`flex items-center gap-2 text-xs transition-opacity ${hideForecast ? 'opacity-50' : 'opacity-100'}`}
            onClick={() => setHideForecast(!hideForecast)}
          >
            <div className="w-3 h-1 rounded-full border-t border-dashed" style={{ borderColor: FORECAST_COLOR }} />
            <span className="text-slate-300">Forecast</span>
          </button>
        )}
      </div>
    </div>
  );
};

// Export memoized version with custom comparator
export const SentimentTrends = memo(SentimentTrendsComponent, (prev, next) => {
  // Only re-render if critical props change
  return (
    prev.primaryTimeline === next.primaryTimeline &&
    prev.comparisonTimelines === next.comparisonTimelines &&
    prev.benchmarkTimelines === next.benchmarkTimelines &&
    prev.forecastData === next.forecastData &&
    prev.period === next.period &&
    prev.showBenchmarks === next.showBenchmarks &&
    prev.sharedHoverDate === next.sharedHoverDate &&
    prev.hiddenSeries === next.hiddenSeries &&
    prev.hideVolume === next.hideVolume
  );
});
