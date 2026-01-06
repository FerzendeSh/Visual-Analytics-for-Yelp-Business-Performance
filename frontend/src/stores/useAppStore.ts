import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ViewMode = 'SCAN' | 'COMPARE';
export type MapColorMode = 'MARKET_POSITIONING' | 'COMPETITIVE_LANDSCAPE';

// Hardcoded business: Maggiano's Little Italy - Tampa, FL
export const MAGGIANOS_TAMPA_BUSINESS_ID = 'RiC_-68qxtDJqiIs5mRR6g';
export const MAGGIANOS_TAMPA_CITY_ID = 'Tampa_FL';

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
  highlightedBusinessId: string | null; // For map-scatter plot bidirectional linking
  clickedBusinessId: string | null; // For opening map popup from scatter plot

  // Cluster Context
  mapColorMode: MapColorMode; // Map visualization mode
  selectedClusterId: number | null; // Currently selected cluster for details
  clusterFilter: number | null; // When set, filter map to show only businesses in this cluster

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
    timeRange: '1Y' | '5Y' | 'CUSTOM';
    customDateRange: { start: string; end: string } | null; // Format: 'YYYY-MM-DD'
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
  setHighlightedBusiness: (id: string | null) => void;
  setClickedBusiness: (id: string | null) => void;
  resetFilters: () => void;

  // Cluster Actions
  setMapColorMode: (mode: MapColorMode) => void;
  setSelectedCluster: (id: number | null) => void;
  setClusterFilter: (id: number | null) => void;
}

const initialFilters: AppState['filters'] = {
  cityId: MAGGIANOS_TAMPA_CITY_ID,
  neighborhoodId: null,
  categories: [],
  status: 'ALL',
  ratingRange: [1.0, 5.0],
  timeRange: '5Y',
  customDateRange: null,
  granularity: 'YEARLY',
};

const initialMapViewState: MapViewState = {
  longitude: -82.526348, // Tampa, FL (Maggiano's exact location)
  latitude: 27.946453,
  zoom: 15.1, // Focused zoom on Maggiano's business showing nearby area
  pitch: 0,
  bearing: 0,
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Initial state
      viewMode: 'SCAN',
      mapViewState: initialMapViewState,
      primaryBusinessId: MAGGIANOS_TAMPA_BUSINESS_ID,
      comparisonIds: [],
      selectedKeyword: null,
      highlightedBusinessId: null,
      clickedBusinessId: null,

      // Cluster state
      mapColorMode: 'MARKET_POSITIONING',
      selectedClusterId: null,
      clusterFilter: null,

      benchmarks: {
        showCityAvg: false,
        showNeighborhoodAvg: false,
        showCategoryAvg: false,
      },

      filters: initialFilters,

      // Actions
      setMode: (mode) => set({ viewMode: mode }),

      setMapViewState: (viewState) => set({ mapViewState: viewState }),

      // Primary business is hardcoded to Maggiano's - no changes allowed
      setPrimaryBusiness: (_id) => {
        // Do nothing - primary business is fixed
        console.warn('Primary business is hardcoded to Maggiano\'s Little Italy and cannot be changed');
      },

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

      setHighlightedBusiness: (id) => set({ highlightedBusinessId: id }),

      setClickedBusiness: (id) => set({ clickedBusinessId: id }),

      resetFilters: () => set({ filters: initialFilters }),

      // Cluster actions
      setMapColorMode: (mode) => set({ mapColorMode: mode }),

      setSelectedCluster: (id) => set({ selectedClusterId: id }),

      setClusterFilter: (id) => set({ clusterFilter: id }),
    }),
    {
      name: 'yelp-analytics-storage',
      version: 4, // Incremented to force reset to Maggiano's default location
      partialize: (state) => ({
        primaryBusinessId: state.primaryBusinessId,
        comparisonIds: state.comparisonIds,
        mapViewState: state.mapViewState,
        filters: state.filters,
      }),
    }
  )
);
