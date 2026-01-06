/**
 * Cluster color palette for competitive landscape visualization
 * Uses perceptually uniform colors to distinguish between 43 competitor groups
 */
import { scaleSequential } from 'd3-scale';
import { interpolateTurbo } from 'd3-scale-chromatic';

/**
 * Convert hex color to RGB array
 */
function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [128, 128, 128]; // Default gray fallback
}

/**
 * Get a distinct color for a cluster based on its label
 * Uses the Turbo color scale which is perceptually uniform and provides
 * maximum color distinction across the full spectrum
 *
 * @param clusterLabel - Cluster label number (typically 0-42 for 43 clusters)
 * @param totalClusters - Total number of clusters in the dataset (default: 43)
 * @returns RGB color array [r, g, b] with values 0-255
 */
export function getClusterColor(
  clusterLabel: number,
  totalClusters: number = 43
): [number, number, number] {
  // Normalize cluster label to 0-1 range
  const t = clusterLabel / (totalClusters - 1);

  // Get color from Turbo scale (ranges from blue through green/yellow to red)
  const colorScale = scaleSequential(interpolateTurbo).domain([0, 1]);
  const hexColor = colorScale(t);

  return hexToRgb(hexColor);
}

/**
 * Cluster benchmark color for timeline charts
 * Teal-500 - distinct from existing benchmark colors:
 * - City: Purple (#a855f7)
 * - Neighborhood: Green (#22c55e)
 * - Category: Amber (#f59e0b)
 */
export const CLUSTER_BENCHMARK_COLOR = '#14b8a6'; // Teal-500

/**
 * Get cluster color as CSS hex string
 */
export function getClusterColorHex(
  clusterLabel: number,
  totalClusters: number = 43
): string {
  const [r, g, b] = getClusterColor(clusterLabel, totalClusters);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Get cluster color as RGBA string
 */
export function getClusterColorRgba(
  clusterLabel: number,
  alpha: number = 1,
  totalClusters: number = 43
): string {
  const [r, g, b] = getClusterColor(clusterLabel, totalClusters);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
