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
const GRID_COLOR = '#2d3748';
const LINE_COLORS = [
  '#9c8506ff', // Gold/Yellow - Your Business
  '#9400fdff', // Purple - Competitor 1
  '#8e2315ff', // Red/Brown - Competitor 2
  '#05a763ff', // Green - Competitor 3
  '#0199ffff', // Bright Blue - Competitor 4
];

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
  businesses: (BusinessKeywordData | null)[];
  hoveredBusinessIndex: number;
}

interface TooltipContentProps {
  data: TooltipData;
  getCompetitiveInsight: (keyword: string, type: 'complaints' | 'praises') => any;
}

const TooltipContent: React.FC<TooltipContentProps> = ({ data, getCompetitiveInsight }) => {
  const insight = getCompetitiveInsight(data.keyword, data.type);
  const yourBusiness = data.businesses[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: '280px' }}>
      {/* Header */}
      <div
        style={{
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.9rem',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        "{data.keyword}" - Competitive Analysis
      </div>

      {/* Business data */}
      {data.businesses.map((business, index) => {
        if (!business) {
          return (
            <div
              key={index}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                opacity: 0.5,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '2px',
                    backgroundColor: LINE_COLORS[index % LINE_COLORS.length],
                  }}
                />
                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                  {index === 0 ? 'Your Business' : `Competitor ${index}`}: Not mentioned
                </span>
              </div>
            </div>
          );
        }

        return (
          <div
            key={index}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              backgroundColor: index === 0 ? 'rgba(156, 133, 6, 0.1)' : 'transparent',
              padding: '0.5rem',
              borderRadius: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '2px',
                  backgroundColor: LINE_COLORS[index % LINE_COLORS.length],
                }}
              />
              <span style={{ color: '#fff', fontSize: '0.85rem', fontWeight: 600 }}>
                {business.businessName}
                {index === 0 && ' (You)'}:
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
            <p
              style={{
                color: '#d2d2d4',
                fontSize: '0.75rem',
                fontStyle: 'italic',
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              "{business.sample.substring(0, 100)}..."
            </p>
          </div>
        );
      })}

      {/* Competitive insights */}
      {insight && yourBusiness && (
        <div
          style={{
            marginTop: '0.5rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.8rem',
            }}
          >
            <span style={{ color: '#94a3b8' }}>📊 Your Position:</span>
            <span style={{ color: '#fff', fontWeight: 600 }}>
              {insight.position}
              {insight.position === 1 ? 'st' : insight.position === 2 ? 'nd' : insight.position === 3 ? 'rd' : 'th'} out of {insight.totalBusinesses}
            </span>
          </div>
          {insight.delta !== 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.8rem',
              }}
            >
              {insight.status === 'lagging' && data.type === 'complaints' && (
                <>
                  <span style={{ color: '#94a3b8' }}>⚠️</span>
                  <span style={{ color: '#ef4444' }}>
                    {Math.abs(insight.delta * 100).toFixed(0)}% more complaints than avg competitor
                  </span>
                </>
              )}
              {insight.status === 'leading' && data.type === 'complaints' && (
                <>
                  <span style={{ color: '#94a3b8' }}>✅</span>
                  <span style={{ color: '#10b981' }}>
                    {Math.abs(insight.delta * 100).toFixed(0)}% fewer complaints than avg competitor
                  </span>
                </>
              )}
              {insight.status === 'lagging' && data.type === 'praises' && (
                <>
                  <span style={{ color: '#94a3b8' }}>⚡</span>
                  <span style={{ color: '#ef4444' }}>
                    {Math.abs(insight.delta * 100).toFixed(0)}% fewer praises than avg competitor
                  </span>
                </>
              )}
              {insight.status === 'leading' && data.type === 'praises' && (
                <>
                  <span style={{ color: '#94a3b8' }}>✅</span>
                  <span style={{ color: '#10b981' }}>
                    {Math.abs(insight.delta * 100).toFixed(0)}% more praises than avg competitor
                  </span>
                </>
              )}
            </div>
          )}
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
  businessCount: number;
  onTooltip: (data: TooltipData | null, coords?: { x: number; y: number }) => void;
  hoveredKeyword: string | null;
}

