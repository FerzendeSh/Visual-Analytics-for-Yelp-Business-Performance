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

export function ControlTower() {
  // ✅ Atomic selectors - only re-render when these specific values change
  const viewMode = useAppStore((state) => state.viewMode);
  const filters = useAppStore((state) => state.filters);
  const benchmarks = useAppStore((state) => state.benchmarks);
  const updateFilters = useAppStore((state) => state.updateFilters);
  const toggleBenchmark = useAppStore((state) => state.toggleBenchmark);
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

      {/* SCAN MODE: Status & Rating Filters */}
      {viewMode === 'SCAN' && (
        <>
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
        </>
      )}

      {/* COMPARE MODE: Time Range & Granularity */}
      {viewMode === 'COMPARE' && (
        <>
          {/* Time Range */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Time Range</label>
            <ToggleGroup
              value={filters.timeRange}
              onValueChange={(value) =>
                updateFilters({ timeRange: value as '1Y' | '5Y' })
              }
              options={[
                { value: '1Y', label: '1Y' },
                { value: '5Y', label: '5Y' },
              ]}
              className="w-full"
            />
          </div>

          {/* Granularity */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Granularity</label>
            <ToggleGroup
              value={filters.granularity}
              onValueChange={(value) =>
                updateFilters({ granularity: value as 'MONTHLY' | 'YEARLY' })
              }
              options={[
                { value: 'MONTHLY', label: 'Monthly' },
                { value: 'YEARLY', label: 'Yearly' },
              ]}
              className="w-full"
            />
          </div>
        </>
      )}

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
          options={neighborhoods?.map(n => ({ value: n, label: n })) || []}
          placeholder="Select neighborhood"
          searchPlaceholder="Search neighborhoods..."
          emptyText="No neighborhoods found"
          disabled={!selectedCity || (neighborhoods?.length === 0)}
        />
      </div>

      {/* COMPARE MODE ONLY: Benchmarks */}
      {viewMode === 'COMPARE' && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Benchmarks</label>
          <div className="space-y-1.5">
            <Checkbox
              checked={benchmarks.showCityAvg}
              onCheckedChange={() => toggleBenchmark('showCityAvg')}
              label="City Average"
            />
            <Checkbox
              checked={benchmarks.showNeighborhoodAvg}
              onCheckedChange={() => toggleBenchmark('showNeighborhoodAvg')}
              label="Neighborhood Average"
            />
            <Checkbox
              checked={benchmarks.showCategoryAvg}
              onCheckedChange={() => toggleBenchmark('showCategoryAvg')}
              label="Category Average"
            />
          </div>
        </div>
      )}
    </div>
  );
}
