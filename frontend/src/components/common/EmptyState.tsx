import React from 'react';
import { SearchX, Filter, TrendingDown, AlertCircle, Inbox } from 'lucide-react';
import './EmptyState.css';

interface EmptyStateProps {
  variant?: 'no-results' | 'no-filters' | 'no-data' | 'error' | 'default';
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  variant = 'default',
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) => {
  const getDefaultContent = () => {
    switch (variant) {
      case 'no-results':
        return {
          icon: <SearchX size={48} strokeWidth={1.5} />,
          title: title || 'No businesses found',
          description: description || 'Try adjusting your filters to see results',
          actionLabel: actionLabel || 'Clear filters',
        };
      case 'no-filters':
        return {
          icon: <Filter size={48} strokeWidth={1.5} />,
          title: title || 'No filters applied',
          description: description || 'Apply filters to refine your search',
          actionLabel: actionLabel || 'Apply filters',
        };
      case 'no-data':
        return {
          icon: <TrendingDown size={48} strokeWidth={1.5} />,
          title: title || 'No data available',
          description: description || 'There is no data for the selected period',
          actionLabel: actionLabel,
        };
      case 'error':
        return {
          icon: <AlertCircle size={48} strokeWidth={1.5} />,
          title: title || 'Something went wrong',
          description: description || 'We encountered an error loading this data',
          actionLabel: actionLabel || 'Try again',
        };
      default:
        return {
          icon: <Inbox size={48} strokeWidth={1.5} />,
          title: title || 'Nothing here yet',
          description: description || 'Start by selecting some options',
          actionLabel: actionLabel,
        };
    }
  };

  const content = getDefaultContent();

  return (
    <div className={`empty-state empty-state--${variant}`}>
      <div className="empty-state__icon">
        {icon || content.icon}
      </div>
      <h3 className="empty-state__title">{content.title}</h3>
      {content.description && (
        <p className="empty-state__description">{content.description}</p>
      )}
      {content.actionLabel && onAction && (
        <button
          className="empty-state__action"
          onClick={onAction}
        >
          {content.actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
