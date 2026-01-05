import { memo } from 'react';
import { Search, Plus, Minus, Compass, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetNorth: () => void;
  onSearchToggle: () => void;
  onGoToMyBusiness?: () => void;
  isSearchOpen: boolean;
  currentZoom: number;
}

const MapControlsComponent = ({
  onZoomIn,
  onZoomOut,
  onResetNorth,
  onSearchToggle,
  onGoToMyBusiness,
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

      {/* Go to My Business Button */}
      {onGoToMyBusiness && (
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            onClick={onGoToMyBusiness}
            variant="ghost"
            size="icon"
            className="glass"
            title="Go to Maggiano's (My Business)"
          >
            <Home className="h-5 w-5" />
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
      <div className="glass h-9.5 w-9 flex items-center justify-center text-[11px] font-mono text-slate-300 rounded-md">
        {currentZoom.toFixed(1)}
      </div>
    </div>
  );
};

// Memoized export
export const MapControls = memo(MapControlsComponent);
