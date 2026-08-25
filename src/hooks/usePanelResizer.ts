import * as React from 'react';
import { useState, useCallback } from 'react';
import { useStore } from '../store/useStore';

export interface UsePanelResizerOptions {
  defaultHeight?: number;
  minHeight?: number;
  maxHeightRatio?: number;
}

/**
 * Shared layout resizer hook for bottom panels (TimelinePanel and BottomPanel).
 * Uses direct DOM manipulation during the drag phase to eliminate React tree re-renders,
 * and commits final height to Zustand on mouseup.
 */
export function usePanelResizer(options: UsePanelResizerOptions = {}) {
  const {
    defaultHeight = 240,
    minHeight = 120,
    maxHeightRatio = 0.6,
  } = options;

  const setTimelineHeight = useStore((s) => s.setTimelineHeight);
  const [prevHeight, setPrevHeight] = useState(defaultHeight);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();

    const mainGrid = document.getElementById('app-main-grid') || (document.querySelector('main') as HTMLElement | null);
    let pendingHeight = useStore.getState().timelineHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newHeight = window.innerHeight - moveEvent.clientY;
      const minH = minHeight;
      const maxH = window.innerHeight * maxHeightRatio;
      pendingHeight = Math.max(minH, Math.min(maxH, newHeight));

      // Direct DOM manipulation during drag phase to eliminate React re-renders of Monaco/Viewport
      if (mainGrid) {
        mainGrid.style.gridTemplateRows = `1fr ${pendingHeight}px`;
      }
    };

    const handleMouseUp = () => {
      if (pendingHeight > 0) {
        setTimelineHeight(pendingHeight);
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [setTimelineHeight, minHeight, maxHeightRatio]);

  const handleDoubleClick = useCallback(() => {
    const currentH = useStore.getState().timelineHeight;
    if (currentH > minHeight) {
      setPrevHeight(currentH);
      setTimelineHeight(minHeight);
    } else {
      setTimelineHeight(prevHeight);
    }
  }, [setTimelineHeight, prevHeight, minHeight]);

  return {
    handleMouseDown,
    handleDoubleClick,
  };
}
