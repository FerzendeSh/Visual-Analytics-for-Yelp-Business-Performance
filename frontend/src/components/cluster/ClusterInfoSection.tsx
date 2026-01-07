/**
 * ClusterInfoSection - Full cluster info display for tooltips/popups
 *
 * Shows comprehensive cluster information including:
 * - AI label (prominent)
 * - AI description (truncated or full)
 * - Metadata (size, avg rating, top categories)
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { ClusterSummaryDTO } from '@/lib/api';
import { ClusterBadge } from './ClusterBadge';

export interface ClusterInfoSectionProps {
  cluster: ClusterSummaryDTO;
  showFullDescription?: boolean;
  onLabelClick?: (clusterId: number) => void;
  className?: string;
}

export function ClusterInfoSection({
  cluster,
  showFullDescription = false,
  onLabelClick,
  className,
}: ClusterInfoSectionProps) {
  return (
    <div className={cn('flex items-start gap-2', className)}>
      <span className="text-base">👥</span>
      <div className="flex-1 min-w-0">
        {/* Cluster Label (clickable if onLabelClick provided) */}
        <div className="mb-1">
          <ClusterBadge
            cluster={cluster}
            onClick={onLabelClick}
            showIcon={false}
          />
        </div>

        {/* AI Description */}
        {cluster.ai_description && (
          <p
            className={cn(
              'text-[10px] text-muted-foreground mt-1',
              !showFullDescription && 'line-clamp-2'
            )}
          >
            {cluster.ai_description}
          </p>
        )}

        {/* Metadata */}
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
          <span>{cluster.size} businesses</span>
          {cluster.avg_stars && (
            <span>⭐ {cluster.avg_stars.toFixed(1)} avg</span>
          )}
        </div>

        {/* Top Categories (if available and showing full description) */}
        {showFullDescription && cluster.top_categories && cluster.top_categories.length > 0 && (
          <div className="mt-2">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">
              Top Categories
            </p>
            <div className="flex flex-wrap gap-1">
              {cluster.top_categories.slice(0, 3).map((cat, idx) => (
                <span
                  key={idx}
                  className="px-1.5 py-0.5 rounded text-[9px] bg-slate-700/50 text-slate-300"
                >
                  {cat.category}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
