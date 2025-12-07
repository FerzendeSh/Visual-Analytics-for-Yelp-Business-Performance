import React, { useState, memo } from 'react';
import { Star, MessageSquare, TrendingUp, ArrowUp, ArrowDown, TrendingUp as TrendingFlat } from 'lucide-react';
import './MetricsCards.css';

interface MetricsCardsProps {
  starRating?: number;
  sentimentScore?: number;
  reviewVolume?: number;
  ratingChange?: number;
  sentimentChange?: number;
  reviewVolumeChange?: number;
  isLoading?: boolean;
  cityAvgRating?: number;
  cityAvgSentiment?: number;
  neighborhoodAvgRating?: number;
}

const MetricsCards: React.FC<MetricsCardsProps> = ({
  starRating,
  sentimentScore,
  reviewVolume,
  ratingChange = 0,
  sentimentChange = 0,
  reviewVolumeChange = 0,
  isLoading = false,
  cityAvgRating,
  cityAvgSentiment,
  neighborhoodAvgRating,
}) => {
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);

  if (isLoading || starRating === undefined || sentimentScore === undefined || reviewVolume === undefined) {
    return null;
  }

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${(change * 100).toFixed(1)}%`;
  };

  const getTrendColor = (change: number) => {
    if (change > 0.05) return 'var(--color-success)';
    if (change < -0.05) return 'var(--color-error)';
    return 'var(--color-text-muted)';
  };

  const getTrendIcon = (change: number) => {
    if (change > 0.05) return <ArrowUp size={16} strokeWidth={2.5} />;
    if (change < -0.05) return <ArrowDown size={16} strokeWidth={2.5} />;
    return <TrendingFlat size={16} strokeWidth={2.5} />;
  };

  const getTooltipText = (metric: string) => {
    switch (metric) {
      case 'rating':
        return 'Change in average rating vs. previous period';
      case 'sentiment':
        return 'Change in sentiment score vs. previous period';
      case 'volume':
        return 'Change in review volume vs. previous period';
      default:
        return '';
    }
  };

  const getComparison = (value: number, cityAvg?: number, neighborhoodAvg?: number) => {
    const comparisons = [];

    if (cityAvg !== undefined) {
      const diff = ((value - cityAvg) / cityAvg) * 100;
      comparisons.push({
        label: 'vs. city avg',
        value: cityAvg,
        diff,
        isPositive: diff > 0
      });
    }

    if (neighborhoodAvg !== undefined) {
      const diff = ((value - neighborhoodAvg) / neighborhoodAvg) * 100;
      comparisons.push({
        label: 'vs. neighborhood avg',
        value: neighborhoodAvg,
        diff,
        isPositive: diff > 0
      });
    }

    return comparisons;
  };

  const ratingComparisons = getComparison(starRating, cityAvgRating, neighborhoodAvgRating);
  const sentimentComparisons = getComparison(sentimentScore, cityAvgSentiment);

  return (
    <div className="metrics-cards">
      {/* Star Rating Card */}
      <div className="metrics-card">
        <div className="metrics-card__header">
          <div className="metrics-card__icon" style={{ backgroundColor: 'rgba(251, 191, 36, 0.15)' }}>
            <Star size={24} style={{ color: '#fbbf24' }} strokeWidth={2} fill="#fbbf24" />
          </div>
          <div className="metrics-card__label">Average Rating</div>
        </div>
        <div className="metrics-card__body">
          <div className="metrics-card__main">
            <div className="metrics-card__value">{starRating.toFixed(1)}<span className="metrics-card__unit">/5.0</span></div>
            <div
              className="metrics-card__trend"
              style={{ color: getTrendColor(ratingChange) }}
              onMouseEnter={() => setHoveredTooltip('rating')}
              onMouseLeave={() => setHoveredTooltip(null)}
            >
              <span className="metrics-card__trend-icon">{getTrendIcon(ratingChange)}</span>
              <span className="metrics-card__trend-value">{formatChange(ratingChange)}</span>
              {hoveredTooltip === 'rating' && (
                <div className="metrics-card__tooltip">{getTooltipText('rating')}</div>
              )}
            </div>
          </div>
          {ratingComparisons.length > 0 && (
            <div className="metrics-card__comparisons">
              {ratingComparisons.map((comp, idx) => (
                <div key={idx} className="metrics-card__comparison">
                  <span className="metrics-card__comparison-label">{comp.label}:</span>
                  <span className="metrics-card__comparison-value">{comp.value.toFixed(1)}</span>
                  <span
                    className="metrics-card__comparison-diff"
                    style={{ color: comp.isPositive ? 'var(--color-success)' : 'var(--color-error)' }}
                  >
                    ({comp.isPositive ? '+' : ''}{comp.diff.toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sentiment Score Card */}
      <div className="metrics-card">
        <div className="metrics-card__header">
          <div className="metrics-card__icon" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)' }}>
            <MessageSquare size={24} style={{ color: '#a855f7' }} strokeWidth={2} />
          </div>
          <div className="metrics-card__label">Sentiment Score</div>
        </div>
        <div className="metrics-card__body">
          <div className="metrics-card__main">
            <div className="metrics-card__value">{sentimentScore.toFixed(2)}</div>
            <div
              className="metrics-card__trend"
              style={{ color: getTrendColor(sentimentChange) }}
              onMouseEnter={() => setHoveredTooltip('sentiment')}
              onMouseLeave={() => setHoveredTooltip(null)}
            >
              <span className="metrics-card__trend-icon">{getTrendIcon(sentimentChange)}</span>
              <span className="metrics-card__trend-value">{formatChange(sentimentChange)}</span>
              {hoveredTooltip === 'sentiment' && (
                <div className="metrics-card__tooltip">{getTooltipText('sentiment')}</div>
              )}
            </div>
          </div>
          {sentimentComparisons.length > 0 && (
            <div className="metrics-card__comparisons">
              {sentimentComparisons.map((comp, idx) => (
                <div key={idx} className="metrics-card__comparison">
                  <span className="metrics-card__comparison-label">{comp.label}:</span>
                  <span className="metrics-card__comparison-value">{comp.value.toFixed(2)}</span>
                  <span
                    className="metrics-card__comparison-diff"
                    style={{ color: comp.isPositive ? 'var(--color-success)' : 'var(--color-error)' }}
                  >
                    ({comp.isPositive ? '+' : ''}{comp.diff.toFixed(1)}%)
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Review Volume Card */}
      <div className="metrics-card">
        <div className="metrics-card__header">
          <div className="metrics-card__icon" style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)' }}>
            <TrendingUp size={24} style={{ color: '#22c55e' }} strokeWidth={2} />
          </div>
          <div className="metrics-card__label">Total Reviews</div>
        </div>
        <div className="metrics-card__body">
          <div className="metrics-card__main">
            <div className="metrics-card__value">{reviewVolume.toLocaleString()}</div>
            <div
              className="metrics-card__trend"
              style={{ color: getTrendColor(reviewVolumeChange) }}
              onMouseEnter={() => setHoveredTooltip('volume')}
              onMouseLeave={() => setHoveredTooltip(null)}
            >
              <span className="metrics-card__trend-icon">{getTrendIcon(reviewVolumeChange)}</span>
              <span className="metrics-card__trend-value">{formatChange(reviewVolumeChange)}</span>
              {hoveredTooltip === 'volume' && (
                <div className="metrics-card__tooltip">{getTooltipText('volume')}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(MetricsCards);
