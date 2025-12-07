import React, { useMemo, useCallback, useRef, memo, useState } from 'react';
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
import { CompetitiveSnapshot } from '../../api/endpoints/analytics';
import { getSeriesColor } from '../timeseries/chartConstants';
import './CompetitivePositioningChart.css';

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

interface CompetitivePositioningChartProps {
  data: CompetitiveSnapshot | null;
  onBusinessSelect?: (businessId: string | null) => void;
  selectedBusinessId?: string | null;
  comparisonBusinessIds?: string[];
  myBusinessId?: string;
  compareByCity?: boolean;
  compareByCategory?: boolean;
  compareByNeighborhood?: boolean;
}

interface ChartDataPoint {
  id: string;
  name: string;
  rating: number;
  reviewVolume: number;
  address: string;
  isMyBusiness: boolean;
  isComparison: boolean;
  comparisonIndex: number;
  category: string;
}

interface TooltipData extends ChartDataPoint {}

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
    <div className="competitive-chart__tooltip">
      <div className="competitive-chart__tooltip-header">
        <div>
          <h3 className="competitive-chart__tooltip-title">
            {data.name}
            {data.isMyBusiness && (
              <span className="competitive-chart__tooltip-badge competitive-chart__tooltip-badge--my-business">
                You
              </span>
            )}
            {data.isComparison && (
              <span className="competitive-chart__tooltip-badge competitive-chart__tooltip-badge--comparison">
                Comp
              </span>
            )}
          </h3>
          <span 
            className="competitive-chart__tooltip-category"
            style={{ backgroundColor: `${color}33`, color: color }}
          >
            {data.category}
          </span>
        </div>
        <div className="competitive-chart__tooltip-stats">
          <div className="competitive-chart__tooltip-rating">
            <span>{data.rating}</span>
            <Star size={14} className="competitive-chart__stat-icon" fill="currentColor" />
          </div>
          <span className="competitive-chart__tooltip-reviews">({data.reviewVolume} reviews)</span>
        </div>
      </div>
      
      <div className="competitive-chart__tooltip-footer">
        <MapPin size={14} className="competitive-chart__tooltip-icon" />
        <span>{data.address}</span>
      </div>
    </div>
  );
};

