import React, { useMemo, useCallback, memo } from 'react';
import { Group } from '@visx/group';
import { Bar } from '@visx/shape';
import { scaleLinear, scaleBand } from '@visx/scale';
import { AxisLeft, AxisBottom } from '@visx/axis';
import { useTooltip, useTooltipInPortal, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { ParentSize } from '@visx/responsive';
import { Business, RatingsTimeline } from '../../api';
import { useKeywordData, AlignedKeyword, BusinessKeywordData } from '../../hooks/useKeywordData';
import './KeywordInsightsChart.css';

const BACKGROUND_COLOR = '#0F111A';
const COMPLAINT_COLOR = '#ef4444';
const PRAISE_COLOR = '#10b981';
const AXIS_COLOR = '#f8fafc';

interface KeywordInsightsChartProps {
  business: Business | null;
  comparisonBusinesses?: Business[];
  ratingsTimeline?: RatingsTimeline | null;
  isLoading?: boolean;
  error?: any;
}

interface TooltipData {
  keyword: string;
  type: 'complaints' | 'praises';
  businessData: BusinessKeywordData;
  currentReviewIndex: number;
}

interface TooltipContentProps {
  data: TooltipData;
  onNavigate: (direction: 'prev' | 'next') => void;
  onClose: () => void;
  isSticky: boolean;
}

const TooltipContent: React.FC<TooltipContentProps> = ({ data, onNavigate, onClose, isSticky }) => {
  const business = data.businessData;
  const reviews = business.allReviews || [business.sample];
  const currentReview = reviews[data.currentReviewIndex] || business.sample;
  const totalReviews = reviews.length;

  // Simple hover tooltip - just hint
  if (!isSticky) {
    // Get first sentence or first 100 chars of review as preview
    const preview = currentReview.split(/[.!?]/)[0] || currentReview.substring(0, 100);
    const previewText = preview.length < currentReview.length ? preview + '...' : preview;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '250px', maxWidth: '350px' }}>
        <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>
          "{data.keyword}"
        </div>
        <div style={{ color: '#d2d2d4', fontSize: '0.75rem', fontStyle: 'italic', lineHeight: 1.4 }}>
          {previewText}
        </div>
        <div style={{
          color: '#9c8506',
          fontSize: '0.7rem',
          fontWeight: 500,
          paddingTop: '0.25rem',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}>
          Click for more details
        </div>
      </div>
    );
  }

  // Full detailed tooltip when pinned
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '320px', maxWidth: '500px' }}>
      {/* Header */}
      <div
        style={{
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.9rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span>"{data.keyword}"</span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '1.2rem',
            padding: '0',
            lineHeight: 1,
            fontWeight: 'bold',
          }}
          title="Close"
        >
          ×
        </button>
      </div>

      {/* Business data */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
          backgroundColor: 'rgba(156, 133, 6, 0.1)',
          padding: '0.5rem',
          borderRadius: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
          <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>
            {business.businessName}
          </span>
          <span
            style={{
              color: '#fff',
              fontSize: '0.85rem',
              fontFamily: 'monospace',
              marginLeft: 'auto',
            }}
          >
            {business.count} mentions ({business.sentiment.toFixed(2)})
          </span>
        </div>
        <div
          style={{
            color: '#d2d2d4',
            fontSize: '0.75rem',
            fontStyle: 'italic',
            lineHeight: 1.5,
            maxHeight: '400px',
            overflowY: 'auto',
            padding: '0.5rem',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '4px',
            backgroundColor: 'rgba(0,0,0,0.2)',
          }}
        >
          "{currentReview}"
        </div>
      </div>

      {/* Navigation controls - only show if there are multiple reviews */}
      {totalReviews > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '0.5rem',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('prev');
            }}
            disabled={data.currentReviewIndex === 0}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              cursor: data.currentReviewIndex === 0 ? 'not-allowed' : 'pointer',
              opacity: data.currentReviewIndex === 0 ? 0.5 : 1,
              fontSize: '0.75rem',
            }}
          >
            ← Previous
          </button>
          <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
            {data.currentReviewIndex + 1} of {totalReviews}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNavigate('next');
            }}
            disabled={data.currentReviewIndex >= totalReviews - 1}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              color: '#fff',
              padding: '0.25rem 0.5rem',
              borderRadius: '4px',
              cursor: data.currentReviewIndex >= totalReviews - 1 ? 'not-allowed' : 'pointer',
              opacity: data.currentReviewIndex >= totalReviews - 1 ? 0.5 : 1,
              fontSize: '0.75rem',
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

