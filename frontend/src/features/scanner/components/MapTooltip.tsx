/**
 * Map hover tooltip component.
 * Displays business information when hovering over markers.
 */
import { Business } from '@/lib/api';

interface MapTooltipProps {
  business: Business | null;
}

export function MapTooltip({ business }: MapTooltipProps) {
  if (!business) return null;

  const isOpen = business.is_open === 1;

  return (
    <div className="absolute bottom-20 left-4 glass p-3 rounded-lg max-w-xs">
      <div className="space-y-1">
        <h4 className="font-semibold text-sm">{business.name}</h4>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
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
        <p className="text-xs text-muted-foreground">
          {business.neighborhood || business.city}
        </p>
      </div>
    </div>
  );
}
