import { lazy, Suspense, memo } from 'react';
import { useCompetitiveSnapshot } from '../../hooks/useComparisonData';
import { useAppStore } from '../../stores/useAppStore';
import { MapErrorBoundary, ChartErrorBoundary } from '../../components/common/ErrorBoundary';
import { Loader2 } from 'lucide-react';
import { ScannerMetricsCards } from './ScannerMetricsCards';

// Lazy load heavy map and chart components
// DeckMap is 748 lines with WebGL deck.gl visualization
const DeckMap = lazy(() => import('./DeckMap').then(m => ({ default: m.DeckMap })));
const CompetitivePositioningChart = lazy(() => import('../comparison/CompetitivePositioningChart').then(m => ({ default: m.CompetitivePositioningChart })));

const ScannerModeComponent = () => {
  // Always call the hook - let it handle the enabled state internally
  const competitiveSnapshot = useCompetitiveSnapshot();
  const filters = useAppStore((state) => state.filters);

  return (
    <div className="w-full h-full flex flex-col gap-4 p-4">
      {/* Business Metrics Cards */}
      <ScannerMetricsCards />

      {/* Main Content Area */}
      <div className="flex-1 flex gap-4 min-h-0">
        {/* Map - Takes 60% width */}
        <MapErrorBoundary resetKeys={[filters.cityId, filters.neighborhoodId]}>
          <div className="flex-[6] h-full">
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center bg-background rounded-lg">
                  <div className="flex flex-col items-center space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground text-sm">Loading map...</p>
                  </div>
                </div>
              }
            >
              <DeckMap />
            </Suspense>
          </div>
        </MapErrorBoundary>

        {/* Competitive Positioning Chart - Takes 40% width */}
        <ChartErrorBoundary chartName="Competitive Positioning" resetKeys={[filters.cityId, filters.categories]}>
          <div className="flex-[4] h-full">
            {competitiveSnapshot.isLoading ? (
              <div className="glass rounded-lg h-full flex items-center justify-center">
                <div className="flex flex-col items-center justify-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-muted-foreground text-sm">Loading competitive data...</p>
                </div>
              </div>
            ) : competitiveSnapshot.data ? (
              <Suspense
                fallback={
                  <div className="glass rounded-lg h-full flex items-center justify-center">
                    <div className="flex flex-col items-center space-y-3">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      <p className="text-muted-foreground text-xs">Loading chart...</p>
                    </div>
                  </div>
                }
              >
                <CompetitivePositioningChart snapshotData={competitiveSnapshot.data} />
              </Suspense>
            ) : (
              <div className="glass rounded-lg h-full flex items-center justify-center">
                <div className="flex flex-col items-center justify-center space-y-2 text-center p-6">
                  <p className="text-muted-foreground text-sm">No competitive data available</p>
                  <p className="text-muted-foreground text-xs opacity-70">Select a city and category to view market positioning</p>
                </div>
              </div>
            )}
          </div>
        </ChartErrorBoundary>
      </div>
    </div>
  );
};

// Memoized export
export const ScannerMode = memo(ScannerModeComponent);
