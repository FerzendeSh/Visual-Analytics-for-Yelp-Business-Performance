import React, { useState, memo } from 'react';
import { Star, MessageSquare, TrendingUp } from 'lucide-react';
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

  const getTooltipText = (metric: string) => {
    switch (metric) {
      case 'rating':
        return 'Change in average rating vs. previous year';
      case 'sentiment':
        return 'Change in sentiment score vs. previous year';
      case 'volume':
        return 'Change in review volume vs. previous year';
      default:
        return '';
    }
  };

  return (
    <div className="metrics-cards">
      {/* Star Rating Card */}
      <div className="metrics-card">
        <div className="metrics-card__header">
          <div className="metrics-card__label">Average Rating</div>
        </div>
        <div className="metrics-card__body">
          <div className="metrics-card__main">
            <div className="metrics-card__value">
              {starRating.toFixed(1)}
              <div className="metrics-card__icon">
                <Star size={20} style={{ color: '#fbbf24' }} strokeWidth={2} fill="#fbbf24" />
              </div>
            </div>
            <div
              className="metrics-card__trend"
              style={{ color: getTrendColor(ratingChange) }}
              onMouseEnter={() => setHoveredTooltip('rating')}
              onMouseLeave={() => setHoveredTooltip(null)}
            >
              <span className="metrics-card__trend-value">{formatChange(ratingChange)}</span>
              {hoveredTooltip === 'rating' && (
                <div className="metrics-card__tooltip">{getTooltipText('rating')}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sentiment Score Card */}
      <div className="metrics-card">
        <div className="metrics-card__header">
          <div className="metrics-card__label">Sentiment Score</div>
        </div>
        <div className="metrics-card__body">
          <div className="metrics-card__main">
            <div className="metrics-card__value">
              {sentimentScore.toFixed(2)}
              <div className="metrics-card__icon">
                <MessageSquare size={20} style={{ color: '#a855f7' }} strokeWidth={2} />
              </div>
            </div>
            <div
              className="metrics-card__trend"
              style={{ color: getTrendColor(sentimentChange) }}
              onMouseEnter={() => setHoveredTooltip('sentiment')}
              onMouseLeave={() => setHoveredTooltip(null)}
            >
              <span className="metrics-card__trend-value">{formatChange(sentimentChange)}</span>
              {hoveredTooltip === 'sentiment' && (
                <div className="metrics-card__tooltip">{getTooltipText('sentiment')}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Review Volume Card */}
      <div className="metrics-card">
        <div className="metrics-card__header">
          <div className="metrics-card__label">Total Reviews</div>
        </div>
        <div className="metrics-card__body">
          <div className="metrics-card__main">
            <div className="metrics-card__value">
              {reviewVolume.toLocaleString()}
              <div className="metrics-card__icon">
                <TrendingUp size={20} style={{ color: '#22c55e' }} strokeWidth={2} />
              </div>
            </div>
            <div
              className="metrics-card__trend"
              style={{ color: getTrendColor(reviewVolumeChange) }}
              onMouseEnter={() => setHoveredTooltip('volume')}
              onMouseLeave={() => setHoveredTooltip(null)}
            >
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
