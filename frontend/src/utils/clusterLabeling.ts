/**
 * Smart labeling for special cluster types (UNIQUE/NOISE clusters)
 *
 * Detects and generates user-friendly labels for clusters that don't have AI-generated labels,
 * which are typically "unique businesses" (no local competitors) or "isolated businesses".
 */

import type { ClusterSummaryDTO } from '@/lib/api';

/**
 * Determines if a cluster is likely a "unique businesses" cluster
 * These are businesses within a region that don't cluster with others semantically
 */
function isUniqueBusinessCluster(cluster: ClusterSummaryDTO): boolean {
  // Heuristics:
  // 1. No AI label (wasn't labeled by LLM)
  // 2. Larger than typical competitor groups (usually 20-80 businesses)
  // 3. More diverse categories (> 5 different top categories)

  const hasNoLabel = !cluster.ai_label || cluster.ai_label.trim() === '';
  const isLargerThanTypical = cluster.size > 15;
  const hasDiverseCategories = (cluster.top_categories?.length ?? 0) > 4;

  return hasNoLabel && isLargerThanTypical && hasDiverseCategories;
}

/**
 * Determines if a cluster is likely a "geographically isolated" cluster
 * These are businesses not part of any major metro cluster
 */
function isIsolatedBusinessCluster(cluster: ClusterSummaryDTO): boolean {
  // Heuristics:
  // 1. No AI label
  // 2. No specific city (or city is "GLOBAL")
  // 3. No centroid (geographically dispersed)

  const hasNoLabel = !cluster.ai_label || cluster.ai_label.trim() === '';
  const isGlobalOrNoCity = !cluster.city || cluster.city === 'GLOBAL' || cluster.city === '';
  const hasNoCentroid = !cluster.centroid_lat || !cluster.centroid_lon;

  return hasNoLabel && (isGlobalOrNoCity || hasNoCentroid);
}

/**
 * Gets the cluster type based on its characteristics
 */
export type ClusterType = 'regular' | 'unique' | 'isolated' | 'unknown';

export function getClusterType(cluster: ClusterSummaryDTO): ClusterType {
  if (cluster.ai_label && cluster.ai_label.trim() !== '') {
    return 'regular';
  }

  if (isIsolatedBusinessCluster(cluster)) {
    return 'isolated';
  }

  if (isUniqueBusinessCluster(cluster)) {
    return 'unique';
  }

  return 'unknown';
}

/**
 * Generates a smart label for clusters without AI labels
 */
export function getSmartClusterLabel(cluster: ClusterSummaryDTO): string {
  // If it has an AI label, use it
  if (cluster.ai_label && cluster.ai_label.trim() !== '') {
    return cluster.ai_label;
  }

  const clusterType = getClusterType(cluster);

  switch (clusterType) {
    case 'unique':
      // Independent businesses in a specific city
      const cityName = cluster.city && cluster.city !== 'GLOBAL'
        ? cluster.city
        : 'this area';
      return `Independent Businesses in ${cityName}`;

    case 'isolated':
      // Geographically isolated businesses
      return 'Geographically Isolated Businesses';

    case 'unknown':
    default:
      // Fallback to cluster number
      return `Cluster ${cluster.cluster_label}`;
  }
}

/**
 * Generates a helpful description explaining why a cluster is special
 */
export function getClusterDescription(cluster: ClusterSummaryDTO): string {
  // If it has an AI description, use it
  if (cluster.ai_description && cluster.ai_description.trim() !== '') {
    return cluster.ai_description;
  }

  const clusterType = getClusterType(cluster);

  switch (clusterType) {
    case 'unique': {
      const cityName = cluster.city && cluster.city !== 'GLOBAL'
        ? cluster.city
        : 'this area';

      return `These ${cluster.size} businesses are in ${cityName} but don't share enough characteristics with other competitor groups. They may represent highly specialized niches, unique business models, or different target markets.`;
    }

    case 'isolated': {
      return `These ${cluster.size} businesses are geographically separated from major metro clusters, making direct comparison with grouped competitors more difficult.`;
    }

    case 'unknown':
    default:
      return `A group of ${cluster.size} businesses with similar characteristics.`;
  }
}

/**
 * Gets key characteristics that make this cluster special
 */
export function getClusterCharacteristics(cluster: ClusterSummaryDTO): string[] {
  const clusterType = getClusterType(cluster);

  switch (clusterType) {
    case 'unique': {
      const characteristics = [
        'No direct local competitors',
        'Highly specialized or niche offerings',
      ];

      // Add category diversity info if available
      if (cluster.top_categories && cluster.top_categories.length > 0) {
        const topCats = cluster.top_categories
          .slice(0, 3)
          .map((cat: any) => cat.category || cat)
          .join(', ');
        characteristics.push(`Diverse categories: ${topCats}`);
      }

      return characteristics;
    }

    case 'isolated': {
      const characteristics = [
        'Not part of major metro areas',
        'Standalone locations',
      ];

      if (cluster.size) {
        characteristics.push(`${cluster.size} businesses across multiple regions`);
      }

      return characteristics;
    }

    case 'unknown':
    default:
      return [
        `${cluster.size} businesses in this group`,
        cluster.avg_stars ? `Average rating: ${cluster.avg_stars.toFixed(1)} stars` : '',
      ].filter(Boolean);
  }
}

/**
 * Gets a helpful tooltip/explanation for the cluster
 */
export function getClusterTooltip(cluster: ClusterSummaryDTO): {
  title: string;
  description: string;
  characteristics: string[];
} {
  return {
    title: getSmartClusterLabel(cluster),
    description: getClusterDescription(cluster),
    characteristics: getClusterCharacteristics(cluster),
  };
}

/**
 * Gets a short subtitle for the cluster (shown below the main label)
 */
export function getClusterSubtitle(cluster: ClusterSummaryDTO): string | null {
  const clusterType = getClusterType(cluster);

  switch (clusterType) {
    case 'unique':
      return 'No direct local competitors';

    case 'isolated':
      return 'Not part of any metro cluster';

    default:
      return null;
  }
}
