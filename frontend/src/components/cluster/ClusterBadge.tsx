/**
 * ClusterBadge - Reusable clickable cluster label component
 *
 * Displays a cluster's AI-generated label as a styled badge.
 * Can be made clickable for filtering or navigation.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { ClusterSummaryDTO } from '@/lib/api';
import { getSmartClusterLabel, getClusterType } from '@/utils/clusterLabeling';

export interface ClusterBadgeProps {
  cluster: ClusterSummaryDTO;
  onClick?: (clusterId: number) => void;
  showIcon?: boolean;
  className?: string;
}

export function ClusterBadge({
  cluster,
  onClick,
  showIcon = true,
  className,
}: ClusterBadgeProps) {
  const label = getSmartClusterLabel(cluster);
  const clusterType = getClusterType(cluster);
  const isClickable = !!onClick;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick(cluster.cluster_id);
    }
  };

  const getClusterTooltip = () => {
    if (clusterType === 'unique') {
      return isClickable
        ? 'Independent businesses with no direct local competitors. Click to filter.'
        : 'Independent businesses with no direct local competitors';
    }
    if (clusterType === 'isolated') {
      return isClickable
        ? 'Geographically isolated businesses. Click to filter.'
        : 'Geographically isolated businesses';
    }
    return isClickable ? 'Click to filter by this competitor group' : undefined;
  };

  return (
    <button
      onClick={handleClick}
      disabled={!isClickable}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
        'bg-blue-500/20 text-blue-400',
        isClickable && [
          'hover:bg-blue-500/30 cursor-pointer',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
        ],
        !isClickable && 'cursor-default',
        className
      )}
      title={getClusterTooltip()}
    >
      <span>{label}</span>
    </button>
  );
}
