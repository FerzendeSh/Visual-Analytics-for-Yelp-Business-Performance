import { useAppStore } from '@/stores/useAppStore';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useState, useMemo } from 'react';
import * as React from 'react';
import { format } from 'date-fns';

export function ControlTower() {
  // ✅ Atomic selectors - only re-render when these specific values change
  const viewMode = useAppStore((state) => state.viewMode);
  const filters = useAppStore((state) => state.filters);
  const benchmarks = useAppStore((state) => state.benchmarks);
  const comparisonIds = useAppStore((state) => state.comparisonIds);
  const updateFilters = useAppStore((state) => state.updateFilters);
  const toggleBenchmark = useAppStore((state) => state.toggleBenchmark);
  const toggleComparison = useAppStore((state) => state.toggleComparison);
  const resetFilters = useAppStore((state) => state.resetFilters);

  // Initialize local state from global filters
  const [selectedCity, setSelectedCity] = useState<string | null>(
    filters.cityId?.split('_')[0] || null
  );

  // Fetch all states first
  const { data: states } = useQuery({
    queryKey: ['states'],
    queryFn: () => api.locations.getStates(),
  });

  // Fetch all cities from all states
  const { data: allCitiesData } = useQuery({
    queryKey: ['allCities', states],
    queryFn: async () => {
      if (!states) return [];

      // Fetch cities for each state in parallel
      const citiesPromises = states.map(async (state) => {
        try {
          const cities = await api.locations.getCities({ state });
          return cities.map(city => ({
            city,
            state,
            id: `${city}_${state}` // Create unique ID
          }));
        } catch (error) {
          console.error(`Failed to fetch cities for ${state}:`, error);
          return [];
        }
      });

      const citiesArrays = await Promise.all(citiesPromises);
      return citiesArrays.flat();
    },
    enabled: !!states && states.length > 0,
  });

  // Transform for Combobox: {value: "City_STATE", label: "City, ST"}
  const cities = React.useMemo(() => {
    if (!allCitiesData) return [];
    return allCitiesData.map(item => ({
      value: item.id,
      label: `${item.city}, ${item.state}`
    }));
  }, [allCitiesData]);

  // Fetch neighborhoods based on selected city
  const { data: neighborhoods } = useQuery({
    queryKey: ['neighborhoods', selectedCity],
    queryFn: () => {
      // Extract state from cityId format: "city_state"
      const state = filters.cityId?.split('_')[1];
      return api.locations.getNeighborhoods({
        state: state!,
        city: selectedCity!
      });
    },
    enabled: !!selectedCity && !!filters.cityId,
  });

  const handleCityChange = (cityValue: string) => {
    if (!cityValue) {
      setSelectedCity(null);
      updateFilters({ cityId: null, neighborhoodId: null });
      return;
    }

    // Extract city name from cityId format: "City_State"
    const cityName = cityValue.split('_')[0];
    setSelectedCity(cityName);
    updateFilters({ cityId: cityValue, neighborhoodId: null });
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status !== 'ALL') count++;
    if (filters.ratingRange[0] !== 1.0 || filters.ratingRange[1] !== 5.0) count++;
    if (filters.cityId) count++;
    if (filters.neighborhoodId) count++;
    if (filters.categories.length > 0) count++;
    if (viewMode === 'COMPARE') {
      if (filters.timeRange !== '5Y') count++;
      if (filters.granularity !== 'MONTHLY') count++;
    }
    return count;
  }, [filters, viewMode]);

  return (
    <div className="space-y-4 min-w-[320px]">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Filters</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            resetFilters();
            setSelectedCity(null);
          }}
          className="text-xs h-7"
        >
          Reset
        </Button>
      </div>

      {/* City Filter with Search */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">City</label>
        <Combobox
          value={filters.cityId || ''}
          onChange={handleCityChange}
          options={cities || []}
          placeholder="Select city"
          searchPlaceholder="Search cities..."
          emptyText="No cities found"
        />
      </div>

      {/* Neighborhood Filter with Search */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Neighborhood</label>
        <Combobox
          value={filters.neighborhoodId || ''}
          onChange={(value) => updateFilters({ neighborhoodId: value || null })}
          options={[
            { value: '', label: 'All Neighborhoods' },
            ...(neighborhoods?.map(n => ({ value: n, label: n })) || [])
          ]}
          placeholder="Select neighborhood"
          searchPlaceholder="Search neighborhoods..."
          emptyText="No neighborhoods found"
          disabled={!selectedCity}
        />
      </div>

      {/* SCAN MODE: Rating Filter */}
      {viewMode === 'SCAN' && (
        <>
          {/* Rating Range */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Rating</label>
              <span className="text-xs text-muted-foreground">
                {filters.ratingRange[0].toFixed(1)} - {filters.ratingRange[1].toFixed(1)} ⭐
              </span>
            </div>
            <Slider
              min={1.0}
              max={5.0}
              step={0.1}
              value={filters.ratingRange}
              onValueChange={(value) => updateFilters({ ratingRange: value })}
            />
          </div>

          {/* Status Filter */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select
              value={filters.status}
              onChange={(e) =>
                updateFilters({ status: e.target.value as 'ALL' | 'OPEN' | 'CLOSED' })
              }
              options={[
                { value: 'ALL', label: 'All' },
                { value: 'OPEN', label: 'Open' },
                { value: 'CLOSED', label: 'Closed' },
              ]}
            />
          </div>
        </>
      )}

      {/* COMPARE MODE ONLY: Selected Comparison Businesses */}
      {viewMode === 'COMPARE' && comparisonIds.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border/40">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">
              Comparing
            </label>
            <span className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded-full">
              {comparisonIds.length}
            </span>
          </div>
          <div className="space-y-2">
            {comparisonIds.map((id) => (
              <ComparisonBusinessItem key={id} businessId={id} onRemove={() => toggleComparison(id)} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// Component to display a single comparison business
function ComparisonBusinessItem({ businessId, onRemove }: { businessId: string; onRemove: () => void }) {
  const { data: business, isLoading } = useQuery({
    queryKey: ['business-details', businessId],
    queryFn: () => api.businesses.getById(businessId),
  });

  if (isLoading) {
    return (
      <div className="glass rounded-lg p-2.5 border border-border/40">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/20 animate-pulse" />
          <span className="text-[11px] text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  if (!business) {
    return null;
  }

  return (
    <div className="glass rounded-lg p-2.5 border border-border/40 hover:border-border/60 transition-all group relative">
      <div className="flex items-start gap-2 pr-6">
        {/* Color indicator dot */}
        <div className="h-2 w-2 rounded-full bg-primary/60 mt-1 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-foreground truncate leading-tight">
            {business.name}
          </p>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
            {business.city}, {business.state}
          </p>
        </div>

        {/* Remove button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
          title="Remove from comparison"
        >
          <span className="text-sm leading-none">×</span>
        </Button>
      </div>
    </div>
  );
}
