import { useMemo, memo } from 'react';
import { useQuery, useQueries } from '@tanstack/react-query';
import { useAppStore } from '../../stores/useAppStore';
import {
  Wine,
  Utensils,
  Wifi,
  Car,
  Users,
  Baby,
  Volume2,
  Clock,
  UtensilsCrossed,
  Check,
  X,
  Loader2,
  Settings,
  CreditCard,
} from 'lucide-react';
import { cn } from '../../lib/utils';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface BusinessDetails {
  business_id: string;
  name: string;
  stars: number;
  review_count: number;
  categories: string;
  attributes?: Record<string, any>;
  hours?: Record<string, string>;
}

async function fetchBusinessDetails(businessId: string): Promise<BusinessDetails> {
  const response = await fetch(`${API_BASE_URL}/api/businesses/${businessId}`);
  if (!response.ok) throw new Error('Failed to fetch business details');
  return response.json();
}

function useBusinessDetails(businessId: string | null) {
  return useQuery({
    queryKey: ['business-details', businessId],
    queryFn: () => fetchBusinessDetails(businessId!),
    enabled: !!businessId,
  });
}

// Helper function to get icon for attribute based on name
function getIconForAttribute(attrKey: string) {
  const lower = attrKey.toLowerCase();

  if (lower.includes('alcohol') || lower.includes('bar') || lower.includes('wine') || lower.includes('beer')) return Wine;
  if (lower.includes('outdoor') || lower.includes('seating') || lower.includes('patio')) return Utensils;
  if (lower.includes('wifi') || lower.includes('internet')) return Wifi;
  if (lower.includes('parking') || lower.includes('valet')) return Car;
  if (lower.includes('group') || lower.includes('wheelchair') || lower.includes('accessible')) return Users;
  if (lower.includes('kid') || lower.includes('child') || lower.includes('family')) return Baby;
  if (lower.includes('noise') || lower.includes('music') || lower.includes('loud')) return Volume2;
  if (lower.includes('reservation') || lower.includes('waitlist') || lower.includes('hour')) return Clock;
  if (lower.includes('delivery') || lower.includes('takeout') || lower.includes('take')) return UtensilsCrossed;
  if (lower.includes('credit') || lower.includes('card')) return CreditCard;

  return Settings;
}

// Helper function to format attribute key into readable label
function formatAttributeLabel(attrKey: string): string {
  return attrKey
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/Restaurants/gi, '')
    .replace(/Business/gi, '')
    .trim();
}

// Helper to check if value is truthy
function isTruthyValue(val: any): boolean {
  if (val === null || val === undefined) return false;

  if (typeof val === 'object' && !Array.isArray(val)) {
    return Object.values(val).some(v => {
      const strV = String(v).toLowerCase();
      return v === true || strV === 'true' || strV === '1' || v === 1;
    });
  }

  const strVal = String(val).toLowerCase().replace(/u'|'/g, '');
  return val === true || strVal === 'true' || strVal === '1' || val === 1;
}

// Smart value formatter
function formatAttributeValue(val: any): { display: string; type: 'boolean' | 'text' } {
  if (val === null || val === undefined) {
    return { display: 'N/A', type: 'text' };
  }

  if (typeof val === 'object' && !Array.isArray(val)) {
    const trueKeys = Object.entries(val)
      .filter(([_, v]) => {
        const strV = String(v).toLowerCase();
        return v === true || strV === 'true' || strV === '1' || v === 1;
      })
      .map(([k]) => k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()));

    if (trueKeys.length === 0) {
      return { display: 'false', type: 'boolean' };
    }

    return { display: trueKeys.join(', '), type: 'text' };
  }

  if (Array.isArray(val)) {
    return { display: val.join(', '), type: 'text' };
  }

  const strVal = String(val).toLowerCase().replace(/u'|'/g, '');

  if (val === true || strVal === 'true' || strVal === '1' || val === 1) {
    return { display: 'true', type: 'boolean' };
  }
  if (val === false || strVal === 'false' || strVal === '0' || val === 0 || strVal === 'none') {
    return { display: 'false', type: 'boolean' };
  }

  let cleanVal = String(val)
    .replace(/u'|'/g, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  return { display: cleanVal, type: 'text' };
}

const PriceDisplay = ({ level }: { level: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4].map((i) => (
      <span key={i} className={cn("text-xs font-bold", i <= level ? "text-emerald-400" : "text-muted-foreground/30")}>
        $
      </span>
    ))}
  </div>
);

