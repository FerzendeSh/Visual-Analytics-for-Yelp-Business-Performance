import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewMode = 'SCAN' | 'COMPARE';

export interface MapViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
  transitionDuration?: number;
  transitionInterpolator?: any;
}

export interface AppState {
  // Navigation
  viewMode: ViewMode;

  // Map View State (Persistent across tab switches)
  mapViewState: MapViewState;

  // Selection Context
  primaryBusinessId: string | null;
  comparisonIds: string[]; // Supports multiple competitors
  selectedKeyword: string | null; // For Keyword Chart interaction

  // Benchmarking
  benchmarks: {
    showCityAvg: boolean;
    showNeighborhoodAvg: boolean;
    showCategoryAvg: boolean;
  };

  // Deep Filters
  filters: {
    cityId: string | null;
    neighborhoodId: string | null;
    categories: string[];
    status: 'ALL' | 'OPEN' | 'CLOSED';
    ratingRange: [number, number];
    timeRange: '1Y' | '5Y';
    granularity: 'MONTHLY' | 'YEARLY';
  };

  // Actions
  setMode: (mode: ViewMode) => void;
  setMapViewState: (viewState: MapViewState) => void;
  setPrimaryBusiness: (id: string | null) => void;
  toggleComparison: (id: string) => void;
  clearComparisons: () => void;
  toggleBenchmark: (type: keyof AppState['benchmarks']) => void;
  updateFilters: (partial: Partial<AppState['filters']>) => void;
  setKeyword: (keyword: string | null) => void;
  resetFilters: () => void;
}

const initialFilters: AppState['filters'] = {
  cityId: null,
  neighborhoodId: null,
  categories: [],
  status: 'ALL',
  ratingRange: [1.0, 5.0],
  timeRange: '5Y',
  granularity: 'MONTHLY',
};

const initialMapViewState: MapViewState = {
  longitude: -86.7816, // Nashville, TN
  latitude: 36.1627,
  zoom: 11,
  pitch: 0,
  bearing: 0,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      viewMode: 'SCAN',
      mapViewState: initialMapViewState,
      primaryBusinessId: null,
      comparisonIds: [],
      selectedKeyword: null,

      benchmarks: {
        showCityAvg: false,
        showNeighborhoodAvg: false,
        showCategoryAvg: false,
      },

      filters: initialFilters,

      // Actions
      setMode: (mode) => set({ viewMode: mode }),

      setMapViewState: (viewState) => set({ mapViewState: viewState }),

      setPrimaryBusiness: (id) => set({ primaryBusinessId: id }),

      toggleComparison: (id) => set((state) => {
        const isSelected = state.comparisonIds.includes(id);
        return {
          comparisonIds: isSelected
            ? state.comparisonIds.filter((cid) => cid !== id)
            : [...state.comparisonIds, id],
        };
      }),

      clearComparisons: () => set({ comparisonIds: [] }),

      toggleBenchmark: (type) => set((state) => ({
        benchmarks: {
          ...state.benchmarks,
          [type]: !state.benchmarks[type],
        },
      })),

      updateFilters: (partial) => set((state) => ({
        filters: {
          ...state.filters,
          ...partial,
        },
      })),

      setKeyword: (keyword) => set({ selectedKeyword: keyword }),

      resetFilters: () => set({ filters: initialFilters }),
    }),
    {
      name: 'yelp-analytics-storage',
      partialize: (state) => ({
        primaryBusinessId: state.primaryBusinessId,
        comparisonIds: state.comparisonIds,
        mapViewState: state.mapViewState,
        filters: state.filters,
      }),
    }
  )
);
