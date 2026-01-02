/**
 * Map click popup component.
 * Displays business details with action buttons when clicking on markers.
 */
import { Business } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { X, Plus, Check } from 'lucide-react';
import { MAGGIANOS_TAMPA_BUSINESS_ID } from '@/stores/useAppStore';

interface MapClickPopupProps {
  business: Business | null;
  isInComparison: boolean;
  canAddMore: boolean;
  onAddToComparison: () => void;
  onRemoveFromComparison: () => void;
  onClose: () => void;
}

export function MapClickPopup({
  business,
  isInComparison,
  canAddMore,
  onAddToComparison,
  onRemoveFromComparison,
  onClose,
}: MapClickPopupProps) {
  if (!business) return null;

  const isOpen = business.is_open === 1;
  const isMaggianosMyBusiness = business.business_id === MAGGIANOS_TAMPA_BUSINESS_ID;

  return (
    <div
      className="absolute bottom-20 left-4 glass p-4 rounded-lg max-w-sm shadow-xl border border-slate-700/50 z-40"
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
              ⭐ {business.stars.toFixed(1)} • {business.review_count} reviews
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
        </div>

        {/* Location info */}
        <div className="text-xs text-muted-foreground space-y-0.5">
          {business.address && <p>{business.address}</p>}
          <p>{business.neighborhood || business.city}, {business.state}</p>
        </div>

        {/* Categories */}
        {business.categories && Array.isArray(business.categories) && business.categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {business.categories.slice(0, 3).map((category, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 rounded text-[10px] bg-blue-500/10 text-blue-400"
              >
                {category}
              </span>
            ))}
            {business.categories.length > 3 && (
              <span className="px-2 py-0.5 rounded text-[10px] text-muted-foreground">
                +{business.categories.length - 3} more
              </span>
            )}
          </div>
        )}

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
