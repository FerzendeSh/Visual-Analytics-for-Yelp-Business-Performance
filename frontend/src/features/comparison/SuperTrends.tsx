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
import { ArrowUpRight, ArrowDownRight, Minus, Move, MousePointer2 } from 'lucide-react';
import { format } from 'date-fns';

import { TimelineDataPoint, ForecastData } from '../../lib/api';
import {
  VOLUME_COLOR,
  VOLUME_HIGHLIGHT,
  AXIS_COLOR,
  GRID_COLOR,
  FORECAST_COLOR,
  LINE_COLORS,
  getSeriesColor,
  formatPercentChange,
  formatDateForPeriod,
  getDateSortKey,
  calculateTickInterval,
} from './helpers/chartHelpers';
import { useChartData, ChartDataPoint } from './hooks/useChartData';

// Local type definitions
export interface RatingsTimeline {
  business_name?: string;
  business_id?: string;
  data: TimelineDataPoint[];
}

export interface ForecastDataPoint {
  period: string;
  predicted_value: number;
  lower_80: number;
  upper_80: number;
  // Mapped properties for internal use
  value?: number;
  lower?: number;
  upper?: number;
}

// --- Interfaces ---

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
  isForecast?: boolean;
  forecastValue?: number;
  forecastLower?: number;
  forecastUpper?: number;
}

export interface SuperTrendsProps {
  primaryTimeline: RatingsTimeline | null;
  comparisonTimelines?: RatingsTimeline[];
  benchmarkTimelines?: {
    city?: RatingsTimeline | null;
    neighborhood?: RatingsTimeline | null;
    category?: RatingsTimeline | null;
    cluster?: RatingsTimeline | null;
  };
  forecastData?: ForecastDataPoint[] | null;
  period?: 'month' | 'year';
  showBenchmarks?: {
    showCityAvg: boolean;
    showNeighborhoodAvg: boolean;
    showCategoryAvg: boolean;
  };
  // Shared state for synchronization with SentimentTrends
  sharedHoverDate?: Date | null;
  onHoverDateChange?: (date: Date | null) => void;
  hoveredBusinessId?: string | null;
  hiddenSeries?: Set<string>;
  onHiddenSeriesChange?: (hidden: Set<string>) => void;
  // Brush selection props
  isBrushMode?: boolean;
  brushSelection?: {start: Date, end: Date} | null;
  onBrushChange?: (selection: {start: Date, end: Date} | null) => void;
  onBrushModeChange?: (enabled: boolean) => void;
  // Year drill-down
  onYearClick?: (year: string) => void;
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
          <span className="font-mono font-bold text-[#06ffa5]">{data.forecastValue?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-xs text-gray-400">
          <span>Upper bound</span>
          <span className="font-mono text-gray-300">{data.forecastUpper?.toFixed(2)}</span>
        </div>
        <div className="flex justify-between items-center text-xs text-gray-400">
          <span>Lower bound</span>
          <span className="font-mono text-gray-300">{data.forecastLower?.toFixed(2)}</span>
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
          <span className="font-mono font-bold text-white">{item.value.toFixed(2)}</span>
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
  benchmarkMap: Map<string, 'city' | 'neighborhood' | 'cluster'>;
  period: 'month' | 'year';
  hiddenSeries: Set<string>;
  hideVolume?: boolean;
  hideForecast?: boolean;
  forecastData?: ForecastDataPoint[] | null;
  sharedHoverDate?: Date | null;
  onHoverDateChange?: (date: Date | null) => void;
  hoveredBusinessId?: string | null;
  isBrushMode?: boolean;
  brushSelection?: {start: Date, end: Date} | null;
  onBrushChange?: (selection: {start: Date, end: Date} | null) => void;
  onBrushModeChange?: (enabled: boolean) => void;
  onYearClick?: (year: string) => void;
}

const Chart: React.FC<ChartProps> = ({
  width,
  height,
  data,
  seriesNames,
  benchmarkMap,
  period,
  hiddenSeries,
  hideVolume = false,
  hideForecast = false,
  forecastData,
  sharedHoverDate,
  onHoverDateChange,
  hoveredBusinessId,
  isBrushMode = false,
  brushSelection,
  onBrushChange,
  onBrushModeChange,
  onYearClick,
}) => {
  const margin = { top: 20, right: 60, bottom: 40, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Brush state
  const [brushStart, setBrushStart] = useState<number | null>(null);
  const [brushEnd, setBrushEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
    let minRating = 1;
    let maxRating = 5;

    if (data.length > 0) {
      const allRatings = data.flatMap(d =>
        seriesNames.map(name => (d[name] as number) || 0)
      ).filter(v => v > 0);

      if (allRatings.length > 0) {
        minRating = Math.min(...allRatings);
        maxRating = Math.max(...allRatings);
      }
    }

    // Ensure we always stay within reasonable bounds with some padding
    const padding = (maxRating - minRating) * 0.1 || 0.2;
    return scaleLinear<number>({
      range: [innerHeight, 0],
      domain: [
        Math.max(0, minRating - padding),
        Math.min(5, maxRating + padding)
      ],
      clamp: true, // This prevents values from going outside the domain
    });
  }, [innerHeight, data, seriesNames]);

  const maxVolume = useMemo(() => Math.max(...data.map((d) => d.volume), 10), [data]);

  const y2Scale = useMemo(
    () =>
      scaleLinear<number>({
        range: [innerHeight, 0],
        domain: [0, maxVolume * 1.5], // Give more headroom for volume bars
        nice: true,
      }),
    [innerHeight, maxVolume]
  );

  const colorScale = useMemo(
    () =>
      scaleOrdinal<string, string>({
        domain: seriesNames,
        range: seriesNames.map((name, index) => getSeriesColor(name, index, benchmarkMap)),
      }),
    [seriesNames, benchmarkMap]
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
          ratings,
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
    [xScale, margin.left, innerHeight, showTooltip, data, seriesNames, colorScale, formattedForecastData, onHoverDateChange]
  );

  // Helper function to parse period string back to Date
  const parsePeriodToDate = useCallback((periodStr: string): Date => {
    // Try to parse as ISO date string first (e.g., "2010-01-01")
    const isoDate = new Date(periodStr);
    if (!isNaN(isoDate.getTime())) {
      return isoDate;
    }

    // Period format is like "Jan 2021" or "2021"
    if (period === 'year') {
      // Extract year from string (handles both "2021" and "2021-01-01" formats)
      const yearMatch = periodStr.match(/\d{4}/);
      if (yearMatch) {
        return new Date(parseInt(yearMatch[0]), 0, 1); // January 1st of the year
      }
    }

    // Parse "Jan 2021" format
    const date = new Date(periodStr + ' 1'); // Add day for parsing
    return date;
  }, [period]);

  // Brush event handlers
  const handleBrushMouseDown = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!isBrushMode) return;