interface ChartSectionProps {
  width: number;
  height: number;
  data: AlignedKeyword[];
  type: 'complaints' | 'praises';
  onTooltip: (data: TooltipData | null, coords?: { x: number; y: number }, sticky?: boolean) => void;
  hoveredKeyword: string | null;
  isSticky: boolean;
}

const ChartSection: React.FC<ChartSectionProps> = ({
  width,
  height,
  data,
  type,
  onTooltip,
  hoveredKeyword,
  isSticky,
}) => {
  const margin = { top: 8, right: 20, bottom: 50, left: 165 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Y scale for keywords
  const yScale = useMemo(
    () =>
      scaleBand<string>({
        range: [0, innerHeight],
        domain: data.map(d => d.keyword),
        padding: 0.2,
      }),
    [innerHeight, data]
  );

  // X scale for counts
  const maxCount = useMemo(() => {
    let max = 0;
    data.forEach(keyword => {
      // Only look at the first business (the selected business)
      const business = keyword.businesses[0];
      if (business && business.count > max) {
        max = business.count;
      }
    });
    return max;
  }, [data]);

  const xScale = useMemo(
    () =>
      scaleLinear<number>({
        range: [0, innerWidth],
        domain: [0, maxCount * 1.1],
      }),
    [innerWidth, maxCount]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGRectElement>, keyword: AlignedKeyword) => {
      // Don't show hover tooltip if already sticky/pinned
      if (isSticky) return;

      const point = localPoint(event);
      if (!point) return;

      const business = keyword.businesses[0];
      if (!business) return;

      onTooltip(
        {
          keyword: keyword.keyword,
          type,
          businessData: business,
          currentReviewIndex: 0,
        },
        { x: point.x, y: point.y },
        false  // not sticky on hover
      );
    },
    [type, onTooltip, isSticky]
  );

  const handleClick = useCallback(
    (event: React.MouseEvent<SVGRectElement>, keyword: AlignedKeyword) => {
      event.stopPropagation(); // Prevent event bubbling
      const point = localPoint(event);
      if (!point) return;

      const business = keyword.businesses[0];
      if (!business) return;

      onTooltip(
        {
          keyword: keyword.keyword,
          type,
          businessData: business,
          currentReviewIndex: 0,
        },
        { x: point.x, y: point.y },
        true  // sticky on click
      );
    },
    [type, onTooltip]
  );

  const handleMouseLeave = useCallback(() => {
    // Don't hide tooltip on mouse leave if it's sticky
    if (isSticky) return;
    onTooltip(null, undefined, false);
  }, [onTooltip, isSticky]);

  if (width < 10 || data.length === 0) return null;

  const barColor = type === 'complaints' ? COMPLAINT_COLOR : PRAISE_COLOR;

  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        {/* Bars */}
        {data.map((keyword, keywordIndex) => {
          const keywordY = yScale(keyword.keyword) || 0;
          const business = keyword.businesses[0];

          if (!business) return null;

          const barWidth = xScale(business.count);
          const barHeight = yScale.bandwidth();
          const opacity = business.confidence;
          const isHovered = hoveredKeyword === keyword.keyword;

          return (
            <Bar
              key={`keyword-${keywordIndex}`}
              x={0}
              y={keywordY}
              width={Math.max(0, barWidth)}
              height={barHeight}
              fill={barColor}
              opacity={isHovered ? Math.min(1, opacity + 0.2) : opacity}
              rx={3}
              onMouseMove={(event) => handleMouseMove(event, keyword)}
              onClick={(event) => handleClick(event, keyword)}
              onMouseLeave={handleMouseLeave}
              style={{
                cursor: 'pointer',
                filter: isHovered ? 'brightness(1.2)' : 'none',
              }}
            />
          );
        })}

        {/* Axes */}
        <AxisLeft
          scale={yScale}
          tickValues={data.map(d => d.keyword)}
          stroke={AXIS_COLOR}
          tickStroke="transparent"
          tickLabelProps={() => ({
            fill: AXIS_COLOR,
            fontSize: 11,
            textAnchor: 'end' as const,
            dy: 3,
            dx: -4,
            fontWeight: 500,
          })}
        />

        <AxisBottom
          scale={xScale}
          top={innerHeight}
          stroke={AXIS_COLOR}
          tickStroke={AXIS_COLOR}
          numTicks={5}
          tickFormat={(value) => Math.floor(value as number).toString()}
          tickLabelProps={() => ({
            fill: AXIS_COLOR,
            fontSize: 10,
            textAnchor: 'middle' as const,
            fontWeight: 500,
            dy: 2,
          })}
          label="Number of Mentions"
          labelProps={{
            fill: AXIS_COLOR,
            fontSize: 11,
            textAnchor: 'middle' as const,
            fontWeight: 600,
            dy: 32,
          }}
        />
      </Group>
    </svg>
  );
};

