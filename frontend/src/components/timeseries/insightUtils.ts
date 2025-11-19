import { TrendAnalysis, CompetitivePosition } from './trendUtils';
import { formatPercentChange } from './chartConstants';

export interface ChartInsight {
  title: string;
  subtitle: string;
  ariaLabel: string;
}

export function generateRatingInsight(
  businessName: string | null,
  cityName: string | null,
  categoryName: string | null,
  trend: TrendAnalysis | null,
  competitivePosition: CompetitivePosition | null
): ChartInsight {
  const subject = businessName || (cityName ? `${cityName} Average` : categoryName || 'Ratings');
  const isBusinessView = !!businessName;

  if (!trend) {
    return {
      title: `${subject} - Rating Trends`,
      subtitle: 'Insufficient data for trend analysis',
      ariaLabel: `Rating trends chart for ${subject}`,
    };
  }

  let title = '';
  let subtitle = '';

  if (trend.direction === 'improving') {
    title = `${subject}: Ratings Improving`;
    subtitle = `${formatPercentChange(trend.changePercent)} trend (${trend.startValue.toFixed(2)} → ${trend.endValue.toFixed(2)} stars)`;
  } else if (trend.direction === 'declining') {
    title = `${subject}: Ratings Declining`;
    subtitle = `${formatPercentChange(trend.changePercent)} trend (${trend.startValue.toFixed(2)} → ${trend.endValue.toFixed(2)} stars)`;
  } else {
    title = `${subject}: Ratings Stable`;
    subtitle = `Consistent around ${trend.endValue.toFixed(2)} stars`;
  }

  if (isBusinessView && competitivePosition) {
    const positionText = competitivePosition.isAboveAverage
      ? `${formatPercentChange(competitivePosition.gapPercent)} above average`
      : `${formatPercentChange(Math.abs(competitivePosition.gapPercent))} below average`;

    subtitle += ` • ${positionText}`;
  }

  const ariaLabel = `Rating trends for ${subject}. ${trend.direction === 'improving' ? 'Improving' : trend.direction === 'declining' ? 'Declining' : 'Stable'} trend with ${formatPercentChange(trend.changePercent)} change. Current rating: ${trend.endValue.toFixed(2)} stars.`;

  return { title, subtitle, ariaLabel };
}

export function generateSentimentInsight(
  businessName: string | null,
  cityName: string | null,
  categoryName: string | null,
  trend: TrendAnalysis | null,
  competitivePosition: CompetitivePosition | null
): ChartInsight {
  const subject = businessName || (cityName ? `${cityName} Average` : categoryName || 'Sentiment');
  const isBusinessView = !!businessName;

  if (!trend) {
    return {
      title: `${subject} - Sentiment Trends`,
      subtitle: 'Insufficient data for trend analysis',
      ariaLabel: `Sentiment trends chart for ${subject}`,
    };
  }

  const describeSentiment = (value: number): string => {
    if (value > 0.5) return 'Very Positive';
    if (value > 0.2) return 'Positive';
    if (value > -0.2) return 'Neutral';
    if (value > -0.5) return 'Negative';
    return 'Very Negative';
  };

  let title = '';
  let subtitle = '';

  if (trend.direction === 'improving') {
    title = `${subject}: Sentiment Improving`;
    subtitle = `${formatPercentChange(trend.changePercent)} trend • Now ${describeSentiment(trend.endValue)}`;
  } else if (trend.direction === 'declining') {
    title = `${subject}: Sentiment Declining`;
    subtitle = `${formatPercentChange(trend.changePercent)} trend • Now ${describeSentiment(trend.endValue)}`;
  } else {
    title = `${subject}: Sentiment Stable`;
    subtitle = `Consistent ${describeSentiment(trend.endValue)} sentiment`;
  }

  if (isBusinessView && competitivePosition) {
    const positionText = competitivePosition.isAboveAverage
      ? `${formatPercentChange(competitivePosition.gapPercent)} above average`
      : `${formatPercentChange(Math.abs(competitivePosition.gapPercent))} below average`;

    subtitle += ` • ${positionText}`;
  }

  const ariaLabel = `Sentiment trends for ${subject}. ${trend.direction === 'improving' ? 'Improving' : trend.direction === 'declining' ? 'Declining' : 'Stable'} trend with ${formatPercentChange(trend.changePercent)} change. Current sentiment: ${describeSentiment(trend.endValue)}.`;

  return { title, subtitle, ariaLabel };
}

/**
 * Generate summary text for empty states
 */
export function generateEmptyStateMessage(
  hasSelection: boolean
): string {
  if (!hasSelection) {
    return 'Select a city, category, or business to view performance trends and competitive analysis';
  }
  return 'No time series data available for the selected filters';
}

/**
 * Format review count for display
 */
export function formatReviewCount(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(1)}M`;
  }
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toString();
}

/**
 * Generate competitive position description
 */
export function generateCompetitiveDescription(
  position: CompetitivePosition | null,
  comparisonType: 'city' | 'category'
): string | null {
  if (!position) return null;

  const comparisonName = comparisonType === 'city' ? 'city' : 'category';
  const direction = position.isAboveAverage ? 'above' : 'below';
  const percent = formatPercentChange(Math.abs(position.gapPercent));

  return `${percent} ${direction} ${comparisonName} average`;
}
