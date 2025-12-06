import React from 'react';
import './LoadingSkeleton.css';

interface LoadingSkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'card' | 'metrics';
  width?: string | number;
  height?: string | number;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  variant = 'rectangular',
  width,
  height,
  className = '',
}) => {
  const style: React.CSSProperties = {
    width: width || '100%',
    height: height || (variant === 'text' ? '1em' : '100%'),
  };

  return (
    <div
      className={`loading-skeleton loading-skeleton--${variant} ${className}`}
      style={style}
    />
  );
};

export const MetricsCardsSkeleton: React.FC = () => {
  return (
    <div className="metrics-cards-skeleton">
      {[1, 2, 3].map((i) => (
        <div key={i} className="metrics-card-skeleton">
          <div className="metrics-card-skeleton__icon shimmer" />
          <div className="metrics-card-skeleton__content">
            <div className="metrics-card-skeleton__value shimmer" />
            <div className="metrics-card-skeleton__label shimmer" />
          </div>
          <div className="metrics-card-skeleton__change shimmer" />
        </div>
      ))}
    </div>
  );
};

export const ChartSkeleton: React.FC<{ height?: string }> = ({ height = '400px' }) => {
  return (
    <div className="chart-skeleton" style={{ height }}>
      <div className="chart-skeleton__header shimmer" />
      <div className="chart-skeleton__body shimmer" />
    </div>
  );
};

export const MapSkeleton: React.FC = () => {
  return (
    <div className="map-skeleton">
      <div className="map-skeleton__placeholder shimmer" />
      <div className="map-skeleton__controls">
        <div className="shimmer" style={{ width: '40px', height: '40px', borderRadius: '4px' }} />
        <div className="shimmer" style={{ width: '40px', height: '40px', borderRadius: '4px' }} />
      </div>
    </div>
  );
};

export default LoadingSkeleton;
