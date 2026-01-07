import { memo, useMemo, useCallback } from 'react';
import { ParentSize } from '@visx/responsive';
import { scaleBand, scaleLinear } from '@visx/scale';
import { Group } from '@visx/group';
import { Text } from '@visx/text';
import { useAppStore } from '../../stores/useAppStore';
import type { KeywordInsights } from '../../lib/api';

interface KeywordInsightsProps {
  insights: KeywordInsights;
}

interface KeywordPair {
  keyword: string;
  complaintCount: number;
  praiseCount: number;
}

const MARGINS = { top: 20, right: 20, bottom: 40, left: 20 };
const COLORS = {
  complaint: '#ff4949ff', // Soft bright red (Tailwind Red 400)
  praise:    '#4ADE80', // Soft bright green (Tailwind Green 400)
};

// ✅ Memoized component - only re-renders when insights change
const KeywordInsightsChartComponent = ({ insights }: KeywordInsightsProps) => {
  // ✅ Atomic selectors - only re-render when these specific values change
  const selectedKeyword = useAppStore((state) => state.selectedKeyword);
  const setKeyword = useAppStore((state) => state.setKeyword);

  return (
    <div className="glass rounded-lg p-4 h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Keyword Insights</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS.complaint }} />
            <span className="text-xs text-muted-foreground">Complaints</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS.praise }} />
            <span className="text-xs text-muted-foreground">Praises</span>
          </div>
        </div>
      </div>
      <div className="h-[calc(100%-60px)]">
        <ParentSize>
          {({ width, height }) => (
            <KeywordChart
              width={width}
              height={height}
              insights={insights}
              selectedKeyword={selectedKeyword}
              onKeywordSelect={setKeyword}
            />
          )}
        </ParentSize>
      </div>
    </div>
  );
}

interface KeywordChartProps extends KeywordInsightsProps {
  width: number;
  height: number;
  selectedKeyword: string | null;
  onKeywordSelect: (keyword: string | null) => void;
}

