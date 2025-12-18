import React, { useMemo, useCallback, useRef, useState, memo } from 'react';
import { Group } from '@visx/group';
import { Circle, Line } from '@visx/shape';
import { scaleLinear, scaleOrdinal } from '@visx/scale';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { GridRows, GridColumns } from '@visx/grid';
import { useTooltip, useTooltipInPortal, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { ParentSize } from '@visx/responsive';
import { Star, MapPin, Info, Maximize2, Move } from 'lucide-react';
import { Text } from '@visx/text';
import { Brush } from '@visx/brush';
import { Bounds } from '@visx/brush/lib/types';
import { CompetitiveSnapshot } from '../../lib/api';
import { useAppStore } from '../../stores/useAppStore';

// --- Constants ---
const BACKGROUND_COLOR = '#0F111A';
const AXIS_COLOR = '#f8fafc';
const GRID_COLOR = '#1e293b';

const CHART_COLORS = {
  textPrimary: '#f8fafc',
  business: '#8b5cf6',
  myBusiness: '#FFD700',
  gridlines: '#1e293b',
};

const QUADRANT_COLORS: Record<string, string> = {
  'Market Leaders': '#22c55e',
  'Hidden Gems': '#3b82f6',
  'Struggling': '#ef4444',
  'Volume Drivers': '#f97316',
};

const QUADRANT_DESCRIPTIONS: Record<string, string> = {
  'Market Leaders': 'High Rating & High Volume. Top performers.',
  'Hidden Gems': 'High Rating & Low Volume. Undiscovered quality.',
  'Struggling': 'Low Rating & Low Volume. Underperforming.',
  'Volume Drivers': 'Low Rating & High Volume. Visible but average quality.',
};

const LINE_COLORS = [
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#ef4444', // Red
  '#22c55e', // Green
  '#f59e0b', // Amber
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#8b5cf6', // Violet
];

// --- Types ---
interface CompetitivePositioningChartProps {
  snapshotData: CompetitiveSnapshot | null;
}

interface ChartDataPoint {
  id: string;
  name: string;
  rating: number;
  reviewVolume: number;
  isMyBusiness: boolean;
  isComparison: boolean;
  comparisonIndex: number;
  category: string;
}

interface TooltipData extends ChartDataPoint {}

// --- Helpers ---
const getQuadrantCategory = (rating: number, reviewVolume: number, avgRating: number, medianReviewCount: number) => {
  if (rating >= avgRating && reviewVolume >= medianReviewCount) return 'Market Leaders';
  if (rating >= avgRating && reviewVolume < medianReviewCount) return 'Hidden Gems';
  if (rating < avgRating && reviewVolume >= medianReviewCount) return 'Volume Drivers';
  return 'Struggling';
};

const TooltipContent = ({ data, colorScale }: { data: TooltipData; colorScale: any }) => {
  if (!data) return null;
  const color = colorScale(data.category);

  return (
    <div className="flex flex-col gap-1.5 min-w-[180px]">
      <div className="pb-2 mb-2 border-b border-white/10">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          {data.name}
          {data.isMyBusiness && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FFD700]/20 text-[#FFD700]">
              You
            </span>
          )}
          {data.isComparison && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#8b5cf6]/20 text-[#8b5cf6]">
              Comp
            </span>
          )}
        </h3>
        <span
          className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
          style={{ backgroundColor: `${color}33`, color: color }}
        >
          {data.category}
        </span>
      </div>

      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center gap-1.5">
          <Star size={12} className="text-[#FFD700]" fill="currentColor" />
          <span className="text-gray-300">Rating:</span>
        </div>
        <span className="font-mono font-bold text-white">{data.rating.toFixed(1)}</span>
      </div>

      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center gap-1.5">
          <MapPin size={12} className="text-gray-400" />
          <span className="text-gray-300">Reviews:</span>
        </div>
        <span className="font-mono font-bold text-white">{data.reviewVolume.toLocaleString()}</span>
      </div>
    </div>
  );
};

