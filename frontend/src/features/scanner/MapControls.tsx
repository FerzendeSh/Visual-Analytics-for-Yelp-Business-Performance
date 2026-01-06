import { memo } from 'react';
import { Plus, Minus, Compass, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetNorth: () => void;
  onGoToMyBusiness?: () => void;
  currentZoom: number;
}

const MapControlsComponent = ({
  onZoomIn,
  onZoomOut,
  onResetNorth,
  onGoToMyBusiness,
  currentZoom,
}: MapControlsProps) => {
  return (
    <div className="absolute top-13 left-1 z-30 flex flex-col gap-2">
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
      {onGoToMyBusiness && <div className="h-px bg-slate-700 mx-2" />}

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
