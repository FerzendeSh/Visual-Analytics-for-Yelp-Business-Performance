/**
 * ClusterBadge - Reusable clickable cluster label component
 *
 * Displays a cluster's AI-generated label as a styled badge.
 * Can be made clickable for filtering or navigation.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { ClusterSummaryDTO } from '@/lib/api';

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
  const label = cluster.ai_label || `Cluster ${cluster.cluster_label}`;
  const isClickable = !!onClick;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) {
      onClick(cluster.cluster_id);
    }
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
      title={isClickable ? 'Click to filter by this competitor group' : undefined}
    >
      {showIcon && <span className="text-[10px]">👥</span>}
      <span>{label}</span>
    </button>
  );
}
