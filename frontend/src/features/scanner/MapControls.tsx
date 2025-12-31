import { memo } from 'react';
import { Search, Plus, Minus, Compass, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetNorth: () => void;
  onSearchToggle: () => void;
  onSetFilterToView?: () => void;
  isSearchOpen: boolean;
  currentZoom: number;
}

const MapControlsComponent = ({
  onZoomIn,
  onZoomOut,
  onResetNorth,
  onSearchToggle,
  onSetFilterToView,
  isSearchOpen,
  currentZoom,
}: MapControlsProps) => {
  return (
    <div className="absolute top-6 right-6 z-30 flex flex-col gap-2">
      {/* Search Toggle Button */}
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button
          onClick={onSearchToggle}
          variant={isSearchOpen ? 'default' : 'ghost'}
          size="icon"
          className="glass"
          title="Search businesses"
        >
          <Search className="h-5 w-5" />
        </Button>
      </motion.div>

      {/* Set Filter to View Button */}
      {onSetFilterToView && (
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={onSetFilterToView}
            variant="ghost"
            size="icon"
            className="glass"
            title="Set filter to current view"
          >
            <MapPin className="h-5 w-5" />
          </Button>
        </motion.div>
      )}

      {/* Divider */}
      <div className="h-px bg-slate-700 mx-2" />

      {/* Zoom Controls */}
      <div className="flex flex-col gap-1">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={onZoomIn}
            variant="ghost"
            size="icon"
            className="glass"
            title="Zoom in (+)"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </motion.div>

        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={onZoomOut}
            variant="ghost"
            size="icon"
            className="glass"
            title="Zoom out (-)"
          >
            <Minus className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-700 mx-2" />

      {/* Compass / Align North */}
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button
          onClick={onResetNorth}
          variant="ghost"
          size="icon"
          className="glass"
          title="Align north"
        >
          <Compass className="h-5 w-5" />
        </Button>
      </motion.div>

      {/* Divider */}
      <div className="h-px bg-slate-700 mx-2" />

      {/* Zoom Level Display */}
      <div className="glass px-2 py-1 text-xs font-mono text-center text-slate-300 min-w-[40px]">
        {currentZoom.toFixed(1)}
      </div>
    </div>
  );
};

// Memoized export
export const MapControls = memo(MapControlsComponent);