// --- Chart Component ---
const QuadrantChart = ({
  width,
  height,
  data,
  stats,
  selectedBusinessId,
  onSelectBusiness,
}: {
  width: number;
  height: number;
  data: ChartDataPoint[];
  stats: { avgRating: number; medianReviews: number };
  selectedBusinessId?: string | null;
  onSelectBusiness?: (id: string | null) => void;
}) => {
  const margin = { top: 20, right: 60, bottom: 50, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const brushRef = useRef<any>(null);

  // Initial domains
  const initialXDomain = useMemo((): [number, number] => {
    if (data.length === 0) return [0, 100];

    const volumes = data.map(d => d.reviewVolume).sort((a, b) => a - b);
    const p98Index = Math.floor(volumes.length * 0.98);
    const p98Value = volumes[p98Index] || volumes[volumes.length - 1];

    return [0, p98Value * 1.2];
  }, [data]);

  const initialYDomain: [number, number] = [1.0, 5.5];

  // Zoomed domains
  const [filteredXDomain, setFilteredXDomain] = useState<[number, number]>(initialXDomain);
  const [filteredYDomain, setFilteredYDomain] = useState<[number, number]>(initialYDomain);

  // Zoom mode toggle
  const [isZoomMode, setIsZoomMode] = useState(false);

  // Update filtered domain when data changes
  React.useEffect(() => {
    setFilteredXDomain(initialXDomain);
    setFilteredYDomain(initialYDomain);
  }, [initialXDomain]);

  const xScale = useMemo(() => scaleLinear({
    range: [0, innerWidth],
    domain: filteredXDomain,
    nice: true,
  }), [innerWidth, filteredXDomain]);

  const yScale = useMemo(() => scaleLinear({
    range: [innerHeight, 0],
    domain: filteredYDomain,
    nice: true,
  }), [innerHeight, filteredYDomain]);

  // Full scale for brush
  const xBrushScale = useMemo(() => scaleLinear({
    range: [0, innerWidth],
    domain: initialXDomain,
    nice: true,
  }), [innerWidth, initialXDomain]);

  const yBrushScale = useMemo(() => scaleLinear({
    range: [innerHeight, 0],
    domain: initialYDomain,
    nice: true,
  }), [innerHeight]);

  const colorScale = useMemo(() => scaleOrdinal({
    domain: Object.keys(QUADRANT_COLORS),
    range: Object.values(QUADRANT_COLORS),
  }), []);

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

  const handleMouseOver = useCallback((event: React.MouseEvent<SVGCircleElement>, datum: ChartDataPoint) => {
    const coords = localPoint(event.target as SVGElement, event);
    if (coords) {
      showTooltip({
        tooltipLeft: coords.x,
        tooltipTop: coords.y,
        tooltipData: datum,
      });
    }
  }, [showTooltip]);

  const onBrushChange = useCallback((domain: Bounds | null) => {
    if (!domain) return;

    const { x0, x1 } = domain;

    const newXDomain: [number, number] = [
      Math.max(xBrushScale.invert(x0), initialXDomain[0]),
      Math.min(xBrushScale.invert(x1), initialXDomain[1])
    ];

    setFilteredXDomain(newXDomain);
    // Y-axis stays fixed at initialYDomain
  }, [xBrushScale, initialXDomain]);

  const resetZoom = useCallback(() => {
    setFilteredXDomain(initialXDomain);
    setFilteredYDomain(initialYDomain);
    if (brushRef.current) {
      brushRef.current.reset();
    }
  }, [initialXDomain, initialYDomain]);

  if (width < 10) return null;

  const isZoomed = filteredXDomain[0] !== initialXDomain[0] ||
                   filteredXDomain[1] !== initialXDomain[1];

  return (
    <div className="relative">
      {/* Zoom Controls */}
      <div className="absolute top-2 right-2 flex gap-2 z-10">
        <button
          className={`p-1.5 rounded transition-colors ${isZoomMode ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
          onClick={() => setIsZoomMode(!isZoomMode)}
          title={isZoomMode ? "Switch to Selection Mode" : "Switch to Zoom Mode"}
        >
          <Move size={16} />
        </button>
        {isZoomed && (
          <button
            className="p-1.5 rounded bg-white/5 text-slate-400 hover:bg-white/10 transition-colors"
            onClick={resetZoom}
            title="Reset Zoom"
          >
            <Maximize2 size={16} />
          </button>
        )}
      </div>

      <svg
        ref={containerRef}
        width={width}
        height={height}
        className="touch-none select-none"
        onClick={() => { if (selectedBusinessId && onSelectBusiness) onSelectBusiness(null); }}
      >
        <defs>
          <filter id="myBusinessGlow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="4" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width={width} height={height} fill={BACKGROUND_COLOR} rx={14} />

        <Group left={margin.left} top={margin.top}>
          {/* Quadrant Background Shading */}
          {(() => {
            const medianX = xScale(stats.medianReviews);
            const avgY = yScale(stats.avgRating);
            const clampedMedianX = Math.max(0, Math.min(innerWidth, medianX));
            const clampedAvgY = Math.max(0, Math.min(innerHeight, avgY));

            return (
              <>
                <rect x={clampedMedianX} y={0} width={Math.max(0, innerWidth - clampedMedianX)} height={clampedAvgY} fill={QUADRANT_COLORS['Market Leaders']} opacity={0.05} />
                <rect x={0} y={0} width={clampedMedianX} height={clampedAvgY} fill={QUADRANT_COLORS['Hidden Gems']} opacity={0.05} />
                <rect x={clampedMedianX} y={clampedAvgY} width={Math.max(0, innerWidth - clampedMedianX)} height={Math.max(0, innerHeight - clampedAvgY)} fill={QUADRANT_COLORS['Volume Drivers']} opacity={0.05} />
                <rect x={0} y={clampedAvgY} width={clampedMedianX} height={Math.max(0, innerHeight - clampedAvgY)} fill={QUADRANT_COLORS['Struggling']} opacity={0.05} />
              </>
            );
          })()}

          <GridRows scale={yScale} width={innerWidth} strokeDasharray="3,3" stroke={GRID_COLOR} />
          <GridColumns scale={xScale} height={innerHeight} strokeDasharray="3,3" stroke={GRID_COLOR} />

          {/* Median Lines */}
          {stats.medianReviews >= filteredXDomain[0] && stats.medianReviews <= filteredXDomain[1] && (
            <>
              <Line from={{ x: xScale(stats.medianReviews), y: 0 }} to={{ x: xScale(stats.medianReviews), y: innerHeight }} stroke={AXIS_COLOR} strokeWidth={1} strokeDasharray="4,4" opacity={0.3} />
              <Text x={xScale(stats.medianReviews)} y={-5} fill={AXIS_COLOR} fontSize={10} textAnchor="middle" fontWeight={600}>{`Median: ${stats.medianReviews}`}</Text>
            </>
          )}

          {stats.avgRating >= filteredYDomain[0] && stats.avgRating <= filteredYDomain[1] && (
            <>
              <Line from={{ x: 0, y: yScale(stats.avgRating) }} to={{ x: innerWidth, y: yScale(stats.avgRating) }} stroke={AXIS_COLOR} strokeWidth={1} strokeDasharray="4,4" opacity={0.3} />
              <Text x={innerWidth + 4} y={yScale(stats.avgRating)} fill={AXIS_COLOR} fontSize={10} textAnchor="start" verticalAnchor="middle" fontWeight={600}>{`Avg: ${stats.avgRating.toFixed(1)}`}</Text>
            </>
          )}

          {/* Points */}
          {data.map((d) => {
            if (d.reviewVolume < filteredXDomain[0] || d.reviewVolume > filteredXDomain[1]) return null;
            const isSelected = selectedBusinessId === d.id;
            const hasSelection = !!selectedBusinessId;

            let radius = 3;
            let stroke = 'none';
            let strokeWidth = 0;

            if (d.isMyBusiness) {
              radius = 10;
              stroke = CHART_COLORS.myBusiness;
              strokeWidth = 3;
            } else if (d.isComparison) {
              radius = 8;
              stroke = LINE_COLORS[(d.comparisonIndex + 1) % LINE_COLORS.length];
              strokeWidth = 2.5;
            }

            if (isSelected) {
              radius = d.isMyBusiness ? 12 : 9;
              if (!d.isMyBusiness && !d.isComparison) {
                stroke = '#fff';
                strokeWidth = 2;
              }
            } else if (hasSelection && !d.isMyBusiness && !d.isComparison) {
              radius = 2;
            }

            return (
              <Circle
                key={d.id}
                cx={xScale(d.reviewVolume)}
                cy={yScale(d.rating)}
                r={radius}
                fill={colorScale(d.category)}
                stroke={stroke}
                strokeWidth={strokeWidth}
                style={{ cursor: 'pointer' }}
                className="transition-all duration-300"
                filter={d.isMyBusiness ? 'url(#myBusinessGlow)' : undefined}
                onMouseOver={(e) => handleMouseOver(e as React.MouseEvent<SVGCircleElement>, d)}
                onMouseOut={hideTooltip}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onSelectBusiness) onSelectBusiness(isSelected ? null : d.id);
                }}
              />
            );
          })}

          {isZoomMode && (
            <Brush
              innerRef={brushRef}
              xScale={xBrushScale}
              yScale={yBrushScale}
              width={innerWidth}
              height={innerHeight}
              margin={margin}
              handleSize={8}
              resizeTriggerAreas={['left', 'right']}
              brushDirection="horizontal"
              onChange={onBrushChange}
              selectedBoxStyle={{ fill: 'rgba(59, 130, 246, 0.1)', stroke: 'rgba(59, 130, 246, 0.6)', strokeWidth: 1 }}
              useWindowMoveEvents
            />
          )}

          <AxisBottom
            scale={xScale}
            top={innerHeight}
            stroke={AXIS_COLOR}
            tickStroke={AXIS_COLOR}
            label="Review Volume"
            labelOffset={20}
            labelProps={{ fill: AXIS_COLOR, fontSize: 11, textAnchor: 'middle', fontWeight: 600 }}
            tickLabelProps={() => ({ fill: AXIS_COLOR, fontSize: 10, textAnchor: 'middle', dy: 0 })}
          />

          <AxisLeft
            scale={yScale}
            stroke={AXIS_COLOR}
            tickStroke={AXIS_COLOR}
            label="Rating"
            labelOffset={40}
            labelProps={{ fill: AXIS_COLOR, fontSize: 11, textAnchor: 'middle', fontWeight: 600 }}
            tickLabelProps={() => ({ fill: AXIS_COLOR, fontSize: 10, textAnchor: 'end', dy: 4, dx: -4 })}
          />
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        <TooltipInPortal
          top={tooltipTop}
          left={tooltipLeft}
          style={{ ...defaultStyles, backgroundColor: '#0f172a', border: '1px solid rgba(148, 163, 184, 0.2)', color: '#fff', borderRadius: '0.5rem', padding: '12px', zIndex: 100 }}
        >
          <TooltipContent data={tooltipData} colorScale={colorScale} />
        </TooltipInPortal>
      )}
    </div>
  );
};

// ✅ Memoized component with custom equality check
const CompetitivePositioningChartComponent: React.FC<CompetitivePositioningChartProps> = ({
  snapshotData,
}) => {
  // ✅ Atomic selectors - only re-render when these specific values change
  const primaryBusinessId = useAppStore((state) => state.primaryBusinessId);
  const comparisonIds = useAppStore((state) => state.comparisonIds);
  const setPrimaryBusiness = useAppStore((state) => state.setPrimaryBusiness);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    tooltipOpen: legendTooltipOpen,
    tooltipLeft: legendTooltipLeft,
    tooltipTop: legendTooltipTop,
    tooltipData: legendTooltipData,
    hideTooltip: hideLegendTooltip,
    showTooltip: showLegendTooltip,
  } = useTooltip<string>();

  const handleLegendHover = (e: React.MouseEvent, category: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const containerRect = containerRef.current ? containerRef.current.getBoundingClientRect() : { top: 0, left: 0 };
    showLegendTooltip({
      tooltipLeft: rect.left - containerRect.left + rect.width / 2,
      tooltipTop: rect.top - containerRect.top,
      tooltipData: category,
    });
  };

  const { chartData, stats } = useMemo(() => {
    if (!snapshotData || !snapshotData.businesses) {
      return { chartData: [], stats: { avgRating: 0, medianReviews: 0, totalBusinesses: 0 } };
    }

    const { avg_rating: avgRating, median_review_count: medianReviews, total_businesses: totalBusinesses } = snapshotData.statistics;

    const businesses: ChartDataPoint[] = snapshotData.businesses
      .filter(b => b.stars !== undefined && b.review_count > 0)
      .map(b => ({
        id: b.business_id,
        name: b.name,
        rating: b.stars,
        reviewVolume: b.review_count,
        isMyBusiness: b.business_id === primaryBusinessId,
        isComparison: comparisonIds.includes(b.business_id),
        comparisonIndex: comparisonIds.indexOf(b.business_id),
        category: getQuadrantCategory(b.stars, b.review_count, avgRating, medianReviews),
      }));

    return {
      chartData: businesses,
      stats: { avgRating, medianReviews, totalBusinesses }
    };
  }, [snapshotData, primaryBusinessId, comparisonIds]);

  if (!snapshotData || chartData.length === 0) {
    return (
      <div className="glass rounded-lg h-full flex items-center justify-center">
        <div className="flex flex-col items-center justify-center space-y-2 text-center p-6">
          <p className="text-muted-foreground text-sm">No competitive data available</p>
          <p className="text-muted-foreground text-xs opacity-70">Select a city and category to view market positioning</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-lg p-4 h-full flex flex-col" ref={containerRef}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Market Positioning</h2>
          <p className="text-xs text-slate-400 mt-1">
            {chartData.length} businesses • Avg: {stats.avgRating.toFixed(1)}★, Median: {stats.medianReviews} reviews
          </p>
        </div>

        <div className="flex gap-3">
          {Object.entries(QUADRANT_COLORS).map(([category, color]) => (
            <div
              key={category}
              className="flex items-center gap-1.5 cursor-help"
              onMouseEnter={(e) => handleLegendHover(e, category)}
              onMouseLeave={() => hideLegendTooltip()}
            >
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-slate-300 hidden sm:inline">{category}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <ParentSize>
          {({ width, height }) => (
            <QuadrantChart
              width={width}
              height={height}
              data={chartData}
              stats={stats}
              selectedBusinessId={primaryBusinessId}
              onSelectBusiness={setPrimaryBusiness}
            />
          )}
        </ParentSize>

        {legendTooltipOpen && legendTooltipData && (
          <div
            className="absolute z-50 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs shadow-lg transform -translate-x-1/2 pointer-events-none w-48"
            style={{ top: (legendTooltipTop ?? 0) + 10, left: legendTooltipLeft }}
          >
            <div className="font-bold mb-1" style={{ color: QUADRANT_COLORS[legendTooltipData] }}>
              {legendTooltipData}
            </div>
            <div className="text-slate-300">
              {QUADRANT_DESCRIPTIONS[legendTooltipData]}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Export memoized version
export const CompetitivePositioningChart = memo(CompetitivePositioningChartComponent, (prev, next) => {
  // Only re-render if snapshot data reference changes
  return prev.snapshotData === next.snapshotData;
});