function KeywordChart({
  width,
  height,
  insights,
  selectedKeyword,
  onKeywordSelect,
}: KeywordChartProps) {
  if (width === 0 || height === 0 || (!insights.complaints.length && !insights.praises.length)) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
        No keyword data available
      </div>
    );
  }

  // Memoize expensive keyword processing and sorting
  const keywords = useMemo(() => {
    // Combine and process data
    const keywordMap = new Map<string, KeywordPair>();

    insights.complaints.forEach(({ keyword, count }) => {
      if (!keywordMap.has(keyword)) {
        keywordMap.set(keyword, { keyword, complaintCount: 0, praiseCount: 0 });
      }
      keywordMap.get(keyword)!.complaintCount = count;
    });

    insights.praises.forEach(({ keyword, count }) => {
      if (!keywordMap.has(keyword)) {
        keywordMap.set(keyword, { keyword, complaintCount: 0, praiseCount: 0 });
      }
      keywordMap.get(keyword)!.praiseCount = count;
    });

    // Sort by total mentions (complaints + praises)
    return Array.from(keywordMap.values())
      .sort((a, b) => {
        const totalA = a.complaintCount + a.praiseCount;
        const totalB = b.complaintCount + b.praiseCount;
        return totalB - totalA;
      })
      .slice(0, 10); // Show top 10
  }, [insights]);

  if (!keywords.length) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
        No keyword data available
      </div>
    );
  }

  const innerWidth = width - MARGINS.left - MARGINS.right;
  const innerHeight = height - MARGINS.top - MARGINS.bottom;

  // Validate dimensions
  if (innerWidth <= 0 || innerHeight <= 0) {
    return null;
  }

  const maxCount = useMemo(
    () => Math.max(...keywords.map(k => Math.max(k.complaintCount, k.praiseCount))),
    [keywords]
  );

  // Memoize scales
  const yScale = useMemo(
    () =>
      scaleBand({
        domain: keywords.map(k => k.keyword),
        range: [0, innerHeight],
        padding: 0.1,
      }),
    [keywords, innerHeight]
  );

  // Center point for the chart
  const centerX = innerWidth / 2;

  // Define text area width in the center
  const textAreaWidth = 100;

  // Left scale (complaints - bars extend from left edge to before center text)
  const leftScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, maxCount],
        range: [0, (innerWidth - textAreaWidth) / 2], // Max width is half minus text area
      }),
    [maxCount, innerWidth, textAreaWidth]
  );

  // Right scale (praises - bars extend from right edge to before center text)
  const rightScale = useMemo(
    () =>
      scaleLinear({
        domain: [0, maxCount],
        range: [0, (innerWidth - textAreaWidth) / 2], // Max width is half minus text area
      }),
    [maxCount, innerWidth, textAreaWidth]
  );

  const handleKeywordClick = useCallback(
    (keyword: string) => {
      if (selectedKeyword === keyword) {
        onKeywordSelect(null);
      } else {
        onKeywordSelect(keyword);
      }
    },
    [selectedKeyword, onKeywordSelect]
  );

  return (
    <svg width={width} height={height}>
      <Group left={MARGINS.left} top={MARGINS.top}>
        {/* Complaints (Left side) */}
        <Group>
          {keywords.map(({ keyword, complaintCount }) => {
            const barWidth = leftScale(complaintCount) || 0;
            const barHeight = yScale.bandwidth() || 0;
            const maxBarWidth = (innerWidth - textAreaWidth) / 2;
            const barX = maxBarWidth - barWidth; // End at same position, start varies
            const barY = yScale(keyword) ?? 0;
            const isSelected = selectedKeyword === keyword;

            // Skip rendering if values are invalid
            if (isNaN(barWidth) || isNaN(barHeight) || isNaN(barX) || isNaN(barY)) {
              return null;
            }

            const reducedBarHeight = barHeight * 0.7; // Bar thickness
            const barYOffset = barY + (barHeight - reducedBarHeight) / 2; // Center vertically

            return (
              <g key={`complaint-${keyword}`}>
                {/* Custom path for rounded left corners only */}
                {complaintCount > 0 && (
                  <path
                    d={`
                      M ${barX + 4} ${barYOffset}
                      L ${barX + barWidth} ${barYOffset}
                      L ${barX + barWidth} ${barYOffset + reducedBarHeight}
                      L ${barX + 4} ${barYOffset + reducedBarHeight}
                      Q ${barX} ${barYOffset + reducedBarHeight} ${barX} ${barYOffset + reducedBarHeight - 4}
                      L ${barX} ${barYOffset + 4}
                      Q ${barX} ${barYOffset} ${barX + 4} ${barYOffset}
                      Z
                    `}
                    fill={COLORS.complaint}
                    opacity={isSelected ? 1 : 0.7}
                    onClick={() => handleKeywordClick(keyword)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = isSelected ? '1' : '0.7';
                    }}
                  />
                )}
                {complaintCount > 0 && (
                  <Text
                    x={barX - 4}
                    y={barYOffset + reducedBarHeight / 2}
                    verticalAnchor="middle"
                    textAnchor="end"
                    fill="rgba(255,255,255,0.6)"
                    fontSize={10}
                  >
                    {complaintCount}
                  </Text>
                )}
              </g>
            );
          })}
        </Group>

        {/* Praises (Right side) */}
        <Group>
          {keywords.map(({ keyword, praiseCount }) => {
            const barWidth = rightScale(praiseCount);
            const barHeight = yScale.bandwidth();
            const barX = (innerWidth + textAreaWidth) / 2; // Start at same position, end varies
            const barY = yScale(keyword) ?? 0;
            const isSelected = selectedKeyword === keyword;

            const reducedBarHeight = barHeight * 0.7; // Bar thickness
            const barYOffset = barY + (barHeight - reducedBarHeight) / 2; // Center vertically

            return (
              <g key={`praise-${keyword}`}>
                {/* Custom path for rounded right corners only */}
                {praiseCount > 0 && (
                  <path
                    d={`
                      M ${barX} ${barYOffset}
                      L ${barX + barWidth - 4} ${barYOffset}
                      Q ${barX + barWidth} ${barYOffset} ${barX + barWidth} ${barYOffset + 4}
                      L ${barX + barWidth} ${barYOffset + reducedBarHeight - 4}
                      Q ${barX + barWidth} ${barYOffset + reducedBarHeight} ${barX + barWidth - 4} ${barYOffset + reducedBarHeight}
                      L ${barX} ${barYOffset + reducedBarHeight}
                      Z
                    `}
                    fill={COLORS.praise}
                    opacity={isSelected ? 1 : 0.7}
                    onClick={() => handleKeywordClick(keyword)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = isSelected ? '1' : '0.7';
                    }}
                  />
                )}
                {praiseCount > 0 && (
                  <Text
                    x={barX + barWidth + 4}
                    y={barYOffset + reducedBarHeight / 2}
                    verticalAnchor="middle"
                    textAnchor="start"
                    fill="rgba(255,255,255,0.6)"
                    fontSize={10}
                  >
                    {praiseCount}
                  </Text>
                )}
              </g>
            );
          })}
        </Group>

        {/* Center labels (Keywords) */}
        <Group>
          {keywords.map(({ keyword }) => {
            const barY = yScale(keyword) ?? 0;
            const barHeight = yScale.bandwidth();
            const isSelected = selectedKeyword === keyword;

            return (
              <Text
                key={`label-${keyword}`}
                x={centerX}
                y={barY + barHeight / 2}
                verticalAnchor="middle"
                textAnchor="middle"
                fill={isSelected ? '#fff' : 'rgba(255,255,255,0.8)'}
                fontSize={11}
                fontWeight={isSelected ? 700 : 500}
                onClick={() => handleKeywordClick(keyword)}
                style={{ cursor: 'pointer' }}
              >
                {keyword}
              </Text>
            );
          })}
        </Group>

      </Group>
    </svg>
  );
};

// Export memoized version
export const KeywordInsightsChart = memo(KeywordInsightsChartComponent, (prev, next) => {
  // Only re-render if insights object reference changes
  return prev.insights === next.insights;
});
