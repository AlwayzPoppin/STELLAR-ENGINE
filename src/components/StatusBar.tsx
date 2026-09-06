import React, { useState, useEffect } from 'react';
import { Cloud, CloudCheck, Loader2, AlertCircle, Move, RotateCw, Scaling, MousePointer, Layers, Cpu, Boxes, Network, Eye } from 'lucide-react';
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
  const showPhysicsDebug = useStore((s) => s.showPhysicsDebug);
  const togglePhysicsDebug = useStore((s) => s.togglePhysicsDebug);
  const spatialPartitioningEnabled = useStore((s) => s.spatialPartitioningEnabled);
  const toggleSpatialPartitioning = useStore((s) => s.toggleSpatialPartitioning);
  const spatialStructureType = useStore((s) => s.spatialStructureType);
  const frustumCullingEnabled = useStore((s) => s.frustumCullingEnabled);
  const toggleFrustumCulling = useStore((s) => s.toggleFrustumCulling);
  const showSpatialDebug = useStore((s) => s.showSpatialDebug);
  const toggleSpatialDebug = useStore((s) => s.toggleSpatialDebug);
  const spatialStats = useStore((s) => s.spatialStats);

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

        {/* Spatial Culling & Acceleration Indicator */}
        <button
          onClick={toggleFrustumCulling}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all cursor-pointer ${
            frustumCullingEnabled && spatialPartitioningEnabled
              ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40 shadow-[0_0_8px_rgba(14,165,233,0.2)]'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/60 border border-transparent'
          }`}
          title={`Spatial Partitioning (${spatialStructureType.toUpperCase()}): ${
            frustumCullingEnabled ? `Active (${spatialStats.visible}/${spatialStats.total} visible, ${spatialStats.culled} culled)` : 'Disabled'
          }. Click to toggle frustum culling.`}
        >
          <Eye size={11} className={frustumCullingEnabled && spatialPartitioningEnabled ? 'text-sky-400' : 'text-neutral-500'} />
          <span className="text-[9.5px]">
            {spatialStructureType.toUpperCase()}: {frustumCullingEnabled && spatialPartitioningEnabled ? `${spatialStats.visible}/${spatialStats.total}` : 'OFF'}
          </span>
        </button>

        {/* Spatial Debug Wireframe Toggle */}
        <button
          onClick={toggleSpatialDebug}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all cursor-pointer ${
            showSpatialDebug
              ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/60 border border-transparent'
          }`}
          title="Toggle 3D Spatial Partitioning (Octree/BVH) Bounding Wireframes"
        >
          <Network size={11} className={showSpatialDebug ? 'text-amber-400 animate-pulse' : 'text-neutral-500'} />
          <span className="text-[9.5px]">Spatial: {showSpatialDebug ? 'ON' : 'OFF'}</span>
        </button>

        <div className="h-3 w-px bg-neutral-800" />

        <button
          onClick={togglePhysicsDebug}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all cursor-pointer ${
            showPhysicsDebug
              ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
              : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-900/60 border border-transparent'
          }`}
          title="Toggle Physics Hitbox & Collider Debugger (Rapier)"
        >
          <Boxes size={11} className={showPhysicsDebug ? 'text-emerald-400 animate-pulse' : 'text-neutral-500'} />
          <span className="text-[9.5px]">Colliders: {showPhysicsDebug ? 'ON' : 'OFF'}</span>
        </button>

        <div className="h-3 w-px bg-neutral-800" />

        <span className="text-neutral-400 font-sans text-[10px]">
          Stellar Engine
        </span>
      </div>
    </footer>
  );
}

export default StatusBar;
