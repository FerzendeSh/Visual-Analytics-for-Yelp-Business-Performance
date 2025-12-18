import { DeckMap } from './DeckMap';
import { CompetitivePositioningChart } from '../comparison/CompetitivePositioningChart';
import { useCompetitiveSnapshot } from '../../hooks/useComparisonData';
import { useAppStore } from '../../stores/useAppStore';
import { Loader2 } from 'lucide-react';

export function ScannerMode() {
  // Always call the hook - let it handle the enabled state internally
  const competitiveSnapshot = useCompetitiveSnapshot();

  return (
    <div className="w-full h-full flex gap-4 p-4">
      {/* Map - Takes 60% width */}
      <div className="flex-[6] h-full">
        <DeckMap />
      </div>

      {/* Competitive Positioning Chart - Takes 40% width */}
      <div className="flex-[4] h-full">
        {competitiveSnapshot.isLoading ? (
          <div className="glass rounded-lg h-full flex items-center justify-center">
            <div className="flex flex-col items-center justify-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Loading competitive data...</p>
            </div>
          </div>
        ) : competitiveSnapshot.data ? (
          <CompetitivePositioningChart snapshotData={competitiveSnapshot.data} />
        ) : (
          <div className="glass rounded-lg h-full flex items-center justify-center">
            <div className="flex flex-col items-center justify-center space-y-2 text-center p-6">
              <p className="text-muted-foreground text-sm">No competitive data available</p>
              <p className="text-muted-foreground text-xs opacity-70">Select a city and category to view market positioning</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
