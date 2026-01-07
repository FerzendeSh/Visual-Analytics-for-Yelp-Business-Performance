/**
 * Map click popup component.
 * Displays business details with action buttons when clicking on markers.
 */
import { Business, ClusterSummaryDTO } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { X, Plus, Check } from 'lucide-react';
import { MAGGIANOS_TAMPA_BUSINESS_ID } from '@/stores/useAppStore';
import { getTodayHours, getPriceRange } from '@/lib/utils';
import { getSmartClusterLabel, getClusterType, getClusterDescription } from '@/utils/clusterLabeling';
import { useState } from 'react';

interface MapClickPopupProps {
  business: Business | null;
  clusterInfo?: ClusterSummaryDTO | null;
  onClusterClick?: (clusterId: number) => void;
  isInComparison: boolean;
  canAddMore: boolean;
  onAddToComparison: () => void;
  onRemoveFromComparison: () => void;
  onClose: () => void;
}

export function MapClickPopup({
  business,
  clusterInfo,
  onClusterClick,
  isInComparison,
  canAddMore,
  onAddToComparison,
  onRemoveFromComparison,
  onClose,
}: MapClickPopupProps) {
  if (!business) return null;

  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const isOpen = business.is_open === 1;
  const isMaggianosMyBusiness = business.business_id === MAGGIANOS_TAMPA_BUSINESS_ID;
  const todayHours = getTodayHours(business.hours);
  const priceRange = getPriceRange(business.attributes);

  return (
    <div
      className="absolute bottom-1 left-1 glass p-4 rounded-lg max-w-sm shadow-xl border border-slate-700/50 z-40"
      onClick={(e) => {
        // Prevent click from propagating to map (which would close the popup)
        e.stopPropagation();
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded transition-colors cursor-pointer"
        title="Close"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="space-y-3">
        {/* Business name and status */}
        <div>
          <h4 className="font-semibold text-sm pr-6">{business.name}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              ⭐ {business.stars.toFixed(1)} • {business.review_count} reviews{priceRange && ` • ${priceRange}`}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                isOpen
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {isOpen ? 'Open' : 'Closed'}
            </span>
          </div>
          {/* Opening hours info */}
          {todayHours && (
            <div className="mt-1">
              {todayHours.isClosedAllDay ? (
                <span className="text-xs text-muted-foreground">
                  {todayHours.nextOpenDay && todayHours.nextOpenTime
                    ? `Opens ${todayHours.nextOpenDay} at ${todayHours.nextOpenTime}`
                    : 'Closed today'}
                </span>
              ) : todayHours.isOpen ? (
                <span className="text-xs text-muted-foreground">
                  Closes at {todayHours.closesAt}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {todayHours.nextOpenDay && todayHours.nextOpenTime
                    ? `Opens ${todayHours.nextOpenDay} at ${todayHours.nextOpenTime}`
                    : `Opens at ${todayHours.opensAt}`}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Location info */}
        <div className="text-xs text-muted-foreground space-y-0.5">
          {business.address && <p>{business.address}</p>}
          <p>{business.neighborhood || business.city}, {business.state}</p>
        </div>

        {/* Categories */}
        {business.categories && (
          <div className="flex flex-wrap gap-1">
            {(() => {
              // Categories is always a string, split by comma
              const categoryList = business.categories.split(',').map(c => c.trim());
              const remainingCategories = categoryList.slice(3);

              return (
                <>
                  {categoryList.slice(0, 3).map((category: string, idx: number) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400"
                    >
                      {category}
                    </span>
                  ))}
                  {categoryList.length > 3 && (
                    <div className="relative group">
                      <span className="px-2 py-0.5 rounded text-[10px] text-muted-foreground cursor-help">
                        +{categoryList.length - 3} more
                      </span>
                      {/* Tooltip with remaining categories */}
                      <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-50 pointer-events-none">
                        <div className="bg-slate-900 border border-slate-700 rounded px-3 py-2 shadow-lg min-w-[150px] max-w-[200px]">
                          <div className="flex flex-col gap-1">
                            {remainingCategories.map((category: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400 text-left"
                              >
                                {category}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* Cluster Section */}
        <div className="mt-2">
          {clusterInfo ? (() => {
            const clusterLabel = getSmartClusterLabel(clusterInfo);
            const clusterType = getClusterType(clusterInfo);
            const clusterDescription = getClusterDescription(clusterInfo);

            const tooltip = clusterType === 'unique'
              ? 'Independent businesses with no direct local competitors. Click to filter.'
              : clusterType === 'isolated'
              ? 'Geographically isolated businesses. Click to filter.'
              : 'Click to filter by this competitor group';

            // Character threshold for showing "read more"
            const CHAR_THRESHOLD = 100;
            const shouldTruncate = clusterDescription.length > CHAR_THRESHOLD;
            const truncatedDescription = shouldTruncate
              ? clusterDescription.slice(0, CHAR_THRESHOLD)
              : clusterDescription;

            return (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Group:</span>
                  <button
                    onClick={() => onClusterClick?.(clusterInfo.cluster_id)}
                    className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-colors cursor-pointer"
                    title={tooltip}
                  >
                    {clusterLabel}
                  </button>
                </div>
                {/* Cluster Description with read more */}
                <div className="text-xs text-muted-foreground">
                  {isDescriptionExpanded ? (
                    <>
                      {clusterDescription}
                      {shouldTruncate && (
                        <button
                          onClick={() => setIsDescriptionExpanded(false)}
                          className="ml-1 text-blue-400 hover:text-blue-300 cursor-pointer underline"
                        >
                          show less
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {truncatedDescription}
                      {shouldTruncate && (
                        <>
                          ...
                          <button
                            onClick={() => setIsDescriptionExpanded(true)}
                            className="ml-1 text-blue-400 hover:text-blue-300 cursor-pointer underline"
                          >
                            read more
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })() : (
            <div className="text-xs text-muted-foreground italic">
              No Competitor Group
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-slate-700/50" />

        {/* Action buttons */}
        <div className="space-y-2">
          {isMaggianosMyBusiness ? (
            <div className="px-3 py-2 rounded bg-yellow-500/10 border border-yellow-500/20">
              <p className="text-xs text-yellow-400 font-medium text-center">
                This is your primary business
              </p>
            </div>
          ) : isInComparison ? (
            <Button
              onClick={onRemoveFromComparison}
              variant="outline"
              size="sm"
              className="w-full"
            >
              <Check className="w-4 h-4 mr-2" />
              Remove from Comparison
            </Button>
          ) : (
            <Button
              onClick={onAddToComparison}
              disabled={!canAddMore}
              size="sm"
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              {canAddMore ? 'Add to Comparison' : 'Max 3 Comparisons'}
            </Button>
          )}

          {!canAddMore && !isInComparison && !isMaggianosMyBusiness && (
            <p className="text-[10px] text-muted-foreground text-center">
              Remove a comparison to add this business
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