const RatingDisplay = ({ rating, count }: { rating: number; count: number }) => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map(i => {
          if (i <= fullStars) {
            // Full star
            return (
              <svg key={i} className="w-3 h-3 fill-yellow-400" viewBox="0 0 20 20">
                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
              </svg>
            );
          } else if (i === fullStars + 1 && hasHalfStar) {
            // Half star
            return (
              <svg key={i} className="w-3 h-3" viewBox="0 0 20 20">
                <defs>
                  <linearGradient id={`half-${i}`}>
                    <stop offset="50%" stopColor="rgb(250 204 21)" />
                    <stop offset="50%" stopColor="rgb(113 113 122 / 0.2)" />
                  </linearGradient>
                </defs>
                <path fill={`url(#half-${i})`} d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
              </svg>
            );
          } else {
            // Empty star
            return (
              <svg key={i} className="w-3 h-3 fill-muted-foreground/20" viewBox="0 0 20 20">
                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
              </svg>
            );
          }
        })}
      </div>
      <span className="text-[9px] text-muted-foreground leading-none">{count.toLocaleString()} reviews</span>
    </div>
  );
};

const BooleanIcon = ({ value }: { value: boolean }) => {
  if (value) {
    return (
      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30">
        <Check size={12} strokeWidth={3} className="text-emerald-400" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center w-5 h-5 rounded-full border border-border/50">
      <X size={12} strokeWidth={3} className="text-muted-foreground/40" />
    </div>
  );
};

const CompactBadge = ({ text }: { text: string }) => {
  return (
    <span className="px-1.5 py-0.5 rounded text-[10px] border border-border/50 text-foreground/80 bg-muted/50 leading-tight whitespace-nowrap">
      {text}
    </span>
  );
};

function getPriceLevel(priceRange: any): number {
  if (!priceRange) return 2;
  const val = String(priceRange);
  if (val === '1') return 1;
  if (val === '2') return 2;
  if (val === '3') return 3;
  if (val === '4') return 4;
  return 2;
}

interface AttributeCellProps {
  value: any;
}

function AttributeCell({ value }: AttributeCellProps) {
  const formatted = formatAttributeValue(value);

  if (formatted.type === 'boolean') {
    return <BooleanIcon value={formatted.display === 'true'} />;
  }

  if (formatted.display === 'N/A') {
    return <span className="text-muted-foreground/40 text-[10px]">—</span>;
  }

  return <CompactBadge text={formatted.display} />;
}

interface BusinessAttributesComparisonProps {
  onBusinessHover?: (businessId: string | null) => void;
}

const BusinessAttributesComparisonComponent = ({ onBusinessHover }: BusinessAttributesComparisonProps = {}) => {
  // ✅ Atomic selectors - only re-render when these specific values change
  const primaryBusinessId = useAppStore((state) => state.primaryBusinessId);
  const comparisonIds = useAppStore((state) => state.comparisonIds);

  const primaryQuery = useBusinessDetails(primaryBusinessId);

  // FIXED: Use useQueries instead of mapping over hooks (Hook Rules violation)
  const comparisonQueries = useQueries({
    queries: comparisonIds.map((id) => ({
      queryKey: ['business-details', id],
      queryFn: () => fetchBusinessDetails(id),
      enabled: !!id,
    })),
  });

  // ✅ ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // Memoize businesses array, filtering out duplicates
  const businesses = useMemo(() => {
    if (!primaryQuery.data) return [];
    return [
      primaryQuery.data,
      ...comparisonQueries
        .map(q => q.data)
        .filter((b): b is BusinessDetails => b !== undefined)
        .filter(b => b.business_id !== primaryBusinessId), // Defensive: exclude primary from comparisons
    ] as BusinessDetails[];
  }, [primaryQuery.data, comparisonQueries, primaryBusinessId]);

  const MEANINGFUL_ATTRIBUTES = useMemo(() => [
    'Alcohol',
    'NoiseLevel',
    'WiFi',
    'BikeParking',
    'BusinessParking',
    'RestaurantsReservations',
    'RestaurantsDelivery',
    'RestaurantsTakeOut',
    'OutdoorSeating',
    'GoodForKids',
    'GoodForGroups',
    'WheelchairAccessible',
    'HasTV',
    'Caters',
    'GoodForDancing',
    'CoatCheck',
    'Smoking',
    'BYOB',
    'Corkage',
    'BYOBCorkage',
    'HappyHour',
    'DogsAllowed',
    'DriveThru',
    'RestaurantsTableService',
    'RestaurantsCounterService',
    'RestaurantsGoodForGroups',
    'Ambience',
    'GoodForMeal',
    'BusinessAcceptsCreditCards',
    'Music',
    'BestNights',
  ], []);

  // Memoize expensive attribute processing
  const attributeKeys = useMemo(() => {
    const allAttributes = new Set<string>();
    businesses.forEach(business => {
      if (business.attributes) {
        Object.keys(business.attributes).forEach(key => {
          if (MEANINGFUL_ATTRIBUTES.includes(key)) {
            const value = business.attributes?.[key];
            if (isTruthyValue(value)) {
              allAttributes.add(key);
            }
          }
        });
      }
    });
    return Array.from(allAttributes).sort();
  }, [businesses, MEANINGFUL_ATTRIBUTES]);

  // NOW we can do conditional rendering after all hooks are called
  const isLoading = primaryQuery.isLoading || comparisonQueries.some(q => q.isLoading);
  const hasError = primaryQuery.isError || comparisonQueries.some(q => q.isError);

  if (isLoading) {
    return (
      <div className="glass rounded-lg p-6 h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading business attributes...</p>
        </div>
      </div>
    );
  }

  if (hasError || !primaryQuery.data) {
    return (
      <div className="glass rounded-lg p-6 h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Unable to load business attributes</p>
      </div>
    );
  }

  if (attributeKeys.length === 0) {
    return (
      <div className="glass rounded-lg p-6 h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No attribute data available for selected businesses</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-lg p-0.5 pb-1 h-full flex flex-col">
      <div className="flex items-center justify-between mb-0.5 px-1">
        <h2 className="text-sm font-semibold">Business Attributes</h2>
        <span className="text-[11px] text-muted-foreground">Feature Comparison</span>
      </div>

      <div className="flex-1 -mx-0.5 px-.5 overflow-hidden">
        <div className="w-full h-full flex flex-col">
          {/* Header Row - Features as columns */}
          <div
            className="grid divide-x divide-border/40 bg-card/50 border-b border-border/40"
            style={{ gridTemplateColumns: `160px repeat(${attributeKeys.length}, 1fr)` }}
          >
            <div className="p-1 flex items-end pb-0.5">
              <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">Business</span>
            </div>
            {attributeKeys.map((attrKey) => {
              const Icon = getIconForAttribute(attrKey);
              const label = formatAttributeLabel(attrKey);
              return (
                <div key={attrKey} className="p-1 flex flex-col items-center gap-0.5 min-w-0">
                  <Icon size={10} className="text-muted-foreground flex-shrink-0" />
                  <span className="text-[11px] font-medium text-foreground/80 text-center leading-tight truncate w-full" title={label}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Business Rows */}
          <div className="divide-y divide-border/30 border-b border-border/40 flex-1 flex flex-col">
            {businesses.map((biz, bizIndex) => (
              <div
                key={biz.business_id}
                className={cn(
                  "grid divide-x divide-border/40 hover:bg-muted/20 transition-colors flex-1",
                  bizIndex === 0 && "bg-card/30"
                )}
                style={{ gridTemplateColumns: `160px repeat(${attributeKeys.length}, 1fr)` }}
                onMouseEnter={() => onBusinessHover?.(biz.name)}
                onMouseLeave={() => onBusinessHover?.(null)}
              >
                {/* Business name column with metrics */}
                <div className={cn(
                  "flex flex-col min-w-0 justify-center",
                  businesses.length <= 2 ? "p-1.5 gap-1" : "p-1 gap-0.5"
                )}>
                  <div className="flex flex-col gap-0.5">
                    <h3 className={cn(
                      "font-bold text-foreground leading-tight truncate",
                      businesses.length <= 2 ? "text-sm" : "text-xs"
                    )} title={biz.name}>
                      {biz.name}
                    </h3>
                    <span className="text-[11px] text-muted-foreground truncate">{biz.categories.split(',')[0]}</span>
                  </div>
                  <div className="flex items-center gap-2 justify-between">
                    <RatingDisplay rating={biz.stars} count={biz.review_count} />
                    <PriceDisplay level={getPriceLevel(biz.attributes?.RestaurantsPriceRange2)} />
                  </div>
                </div>

                {/* Attribute value columns */}
                {attributeKeys.map((attrKey) => {
                  const value = biz.attributes?.[attrKey];
                  return (
                    <div key={`${biz.business_id}-${attrKey}`} className={cn(
                      "flex justify-center items-center min-w-0",
                      businesses.length <= 2 ? "p-1" : "p-0.5"
                    )}>
                      <AttributeCell value={value} />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Memoized export
export const BusinessAttributesComparison = memo(BusinessAttributesComparisonComponent);
