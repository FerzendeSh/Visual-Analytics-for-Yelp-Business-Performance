import { ParentSize } from '@visx/responsive';
import { AreaClosed, Bar } from '@visx/shape';
import { scaleLinear, scaleTime, scaleBand } from '@visx/scale';
import { LinearGradient } from '@visx/gradient';
import { curveMonotoneX } from '@visx/curve';

interface MetricData {
  date: Date;
  value: number;
}

interface MetricsCardsProps {
  ratingTrend: MetricData[];
  sentimentTrend: MetricData[];
  volumeTrend: MetricData[];
  currentRating: number;
  currentSentiment: number;
  currentVolume: number;
}

export function MetricsCards({
  ratingTrend,
  sentimentTrend,
  volumeTrend,
  currentRating,
  currentSentiment,
  currentVolume,
}: MetricsCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <RatingCard trend={ratingTrend} current={currentRating} />
      <SentimentCard trend={sentimentTrend} current={currentSentiment} />
      <VolumeCard trend={volumeTrend} current={currentVolume} />
    </div>
  );
}

function RatingCard({ trend, current }: { trend: MetricData[]; current: number }) {
  return (
    <div className="glass rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Average Rating</h3>
        <span className="text-2xl font-bold">⭐ {current.toFixed(1)}</span>
      </div>
      <div className="h-16">
        <ParentSize>
          {({ width, height }) => (
            <RatingSparkline data={trend} width={width} height={height} />
          )}
        </ParentSize>
      </div>
    </div>
  );
}

function SentimentCard({ current }: { trend: MetricData[]; current: number }) {
  const percentage = Math.round(current * 100);

  return (
    <div className="glass rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Sentiment Score</h3>
        <span className="text-2xl font-bold">{percentage}%</span>
      </div>
      <div className="h-16 flex items-center justify-center">
        <ParentSize>
          {({ width, height }) => (
            <SentimentGauge value={current} width={Math.min(width, 120)} height={height} />
          )}
        </ParentSize>
      </div>
    </div>
  );
}

function VolumeCard({ trend, current }: { trend: MetricData[]; current: number }) {
  return (
    <div className="glass rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Review Volume</h3>
        <span className="text-2xl font-bold">{current.toLocaleString()}</span>
      </div>
      <div className="h-16">
        <ParentSize>
          {({ width, height }) => (
            <VolumeBars data={trend.slice(-7)} width={width} height={height} />
          )}
        </ParentSize>
      </div>
    </div>
  );
}

// Visx Sparkline Components

function RatingSparkline({ data, width, height }: { data: MetricData[]; width: number; height: number }) {
  if (!data.length || width === 0) return null;

  const xScale = scaleTime({
    domain: [data[0].date, data[data.length - 1].date],
    range: [0, width],
  });

  const yScale = scaleLinear({
    domain: [Math.min(...data.map(d => d.value)) * 0.95, Math.max(...data.map(d => d.value)) * 1.05],
    range: [height, 0],
  });

  return (
    <svg width={width} height={height}>
      <LinearGradient id="rating-gradient" from="#eab308" to="#eab30800" />
      <AreaClosed
        data={data}
        x={d => xScale(d.date)}
        y={d => yScale(d.value)}
        yScale={yScale}
        fill="url(#rating-gradient)"
        curve={curveMonotoneX}
      />
    </svg>
  );
}

function SentimentGauge({ value, width, height }: { value: number; width: number; height: number }) {
  const radius = Math.min(width, height) / 2;
  const arcAngle = value * 180; // 0-180 degrees
  const arcRadians = (arcAngle - 90) * (Math.PI / 180);

  const centerX = width / 2;
  const centerY = height;

  // Calculate arc path
  const startAngle = -Math.PI;
  const endAngle = startAngle + (arcRadians + Math.PI);

  const arcPath = `
    M ${centerX + radius * Math.cos(startAngle)} ${centerY + radius * Math.sin(startAngle)}
    A ${radius} ${radius} 0 ${arcAngle > 180 ? 1 : 0} 1 ${centerX + radius * Math.cos(endAngle)} ${centerY + radius * Math.sin(endAngle)}
  `;

  return (
    <svg width={width} height={height}>
      {/* Background arc */}
      <path
        d={`
          M ${centerX - radius} ${centerY}
          A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}
        `}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      {/* Value arc */}
      <path
        d={arcPath}
        fill="none"
        stroke="#22c55e"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function VolumeBars({ data, width, height }: { data: MetricData[]; width: number; height: number }) {
  if (!data.length || width === 0) return null;

  const xScale = scaleBand({
    domain: data.map((_, i) => i),
    range: [0, width],
    padding: 0.3,
  });

  const yScale = scaleLinear({
    domain: [0, Math.max(...data.map(d => d.value))],
    range: [height, 0],
  });

  return (
    <svg width={width} height={height}>
      {data.map((d, i) => {
        const barWidth = xScale.bandwidth();
        const barHeight = height - yScale(d.value);
        const barX = xScale(i) ?? 0;
        const barY = yScale(d.value);

        return (
          <Bar
            key={i}
            x={barX}
            y={barY}
            width={barWidth}
            height={barHeight}
            fill="#3b82f6"
            opacity={0.8}
          />
        );
      })}
    </svg>
  );
}
