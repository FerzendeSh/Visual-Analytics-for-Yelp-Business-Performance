import * as React from "react";
import { cn } from "@/lib/utils";

interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: [number, number];
  onValueChange: (value: [number, number]) => void;
  className?: string;
  minRange?: number; // Minimum gap between min and max values
}

export function Slider({
  min,
  max,
  step = 0.1,
  value,
  onValueChange,
  className,
  minRange = 0,
}: SliderProps) {
  const [localValue, setLocalValue] = React.useState(value);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const minInputRef = React.useRef<HTMLInputElement>(null);
  const maxInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMin = parseFloat(e.target.value);
    const newValue: [number, number] = [newMin, Math.max(newMin + minRange, localValue[1])];
    setLocalValue(newValue);
    onValueChange(newValue);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMax = parseFloat(e.target.value);
    const newValue: [number, number] = [Math.min(localValue[0], newMax - minRange), newMax];
    setLocalValue(newValue);
    onValueChange(newValue);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || !minInputRef.current || !maxInputRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const valueAtPointer = min + percent * (max - min);

    const distToMin = Math.abs(valueAtPointer - localValue[0]);
    const distToMax = Math.abs(valueAtPointer - localValue[1]);

    if (distToMin < distToMax) {
      minInputRef.current.style.zIndex = '30';
      maxInputRef.current.style.zIndex = '20';
    } else {
      minInputRef.current.style.zIndex = '20';
      maxInputRef.current.style.zIndex = '30';
    }
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div
        ref={containerRef}
        className="relative h-6 px-1"
        onPointerMove={handlePointerMove}
      >
        {/* Track */}
        <div className="absolute top-1/2 -translate-y-1/2 inset-x-0 h-1.5 bg-slate-700 rounded-full" />

        {/* Active range */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-blue-500 rounded-full"
          style={{
            left: `${((localValue[0] - min) / (max - min)) * 100}%`,
            right: `${100 - ((localValue[1] - min) / (max - min)) * 100}%`,
          }}
        />

        {/* Left thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg pointer-events-none"
          style={{
            left: `${((localValue[0] - min) / (max - min)) * 100}%`,
          }}
        />

        {/* Right thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg pointer-events-none"
          style={{
            left: `${((localValue[1] - min) / (max - min)) * 100}%`,
          }}
        />

        <input
          ref={minInputRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={localValue[0]}
          onChange={handleMinChange}
          className="absolute inset-0 w-full opacity-0 cursor-pointer z-20"
        />
        <input
          ref={maxInputRef}
          type="range"
          min={min}
          max={max}
          step={step}
          value={localValue[1]}
          onChange={handleMaxChange}
          className="absolute inset-0 w-full opacity-0 cursor-pointer z-30"
        />
      </div>
    </div>
  );
}
