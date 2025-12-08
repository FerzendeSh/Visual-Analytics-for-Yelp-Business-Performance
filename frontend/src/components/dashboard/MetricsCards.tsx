import React, { memo } from 'react';
import { Star, MessageSquare, TrendingUp } from 'lucide-react';
import './MetricsCards.css';

interface MetricsCardsProps {
  starRating?: number;
  sentimentScore?: number;
  reviewVolume?: number;
  isLoading?: boolean;
}

const MetricsCards: React.FC<MetricsCardsProps> = ({
  starRating,
  sentimentScore,
  reviewVolume,
  isLoading = false,
}) => {
  if (isLoading || starRating === undefined || sentimentScore === undefined || reviewVolume === undefined) {
    return null;
  }

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
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(MetricsCards);
