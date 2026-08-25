import React, { useRef, useState, useEffect } from 'react';
import { useStore } from '../store/useStore';

interface ScrubbableInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  step?: number;
  precision?: number;
}

export function computeScrubValue(
  startValue: number,
  deltaX: number,
  step: number = 0.1,
  precision: number = 2
): number {
  const newValue = startValue + deltaX * step;
  const factor = Math.pow(10, precision);
  return Math.round(newValue * factor) / factor;
}

export const ScrubbableInput = ({ label, value, onChange, step = 0.1, precision = 2 }: ScrubbableInputProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startValueRef = useRef(0);
  const lastValueRef = useRef(value);
  const initialValueRef = useRef(value);
  // Snapshot of objects array before the scrub begins (for revert-and-commit)
  const initialObjectsRef = useRef<any>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    // Capture pointer so pointermove and pointerup are delivered even if dragged outside window/iframes
    try {
      (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId);
    } catch {}

    // Save snapshot of tracked state BEFORE pausing
    const state = useStore.getState();
    initialObjectsRef.current = state.objects;

    useStore.temporal.getState().pause();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startValueRef.current = value;
    lastValueRef.current = value;
    initialValueRef.current = value;
    document.body.style.cursor = 'ew-resize';
    e.preventDefault(); // Prevent text selection
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      const deltaX = e.clientX - startXRef.current;
      const roundedValue = computeScrubValue(startValueRef.current, deltaX, step, precision);
      lastValueRef.current = roundedValue;
      onChange(roundedValue);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';

      const finalValue = lastValueRef.current;
      const initialValue = initialValueRef.current;

      if (finalValue !== initialValue && initialObjectsRef.current) {
        // 1. Revert to initial value while still paused (not tracked)
        onChange(initialValue);

        // 2. Resume tracking
        useStore.temporal.getState().resume();

        // 3. Commit the final value (this creates exactly one undo entry: initial → final)
        onChange(finalValue);
      } else {
        // No change, just resume
        useStore.temporal.getState().resume();
      }

      initialObjectsRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('blur', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('blur', handlePointerUp);
      document.body.style.cursor = 'default';
    };
  }, [isDragging, onChange, step, precision]);

  return (
    <div className="relative flex-1">
      <span
        className={`absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold select-none transition-colors ${isDragging ? 'text-accent cursor-ew-resize' : 'text-text-secondary/50 cursor-ew-resize hover:text-text-primary'}`}
        onPointerDown={handlePointerDown}
        onMouseDown={handlePointerDown as any}
        style={{ filter: isDragging ? 'drop-shadow(0 0 2px #38bdf8)' : 'none' }}
      >
        {label}
      </span>
      <input
        type="number"
        className={`w-full bg-bg-deep border text-text-primary pl-4 pr-1 py-1 rounded-[4px] text-right font-mono text-[11px] focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-all ${isDragging ? 'border-accent/50' : 'border-border'}`}
        value={value}
        step={step}
        onChange={(e) => {
          const val = parseFloat(e.target.value);
          if (!isNaN(val)) onChange(val);
        }}
      />
    </div>
  );
};
