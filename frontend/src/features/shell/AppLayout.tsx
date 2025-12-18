import React from 'react';
import { motion } from 'framer-motion';
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
      {/* Control Tower (Settings) - Top Left */}
      <div className="absolute top-6 left-6 z-30">
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

      {/* Main Content Canvas */}
      <div className="w-full h-full">
        {children}
      </div>

      {/* Navigation Dock - Bottom Center */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30">
        <div className="flex items-center gap-2 px-3 py-2 rounded-full glass shadow-2xl">
          {modes.map((mode) => {
            const Icon = mode.icon;
            const isActive = viewMode === mode.id;

            return (
              <motion.button
                key={mode.id}
                onClick={() => setMode(mode.id)}
                className={`
                  relative flex items-center gap-2 px-4 py-2 rounded-full
                  text-sm font-medium transition-colors
                  ${isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'}
                `}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeMode"
                    className="absolute inset-0 bg-primary rounded-full"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <Icon className="relative h-4 w-4" />
                <span className="relative">{mode.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
