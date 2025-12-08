import { useState, useEffect, useMemo } from 'react';
import { Business, getPeriodIssues, KeywordCluster, RatingsTimeline } from '../api';

export interface BusinessKeywordData {
  businessId: string;
  businessName: string;
  count: number;
  sentiment: number;
  sample: string;
  confidence: number;
}

export interface AlignedKeyword {
  keyword: string;
  businesses: (BusinessKeywordData | null)[];
}

export interface AlignedKeywordData {
  complaints: AlignedKeyword[];
  praises: AlignedKeyword[];
  actualPeriod?: { start: string; end: string }; // The actual period used for the data
  totalReviews?: number; // Total reviews in the period
}

export interface CompetitiveInsight {
  position: number;
  totalBusinesses: number;
  delta: number;
  status: 'leading' | 'lagging' | 'average';
}

interface UseKeywordDataReturn {
  data: AlignedKeywordData | null;
  isLoading: boolean;
  error: Error | null;
  getCompetitiveInsight: (keyword: string, type: 'complaints' | 'praises') => CompetitiveInsight | null;
  displayPeriod: string | null; // User-friendly display of which period is shown
}

/**
 * Custom hook for fetching and aligning keyword data across multiple businesses
 * Uses actual review timeline data to determine the best available period
 */
export function useKeywordData(
  business: Business | null,
  comparisonBusinesses: Business[] = [],
  ratingsTimeline?: RatingsTimeline | null
): UseKeywordDataReturn {
  const [rawData, setRawData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [actualPeriodUsed, setActualPeriodUsed] = useState<{ start: string; end: string } | null>(null);

  // Fetch data for all businesses using the actual date range from timeline
  useEffect(() => {
    if (!business || !ratingsTimeline?.data || ratingsTimeline.data.length === 0) {
      setRawData([]);
      setActualPeriodUsed(null);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const allBusinesses = [business, ...comparisonBusinesses];

        // Sort periods by date (newest first)
        const periods = ratingsTimeline.data;
        const sortedPeriods = [...periods].sort((a, b) =>
          new Date(b.period_start).getTime() - new Date(a.period_start).getTime()
        );

        // Extract unique years from the periods
        const years = Array.from(new Set(
          sortedPeriods.map(p => new Date(p.period_start).getFullYear())
        )).sort((a, b) => b - a); // Sort years descending (newest first)

        // Try to fetch data for each year, starting from the most recent
        let results: any[] = [];
        let usedStartDate: string | null = null;
        let usedEndDate: string | null = null;

        for (const year of years) {
          // Get all periods for this year
          const yearPeriods = sortedPeriods.filter(
            p => new Date(p.period_start).getFullYear() === year
          );

          if (yearPeriods.length === 0) continue;

          // Construct full year date range (Jan 1 to Dec 31)
          const yearStart = `${year}-01-01`;
          const yearEnd = `${year}-12-31`;

          console.log(`[Keywords] Trying year ${year}: ${yearStart} to ${yearEnd}`);

          // Try to fetch data for this year
          const promises = allBusinesses.map(b =>
            getPeriodIssues(b.business_id, yearStart, yearEnd)
              .then(data => ({ businessId: b.business_id, businessName: b.name, data }))
              .catch(err => {
                console.error(`Failed to fetch keywords for ${b.name} (${year}):`, err);
                return { businessId: b.business_id, businessName: b.name, data: null };
              })
          );

          const yearResults = await Promise.all(promises);

          // Check if primary business has enough data
          const primaryData = yearResults[0]?.data;
          console.log(`[Keywords] Year ${year} results:`, {
            complaints: primaryData?.complaints?.length || 0,
            praises: primaryData?.praises?.length || 0,
            total_reviews: primaryData?.total_reviews || 0,
            negative_count: primaryData?.negative_count || 0,
            positive_count: primaryData?.positive_count || 0
          });

          if (primaryData && (primaryData.complaints?.length > 0 || primaryData.praises?.length > 0)) {
            console.log(`[Keywords] ✓ Using year ${year}`);
            results = yearResults;
            usedStartDate = yearStart;
            usedEndDate = yearEnd;
            break; // Found valid data, stop looking at older years
          } else {
            console.log(`[Keywords] ✗ Year ${year} has insufficient data, trying next year...`);
          }
        }

        // Set the results
        if (results.length > 0 && usedStartDate && usedEndDate) {
          setRawData(results);
          setActualPeriodUsed({ start: usedStartDate, end: usedEndDate });
        } else {
          setRawData([]);
          setActualPeriodUsed(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch keyword data'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [business, comparisonBusinesses, ratingsTimeline]);

  // Align keywords across businesses
  const alignedData = useMemo((): AlignedKeywordData | null => {
    if (rawData.length === 0 || !rawData[0]?.data) {
      return null;
    }

    const primaryData = rawData[0].data;
    const totalReviews = primaryData.total_reviews || 0;

    // Extract top 5 keywords from primary business for each category
    const topComplaints = extractTopKeywords(primaryData.complaints, 20);
    const topPraises = extractTopKeywords(primaryData.praises, 20);

    // Align complaints
    const alignedComplaints = topComplaints.map(keywordInfo => {
      const businesses = rawData.map(businessData => {
        if (!businessData.data) return null;

        const match = findKeywordInClusters(
          businessData.data.complaints,
          keywordInfo.keyword
        );

        if (!match) return null;

        return {
          businessId: businessData.businessId,
          businessName: businessData.businessName,
          count: match.count,
          sentiment: match.sentiment,
          sample: match.sample,
          confidence: match.confidence,
        };
      });

      return {
        keyword: keywordInfo.keyword,
        businesses,
      };
    });

    // Align praises
    const alignedPraises = topPraises.map(keywordInfo => {
      const businesses = rawData.map(businessData => {
        if (!businessData.data) return null;

        const match = findKeywordInClusters(
          businessData.data.praises,
          keywordInfo.keyword
        );

        if (!match) return null;

        return {
          businessId: businessData.businessId,
          businessName: businessData.businessName,
          count: match.count,
          sentiment: match.sentiment,
          sample: match.sample,
          confidence: match.confidence,
        };
      });

      return {
        keyword: keywordInfo.keyword,
        businesses,
      };
    });

    return {
      complaints: alignedComplaints,
      praises: alignedPraises,
      actualPeriod: actualPeriodUsed || undefined,
      totalReviews,
    };
  }, [rawData, actualPeriodUsed]);

  // Function to get competitive insights for a specific keyword
  const getCompetitiveInsight = (keyword: string, type: 'complaints' | 'praises'): CompetitiveInsight | null => {
    if (!alignedData) return null;

    const keywords = type === 'complaints' ? alignedData.complaints : alignedData.praises;
    const keywordData = keywords.find(k => k.keyword === keyword);

    if (!keywordData) return null;

    const businessCounts = keywordData.businesses
      .filter(b => b !== null)
      .map(b => b!.count);

    if (businessCounts.length === 0) return null;

    const yourCount = keywordData.businesses[0]?.count ?? 0;

    // Calculate position (for complaints, lower is better; for praises, higher is better)
    let position: number;
    if (type === 'complaints') {
      // For complaints, rank by ascending count (fewer complaints = better position)
      const sorted = [...businessCounts].sort((a, b) => a - b);
      position = sorted.indexOf(yourCount) + 1;
    } else {
      // For praises, rank by descending count (more praises = better position)
      const sorted = [...businessCounts].sort((a, b) => b - a);
      position = sorted.indexOf(yourCount) + 1;
    }

    // Calculate delta vs average competitor
    const competitorCounts = businessCounts.slice(1); // Exclude your business
    const avgCompetitor = competitorCounts.length > 0
      ? competitorCounts.reduce((sum, c) => sum + c, 0) / competitorCounts.length
      : yourCount;

    const delta = avgCompetitor !== 0
      ? (yourCount - avgCompetitor) / avgCompetitor
      : 0;

    // Determine status
    let status: 'leading' | 'lagging' | 'average';
    if (type === 'complaints') {
      // For complaints, lower is better
      status = yourCount < avgCompetitor ? 'leading' : yourCount > avgCompetitor ? 'lagging' : 'average';
    } else {
      // For praises, higher is better
      status = yourCount > avgCompetitor ? 'leading' : yourCount < avgCompetitor ? 'lagging' : 'average';
    }

    return {
      position,
      totalBusinesses: businessCounts.length,
      delta,
      status,
    };
  };

  // Generate user-friendly display period
  const displayPeriod = useMemo(() => {
    if (!actualPeriodUsed) return null;

    const startYear = new Date(actualPeriodUsed.start).getFullYear();
    const endYear = new Date(actualPeriodUsed.end).getFullYear();

    if (startYear === endYear) {
      return `${startYear}`;
    } else {
      return `${startYear}-${endYear}`;
    }
  }, [actualPeriodUsed]);

  return {
    data: alignedData,
    isLoading,
    error,
    getCompetitiveInsight,
    displayPeriod,
  };
}

/**
 * Extract top N keywords from clusters
 */
function extractTopKeywords(
  clusters: KeywordCluster[],
  topN: number
): Array<{ keyword: string; confidence: number }> {
  // Collect all keywords with their confidence scores
  const allKeywords: Array<{ keyword: string; confidence: number; size: number }> = [];

  clusters.forEach(cluster => {
    cluster.keywords.forEach(([keyword, confidence]) => {
      allKeywords.push({
        keyword,
        confidence,
        size: cluster.size,
      });
    });
  });

  // Sort by cluster size (descending) and then confidence (descending)
  allKeywords.sort((a, b) => {
    if (b.size !== a.size) return b.size - a.size;
    return b.confidence - a.confidence;
  });

  // Take top N unique keywords
  const uniqueKeywords = new Map<string, number>();
  for (const kw of allKeywords) {
    if (!uniqueKeywords.has(kw.keyword)) {
      uniqueKeywords.set(kw.keyword, kw.confidence);
      if (uniqueKeywords.size >= topN) break;
    }
  }

  return Array.from(uniqueKeywords.entries()).map(([keyword, confidence]) => ({
    keyword,
    confidence,
  }));
}

/**
 * Find a keyword in clusters and return aggregated data
 */
function findKeywordInClusters(
  clusters: KeywordCluster[],
  targetKeyword: string
): { count: number; sentiment: number; sample: string; confidence: number } | null {
  for (const cluster of clusters) {
    const keywordMatch = cluster.keywords.find(([kw]) => kw === targetKeyword);
    if (keywordMatch) {
      return {
        count: cluster.size,
        sentiment: cluster.avg_sentiment,
        sample: cluster.sample_review,
        confidence: keywordMatch[1],
      };
    }
  }
  return null;
}