const ChartSection: React.FC<ChartSectionProps> = ({
  width,
  height,
  data,
  type,
  businessCount,
  onTooltip,
  hoveredKeyword,
}) => {
  const margin = { top: 20, right: 20, bottom: 50, left: 160 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const color = type === 'complaints' ? COMPLAINT_COLOR : PRAISE_COLOR;

  // Y scale for keywords
  const yScale = useMemo(
    () =>
      scaleBand<string>({
        range: [0, innerHeight],
        domain: data.map(d => d.keyword),
        padding: 0.3,
      }),
    [innerHeight, data]
  );

  // X scale for counts
  const maxCount = useMemo(() => {
    let max = 0;
    data.forEach(keyword => {
      keyword.businesses.forEach(business => {
        if (business && business.count > max) {
          max = business.count;
        }
      });
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

  // Scale for grouping businesses within each keyword
  const businessScale = useMemo(
    () =>
      scaleBand<number>({
        range: [0, yScale.bandwidth()],
        domain: Array.from({ length: businessCount }, (_, i) => i),
        padding: 0.1,
      }),
    [yScale, businessCount]
  );

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<SVGRectElement>, keyword: AlignedKeyword, businessIndex: number) => {
      const point = localPoint(event);
      if (!point) return;

      onTooltip(
        {
          keyword: keyword.keyword,
          type,
          businesses: keyword.businesses,
          hoveredBusinessIndex: businessIndex,
        },
        { x: point.x, y: point.y }
      );
    },
    [type, onTooltip]
  );

  const handleMouseLeave = useCallback(() => {
    onTooltip(null);
  }, [onTooltip]);

  if (width < 10 || data.length === 0) return null;

  return (
    <svg width={width} height={height}>
      <Group left={margin.left} top={margin.top}>
        {/* Bars */}
        {data.map((keyword, keywordIndex) => {
          const keywordY = yScale(keyword.keyword) || 0;

          return (
            <Group key={`keyword-${keywordIndex}`} top={keywordY}>
              {keyword.businesses.map((business, businessIndex) => {
                if (!business) return null;

                const barWidth = xScale(business.count);
                const barHeight = businessScale.bandwidth();
                const barY = businessScale(businessIndex) || 0;
                const barColor = LINE_COLORS[businessIndex % LINE_COLORS.length];
                const opacity = business.confidence;
                const isHovered = hoveredKeyword === keyword.keyword;

                return (
                  <Bar
                    key={`bar-${businessIndex}`}
                    x={0}
                    y={barY}
                    width={Math.max(0, barWidth)}
                    height={barHeight}
                    fill={barColor}
                    opacity={isHovered ? Math.min(1, opacity + 0.2) : opacity}
                    rx={3}
                    onMouseMove={(event) => handleMouseMove(event, keyword, businessIndex)}
                    onMouseLeave={handleMouseLeave}
                    style={{
                      cursor: 'pointer',
                      stroke: businessIndex === 0 ? barColor : 'transparent',
                      strokeWidth: businessIndex === 0 ? 2 : 0,
                      filter: businessIndex === 0 && isHovered ? 'brightness(1.2)' : 'none',
                    }}
                  />
                );
              })}
            </Group>
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
            fontSize: 12,
            textAnchor: 'end' as const,
            dy: 4,
            dx: -5,
            fontWeight: 500,
          })}
        />

        <AxisBottom
          scale={xScale}
          top={innerHeight}
          stroke={AXIS_COLOR}
          tickStroke={AXIS_COLOR}
          tickLabelProps={() => ({
            fill: AXIS_COLOR,
            fontSize: 11,
            textAnchor: 'middle' as const,
            fontWeight: 500,
          })}
          label="Number of Mentions"
          labelProps={{
            fill: AXIS_COLOR,
            fontSize: 11,
            textAnchor: 'middle' as const,
            fontWeight: 600,
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
  businessCount: number;
  getCompetitiveInsight: (keyword: string, type: 'complaints' | 'praises') => any;
}

const Chart: React.FC<ChartProps> = ({
  width,
  height,
  complaints,
  praises,
  businessCount,
  getCompetitiveInsight,
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

  const handleTooltip = useCallback(
    (data: TooltipData | null, coords?: { x: number; y: number }) => {
      if (!data || !coords) {
        hideTooltip();
        setHoveredKeyword(null);
        return;
      }

      setHoveredKeyword(data.keyword);
      showTooltip({
        tooltipData: data,
        tooltipLeft: coords.x,
        tooltipTop: coords.y,
      });
    },
    [showTooltip, hideTooltip]
  );

  // Split width for two columns
  const columnWidth = width / 2;
  const chartHeight = height - 60; // Reserve space for title

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
            businessCount={businessCount}
            onTooltip={handleTooltip}
            hoveredKeyword={hoveredKeyword}
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
            businessCount={businessCount}
            onTooltip={handleTooltip}
            hoveredKeyword={hoveredKeyword}
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
            border: '1px solid #374151',
            color: '#fff',
            padding: '12px',
            zIndex: 100,
          }}
        >
          <TooltipContent data={tooltipData} getCompetitiveInsight={getCompetitiveInsight} />
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
  const { data, isLoading, error, getCompetitiveInsight, displayPeriod } = useKeywordData(
    business,
    comparisonBusinesses,
    ratingsTimeline
  );

  const loading = isLoading || externalLoading;
  const displayError = error || externalError;

  const businessCount = useMemo(() => {
    return 1 + comparisonBusinesses.length;
  }, [comparisonBusinesses]);

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
          Competitive Keyword Insights
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
                businessCount={businessCount}
                getCompetitiveInsight={getCompetitiveInsight}
              />
            )}
          </ParentSize>
        </div>
      )}
    </div>
  );
};

export default memo(KeywordInsightsChart);