      const point = localPoint(event);
      if (!point) return;

      const x = point.x - margin.left;
      // Only start brush if within chart bounds
      if (x >= 0 && x <= innerWidth) {
        setBrushStart(x);
        setBrushEnd(x);
        setIsDragging(true);
        // Clear any existing selection
        onBrushChange?.(null);
      }
    },
    [isBrushMode, margin.left, innerWidth, onBrushChange]
  );

  const handleBrushMouseMove = useCallback(
    (event: React.MouseEvent<SVGSVGElement>) => {
      if (!isBrushMode || !isDragging || brushStart === null) {
        // Fall back to tooltip behavior when not brushing
        if (!isBrushMode) {
          handleTooltip(event);
        }
        return;
      }

      const point = localPoint(event);
      if (!point) return;

      const x = point.x - margin.left;
      // Clamp to chart bounds
      const clampedX = Math.max(0, Math.min(x, innerWidth));
      setBrushEnd(clampedX);
    },
    [isBrushMode, isDragging, brushStart, margin.left, innerWidth, handleTooltip]
  );

  const handleBrushMouseUp = useCallback(() => {
    if (!isBrushMode || !isDragging || brushStart === null || brushEnd === null) {
      setIsDragging(false);
      return;
    }

    setIsDragging(false);

    // Calculate the selected date range
    const minX = Math.min(brushStart, brushEnd);
    const maxX = Math.max(brushStart, brushEnd);

    // Convert X positions to period indices
    const step = xScale.step();
    const domain = xScale.domain();
    const startIndex = Math.floor(minX / step);
    const endIndex = Math.floor(maxX / step);

    // Clamp indices
    const safeStartIndex = Math.max(0, Math.min(startIndex, domain.length - 1));
    const safeEndIndex = Math.max(0, Math.min(endIndex, domain.length - 1));

    if (safeStartIndex !== safeEndIndex) {
      const startPeriod = domain[safeStartIndex];
      const endPeriod = domain[safeEndIndex];

      // Parse period strings back to dates
      const startDate = parsePeriodToDate(startPeriod);
      const endDate = parsePeriodToDate(endPeriod);

      onBrushChange?.({ start: startDate, end: endDate });

      // Automatically turn off brush mode after selection
      onBrushModeChange?.(false);
    }

    // Clear brush visual
    setBrushStart(null);
    setBrushEnd(null);
  }, [isBrushMode, isDragging, brushStart, brushEnd, xScale, parsePeriodToDate, onBrushChange, onBrushModeChange]);

  const handleMouseLeave = useCallback(() => {
    if (isBrushMode && isDragging) {
      // Cancel brush on mouse leave
      setIsDragging(false);
      setBrushStart(null);
      setBrushEnd(null);
    } else {
      hideTooltip();
      onHoverDateChange?.(null);
    }
  }, [isBrushMode, isDragging, hideTooltip, onHoverDateChange]);

  // Calculate brush rectangle for rendering
  const brushRect = useMemo(() => {
    if (brushSelection && !isDragging) {
      // Show brush selection from props - use raw ISO dates to match xScale domain
      const startPeriod = brushSelection.start.toISOString().split('T')[0];
      const endPeriod = brushSelection.end.toISOString().split('T')[0];

      const startX = xScale(startPeriod);
      const endX = xScale(endPeriod);

      if (startX !== undefined && endX !== undefined) {
        const minX = Math.min(startX, endX);
        const maxX = Math.max(startX, endX) + xScale.bandwidth();
        return { x: minX, width: maxX - minX };
      }
    } else if (isDragging && brushStart !== null && brushEnd !== null) {
      // Show active brush drag
      const minX = Math.min(brushStart, brushEnd);
      const maxX = Math.max(brushStart, brushEnd);
      return { x: minX, width: maxX - minX };
    }
    return null;
  }, [brushSelection, isDragging, brushStart, brushEnd, xScale]);

  if (width < 10) return null;

  return (
    <div className="relative font-sans">
      <svg
        ref={containerRef}
        width={width}
        height={height}
        className="touch-none select-none"
        style={{ cursor: isBrushMode ? 'crosshair' : 'default' }}
        onMouseDown={handleBrushMouseDown}
        onMouseMove={handleBrushMouseMove}
        onMouseUp={handleBrushMouseUp}
        onMouseLeave={handleMouseLeave}
        onTouchMove={handleTooltip}
        onTouchEnd={() => {
          hideTooltip();
          onHoverDateChange?.(null);
        }}
      >
        <defs>
          <filter id="primaryGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="chart-clip-super">
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
          <Group clipPath="url(#chart-clip-super)">
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
                style={{ cursor: !isBrushMode && period === 'year' ? 'pointer' : 'default' }}
                onClick={() => {
                  if (onYearClick && !isBrushMode && period === 'year') {
                    const match = d.period.match(/\d{4}/);
                    if (match) {
                      onYearClick(match[0]);
                    }
                  }
                }}
              />
            );
          })}

          {/* Rating Lines */}
          {seriesNames.map((name, index) => {
            if (hiddenSeries.has(name)) return null;

            const isPrimary = index === 0;
            const strokeWidth = isPrimary ? 3 : 2;
            const glowFilter = isPrimary ? 'url(#primaryGlow)' : undefined;

            const isHighlighted = hoveredBusinessId ? name === hoveredBusinessId : true;
            const lineOpacity = isHighlighted ? 1 : 0.15;

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
                  opacity={lineOpacity}
                  pointerEvents="none"
                />
                {tooltipOpen && tooltipData && !tooltipData.isForecast && (
                  <Circle
                    cx={(xScale(tooltipData.period) || 0) + xScale.bandwidth() / 2}
                    cy={y1Scale(tooltipData.ratings[name] || 0)}
                    r={isPrimary ? 6 : 4}
                    fill={colorScale(name)}
                    stroke="#1e293b"
                    strokeWidth={2}
                    opacity={lineOpacity}
                    pointerEvents="none"
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
                value: fp.value ?? fp.predicted_value,
                lower: fp.lower ?? fp.lower_80,
                upper: fp.upper ?? fp.upper_80,
                period: formattedPeriod,
              };
            });

            const connectionPoints = [
              { x: lastDataX, y: y1Scale(lastHistoricalValue) },
              ...forecastPoints.map(fp => ({ x: fp.x, y: y1Scale(fp.value ?? 0) })),
            ];

            const confidenceAreaData = [
              { x: lastDataX, lower: lastHistoricalValue, upper: lastHistoricalValue },
              ...forecastPoints.map(fp => ({
                x: fp.x,
                lower: Math.max(1, fp.lower ?? 0),
                upper: Math.min(5, fp.upper ?? 5),
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
                  pointerEvents="none"
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
                  pointerEvents="none"
                />
              </React.Fragment>
            );
          })()}

          {/* Tooltip Hover Line */}
          {tooltipOpen && tooltipData && !isBrushMode && (
            <Line
              from={{ x: (xScale(tooltipData.period) || 0) + xScale.bandwidth() / 2, y: 0 }}
              to={{ x: (xScale(tooltipData.period) || 0) + xScale.bandwidth() / 2, y: innerHeight }}
              stroke="#fff"
              strokeWidth={1}
              pointerEvents="none"
              opacity={0.2}
            />
          )}

          {/* Brush Selection Overlay - Only show when actively in brush mode */}
          {brushRect && isBrushMode && (
            <rect
              x={brushRect.x}
              y={0}
              width={brushRect.width}
              height={innerHeight}
              fill="#3b82f6"
              opacity={0.2}
              stroke="#3b82f6"
              strokeWidth={1}
              pointerEvents="none"
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
            tickFormat={(value) => {
              if (period === 'month') {
                // Show month names for monthly data (e.g., "2021-01-01" -> "Jan")
                try {
                  const date = new Date(value.toString());
                  return format(date, 'MMM');
                } catch {
                  return value.toString();
                }
              }
              // Extract year from period (e.g., "2021-01-01" -> "2021")
              const match = value.toString().match(/\d{4}/);
              return match ? match[0] : value.toString();
            }}
            tickValues={(() => {
              if (period === 'month') {
                // Show all months when in monthly view
                return data.map(d => d.period);
              }

              // Get unique years only for yearly view
              const seenYears = new Set<string>();
              const uniqueYearPeriods: string[] = [];

              data.forEach((d) => {
                const match = d.period.match(/\d{4}/);
                const year = match ? match[0] : d.period;

                if (!seenYears.has(year)) {
                  seenYears.add(year);
                  uniqueYearPeriods.push(d.period);
                }
              });

              return uniqueYearPeriods;
            })()}
          />

          <AxisLeft
            scale={y1Scale}
            stroke="transparent"
            tickStroke="transparent"
            numTicks={5}
            label="Rating"
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
const SuperTrendsComponent: React.FC<SuperTrendsProps> = ({
  primaryTimeline,
  comparisonTimelines = [],
  benchmarkTimelines,
  forecastData,
  period = 'month',
  showBenchmarks,
  sharedHoverDate,
  onHoverDateChange,
  hoveredBusinessId,
  hiddenSeries,
  onHiddenSeriesChange,
  isBrushMode = false,
  brushSelection,
  onBrushChange,
  onBrushModeChange,
  onYearClick,
}) => {
  // Extract chart data transformation to custom hook
  const { chartData, seriesNames, benchmarkMap } = useChartData({
    primaryTimeline,
    comparisonTimelines,
    benchmarkTimelines: benchmarkTimelines ? {
      city: benchmarkTimelines.city ?? undefined,
      neighborhood: benchmarkTimelines.neighborhood ?? undefined,
      category: benchmarkTimelines.category ?? undefined,
      cluster: benchmarkTimelines.cluster ?? undefined,
    } : undefined,
    showBenchmarks,
    period,
  });

  // Use shared hiddenSeries if provided, otherwise use local state
  const [localHiddenSeries, setLocalHiddenSeries] = useState<Set<string>>(new Set());
  const effectiveHiddenSeries = hiddenSeries ?? localHiddenSeries;
  const effectiveSetHiddenSeries = onHiddenSeriesChange ?? setLocalHiddenSeries;

  // Volume bars are always visible (non-hideable)
  const hideVolume = false;

  const [hideForecast, setHideForecast] = useState(false);

  const toggleSeries = useCallback((seriesName: string) => {
    const newSet = new Set(effectiveHiddenSeries);
    if (newSet.has(seriesName)) {
      newSet.delete(seriesName);
    } else {
      newSet.add(seriesName);
    }
    effectiveSetHiddenSeries(newSet);
  }, [effectiveHiddenSeries, effectiveSetHiddenSeries]);

  if (!primaryTimeline) return null;

  return (
    <div className="glass rounded-lg p-1.5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-1 mt-0.5">
        <h2 className="text-sm font-semibold text-white">Performance Trends</h2>

        {/* Mode Controls */}
        <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-md p-1">
          {/* Click Mode - Click on year bars to drill down */}
          <button
            className={`p-1 rounded transition-all cursor-pointer ${
              !isBrushMode
                ? 'bg-blue-500/40 text-blue-300'
                : 'text-slate-400 hover:bg-white/10 hover:text-slate-300'
            }`}
            onClick={() => {
              if (onBrushModeChange && isBrushMode) {
                onBrushModeChange(false);
              }
            }}
            title="Click on year bars to view monthly data"
          >
            <MousePointer2 size={13} />
          </button>

          {/* Brush Mode - Drag to select range */}
          <button
            className={`p-1 rounded transition-all cursor-pointer ${
              isBrushMode
                ? 'bg-blue-500/40 text-blue-300'
                : 'text-slate-400 hover:bg-white/10 hover:text-slate-300'
            }`}
            onClick={() => {
              if (onBrushModeChange) {
                onBrushModeChange(!isBrushMode);
              }
            }}
            title={isBrushMode ? "Drag on chart to select time range" : "Enable time range selection"}
          >
            <Move size={13} />
          </button>

          {brushSelection && (
            <>
              <div className="h-3 w-px bg-white/20" />
              <span className="text-[10px] font-medium text-slate-300 px-1">
                {format(brushSelection.start, 'yyyy') === format(brushSelection.end, 'yyyy')
                  ? format(brushSelection.start, 'yyyy')
                  : `${format(brushSelection.start, 'yyyy')}-${format(brushSelection.end, 'yyyy')}`}
              </span>
              <button
                className="p-0.5 hover:bg-white/10 rounded transition-colors cursor-pointer"
                onClick={() => onBrushChange && onBrushChange(null)}
                title="Clear selection"
              >
                <span className="text-sm leading-none text-slate-400 hover:text-slate-300">×</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Interactive Legend */}
      <div className="mb-1.5 flex flex-wrap gap-1.5 justify-center border-b border-white/10 pb-2 shrink-0">
        <div className="flex items-center gap-2 text-xs opacity-100">
          <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: VOLUME_COLOR }} />
          <span className="text-slate-300">Volume</span>
        </div>

        {seriesNames.map((name, i) => {
          const isHidden = effectiveHiddenSeries.has(name);
          return (
            <button
              key={name}
              className={`flex items-center gap-2 text-xs transition-opacity cursor-pointer ${isHidden ? 'opacity-50' : 'opacity-100'}`}
              onClick={() => toggleSeries(name)}
            >
              <div className="w-3 h-1 rounded-full" style={{ backgroundColor: getSeriesColor(name, i, benchmarkMap) }} />
              <span className="text-slate-300">{name}</span>
            </button>
          );
        })}

        {forecastData && forecastData.length > 0 && (
          <button
            className={`flex items-center gap-2 text-xs transition-opacity cursor-pointer ${hideForecast ? 'opacity-50' : 'opacity-100'}`}
            onClick={() => setHideForecast(!hideForecast)}
          >
            <div className="w-3 h-1 rounded-full border-t border-dashed" style={{ borderColor: FORECAST_COLOR }} />
            <span className="text-slate-300">Forecast</span>
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 relative">
        <div className="absolute inset-0">
          <ParentSize>
            {({ width, height }) => (
              <Chart
                width={width}
                height={Math.max(height, 100)}
                data={chartData}
                seriesNames={seriesNames}
                benchmarkMap={benchmarkMap}
                period={period}
                hiddenSeries={effectiveHiddenSeries}
                hideVolume={hideVolume}
                hideForecast={hideForecast}
                forecastData={forecastData}
                sharedHoverDate={sharedHoverDate}
                onHoverDateChange={onHoverDateChange}
                hoveredBusinessId={hoveredBusinessId}
                isBrushMode={isBrushMode}
                brushSelection={brushSelection}
                onBrushChange={onBrushChange}
                onBrushModeChange={onBrushModeChange}
                onYearClick={onYearClick}
              />
            )}
          </ParentSize>
        </div>
      </div>
    </div>
  );
};

// Export memoized version with custom comparator
export const SuperTrends = memo(SuperTrendsComponent, (prev, next) => {
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
    prev.isBrushMode === next.isBrushMode &&
    prev.brushSelection === next.brushSelection
    // Note: Function props (onHoverDateChange, onBrushChange, etc.) are excluded from comparison
    // as they're typically stable references
  );
});
