import { get } from '../apiClient';

export interface KeywordCluster {
  cluster_id: number;
  size: number;
  keywords: Array<[string, number]>;
  avg_sentiment: number;
  sample_review: string;
}

export interface PeriodIssuesResponse {
  complaints: KeywordCluster[];
  praises: KeywordCluster[];
  total_reviews: number;
  negative_count: number;
  positive_count: number;
}

export const getPeriodIssues = async (
  businessId: string,
  startDate: string,
  endDate: string,
  nClusters: number = 3
): Promise<PeriodIssuesResponse> => {
  return get<PeriodIssuesResponse>(
    `/api/analytics/business/${businessId}/period-issues`,
    { params: { start_date: startDate, end_date: endDate, n_clusters: nClusters } }
  );
};