interface ChartProps {
  width: number;
  height: number;
  complaints: AlignedKeyword[];
  praises: AlignedKeyword[];
}

const Chart: React.FC<ChartProps> = ({
  width,
  height,
  complaints,
  praises,
}) => {
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

  const [hoveredKeyword, setHoveredKeyword] = React.useState<string | null>(null);
  const [isSticky, setIsSticky] = React.useState(false);

  const handleTooltip = useCallback(
    (data: TooltipData | null, coords?: { x: number; y: number }, sticky = false) => {
      if (!data || !coords) {
        // Don't hide if it's sticky (unless explicitly closing)
        if (!isSticky || sticky === false) {
          hideTooltip();
          setHoveredKeyword(null);
          setIsSticky(false);
        }
        return;
      }

      setHoveredKeyword(data.keyword);
      if (sticky) {
        setIsSticky(true);
      }
      showTooltip({
        tooltipData: data,
        tooltipLeft: coords.x,
        tooltipTop: coords.y,
      });
    },
    [showTooltip, hideTooltip, isSticky]
  );

  const handleNavigate = useCallback(
    (direction: 'prev' | 'next') => {
      if (!tooltipData || !tooltipLeft || !tooltipTop) return;

      const newIndex = direction === 'prev'
        ? Math.max(0, tooltipData.currentReviewIndex - 1)
        : tooltipData.currentReviewIndex + 1;

      const reviews = tooltipData.businessData.allReviews || [tooltipData.businessData.sample];
      if (newIndex >= reviews.length) return;

      // Update tooltip data with new review index
      showTooltip({
        tooltipData: {
          ...tooltipData,
          currentReviewIndex: newIndex,
        },
        tooltipLeft: tooltipLeft,
        tooltipTop: tooltipTop,
      });
    },
    [tooltipData, tooltipLeft, tooltipTop, showTooltip]
  );

  // Close handler
  const handleClose = useCallback(() => {
    hideTooltip();
    setIsSticky(false);
    setHoveredKeyword(null);
  }, [hideTooltip]);

  // Split width for two columns
  const columnWidth = width / 2;
  const chartHeight = height - 35; // Reserve space for title

  return (
    <div ref={containerRef} className="keyword-insights__chart-container">
      {/* Two-column layout */}
      <div className="keyword-insights__columns">
        {/* Complaints Column */}
        <div className="keyword-insights__column keyword-insights__column--complaints">
          <h3 className="keyword-insights__section-title" style={{ color: COMPLAINT_COLOR }}>
            Top Complaints
          </h3>
          <ChartSection
            width={columnWidth}
            height={chartHeight}
            data={complaints}
            type="complaints"
            onTooltip={handleTooltip}
            hoveredKeyword={hoveredKeyword}
            isSticky={isSticky}
          />
        </div>

        {/* Praises Column */}
        <div className="keyword-insights__column keyword-insights__column--praises">
          <h3 className="keyword-insights__section-title" style={{ color: PRAISE_COLOR }}>
            Top Praises
          </h3>
          <ChartSection
            width={columnWidth}
            height={chartHeight}
            data={praises}
            type="praises"
            onTooltip={handleTooltip}
            hoveredKeyword={hoveredKeyword}
            isSticky={isSticky}
          />
        </div>
      </div>

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
            border: isSticky ? '2px solid #9c8506' : '1px solid #374151',
            color: '#fff',
            padding: '12px',
            zIndex: 100,
            pointerEvents: 'auto',
          }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <TooltipContent
              data={tooltipData}
              onNavigate={handleNavigate}
              onClose={handleClose}
              isSticky={isSticky}
            />
          </div>
        </TooltipInPortal>
      )}
    </div>
  );
};

