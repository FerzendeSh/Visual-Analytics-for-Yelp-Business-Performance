/**
 * Map Layer Switcher - Toggle between Market Positioning and Competitive Landscape views
 * Positioned at bottom-left of the map
 */
import { useAppStore, MapColorMode } from '@/stores/useAppStore';
import { Target, Network } from 'lucide-react';
import { motion } from 'framer-motion';

export function MapLayerSwitcher() {
  const mapColorMode = useAppStore((state) => state.mapColorMode);
  const setMapColorMode = useAppStore((state) => state.setMapColorMode);

  const modes: Array<{ value: MapColorMode; label: string; icon: typeof Target }> = [
    { value: 'MARKET_POSITIONING', label: 'Market Positioning', icon: Target },
    { value: 'COMPETITIVE_LANDSCAPE', label: 'Competitive Landscape', icon: Network },
  ];

  return (
    <motion.div
      className="absolute bottom-6 left-6 z-30 glass rounded-lg p-1.5 shadow-lg"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex flex-col gap-1">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = mapColorMode === mode.value;

          return (
            <motion.button
              key={mode.value}
              onClick={() => setMapColorMode(mode.value)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium
                transition-all duration-200
                ${
                  isActive
                    ? 'bg-primary/30 text-white shadow-sm'
                    : 'text-muted-foreground/80 hover:bg-white/5 hover:text-white/90'
                }
              `}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              title={mode.label}
            >
              <Icon className="h-4 w-4" />
              <span className="whitespace-nowrap">{mode.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Help text */}
      <div className="mt-2 px-3 py-1.5 border-t border-white/10">
        <p className="text-[10px] text-muted-foreground/60 leading-tight">
          {mapColorMode === 'MARKET_POSITIONING'
            ? 'Businesses colored by performance quadrant'
            : 'Businesses colored by competitor group'}
        </p>
      </div>
    </motion.div>
  );
}
