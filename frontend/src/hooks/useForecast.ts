/**
 * Custom hook for fetching forecast data with React Query
 * Provides rating and sentiment predictions with confidence intervals
 */
import { useQuery } from '@tanstack/react-query';
import { getBusinessForecast, ForecastData, ForecastDataPoint } from '../api/endpoints/analytics';

interface UseForecastParams {
  businessId: string | undefined;
  periods?: number;
  periodType?: 'month' | 'year';
  enabled?: boolean;
}

interface UseForecastResult {
  forecastData: ForecastData | null;
  ratingForecast: ForecastDataPoint[] | null;
  sentimentForecast: ForecastDataPoint[] | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<unknown>;
}

/**
 * Hook for fetching business forecast data
 * 
 * @param businessId - Business to forecast (required to enable query)
 * @param periods - Number of future periods to predict (default: 4)
 * @param periodType - Granularity of forecast ('month' or 'year')
 * @param enabled - Whether to enable the query (default: true when businessId exists)
 * 
 * @example
 * const { ratingForecast, sentimentForecast, isLoading } = useForecast({
 *   businessId: myBusiness?.business_id,
 *   periods: 4,
 *   periodType: 'month'
 * });
 */
export const useForecast = ({
  businessId,
  periods = 4,
  periodType = 'month',
  enabled = true,
}: UseForecastParams): UseForecastResult => {
  const query = useQuery({
    queryKey: ['forecast', businessId, periods, periodType],
    queryFn: () => getBusinessForecast(businessId!, periods, periodType),
    enabled: !!businessId && enabled,
    // Cache forecasts for 24 hours - they don't change frequently
    staleTime: 24 * 60 * 60 * 1000,
    // Keep cached data for 48 hours
    gcTime: 48 * 60 * 60 * 1000,
    // Don't refetch on window focus for forecasts
    refetchOnWindowFocus: false,
    // Retry failed requests up to 2 times
    retry: 2,
  });

  return {
    forecastData: query.data ?? null,
    // Extract the nested forecast array from the response
    ratingForecast: query.data?.rating_forecast?.forecast ?? null,
    sentimentForecast: query.data?.sentiment_forecast?.forecast ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};

export default useForecast;