const KeywordInsightsChart: React.FC<KeywordInsightsChartProps> = ({
  business,
  comparisonBusinesses = [],
  ratingsTimeline,
  isLoading: externalLoading = false,
  error: externalError = null,
}) => {
  const { data, isLoading, error, displayPeriod } = useKeywordData(
    business,
    comparisonBusinesses,
    ratingsTimeline
  );

  const loading = isLoading || externalLoading;
  const displayError = error || externalError;

  if (!business) {
    return (
      <div className="keyword-insights-chart" style={{ backgroundColor: BACKGROUND_COLOR }}>
        <div className="keyword-insights__empty">
          <p>Select a business to view keyword insights</p>
        </div>
      </div>
    );
  }

  return (
    <div className="keyword-insights-chart" style={{ backgroundColor: BACKGROUND_COLOR }}>
      {/* Header */}
      <div className="keyword-insights-chart__header">
        <h2 className="keyword-insights-chart__title">
          Keyword Insights
          {displayPeriod && data && (
            <span className="keyword-insights-chart__period"> ({displayPeriod})</span>
          )}
        </h2>
        <p className="keyword-insights-chart__subtitle">
          Customer feedback analysis: What they love and what they complain about
          {data?.totalReviews && (
            <span className="keyword-insights-chart__review-count">
              {' '}• Based on {data.totalReviews.toLocaleString()} reviews
            </span>
          )}
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="keyword-insights__loading">
          <div className="spinner" />
          <p>Analyzing customer feedback...</p>
        </div>
      )}

      {/* Error State */}
      {!loading && displayError && (
        <div className="keyword-insights__error">
          <p>Failed to load keyword insights</p>
          <p className="muted">{displayError.message || 'Unknown error'}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !displayError && (!data || (data.complaints.length === 0 && data.praises.length === 0)) && (
        <div className="keyword-insights__empty">
          <p>No keyword data available for selected period</p>
          <p className="muted">Try selecting a different time range</p>
        </div>
      )}

      {/* Chart */}
      {!loading && !displayError && data && (data.complaints.length > 0 || data.praises.length > 0) && (
        <div className="keyword-insights-chart__chart">
          <ParentSize>
            {({ width, height }) => (
              <Chart
                width={width}
                height={Math.max(height, 400)}
                complaints={data.complaints}
                praises={data.praises}
              />
            )}
          </ParentSize>
        </div>
      )}
    </div>
  );
};

export default memo(KeywordInsightsChart);