const QuadrantChart = ({
  width,
  height,
  data,
  stats,
  selectedBusinessId,
  onSelectBusiness,
  getComparisonBusinessColor
}: {
  width: number;
  height: number;
  data: ChartDataPoint[];
  stats: { avgRating: number; medianReviews: number };
  selectedBusinessId?: string | null;
  onSelectBusiness?: (id: string | null) => void;
  getComparisonBusinessColor: (index: number) => string;
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
      <div className="competitive-chart__zoom-controls">
        {/* Toggle Zoom Mode */}
        <button
          className={`competitive-chart__zoom-btn ${isZoomMode ? 'competitive-chart__zoom-btn--active' : ''}`}
          onClick={() => setIsZoomMode(!isZoomMode)}
          title={isZoomMode ? "Switch to Selection Mode" : "Switch to Zoom Mode"}
        >
          <Move size={16} />
        </button>

        {/* Reset Zoom (only show when zoomed) */}
        {isZoomed && (
          <button
            className="competitive-chart__zoom-btn"
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
          {/* Glow filter for My Business point */}
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
                {/* Market Leaders (top-right) - Green */}
                <rect
                  x={clampedMedianX}
                  y={0}
                  width={innerWidth - clampedMedianX}
                  height={clampedAvgY}
                  fill={QUADRANT_COLORS['Market Leaders']}
                  opacity={0.05}
                />
                {/* Hidden Gems (top-left) - Blue */}
                <rect
                  x={0}
                  y={0}
                  width={clampedMedianX}
                  height={clampedAvgY}
                  fill={QUADRANT_COLORS['Hidden Gems']}
                  opacity={0.05}
                />
                {/* Volume Drivers (bottom-right) - Orange */}
                <rect
                  x={clampedMedianX}
                  y={clampedAvgY}
                  width={innerWidth - clampedMedianX}
                  height={innerHeight - clampedAvgY}
                  fill={QUADRANT_COLORS['Volume Drivers']}
                  opacity={0.05}
                />
                {/* Struggling (bottom-left) - Red */}
                <rect
                  x={0}
                  y={clampedAvgY}
                  width={clampedMedianX}
                  height={innerHeight - clampedAvgY}
                  fill={QUADRANT_COLORS['Struggling']}
                  opacity={0.05}
                />
              </>
            );
          })()}

          <GridRows scale={yScale} width={innerWidth} strokeDasharray="3,3" stroke={GRID_COLOR} />
          <GridColumns scale={xScale} height={innerHeight} strokeDasharray="3,3" stroke={GRID_COLOR} />

          {/* Median Review Line (Vertical) */}
          {stats.medianReviews >= filteredXDomain[0] && stats.medianReviews <= filteredXDomain[1] && (
            <>
              <Line
                from={{ x: xScale(stats.medianReviews), y: 0 }}
                to={{ x: xScale(stats.medianReviews), y: innerHeight }}
                stroke={AXIS_COLOR}
                strokeWidth={1}
                strokeDasharray="4,4"
                opacity={0.5}
              />
              <Text
                x={xScale(stats.medianReviews)}
                y={-5}
                fill={AXIS_COLOR}
                fontSize={10}
                textAnchor="middle"
                fontWeight={600}
              >
                {`Median: ${stats.medianReviews}`}
              </Text>
            </>
          )}

          {/* Avg Rating Line (Horizontal) */}
          {stats.avgRating >= filteredYDomain[0] && stats.avgRating <= filteredYDomain[1] && (
            <>
              <Line
                from={{ x: 0, y: yScale(stats.avgRating) }}
                to={{ x: innerWidth, y: yScale(stats.avgRating) }}
                stroke={AXIS_COLOR}
                strokeWidth={1}
                strokeDasharray="4,4"
                opacity={0.5}
              />
              <Text
                x={innerWidth + 4}
                y={yScale(stats.avgRating)}
                fill={AXIS_COLOR}
                fontSize={10}
                textAnchor="start"
                verticalAnchor="middle"
                fontWeight={600}
              >
                {`Avg: ${stats.avgRating.toFixed(2)}`}
              </Text>
            </>
          )}

          {/* Render Points */}
          {data.map((d) => {
            // Only render points within the filtered X domain (Y is always visible)
            if (d.reviewVolume < filteredXDomain[0] || d.reviewVolume > filteredXDomain[1]) {
              return null;
            }

            const isSelected = selectedBusinessId === d.id;
            const hasSelection = !!selectedBusinessId;

            let radius = 3;
            let stroke: string = 'none';
            let strokeWidth = 0;

            if (d.isMyBusiness) {
              radius = 10;
              stroke = CHART_COLORS.myBusiness;
              strokeWidth = 3;
            } else if (d.isComparison) {
              radius = 8;
              stroke = getComparisonBusinessColor(d.comparisonIndex);
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
                  if (onSelectBusiness) {
                    onSelectBusiness(isSelected ? null : d.id);
                  }
                }}
              />
            );
          })}

          {/* Brush for zooming (X-axis only) - only active in zoom mode */}
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
              onClick={() => {}}
              selectedBoxStyle={{
                fill: 'rgba(59, 130, 246, 0.1)',
                stroke: 'rgba(59, 130, 246, 0.6)',
                strokeWidth: 2,
              }}
              useWindowMoveEvents
            />
          )}

          {/* Axes */}
          <AxisBottom
            scale={xScale}
            top={innerHeight}
            stroke={AXIS_COLOR}
            tickStroke={AXIS_COLOR}
            label="Review Volume"
            labelOffset={20}
            labelProps={{
              fill: AXIS_COLOR,
              fontSize: 11,
              textAnchor: 'middle' as const,
              fontWeight: 600,
            }}
            tickLabelProps={() => ({
              fill: AXIS_COLOR,
              fontSize: 10,
              textAnchor: 'middle' as const,
              fontFamily: 'sans-serif',
              dy: 0,
            })}
          />

          <AxisLeft
            scale={yScale}
            stroke={AXIS_COLOR}
            tickStroke={AXIS_COLOR}
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
              dy: 4,
              dx: -4,
            })}
          />
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        <TooltipInPortal
          top={tooltipTop}
          left={tooltipLeft}
          style={{ ...defaultStyles, backgroundColor: 'transparent', boxShadow: 'none', padding: 0, zIndex: 100 }}
        >
          <TooltipContent data={tooltipData} colorScale={colorScale} />
        </TooltipInPortal>
      )}
    </div>
  );
};

