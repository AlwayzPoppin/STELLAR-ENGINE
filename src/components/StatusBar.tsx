import React, { useState, useEffect } from 'react';
import { Cloud, CloudCheck, Loader2, AlertCircle, Move, RotateCw, Scaling, MousePointer, Layers, Cpu } from 'lucide-react';
import { SerializationManager, AutosaveState } from '../utils/SerializationManager';
import { useStore } from '../store/useStore';

export function StatusBar(): React.JSX.Element {
  const [autosaveState, setAutosaveState] = useState<AutosaveState>(() =>
    SerializationManager.getAutosaveState()
  );

  const objectsCount = useStore((s) => s.objects.length);
  const selectedCount = useStore((s) => s.selectedIds.length);
  const transformMode = useStore((s) => s.transformMode);
  const workspaceMode = useStore((s) => s.workspaceMode);
  const snapGrid = useStore((s) => s.snapGrid);
  const snapValue = useStore((s) => s.snapValue);

  useEffect(() => {
    const unsubscribe = SerializationManager.subscribeAutosave((state) => {
      setAutosaveState(state);
    });
    return unsubscribe;
  }, []);

  const formatTime = (ts: number | null) => {
    if (!ts) return null;
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formattedSavedTime = formatTime(autosaveState.lastSavedTimestamp);

  return (
    <footer
      role="status"
      aria-label="Engine Status Bar"
      className="h-6 bg-[#0a0a0e] border-t border-neutral-800/80 px-3 flex items-center justify-between text-[10.5px] text-neutral-400 select-none z-40 font-mono tracking-tight"
    >
      {/* Left side: Autosave Status & Transform Mode */}
      <div className="flex items-center gap-4">
        {/* Autosave Status Indicator */}
        <div
          className="flex items-center gap-1.5 cursor-default transition-all duration-200"
          title={
            formattedSavedTime
              ? `Autosave active. Last saved at ${formattedSavedTime}`
              : 'Autosave active (IndexedDB & Background Worker)'
          }
        >
          {autosaveState.status === 'saving' && (
            <div className="flex items-center gap-1.5 text-cyan-400">
              <Loader2 size={12} className="animate-spin" />
              <span className="animate-pulse text-[10px]">Autosaving...</span>
            </div>
          )}

          {autosaveState.status === 'saved' && (
            <div className="flex items-center gap-1.5 text-emerald-400 animate-in fade-in duration-300">
              <div className="relative flex items-center justify-center">
                <Cloud size={12} className="text-emerald-400" />
                <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full ring-2 ring-[#0a0a0e] animate-ping" />
                <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full ring-1 ring-[#0a0a0e]" />
              </div>
              <span className="text-[10px] text-emerald-300 font-sans">
                {formattedSavedTime ? `Autosaved at ${formattedSavedTime}` : 'Autosaved'}
              </span>
            </div>
          )}

          {autosaveState.status === 'idle' && (
            <div className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-300">
              <Cloud size={12} className="opacity-70 text-emerald-500/80" />
              <span className="text-[10px] text-neutral-400 font-sans">
                {formattedSavedTime ? `Saved ${formattedSavedTime}` : 'Autosave Ready'}
              </span>
            </div>
          )}

          {autosaveState.status === 'error' && (
            <div className="flex items-center gap-1.5 text-rose-400">
              <AlertCircle size={12} />
              <span className="text-[10px]">Autosave Error</span>
            </div>
          )}
        </div>

        <div className="h-3 w-px bg-neutral-800" />

        {/* Active Transform Mode */}
        <div className="flex items-center gap-1.5 text-neutral-300">
          {transformMode === 'select' && (
            <>
              <MousePointer size={11} className="text-neutral-400" />
              <span className="text-neutral-400">Select</span>
              <kbd className="bg-neutral-900 border border-neutral-700/60 px-1 py-0.2 rounded text-[9px] text-neutral-300 font-mono">Q</kbd>
            </>
          )}
          {transformMode === 'translate' && (
            <>
              <Move size={11} className="text-cyan-400" />
              <span className="text-cyan-300">Translate</span>
              <kbd className="bg-neutral-900 border border-neutral-700/60 px-1 py-0.2 rounded text-[9px] text-neutral-300 font-mono">W</kbd>
            </>
          )}
          {transformMode === 'rotate' && (
            <>
              <RotateCw size={11} className="text-amber-400" />
              <span className="text-amber-300">Rotate</span>
              <kbd className="bg-neutral-900 border border-neutral-700/60 px-1 py-0.2 rounded text-[9px] text-neutral-300 font-mono">E</kbd>
            </>
          )}
          {transformMode === 'scale' && (
            <>
              <Scaling size={11} className="text-emerald-400" />
              <span className="text-emerald-300">Scale</span>
              <kbd className="bg-neutral-900 border border-neutral-700/60 px-1 py-0.2 rounded text-[9px] text-neutral-300 font-mono">R</kbd>
            </>
          )}
        </div>

        {snapGrid && (
          <>
            <div className="h-3 w-px bg-neutral-800" />
            <span className="text-amber-400/90 text-[10px]">
              Snap: {snapValue}m
            </span>
          </>
        )}
      </div>

      {/* Right side: Object Counts & Engine Status */}
      <div className="flex items-center gap-4 text-neutral-400">
        <div className="flex items-center gap-1.5">
          <Layers size={11} className="text-neutral-400" />
          <span>
            {objectsCount} {objectsCount === 1 ? 'object' : 'objects'}
          </span>
          {selectedCount > 0 && (
            <span className="text-cyan-400 font-semibold">
              ({selectedCount} selected)
            </span>
          )}
        </div>

        <div className="h-3 w-px bg-neutral-800" />

        <div className="flex items-center gap-1.5 text-neutral-400">
          <Cpu size={11} className="text-indigo-400" />
          <span className="uppercase text-[9.5px] tracking-wider text-indigo-300/80 font-bold">
            {workspaceMode}
          </span>
        </div>

        <div className="h-3 w-px bg-neutral-800" />

        <span className="text-neutral-400 font-sans text-[10px]">
          Stellar Engine
        </span>
      </div>
    </footer>
  );
}

export default StatusBar;
