import React from 'react';
import { create } from 'zustand';

/**
 * Transient Tooltip Store
 *
 * This store uses Zustand's subscription pattern to enable 60fps hover interactions
 * without triggering React re-renders. Tooltip updates are applied directly to the DOM.
 *
 * Key Concepts:
 * 1. State updates trigger subscriber callbacks (not React renders)
 * 2. Subscribers receive the new tooltip data and update DOM directly
 * 3. This bypasses React's render cycle for performance-critical operations
 *
 * Usage Pattern:
 * ```typescript
 * // In chart component
 * const tooltipRef = useRef<HTMLDivElement>(null);
 *
 * useEffect(() => {
 *   const unsubscribe = useTooltipStore.subscribe((state) => {
 *     const tooltipData = state.tooltipData;
 *     if (!tooltipRef.current) return;
 *
 *     if (tooltipData) {
 *       tooltipRef.current.style.display = 'block';
 *       tooltipRef.current.style.left = `${tooltipData.x}px`;
 *       tooltipRef.current.style.top = `${tooltipData.y}px`;
 *       tooltipRef.current.textContent = tooltipData.content;
 *     } else {
 *       tooltipRef.current.style.display = 'none';
 *     }
 *   });
 *   return unsubscribe;
 * }, []);
 *
 * // On mousemove
 * const handleMouseMove = (event) => {
 *   useTooltipStore.getState().setTooltip({
 *     x: event.clientX,
 *     y: event.clientY,
 *     content: 'Tooltip text'
 *   });
 * };
 * ```
 */

export interface TooltipData {
  x: number;
  y: number;
  content: string | null;
  metadata?: Record<string, any>; // For passing additional data (colors, formatting, etc.)
}

interface TooltipStore {
  // Current tooltip data (null when hidden)
  tooltipData: TooltipData | null;

  // Actions
  setTooltip: (data: TooltipData | null) => void;
  hideTooltip: () => void;
}

/**
 * Transient tooltip store for 60fps hover interactions
 *
 * This store does NOT cause React re-renders when tooltip data changes.
 * Instead, components subscribe to changes and update the DOM directly.
 *
 * Performance Benefits:
 * - No React render cycle on mousemove
 * - Direct DOM manipulation (~0.1ms vs ~16ms for React render)
 * - Smooth 60fps interactions even with complex charts
 */
export const useTooltipStore = create<TooltipStore>()((set) => ({
  tooltipData: null,

  setTooltip: (data) => set({ tooltipData: data }),

  hideTooltip: () => set({ tooltipData: null }),
}));

/**
 * Helper hook for subscribing to tooltip changes with automatic cleanup
 *
 * @param callback Function to call when tooltip data changes (receives new tooltip data)
 *
 * Example:
 * ```typescript
 * const tooltipRef = useRef<HTMLDivElement>(null);
 *
 * useTooltipSubscription((tooltipData) => {
 *   if (!tooltipRef.current) return;
 *
 *   if (tooltipData) {
 *     tooltipRef.current.style.left = `${tooltipData.x}px`;
 *     tooltipRef.current.style.top = `${tooltipData.y}px`;
 *     tooltipRef.current.textContent = tooltipData.content;
 *     tooltipRef.current.style.display = 'block';
 *   } else {
 *     tooltipRef.current.style.display = 'none';
 *   }
 * });
 * ```
 */
export function useTooltipSubscription(
  callback: (tooltipData: TooltipData | null) => void
): void {
  // Subscribe on mount, unsubscribe on unmount
  React.useEffect(() => {
    const unsubscribe = useTooltipStore.subscribe((state) => {
      callback(state.tooltipData);
    });
    return unsubscribe;
  }, [callback]);
}
