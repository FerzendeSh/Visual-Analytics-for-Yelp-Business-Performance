import React, { useState } from 'react';
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
    if (change > 0.05) return '#34d399'; // green
    if (change < -0.05) return '#ef4444'; // red
    return '#94a3b8'; // gray
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
        <div className="metrics-card__icon" style={{ backgroundColor: 'rgba(59, 130, 246, 0.2)' }}>
          <Star size={20} style={{ color: '#3b82f6' }} strokeWidth={1.5} fill="#3b82f6" />
        </div>
        <div className="metrics-card__content">
          <div className="metrics-card__value">{starRating.toFixed(1)}</div>
          <div className="metrics-card__label">Average Rating</div>
        </div>
        <div
          className="metrics-card__change"
          style={{ color: getTrendColor(ratingChange) }}
          onMouseEnter={() => setHoveredTooltip('rating')}
          onMouseLeave={() => setHoveredTooltip(null)}
        >
          {formatChange(ratingChange)}
          {hoveredTooltip === 'rating' && (
            <div className="metrics-card__tooltip">{getTooltipText('rating')}</div>
          )}
        </div>
      </div>

      {/* Sentiment Score Card */}
      <div className="metrics-card">
        <div className="metrics-card__icon" style={{ backgroundColor: 'rgba(168, 85, 247, 0.2)' }}>
          <MessageSquare size={20} style={{ color: '#a855f7' }} strokeWidth={1.5} />
        </div>
        <div className="metrics-card__content">
          <div className="metrics-card__value">{sentimentScore.toFixed(2)}</div>
          <div className="metrics-card__label">Sentiment Score</div>
        </div>
        <div
          className="metrics-card__change"
          style={{ color: getTrendColor(sentimentChange) }}
          onMouseEnter={() => setHoveredTooltip('sentiment')}
          onMouseLeave={() => setHoveredTooltip(null)}
        >
          {formatChange(sentimentChange)}
          {hoveredTooltip === 'sentiment' && (
            <div className="metrics-card__tooltip">{getTooltipText('sentiment')}</div>
          )}
        </div>
      </div>

      {/* Review Volume Card */}
      <div className="metrics-card">
        <div className="metrics-card__icon" style={{ backgroundColor: 'rgba(34, 197, 94, 0.2)' }}>
          <TrendingUp size={20} style={{ color: '#22c55e' }} strokeWidth={1.5} />
        </div>
        <div className="metrics-card__content">
          <div className="metrics-card__value">{reviewVolume.toLocaleString()}</div>
          <div className="metrics-card__label">Total Reviews</div>
        </div>
        <div
          className="metrics-card__change"
          style={{ color: getTrendColor(reviewVolumeChange) }}
          onMouseEnter={() => setHoveredTooltip('volume')}
          onMouseLeave={() => setHoveredTooltip(null)}
        >
          {formatChange(reviewVolumeChange)}
          {hoveredTooltip === 'volume' && (
            <div className="metrics-card__tooltip">{getTooltipText('volume')}</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MetricsCards;