export const CompetitivePositioningChart: React.FC<CompetitivePositioningChartProps> = ({
  data,
  onBusinessSelect,
  selectedBusinessId,
  comparisonBusinessIds = [],
  myBusinessId,
  compareByCity = false,
  compareByCategory = false,
  compareByNeighborhood = false,
}) => {
  const appContainerRef = useRef<HTMLDivElement>(null);

  // Calculate color for comparison businesses based on series order
  // This matches the color logic in charts and sidebar
  const getComparisonBusinessColor = useCallback((index: number): string => {
    let colorIndex = 1; // Start after primary (which is 0)

    // Add offset if comparing by city/neighborhood
    if (compareByCity || compareByNeighborhood) {
      colorIndex++;
    }

    // Add offset if comparing by category
    if (compareByCategory) {
      colorIndex++;
    }

    // Add the business index
    return getSeriesColor(colorIndex + index);
  }, [compareByCity, compareByCategory, compareByNeighborhood]);

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
    const containerRect = appContainerRef.current ? appContainerRef.current.getBoundingClientRect() : { top: 0, left: 0 };
    showLegendTooltip({
      tooltipLeft: rect.left - containerRect.left + rect.width / 2,
      tooltipTop: rect.top - containerRect.top,
      tooltipData: category,
    });
  };

  const { chartData, stats } = useMemo(() => {
    if (!data || !data.businesses) {
      return { chartData: [], stats: { avgRating: 0, medianReviews: 0, totalBusinesses: 0 } };
    }

    const { avg_rating, median_review_count, total_businesses } = data.statistics;

    let businesses: ChartDataPoint[] = data.businesses
      .filter(b => b.stars !== undefined && b.stars !== null && b.review_count > 0)
      .map(b => ({
        id: b.business_id,
        name: b.name,
        rating: b.stars,
        reviewVolume: b.review_count,
        address: `${b.city}, ${b.state}`,
        isMyBusiness: b.business_id === myBusinessId,
        isComparison: comparisonBusinessIds.includes(b.business_id),
        comparisonIndex: comparisonBusinessIds.indexOf(b.business_id),
        category: getQuadrantCategory(b.stars, b.review_count, avg_rating, median_review_count),
      }));

    if (myBusinessId && data.selected_business &&
        !businesses.some(b => b.id === myBusinessId)) {
      const myBiz = data.selected_business;
      if (myBiz.stars !== undefined && myBiz.stars !== null && myBiz.review_count > 0) {
        businesses.push({
          id: myBiz.business_id,
          name: myBiz.name,
          rating: myBiz.stars,
          reviewVolume: myBiz.review_count,
          address: `${myBiz.city}, ${myBiz.state}`,
          isMyBusiness: true,
          isComparison: false,
          comparisonIndex: -1,
          category: getQuadrantCategory(myBiz.stars, myBiz.review_count, avg_rating, median_review_count),
        });
      }
    }

    return {
      chartData: businesses,
      stats: {
        avgRating: avg_rating,
        medianReviews: median_review_count,
        totalBusinesses: total_businesses
      }
    };
  }, [data, myBusinessId, comparisonBusinessIds]);

  if (!data || chartData.length === 0) {
    return (
      <div className="competitive-chart__empty">
        <p>No competitive data available</p>
        <p className="competitive-chart__empty-sub">
          Select a city or category to view market positioning
        </p>
      </div>
    );
  }

  return (
    <div className="competitive-chart" ref={appContainerRef}>
      {/* Header */}
      <div className="competitive-chart__header">
        <div className="competitive-chart__title-group">
          <h3 className="competitive-chart__title">Competitive Market Positioning</h3>
          <p className="competitive-chart__subtitle">
            {data.filters.city && data.filters.state
              ? `${data.filters.category ? data.filters.category + ' in ' : ''}${data.filters.city}, ${data.filters.state}`
              : data.filters.category || 'Market Overview'}
          </p>
        </div>
        
        {/* Stats Row */}
        <div className="competitive-chart__stats">
          <div className="competitive-chart__stat-item">
            <span className="competitive-chart__stat-label">Businesses</span>
            <span className="competitive-chart__stat-value">{stats.totalBusinesses.toLocaleString()}</span>
          </div>
          <div className="competitive-chart__stat-item">
            <span className="competitive-chart__stat-label">Avg Rating</span>
            <div className="competitive-chart__stat-value">
              <span>{stats.avgRating.toFixed(2)}</span>
              <Star size={16} className="competitive-chart__stat-icon" fill="currentColor" />
            </div>
          </div>
          <div className="competitive-chart__stat-item">
            <span className="competitive-chart__stat-label">Median Reviews</span>
            <span className="competitive-chart__stat-value">{stats.medianReviews.toLocaleString()}</span>
          </div>
        </div>

        {/* Legend Row */}
        <div className="competitive-chart__legend">
          {Object.entries(QUADRANT_COLORS).map(([category, color]) => (
            <div 
              key={category} 
              className="competitive-chart__legend-item"
              onMouseEnter={(e) => handleLegendHover(e, category)}
              onMouseLeave={() => hideLegendTooltip()}
            >
              <div className="competitive-chart__legend-dot" style={{ backgroundColor: color }} />
              <span className="competitive-chart__legend-text">{category}</span>
              <Info size={14} className="competitive-chart__legend-icon" />
            </div>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="competitive-chart__container">
        <ParentSize>
          {({ width, height }) => (
            <QuadrantChart
              width={width}
              height={height}
              data={chartData}
              stats={stats}
              selectedBusinessId={selectedBusinessId}
              onSelectBusiness={onBusinessSelect}
              getComparisonBusinessColor={getComparisonBusinessColor}
            />
          )}
        </ParentSize>
      </div>

      {/* Legend Tooltip */}
      {legendTooltipOpen && legendTooltipData && (
        <div 
          className="competitive-chart__legend-tooltip" 
          style={{ 
            position: 'absolute',
            top: (legendTooltipTop ?? 0) + 25, 
            left: Math.min(Math.max(legendTooltipLeft ?? 0, 90), 300),
            transform: 'translateX(-50%)',
            zIndex: 50
          }}
        >
          <div className="competitive-chart__legend-tooltip-title" style={{ color: QUADRANT_COLORS[legendTooltipData] }}>
            {legendTooltipData}
          </div>
          <div className="competitive-chart__legend-tooltip-desc">
            {QUADRANT_DESCRIPTIONS[legendTooltipData]}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(CompetitivePositioningChart);
