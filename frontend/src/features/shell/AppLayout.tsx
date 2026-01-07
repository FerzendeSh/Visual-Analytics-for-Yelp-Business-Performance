import React from 'react';
import { Scan, GitCompare, Sliders } from 'lucide-react';
import { useAppStore, ViewMode } from '@/stores/useAppStore';
import { Button } from '@/components/ui/button';
import { Popover } from '@/components/ui/popover';
import { ControlTower } from './ControlTower';

interface AppLayoutProps {
  children: React.ReactNode;
}

const modes: { id: ViewMode; label: string; icon: typeof Scan }[] = [
  { id: 'SCAN', label: 'SCAN', icon: Scan },
  { id: 'COMPARE', label: 'COMPARE', icon: GitCompare },
];

export function AppLayout({ children }: AppLayoutProps) {
  // ✅ Atomic selectors - only re-render when these specific values change
  const viewMode = useAppStore((state) => state.viewMode);
  const setMode = useAppStore((state) => state.setMode);
  const filters = useAppStore((state) => state.filters);
  const [controlTowerOpen, setControlTowerOpen] = React.useState(false);

  // Count active filters
  const activeFilterCount = React.useMemo(() => {
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
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Navigation Tabs - Top */}
      <div className="absolute top-0 left-0 right-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-sm">
        <div className="flex items-center justify-center h-14 relative">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isActive = viewMode === mode.id;

            return (
              <button
                key={mode.id}
                onClick={() => setMode(mode.id)}
                className={`
                  relative flex items-center gap-2 px-8 h-full
                  text-sm font-semibold transition-all cursor-pointer
                  ${isActive
                    ? 'text-white bg-primary/30'
                    : 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/20'}
                `}
              >
                <Icon className="h-4 w-4" />
                <span>{mode.label}</span>
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 z-10" />
                )}
              </button>
            );
          })}

          {/* Control Tower (Settings) - Top Right */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Popover
              open={controlTowerOpen}
              onOpenChange={setControlTowerOpen}
              content={<ControlTower />}
            >
              <Button variant="ghost" size="icon" className="glass relative">
                <Sliders className="h-5 w-5" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex items-center justify-center w-5 h-5 text-xs font-bold bg-blue-500 text-white rounded-full border-2 border-slate-950">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </Popover>
          </div>
        </div>
      </div>

      {/* Main Content Canvas */}
      <div className="w-full h-full">
        {children}
      </div>
    </div>
  );
}
