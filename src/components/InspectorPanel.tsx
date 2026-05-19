import React, { useState } from 'react';
import { useStore, EnvironmentSettings } from '../store/useStore';
import { useAssetStore } from '../store/useAssetStore';
import {
  Settings2,
  SlidersHorizontal,
  Sun,
  Layers,
  Box,
  ChevronDown,
  ChevronRight,
  Hash,
  Magnet,
  Eye,
  Brush,
  Trash2,
  Bone,
  Plus,
} from 'lucide-react';
import { ScrubbableInput } from './ScrubbableInput';

const Section = ({ title, icon: Icon, colorClass = 'text-text-secondary', defaultExpanded = true, children }: any) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="bg-bg-panel/30 border border-border rounded-lg overflow-hidden shrink-0 backdrop-blur-sm">
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-surface/30 font-medium text-xs cursor-pointer hover:bg-bg-panel/50 select-none transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 text-text-primary font-mono tracking-tight">
          <Icon size={14} className={colorClass} style={{ filter: 'drop-shadow(0 0 2px currentColor)' }} /> {title}
        </div>
        {expanded ? (
          <ChevronDown size={14} className="text-text-secondary" />
        ) : (
          <ChevronRight size={14} className="text-text-secondary" />
        )}
      </div>
      {expanded && <div className="p-3 space-y-3">{children}</div>}
    </div>
  );
};

export default function InspectorPanel() {
  const {
    objects,
    selectedIds,
    updateObject,
    environment,
    updateEnvironment,
    isPlaying,
    showPhysicsDebug,
    togglePhysicsDebug,
    showEmitters,
    toggleEmitters,
    wireframeMode,
    toggleWireframeMode,
    activeTool,
    setActiveTool,
    foliageBrushAssetId,
    setFoliageBrushAssetId,
    foliageBrushRadius,
    setFoliageBrushRadius,
    foliageBrushDensity,
    setFoliageBrushDensity,
    clearFoliage,
    foliageInstances,
    addJoint,
    updateJoint,
    deleteJoint,
  } = useStore();

  const { assets } = useAssetStore();
  const models = assets.filter(a => a.type === 'model' && a.url);

  if (activeTool === 'skeleton_rig') {
    const selectedId = selectedIds[0] || null;
    const selectedObj = objects.find((o) => o.id === selectedId);

    if (!selectedObj) {
      return (
        <div
          role="region"
          aria-label="Skeleton Rigger Panel"
          className="w-80 bg-bg-surface/80 border-l border-border flex flex-col pointer-events-auto backdrop-blur-md overflow-y-auto select-none"
        >
          <div className="px-3 py-2.5 bg-transparent text-xs font-semibold text-text-primary border-b border-border flex justify-between items-center tracking-wide shrink-0">
            <div className="flex items-center gap-2">
              <Bone size={14} className="text-amber-400 animate-pulse" />
              <span>Skeleton Rigger Settings</span>
            </div>
            <button
              onClick={() => setActiveTool('select')}
              className="text-[10px] text-text-secondary hover:text-text-primary bg-bg-deep border border-border px-1.5 py-0.5 rounded cursor-pointer animate-fade-in"
            >
              Exit
            </button>
          </div>
          <div className="p-6 text-center text-text-secondary text-sm flex-1 flex flex-col items-center justify-center gap-2">
            <Bone className="opacity-25 text-amber-400" size={36} />
            <span className="font-semibold text-text-primary text-xs">No Model Selected</span>
            <p className="text-[11px] text-text-secondary/70 leading-relaxed max-w-[200px]">
              Select an object in the viewport or Hierarchy tab to start rigging joints.
            </p>
          </div>
        </div>
      );
    }

    const joints = selectedObj.joints || [];

    return (
      <div
        role="region"
        aria-label="Skeleton Rigger Panel"
        className="w-80 bg-bg-surface/80 border-l border-border flex flex-col pointer-events-auto backdrop-blur-md overflow-y-auto select-none"
      >
        <div className="px-3 py-2.5 bg-transparent text-xs font-semibold text-text-primary border-b border-border flex justify-between items-center tracking-wide shrink-0">
          <div className="flex items-center gap-2 max-w-[180px] truncate">
            <Bone size={14} className="text-amber-400 shrink-0" />
            <span className="truncate">Rig: {selectedObj.name}</span>
          </div>
          <button
            onClick={() => setActiveTool('select')}
            className="text-[10px] text-text-secondary hover:text-text-primary bg-bg-deep border border-border px-1.5 py-0.5 rounded cursor-pointer"
          >
            Exit
          </button>
        </div>

        <div className="p-3.5 flex flex-col gap-3.5 overflow-y-auto flex-1 custom-scrollbar">
          {/* Skeleton Actions card */}
          <div className="bg-bg-panel/30 border border-border rounded-lg p-3 space-y-3">
            <div className="flex justify-between items-center text-xs font-bold text-text-primary">
              <span className="font-mono tracking-tight text-neutral-400">Skeleton Hierarchy</span>
              <button
                onClick={() => {
                  const newJointId = `j_${crypto.randomUUID()}`;
                  addJoint(selectedObj.id, {
                    id: newJointId,
                    name: `Joint_${joints.length + 1}`,
                    position: [0, joints.length > 0 ? 0.3 : 0, 0],
                    rotation: [0, 0, 0],
                    parentId: joints.length > 0 ? joints[joints.length - 1].id : null,
                  });
                }}
                className="px-2 py-1 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 rounded text-[10px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus size={10} /> Add Bone
              </button>
            </div>

            {joints.length === 0 ? (
              <div className="text-[10px] text-text-secondary/70 text-center py-4 leading-relaxed font-medium">
                No bones rigged. Click "Add Bone" to create your root joint!
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-0.5 custom-scrollbar">
                {joints.map((joint, idx) => (
                  <div key={joint.id} className="bg-neutral-900/40 border border-neutral-800/80 rounded-lg p-2.5 space-y-2.5 text-[11px] hover:border-amber-500/25 transition-all">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={joint.name}
                        onChange={(e) => updateJoint(selectedObj.id, joint.id, { name: e.target.value })}
                        className="bg-neutral-950 border border-neutral-800 rounded px-1.5 py-0.5 text-text-primary text-[10px] font-semibold w-28 outline-none focus:border-amber-500/50"
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[8px] font-bold text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded font-mono border border-amber-500/20">
                          BONE #{idx + 1}
                        </span>
                        <button
                          onClick={() => deleteJoint(selectedObj.id, joint.id)}
                          className="text-text-secondary hover:text-red-400 transition-colors p-0.5 cursor-pointer"
                          title="Delete Joint"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Local Offset values */}
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">Local Offset</span>
                      <div className="grid grid-cols-3 gap-1">
                        <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded px-1.5 py-0.5">
                          <span className="text-[8px] font-bold text-red-500 mr-1 select-none font-mono">X</span>
                          <input
                            type="number"
                            step="0.05"
                            value={joint.position[0]}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              updateJoint(selectedObj.id, joint.id, { position: [val, joint.position[1], joint.position[2]] });
                            }}
                            className="bg-transparent border-none text-text-primary text-[10px] w-full text-center outline-none"
                          />
                        </div>
                        <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded px-1.5 py-0.5">
                          <span className="text-[8px] font-bold text-green-500 mr-1 select-none font-mono">Y</span>
                          <input
                            type="number"
                            step="0.05"
                            value={joint.position[1]}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              updateJoint(selectedObj.id, joint.id, { position: [joint.position[0], val, joint.position[2]] });
                            }}
                            className="bg-transparent border-none text-text-primary text-[10px] w-full text-center outline-none"
                          />
                        </div>
                        <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded px-1.5 py-0.5">
                          <span className="text-[8px] font-bold text-blue-500 mr-1 select-none font-mono">Z</span>
                          <input
                            type="number"
                            step="0.05"
                            value={joint.position[2]}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              updateJoint(selectedObj.id, joint.id, { position: [joint.position[0], joint.position[1], val] });
                            }}
                            className="bg-transparent border-none text-text-primary text-[10px] w-full text-center outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Local Euler Rotation */}
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">Rotation (Euler)</span>
                      <div className="grid grid-cols-3 gap-1">
                        <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded px-1.5 py-0.5">
                          <span className="text-[8px] font-bold text-red-500 mr-1 select-none font-mono">X</span>
                          <input
                            type="number"
                            step="0.1"
                            value={joint.rotation[0]}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              updateJoint(selectedObj.id, joint.id, { rotation: [val, joint.rotation[1], joint.rotation[2]] });
                            }}
                            className="bg-transparent border-none text-text-primary text-[10px] w-full text-center outline-none"
                          />
                        </div>
                        <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded px-1.5 py-0.5">
                          <span className="text-[8px] font-bold text-green-500 mr-1 select-none font-mono">Y</span>
                          <input
                            type="number"
                            step="0.1"
                            value={joint.rotation[1]}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              updateJoint(selectedObj.id, joint.id, { rotation: [joint.rotation[0], val, joint.rotation[2]] });
                            }}
                            className="bg-transparent border-none text-text-primary text-[10px] w-full text-center outline-none"
                          />
                        </div>
                        <div className="flex items-center bg-neutral-950 border border-neutral-800 rounded px-1.5 py-0.5">
                          <span className="text-[8px] font-bold text-blue-500 mr-1 select-none font-mono">Z</span>
                          <input
                            type="number"
                            step="0.1"
                            value={joint.rotation[2]}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              updateJoint(selectedObj.id, joint.id, { rotation: [joint.rotation[0], joint.rotation[1], val] });
                            }}
                            className="bg-transparent border-none text-text-primary text-[10px] w-full text-center outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Parent Dropdown */}
                    <div className="space-y-1">
                      <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">Parent Joint</span>
                      <select
                        value={joint.parentId || ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? null : e.target.value;
                          updateJoint(selectedObj.id, joint.id, { parentId: val });
                        }}
                        className="bg-neutral-950 border border-neutral-800 rounded px-1.5 py-1 text-text-primary text-[10px] w-full outline-none focus:border-amber-500/50 cursor-pointer"
                      >
                        <option value="">None (Root Bone)</option>
                        {joints
                          .filter((j) => j.id !== joint.id)
                          .map((j) => (
                            <option key={j.id} value={j.id}>
                              {j.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clear Rig Button */}
          {joints.length > 0 && (
            <button
              onClick={() => updateObject(selectedObj.id, { joints: [] })}
              className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <Trash2 size={13} />
              <span>Clear Rig Hierarchy</span>
            </button>
          )}

          {/* Quick tips */}
          <div className="text-[10px] text-text-secondary/60 bg-bg-deep/30 border border-border/50 rounded-lg p-3 space-y-1">
            <div className="font-semibold text-text-secondary">Rigger Quick Tips:</div>
            <div>• Click <span className="font-semibold text-amber-400">Add Bone</span> to spawn interactive joint offsets.</div>
            <div>• Connect joints hierarchically via the Parent selector.</div>
            <div>• Real-time Euler inputs simulate forward kinematics poses in the viewport.</div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTool === 'foliage') {
    return (
      <div
        role="region"
        aria-label="Foliage Painter Panel"
        className="w-80 bg-bg-surface/80 border-l border-border flex flex-col pointer-events-auto backdrop-blur-md overflow-y-auto select-none"
      >
        <div className="px-3 py-2.5 bg-transparent text-xs font-semibold text-text-primary border-b border-border flex justify-between items-center tracking-wide shrink-0">
          <div className="flex items-center gap-2">
            <Brush size={14} className="text-emerald-400" />
            <span>Foliage Painter Settings</span>
          </div>
          <button
            onClick={() => setActiveTool('select')}
            className="text-[10px] text-text-secondary hover:text-text-primary bg-bg-deep border border-border px-1.5 py-0.5 rounded cursor-pointer"
          >
            Exit
          </button>
        </div>

        <div className="p-3 space-y-4">
          <Section title="Brush Type" icon={Box} colorClass="text-sky-400">
            <div className="space-y-2 w-full">
              <span className="text-[11px] text-text-secondary block">Select Foliage Asset</span>
              <div className="grid grid-cols-2 gap-2">
                {models.map((m) => {
                  const isSelected = foliageBrushAssetId === m.url;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setFoliageBrushAssetId(m.url || null)}
                      className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-center cursor-pointer min-w-0 ${isSelected ? 'border-accent bg-accent/10 text-text-primary font-semibold' : 'border-border bg-bg-deep/50 text-text-secondary hover:border-text-secondary hover:text-text-primary'}`}
                    >
                      <Box size={20} className="mb-1" />
                      <span className="text-[10px] font-medium truncate w-full block">{m.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>

          <Section title="Brush Properties" icon={SlidersHorizontal} colorClass="text-emerald-500">
            <div className="grid grid-cols-[80px_1fr] items-center gap-2 w-full">
              <span className="text-[11px] text-text-secondary">Radius</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.5"
                  max="10"
                  step="0.1"
                  className="w-full accent-accent cursor-pointer"
                  value={foliageBrushRadius}
                  onChange={(e) => setFoliageBrushRadius(parseFloat(e.target.value))}
                />
                <span className="w-10 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border shrink-0">
                  {foliageBrushRadius.toFixed(1)}m
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[80px_1fr] items-center gap-2 w-full">
              <span className="text-[11px] text-text-secondary">Density</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="50"
                  step="1"
                  className="w-full accent-accent cursor-pointer"
                  value={foliageBrushDensity}
                  onChange={(e) => setFoliageBrushDensity(parseInt(e.target.value))}
                />
                <span className="w-10 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border shrink-0">
                  {foliageBrushDensity}
                </span>
              </div>
            </div>
          </Section>

          <Section title="Actions" icon={Settings2} colorClass="text-amber-500">
            <div className="space-y-2 w-full">
              <button
                onClick={() => clearFoliage(foliageBrushAssetId || undefined)}
                className="w-full py-2 bg-red-500/10 hover:bg-red-500/25 border border-red-500/30 hover:border-red-500/50 rounded-lg text-xs font-semibold text-red-400 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={12} />
                <span>{foliageBrushAssetId ? 'Clear Selected Type' : 'Clear All Foliage'}</span>
              </button>
            </div>
          </Section>

          <div className="text-[10px] text-text-secondary/60 bg-bg-deep/30 border border-border/50 rounded-lg p-3 space-y-1">
            <div className="font-semibold text-text-secondary">Painter Quick Tips:</div>
            <div>• Press <span className="font-mono text-text-primary bg-bg-deep px-1 py-0.5 rounded border border-border">P</span> to toggle the painter tool.</div>
            <div>• <span className="text-accent font-semibold">Click and drag</span> in the viewport to paint foliage on any mesh.</div>
            <div>• Hold <span className="font-mono text-text-primary bg-bg-deep px-1 py-0.5 rounded border border-border">Shift + Click</span> to erase foliage.</div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedIds.length > 1) {
    return (
      <div
        role="region"
        aria-label="Multiple Objects Inspector"
        className="w-80 bg-bg-base border-l border-bg-panel flex flex-col pointer-events-auto"
      >
        <div className="h-10 border-b border-bg-panel flex items-center px-4 shrink-0 bg-bg-panel/50">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary w-full text-center">
            Multiple Selected ({selectedIds.length})
          </span>
        </div>
        <div className="p-6 text-center text-text-secondary text-sm flex-1 flex flex-col items-center justify-center">
          <Layers className="mb-3 opacity-20" size={32} />
          Multiple objects are currently selected.
        </div>
      </div>
    );
  }

  const selectedId = selectedIds[0] || null;
  const selectedObj = objects.find((o) => o.id === selectedId);

  if (selectedId === 'world_settings') {
    return (
      <div
        role="region"
        aria-label="World Settings Inspector"
        className="flex flex-col h-full overflow-y-auto select-none bg-bg-surface/80 backdrop-blur-md"
      >
        <div className="px-3 py-2.5 bg-transparent text-xs font-semibold text-text-primary border-b border-border flex justify-between items-center tracking-wide">
          World Settings
        </div>

        <div className="p-3 space-y-4">
          <Section title="Environment" icon={Sun} colorClass="text-emerald-500">
            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Sky Preset</span>
              <select
                className="bg-bg-deep border border-border text-text-primary px-2 py-1.5 rounded-md w-full font-mono text-[11px] focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-all"
                value={environment.preset}
                onChange={(e) => updateEnvironment({ preset: e.target.value as EnvironmentSettings['preset'] })}
              >
                {['city', 'sunset', 'dawn', 'night', 'warehouse', 'forest', 'apartment', 'studio', 'park', 'lobby'].map(
                  (p) => (
                    <option key={p} value={p}>
                      {p.toUpperCase()}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Time of Day</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="24"
                  step="0.1"
                  className="w-full accent-emerald-500"
                  value={environment.timeOfDay}
                  onChange={(e) => updateEnvironment({ timeOfDay: parseFloat(e.target.value) })}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {environment.timeOfDay.toFixed(1)}h
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Cycle Speed</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="10"
                  max="600"
                  step="10"
                  className="w-full accent-emerald-500"
                  value={environment.cycleDuration}
                  onChange={(e) => updateEnvironment({ cycleDuration: parseInt(e.target.value) })}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {environment.cycleDuration}s
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Ambient</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  className="w-full accent-emerald-500"
                  value={environment.ambientIntensity}
                  onChange={(e) => updateEnvironment({ ambientIntensity: parseFloat(e.target.value) })}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {environment.ambientIntensity.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Directional</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  className="w-full accent-emerald-500"
                  value={environment.directionalIntensity}
                  onChange={(e) => updateEnvironment({ directionalIntensity: parseFloat(e.target.value) })}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {environment.directionalIntensity.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Bloom</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  className="w-full accent-purple-500"
                  value={environment.bloomIntensity}
                  onChange={(e) => updateEnvironment({ bloomIntensity: parseFloat(e.target.value) })}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {environment.bloomIntensity.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="h-px bg-border my-2" />

            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Fog</span>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={environment.fogEnabled}
                  onChange={(e) => updateEnvironment({ fogEnabled: e.target.checked })}
                />
                <span className="text-[11px] text-text-primary">Enabled</span>
              </div>
            </div>

            {environment.fogEnabled && (
              <>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary">Fog Color</span>
                  <div className="flex items-center gap-2">
                    <div className="relative w-full h-7 rounded border border-border overflow-hidden">
                      <input
                        type="color"
                        className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                        value={environment.fogColor}
                        onChange={(e) => updateEnvironment({ fogColor: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary">Density</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="0.1"
                      step="0.001"
                      className="w-full accent-blue-500"
                      value={environment.fogDensity}
                      onChange={(e) => updateEnvironment({ fogDensity: parseFloat(e.target.value) })}
                    />
                    <span className="w-12 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {environment.fogDensity.toFixed(3)}
                    </span>
                  </div>
                </div>
              </>
            )}
            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary font-semibold">Clouds</span>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={environment.cloudsEnabled}
                  onChange={(e) => updateEnvironment({ cloudsEnabled: e.target.checked })}
                />
                <span className="text-[11px] text-text-primary">Enabled</span>
              </div>
            </div>

             {environment.cloudsEnabled && (
              <>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary">Type</span>
                  <select
                    className="w-full bg-bg-deep border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-accent"
                    value={environment.cloudsType}
                    onChange={(e) => updateEnvironment({ cloudsType: e.target.value as any })}
                  >
                    <option value="volumetric">Volumetric (3D Puffs)</option>
                    <option value="flat">Flat (2D Stratus)</option>
                    <option value="cirrus">Cirrus (Wispy)</option>
                    <option value="voxel">Voxel / Chiseled</option>
                    <option value="nimbus">Nimbus (Heavy Storm Cirrus)</option>
                    <option value="snow">Thick Puff</option>
                    <option value="blizzard">Blizzard (Storm Cirrus)</option>
                  </select>
                </div>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary">Density</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      className="w-full accent-blue-500"
                      value={environment.cloudsDensity}
                      onChange={(e) => updateEnvironment({ cloudsDensity: parseFloat(e.target.value) })}
                    />
                    <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {environment.cloudsDensity.toFixed(2)}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary">Wind Speed</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="1"
                      className="w-full accent-blue-500"
                      value={Math.round(environment.cloudsSpeed * 10)}
                      onChange={(e) => updateEnvironment({ cloudsSpeed: parseFloat(e.target.value) / 10 })}
                    />
                    <span className="w-12 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {Math.round(environment.cloudsSpeed * 10)} mph
                    </span>
                  </div>
                </div>
              </>
            )}
            {/* Rain Settings */}
            <div className="h-px bg-border my-2" />
            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Rain</span>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                  checked={environment.rainEnabled || false}
                  onChange={(e) => updateEnvironment({ rainEnabled: e.target.checked })}
                />
                <span className="text-xs text-text-primary">Enabled</span>
              </label>
            </div>

            {environment.rainEnabled && (
              <>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary">Density</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      className="w-full accent-blue-500"
                      value={environment.rainIntensity || 0.5}
                      onChange={(e) => updateEnvironment({ rainIntensity: parseFloat(e.target.value) })}
                    />
                    <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {Math.round((environment.rainIntensity || 0.5) * 100)}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary">Fall Speed</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.1"
                      className="w-full accent-blue-500"
                      value={environment.rainSpeed || 1.0}
                      onChange={(e) => updateEnvironment({ rainSpeed: parseFloat(e.target.value) })}
                    />
                    <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {(environment.rainSpeed || 1.0).toFixed(1)}x
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary">Texture</span>
                  <div className="flex items-center gap-2">
                    <label className="flex-1">
                      <div className="w-full text-center bg-bg-deep border border-border border-dashed hover:border-accent hover:text-accent rounded py-1 px-2 text-[10px] font-medium text-text-secondary cursor-pointer transition-colors duration-150 flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        {environment.rainTextureUrl ? 'Change' : 'Import'}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              updateEnvironment({ rainTextureUrl: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {environment.rainTextureUrl && (
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded border border-border bg-bg-deep overflow-hidden flex items-center justify-center">
                          <img src={environment.rainTextureUrl} className="w-full h-full object-cover" />
                        </div>
                        <button
                          type="button"
                          className="p-1 hover:text-red-400 text-text-secondary transition-colors rounded hover:bg-bg-deep"
                          onClick={() => updateEnvironment({ rainTextureUrl: null })}
                          title="Reset to default procedural rain"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
            {/* Snow Settings */}
            <div className="h-px bg-border my-2" />
            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Snow</span>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                  checked={environment.snowEnabled || false}
                  onChange={(e) => updateEnvironment({ snowEnabled: e.target.checked })}
                />
                <span className="text-xs text-text-primary">Enabled</span>
              </label>
            </div>

            {environment.snowEnabled && (
              <>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary">Density</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      className="w-full accent-blue-500"
                      value={environment.snowIntensity || 0.5}
                      onChange={(e) => updateEnvironment({ snowIntensity: parseFloat(e.target.value) })}
                    />
                    <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {Math.round((environment.snowIntensity || 0.5) * 100)}%
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary">Fall Speed</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.2"
                      max="3.0"
                      step="0.1"
                      className="w-full accent-blue-500"
                      value={environment.snowSpeed || 1.0}
                      onChange={(e) => updateEnvironment({ snowSpeed: parseFloat(e.target.value) })}
                    />
                    <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {(environment.snowSpeed || 1.0).toFixed(1)}x
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary">Texture</span>
                  <div className="flex items-center gap-2">
                    <label className="flex-1">
                      <div className="w-full text-center bg-bg-deep border border-border border-dashed hover:border-accent hover:text-accent rounded py-1 px-2 text-[10px] font-medium text-text-secondary cursor-pointer transition-colors duration-150 flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        {environment.snowTextureUrl ? 'Change' : 'Import'}
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => {
                              updateEnvironment({ snowTextureUrl: reader.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {environment.snowTextureUrl && (
                      <div className="flex items-center gap-1">
                        <div className="w-5 h-5 rounded border border-border bg-bg-deep overflow-hidden flex items-center justify-center">
                          <img src={environment.snowTextureUrl} className="w-full h-full object-cover" />
                        </div>
                        <button
                          type="button"
                          className="p-1 hover:text-red-400 text-text-secondary transition-colors rounded hover:bg-bg-deep"
                          onClick={() => updateEnvironment({ snowTextureUrl: null })}
                          title="Reset to default procedural snow"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
            {/* Wind Settings */}
            <div className="h-px bg-border my-2" />
            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Wind</span>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                  checked={environment.windEnabled || false}
                  onChange={(e) => updateEnvironment({ windEnabled: e.target.checked })}
                />
                <span className="text-xs text-text-primary">Enabled</span>
              </label>
            </div>

            {environment.windEnabled && (
              <>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary">Strength</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.0"
                      max="10.0"
                      step="0.5"
                      className="w-full accent-blue-500"
                      value={environment.windStrength || 2.0}
                      onChange={(e) => updateEnvironment({ windStrength: parseFloat(e.target.value) })}
                    />
                    <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {(environment.windStrength || 2.0).toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary">Direction</span>
                  <select
                    className="w-full bg-bg-deep border border-border rounded px-2 py-1 text-xs text-text-primary focus:border-accent outline-none"
                    value={environment.windDirection || 'SE'}
                    onChange={(e) => updateEnvironment({ windDirection: e.target.value as any })}
                  >
                    <option value="N">North (↑)</option>
                    <option value="NE">Northeast (↗)</option>
                    <option value="E">East (→)</option>
                    <option value="SE">Southeast (↘)</option>
                    <option value="S">South (↓)</option>
                    <option value="SW">Southwest (↙)</option>
                    <option value="W">West (←)</option>
                    <option value="NW">Northwest (↖)</option>
                  </select>
                </div>

                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary">Gustiness</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.0"
                      max="2.0"
                      step="0.1"
                      className="w-full accent-blue-500"
                      value={environment.windTurbulence || 0.5}
                      onChange={(e) => updateEnvironment({ windTurbulence: parseFloat(e.target.value) })}
                    />
                    <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {(environment.windTurbulence || 0.5).toFixed(1)}x
                    </span>
                  </div>
                </div>
              </>
            )}

            <div className="h-px bg-border my-2" />

            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Exposure</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  className="w-full accent-yellow-500"
                  value={environment.exposure}
                  onChange={(e) => updateEnvironment({ exposure: parseFloat(e.target.value) })}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {environment.exposure.toFixed(2)}
                </span>
              </div>
            </div>
          </Section>

          <Section title="Visibility" icon={Eye} colorClass="text-blue-500">
            <div className="grid grid-cols-[120px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Physics Debugger</span>
              <button
                onClick={() => togglePhysicsDebug()}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors w-16 text-center ${showPhysicsDebug ? 'bg-blue-500/20 text-blue-500 border border-blue-500/50' : 'bg-bg-deep text-text-secondary border border-border'}`}
              >
                {showPhysicsDebug ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="grid grid-cols-[120px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Emitters & Lights</span>
              <button
                onClick={() => toggleEmitters()}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors w-16 text-center ${showEmitters ? 'bg-blue-500/20 text-blue-500 border border-blue-500/50' : 'bg-bg-deep text-text-secondary border border-border'}`}
              >
                {showEmitters ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="grid grid-cols-[120px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Wireframe Mode</span>
              <button
                onClick={() => toggleWireframeMode()}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-colors w-16 text-center ${wireframeMode ? 'bg-blue-500/20 text-blue-500 border border-blue-500/50' : 'bg-bg-deep text-text-secondary border border-border'}`}
              >
                {wireframeMode ? 'ON' : 'OFF'}
              </button>
            </div>
          </Section>
        </div>
      </div>
    );
  }

  if (!selectedObj) {
    return (
      <div className="flex flex-col h-full bg-bg-surface border-l border-border text-xs text-text-secondary/50 items-center justify-center p-6 text-center select-none">
        <SlidersHorizontal size={32} className="mb-3 opacity-20" />
        Select an object in the viewport or outliner to inspect properties.
      </div>
    );
  }

  const isParticleEffect = ['tornado', 'smoke', 'water', 'sparks', 'fire'].includes(selectedObj.type) || 
                           ['tornado', 'smoke', 'water', 'sparks', 'fire'].includes(selectedObj.geometry || '');

  const handleVectorChange = (prop: 'position' | 'rotation' | 'scale', index: number, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const newVec = [...selectedObj[prop]] as [number, number, number];
    newVec[index] = num;
    updateObject(selectedObj.id, { [prop]: newVec });
  };

  const handleMaterialChange = (prop: string, value: any) => {
    if (!selectedObj.material) return;
    updateObject(selectedObj.id, {
      material: { ...selectedObj.material, [prop]: value },
    });
  };

  return (
    <div
      role="region"
      aria-label="Object Properties Inspector"
      className="flex flex-col h-full overflow-y-auto select-none bg-bg-surface/80 backdrop-blur-md"
    >
      <div className="px-3 py-2.5 bg-transparent text-xs font-semibold text-text-primary border-b border-border flex justify-between items-center tracking-wide">
        Properties
      </div>

      <div className="p-3 space-y-4">
        {/* Data Group */}
        <Section title="Data" icon={Hash} colorClass="text-zinc-400">
          <div className="grid grid-cols-[60px_1fr] items-center gap-2">
            <span className="text-[11px] text-text-secondary">Name</span>
            <input
              type="text"
              className="w-full bg-bg-deep border border-border text-text-primary px-2 py-1.5 rounded-[4px] text-[11px] font-mono focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-all"
              value={selectedObj.name}
              onChange={(e) => updateObject(selectedObj.id, { name: e.target.value })}
            />
          </div>
          {selectedObj.csgMode && (
            <div className="grid grid-cols-[60px_1fr] items-center gap-2 mt-2">
              <span className="text-[11px] text-text-secondary">CSG Mode</span>
              <select
                className="w-full bg-bg-deep border border-border text-text-primary px-2 py-1 rounded-[4px] text-[11px] focus:border-accent focus:outline-none transition-all"
                value={selectedObj.csgMode}
                onChange={(e) => updateObject(selectedObj.id, { csgMode: e.target.value as any })}
              >
                <option value="base">Base</option>
                <option value="addition">Addition (+)</option>
                <option value="subtraction">Subtraction (-)</option>
                <option value="intersection">Intersection (∩)</option>
              </select>
            </div>
          )}
        </Section>

        {selectedObj.celestialProps && (
          <Section title="Celestial" icon={Sun} colorClass="text-amber-400">
            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Temperature</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="2000"
                  max="10000"
                  step="100"
                  className="w-full accent-amber-500"
                  value={selectedObj.celestialProps.colorTemperature}
                  onChange={(e) => {
                    updateObject(selectedObj.id, {
                      celestialProps: { ...selectedObj.celestialProps, colorTemperature: parseInt(e.target.value) }
                    });
                  }}
                />
                <span className="w-12 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {selectedObj.celestialProps.colorTemperature}K
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Disk Scale</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.1"
                  className="w-full accent-amber-500"
                  value={selectedObj.celestialProps.diskScale}
                  onChange={(e) => {
                    updateObject(selectedObj.id, {
                      celestialProps: { ...selectedObj.celestialProps, diskScale: parseFloat(e.target.value) }
                    });
                  }}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {selectedObj.celestialProps.diskScale.toFixed(1)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Volumetric Int.</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  className="w-full accent-amber-500"
                  value={selectedObj.celestialProps.volumetricIntensity}
                  onChange={(e) => {
                    updateObject(selectedObj.id, {
                      celestialProps: { ...selectedObj.celestialProps, volumetricIntensity: parseFloat(e.target.value) }
                    });
                  }}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {selectedObj.celestialProps.volumetricIntensity.toFixed(1)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Atmosphere Cont.</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  className="w-full accent-amber-500"
                  value={selectedObj.celestialProps.atmosphericContribution}
                  onChange={(e) => {
                    updateObject(selectedObj.id, {
                      celestialProps: { ...selectedObj.celestialProps!, atmosphericContribution: parseFloat(e.target.value) }
                    });
                  }}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {selectedObj.celestialProps.atmosphericContribution.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="h-px bg-border my-2" />

            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">God Rays</span>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedObj.celestialProps.godRaysEnabled ?? false}
                  onChange={(e) => updateObject(selectedObj.id, {
                    celestialProps: { ...selectedObj.celestialProps!, godRaysEnabled: e.target.checked }
                  })}
                />
                <span className="text-[11px] text-text-primary">Enabled</span>
              </div>
            </div>

            {selectedObj.celestialProps.godRaysEnabled && (
              <>
                <div className="grid grid-cols-[90px_1fr] items-center gap-2 mt-2">
                  <span className="text-[11px] text-text-secondary">Ray Weight</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.05"
                      className="w-full accent-yellow-500"
                      value={selectedObj.celestialProps.rayWeight ?? 0.6}
                      onChange={(e) => updateObject(selectedObj.id, {
                        celestialProps: { ...selectedObj.celestialProps!, rayWeight: parseFloat(e.target.value) }
                      })}
                    />
                    <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {(selectedObj.celestialProps.rayWeight ?? 0.6).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-[90px_1fr] items-center gap-2 mt-2">
                  <span className="text-[11px] text-text-secondary">Ray Decay</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.8"
                      max="1.0"
                      step="0.01"
                      className="w-full accent-yellow-500"
                      value={selectedObj.celestialProps.rayDecay ?? 0.93}
                      onChange={(e) => updateObject(selectedObj.id, {
                        celestialProps: { ...selectedObj.celestialProps!, rayDecay: parseFloat(e.target.value) }
                      })}
                    />
                    <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {(selectedObj.celestialProps.rayDecay ?? 0.93).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-[90px_1fr] items-center gap-2 mt-2">
                  <span className="text-[11px] text-text-secondary">Ray Exposure</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.05"
                      className="w-full accent-yellow-500"
                      value={selectedObj.celestialProps.rayExposure ?? 0.6}
                      onChange={(e) => updateObject(selectedObj.id, {
                        celestialProps: { ...selectedObj.celestialProps!, rayExposure: parseFloat(e.target.value) }
                      })}
                    />
                    <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {(selectedObj.celestialProps.rayExposure ?? 0.6).toFixed(2)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </Section>
        )}

        {/* Transform Group */}
        <Section title="Transform" icon={Box} colorClass="text-accent">
          <div className="space-y-2.5">
            {['Position', 'Rotation', 'Scale'].map((label) => {
              const prop = label.toLowerCase() as 'position' | 'rotation' | 'scale';
              const vec = selectedObj[prop];
              return (
                <div key={label} className="grid grid-cols-[60px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary">{label}</span>
                  <div className="flex gap-1.5 w-full">
                    {['X', 'Y', 'Z'].map((axis, i) => (
                      <ScrubbableInput
                        key={axis}
                        label={axis}
                        value={prop === 'rotation' ? Math.round(vec[i] * (180 / Math.PI)) : vec[i]}
                        step={prop === 'position' ? 0.1 : prop === 'rotation' ? 1 : 0.1}
                        precision={prop === 'rotation' ? 0 : 2}
                        onChange={(val) => {
                          const newValue = prop === 'rotation' ? val * (Math.PI / 180) : val;
                          const newVec = [...vec] as [number, number, number];
                          newVec[i] = newValue;
                          updateObject(selectedObj.id, { [prop]: newVec });
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {isParticleEffect && (
          <Section title="Particle Emitter" icon={SlidersHorizontal} colorClass="text-cyan-400">
            {/* Particle Emitter Type Choice */}
            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Effect Type</span>
              <select
                className="w-full bg-bg-deep border border-border text-text-primary px-2 py-1 rounded-[4px] text-[11px] focus:border-accent focus:outline-none transition-all"
                value={selectedObj.geometry || selectedObj.type}
                onChange={(e) => {
                  const newType = e.target.value;
                  let color = '#ffffff';
                  let size = 0.25;
                  let opacity = 0.6;
                  if (newType === 'fire') { color = '#f97316'; size = 0.35; opacity = 0.7; }
                  else if (newType === 'tornado') { color = '#a3a3a3'; size = 0.55; opacity = 0.7; }
                  else if (newType === 'smoke') { color = '#a3a3a3'; size = 0.55; opacity = 0.25; }
                  else if (newType === 'water') { color = '#38bdf8'; size = 0.25; opacity = 0.6; }
                  else if (newType === 'sparks') { color = '#eab308'; size = 0.15; opacity = 0.9; }

                  updateObject(selectedObj.id, {
                    geometry: newType as any,
                    particleProps: {
                      ...(selectedObj.particleProps || {}),
                      color,
                      size,
                      opacity,
                    }
                  });
                }}
              >
                <option value="fire">Fire</option>
                <option value="tornado">Tornado</option>
                <option value="smoke">Smoke & Steam</option>
                <option value="water">Water Splash</option>
                <option value="sparks">Glowing Sparks</option>
              </select>
            </div>

            {/* Particle Shape Select */}
            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Particle Shape</span>
              <select
                className="w-full bg-bg-deep border border-border text-text-primary px-2 py-1 rounded-[4px] text-[11px] focus:border-accent focus:outline-none transition-all"
                value={selectedObj.particleProps?.shape ?? 'circle'}
                onChange={(e) => {
                  updateObject(selectedObj.id, {
                    particleProps: {
                      ...(selectedObj.particleProps || {}),
                      shape: e.target.value as any
                    }
                  });
                }}
              >
                <option value="realistic">Realistic Puff (Wispy)</option>
                <option value="circle">Soft Circle (Fluffy)</option>
                <option value="spark">Glow Spark (Sharp)</option>
                <option value="square">Digital Square (Voxel)</option>
              </select>
            </div>

            {/* Particle Count */}
            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Particle Count</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="10"
                  max="5000"
                  step="50"
                  className="w-full accent-cyan-400"
                  value={selectedObj.particleProps?.count ?? 150}
                  onChange={(e) => {
                    updateObject(selectedObj.id, {
                      particleProps: {
                        ...(selectedObj.particleProps || {}),
                        count: parseInt(e.target.value)
                      }
                    });
                  }}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {selectedObj.particleProps?.count ?? 150}
                </span>
              </div>
            </div>

            {/* Particle Size */}
            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Particle Size</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.05"
                  max="2.0"
                  step="0.05"
                  className="w-full accent-cyan-400"
                  value={selectedObj.particleProps?.size ?? 0.25}
                  onChange={(e) => {
                    updateObject(selectedObj.id, {
                      particleProps: {
                        ...(selectedObj.particleProps || {}),
                        size: parseFloat(e.target.value)
                      }
                    });
                  }}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {(selectedObj.particleProps?.size ?? 0.25).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Particle Spread */}
            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Spread</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.1"
                  max="10.0"
                  step="0.1"
                  className="w-full accent-cyan-400"
                  value={selectedObj.particleProps?.spread ?? 1.0}
                  onChange={(e) => {
                    updateObject(selectedObj.id, {
                      particleProps: {
                        ...(selectedObj.particleProps || {}),
                        spread: parseFloat(e.target.value)
                      }
                    });
                  }}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {(selectedObj.particleProps?.spread ?? 1.0).toFixed(1)}
                </span>
              </div>
            </div>

            {/* Particle Opacity */}
            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Opacity</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  className="w-full accent-cyan-400"
                  value={selectedObj.particleProps?.opacity ?? 0.6}
                  onChange={(e) => {
                    updateObject(selectedObj.id, {
                      particleProps: {
                        ...(selectedObj.particleProps || {}),
                        opacity: parseFloat(e.target.value)
                      }
                    });
                  }}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {(selectedObj.particleProps?.opacity ?? 0.6).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Particle Color */}
            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Tint Color</span>
              <div className="flex items-center gap-2">
                <div className="relative w-full h-7 rounded border border-border overflow-hidden">
                  <input
                    type="color"
                    className="absolute -inset-2 w-12 h-12 cursor-pointer appearance-none bg-transparent"
                    value={selectedObj.particleProps?.color ?? '#ffffff'}
                    onChange={(e) => {
                      updateObject(selectedObj.id, {
                        particleProps: {
                          ...(selectedObj.particleProps || {}),
                          color: e.target.value
                        }
                      });
                    }}
                  />
                </div>
                <span className="font-mono text-[10px] text-text-primary bg-bg-deep px-1.5 py-1 rounded border border-border uppercase">
                  {selectedObj.particleProps?.color ?? '#ffffff'}
                </span>
              </div>
            </div>

            {/* Particle Speed */}
            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Rise Velocity</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.1"
                  max="5.0"
                  step="0.1"
                  className="w-full accent-cyan-400"
                  value={selectedObj.particleProps?.speed ?? 1.5}
                  onChange={(e) => {
                    updateObject(selectedObj.id, {
                      particleProps: {
                        ...(selectedObj.particleProps || {}),
                        speed: parseFloat(e.target.value)
                      }
                    });
                  }}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {(selectedObj.particleProps?.speed ?? 1.5).toFixed(1)}x
                </span>
              </div>
            </div>

            {/* Particle Lifetime */}
            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Lifetime / Height</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0.5"
                  max="10.0"
                  step="0.1"
                  className="w-full accent-cyan-400"
                  value={selectedObj.particleProps?.lifetime ?? 4.0}
                  onChange={(e) => {
                    updateObject(selectedObj.id, {
                      particleProps: {
                        ...(selectedObj.particleProps || {}),
                        lifetime: parseFloat(e.target.value)
                      }
                    });
                  }}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {(selectedObj.particleProps?.lifetime ?? 4.0).toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Apply Physics (Wind) */}
            <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-border/40">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-emerald-400">Apply Physics (Wind)</span>
                <input
                  type="checkbox"
                  className="w-3.5 h-3.5 accent-emerald-500 rounded border-border"
                  checked={selectedObj.particleProps?.applyPhysics ?? true}
                  onChange={(e) => {
                    updateObject(selectedObj.id, {
                      particleProps: {
                        ...(selectedObj.particleProps || {}),
                        applyPhysics: e.target.checked
                      }
                    });
                  }}
                />
              </div>
              <span className="text-[10px] text-text-secondary leading-normal">
                Enables particles to bend and swirl based on global weather and wind velocity settings.
              </span>
            </div>



            {/* Emit Sparks Layer */}
            {selectedObj.geometry === 'fire' && (
              <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-orange-400">Emit Sparks Layer</span>
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 accent-orange-500 rounded border-border"
                    checked={selectedObj.particleProps?.emitSparks ?? true}
                    onChange={(e) => {
                      updateObject(selectedObj.id, {
                        particleProps: {
                          ...(selectedObj.particleProps || {}),
                          emitSparks: e.target.checked
                        }
                      });
                    }}
                  />
                </div>

                {(selectedObj.particleProps?.emitSparks ?? true) && (
                  <div className="pl-3 border-l-2 border-orange-500/30 flex flex-col gap-2.5 mt-1">
                    {/* Blend Mode */}
                    <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                      <span className="text-[10px] text-text-secondary">Blend Mode</span>
                      <div className="flex gap-1.5">
                        <button
                          className={`flex-1 py-1 rounded text-[10px] font-medium transition-all ${
                            (selectedObj.particleProps?.sparksBlendMode ?? 'additive') === 'additive'
                              ? 'bg-purple-600/90 text-white shadow-sm border border-purple-500/30'
                              : 'bg-bg-deep text-text-secondary hover:text-text-primary border border-border/50'
                          }`}
                          onClick={() => {
                            updateObject(selectedObj.id, {
                              particleProps: {
                                ...(selectedObj.particleProps || {}),
                                sparksBlendMode: 'additive'
                              }
                            });
                          }}
                        >
                          Additive
                        </button>
                        <button
                          className={`flex-1 py-1 rounded text-[10px] font-medium transition-all ${
                            (selectedObj.particleProps?.sparksBlendMode ?? 'additive') === 'normal'
                              ? 'bg-purple-600/90 text-white shadow-sm border border-purple-500/30'
                              : 'bg-bg-deep text-text-secondary hover:text-text-primary border border-border/50'
                          }`}
                          onClick={() => {
                            updateObject(selectedObj.id, {
                              particleProps: {
                                ...(selectedObj.particleProps || {}),
                                sparksBlendMode: 'normal'
                              }
                            });
                          }}
                        >
                          Normal
                        </button>
                      </div>
                    </div>

                    {/* Emission Rate */}
                    <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                      <span className="text-[10px] text-text-secondary">Emission Rate (p/s)</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="10"
                          max="500"
                          step="10"
                          className="w-full accent-orange-500"
                          value={selectedObj.particleProps?.sparksEmissionRate ?? 200}
                          onChange={(e) => {
                            updateObject(selectedObj.id, {
                              particleProps: {
                                ...(selectedObj.particleProps || {}),
                                sparksEmissionRate: parseInt(e.target.value)
                              }
                            });
                          }}
                        />
                        <span className="w-8 font-mono text-[9px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                          {selectedObj.particleProps?.sparksEmissionRate ?? 200}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Section>
        )}

        {/* Material Group */}
        {selectedObj.material && selectedObj.type !== 'gltf' && !isParticleEffect && (
          <Section title="Material" icon={Layers} colorClass="text-orange-400">
            <div className="grid grid-cols-[80px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Preset</span>
              <select
                className="w-full bg-bg-deep border border-border text-text-primary px-2 py-1 rounded-[4px] text-[11px] focus:border-accent focus:outline-none transition-all"
                onChange={(e) => {
                  const preset = e.target.value;
                  let updates = {
                    roughness: selectedObj.material!.roughness,
                    metalness: selectedObj.material!.metalness,
                    envMapIntensity: selectedObj.material!.envMapIntensity,
                  };
                  if (preset === 'plastic') updates = { roughness: 0.2, metalness: 0, envMapIntensity: 1 };
                  if (preset === 'neon') updates = { roughness: 1, metalness: 0, envMapIntensity: 5 };
                  if (preset === 'metal') updates = { roughness: 0.1, metalness: 0.9, envMapIntensity: 1 };
                  if (preset === 'glass') updates = { roughness: 0, metalness: 0.1, envMapIntensity: 1 };

                  updateObject(selectedObj.id, {
                    material: { ...selectedObj.material!, ...updates },
                  });
                }}
                value={
                  selectedObj.material.envMapIntensity > 2
                    ? 'neon'
                    : selectedObj.material.metalness > 0.8
                      ? 'metal'
                      : selectedObj.material.roughness < 0.1
                        ? 'glass'
                        : selectedObj.material.roughness === 0.2 && selectedObj.material.metalness === 0
                          ? 'plastic'
                          : 'custom'
                }
              >
                <option value="custom">Custom</option>
                <option value="plastic">Smooth Plastic</option>
                <option value="neon">Neon</option>
                <option value="metal">Metal</option>
                <option value="glass">Ice/Glass</option>
              </select>
            </div>

            <div className="grid grid-cols-[80px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Base Color</span>
              <div className="flex items-center gap-2">
                <div className="relative w-full h-7 rounded border border-border overflow-hidden">
                  <input
                    type="color"
                    className="absolute -inset-2 w-12 h-12 cursor-pointer appearance-none"
                    value={selectedObj.material.color}
                    onChange={(e) => handleMaterialChange('color', e.target.value)}
                  />
                </div>
                <span className="font-mono text-[10px] text-text-primary bg-bg-deep px-1.5 py-1 rounded border border-border">
                  {selectedObj.material.color}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[80px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Texture</span>
              <select
                className="w-full bg-bg-deep border border-border text-text-primary px-2 py-1 rounded-[4px] text-[11px] focus:border-accent focus:outline-none transition-all"
                onChange={(e) => handleMaterialChange('map', e.target.value)}
                value={selectedObj.material.map || ''}
              >
                <option value="">None (Color Only)</option>
                <option value="grid">Grid Pattern</option>
                <option value="brick">Brick Wall</option>
                <option value="wood">Hardwood</option>
                <option value="metal">Metal Plate</option>
              </select>
            </div>

            <div className="grid grid-cols-[80px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Roughness</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  className="w-full accent-accent"
                  value={selectedObj.material.roughness}
                  onChange={(e) => handleMaterialChange('roughness', parseFloat(e.target.value))}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {selectedObj.material.roughness.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[80px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Metallic</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  className="w-full accent-accent"
                  value={selectedObj.material.metalness}
                  onChange={(e) => handleMaterialChange('metalness', parseFloat(e.target.value))}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {selectedObj.material.metalness.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[80px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Emission</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  className="w-full accent-accent"
                  value={selectedObj.material.envMapIntensity}
                  onChange={(e) => handleMaterialChange('envMapIntensity', parseFloat(e.target.value))}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {selectedObj.material.envMapIntensity.toFixed(2)}
                </span>
              </div>
            </div>
          </Section>
        )}

        {/* Light Group */}
        {selectedObj.type === 'light' && selectedObj.lightProps && (
          <Section title={
            selectedObj.lightProps.lightType === 'spot' ? 'Spot Light' :
            selectedObj.lightProps.lightType === 'directional' ? 'Directional Light' :
            'Point Light'
          } icon={Sun} colorClass="text-yellow-500">
            <div className="grid grid-cols-[80px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Type</span>
              <select
                className="w-full bg-bg-deep border border-border text-text-primary px-2 py-1 rounded-[4px] text-[11px] focus:border-accent focus:outline-none transition-all"
                value={selectedObj.lightProps.lightType || 'point'}
                onChange={(e) =>
                  updateObject(selectedObj.id, {
                    lightProps: { ...selectedObj.lightProps!, lightType: e.target.value as any },
                  })
                }
              >
                <option value="point">Point Light</option>
                <option value="spot">Spot Light</option>
                <option value="directional">Directional Light</option>
              </select>
            </div>

            <div className="grid grid-cols-[80px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Color</span>
              <div className="flex items-center gap-2">
                <div className="relative w-full h-7 rounded border border-border overflow-hidden">
                  <input
                    type="color"
                    value={selectedObj.lightProps.color}
                    onChange={(e) =>
                      updateObject(selectedObj.id, {
                        lightProps: { ...selectedObj.lightProps!, color: e.target.value },
                      })
                    }
                    className="absolute -inset-2 w-12 h-12 cursor-pointer appearance-none"
                  />
                </div>
                <span className="font-mono text-[10px] text-text-primary bg-bg-deep px-1.5 py-1 rounded border border-border">
                  {selectedObj.lightProps.color}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-[80px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Intensity</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="20"
                  step="0.5"
                  value={selectedObj.lightProps.intensity}
                  onChange={(e) =>
                    updateObject(selectedObj.id, {
                      lightProps: { ...selectedObj.lightProps!, intensity: parseFloat(e.target.value) },
                    })
                  }
                  className="w-full accent-yellow-500"
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {selectedObj.lightProps.intensity.toFixed(1)}
                </span>
              </div>
            </div>

            {/* Radius — only for Point & Spot (directional has infinite range) */}
            {(selectedObj.lightProps.lightType !== 'directional') && (
              <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                <span className="text-[11px] text-text-secondary">Radius</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={selectedObj.lightProps.distance}
                    onChange={(e) =>
                      updateObject(selectedObj.id, {
                        lightProps: { ...selectedObj.lightProps!, distance: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-yellow-500"
                  />
                  <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                    {selectedObj.lightProps.distance.toFixed(0)}
                  </span>
                </div>
              </div>
            )}

            {/* Angle — Spot only */}
            {selectedObj.lightProps.lightType === 'spot' && (
              <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                <span className="text-[11px] text-text-secondary">Angle</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0.05"
                    max="1.57"
                    step="0.01"
                    value={selectedObj.lightProps.angle ?? 0.5}
                    onChange={(e) =>
                      updateObject(selectedObj.id, {
                        lightProps: { ...selectedObj.lightProps!, angle: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-yellow-500"
                  />
                  <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                    {Math.round((selectedObj.lightProps.angle ?? 0.5) * (180 / Math.PI))}°
                  </span>
                </div>
              </div>
            )}

            {/* Penumbra — Spot only */}
            {selectedObj.lightProps.lightType === 'spot' && (
              <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                <span className="text-[11px] text-text-secondary">Penumbra</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedObj.lightProps.penumbra ?? 0.5}
                    onChange={(e) =>
                      updateObject(selectedObj.id, {
                        lightProps: { ...selectedObj.lightProps!, penumbra: parseFloat(e.target.value) },
                      })
                    }
                    className="w-full accent-yellow-500"
                  />
                  <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                    {(selectedObj.lightProps.penumbra ?? 0.5).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </Section>
        )}

        {/* Animation Behavior Group */}
        {selectedObj.type !== 'light' && selectedObj.type !== 'group' && !isParticleEffect && (
          <Section title="Logic Behavior" icon={Settings2} colorClass="text-purple-400">
            <div className="space-y-3">
              <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                <span className="text-[11px] text-text-secondary">On Play</span>
                <select
                  className="bg-bg-deep border border-border text-text-primary px-2 py-1.5 rounded-md w-full font-mono text-[11px] focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-all disabled:opacity-50"
                  value={selectedObj.behavior || 'none'}
                  onChange={(e) =>
                    updateObject(selectedObj.id, { behavior: e.target.value as 'none' | 'spin' | 'float' | 'follow' })
                  }
                  disabled={isPlaying}
                >
                  <option value="none">Static (None)</option>
                  <option value="spin">Constant Spin</option>
                  <option value="float">Hover & Bob</option>
                  <option value="follow">Follow Camera</option>
                </select>
              </div>
            </div>
          </Section>
        )}

        {/* Physics Group */}
        {selectedObj.type !== 'light' && selectedObj.type !== 'group' && !isParticleEffect && (
          <Section title="Physics" icon={Magnet} colorClass="text-orange-400">
            <div className="space-y-3">
              <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                <span className="text-[11px] text-text-secondary">Body Type</span>
                <select
                  className="bg-bg-deep border border-border text-text-primary px-2 py-1.5 rounded-md w-full font-mono text-[11px] focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-all disabled:opacity-50"
                  value={selectedObj.physics || 'none'}
                  disabled={isPlaying}
                  onChange={(e) => updateObject(selectedObj.id, { physics: e.target.value as any })}
                >
                  <option value="none">None (No Colli.)</option>
                  <option value="dynamic">Dynamic (Gravity)</option>
                  <option value="fixed">Fixed (Static)</option>
                </select>
              </div>

              {selectedObj.physics && selectedObj.physics !== 'none' && (
                <>
                  <div className="grid grid-cols-[80px_1fr] items-center gap-2 mb-1">
                    <span className="text-[11px] text-text-secondary">Collisions</span>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                        checked={selectedObj.physicsCollisions !== false}
                        disabled={isPlaying}
                        onChange={(e) => updateObject(selectedObj.id, { physicsCollisions: e.target.checked })}
                      />
                      <span className="text-xs text-text-primary">Enabled</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-[80px_1fr] items-center gap-2 mb-1">
                    <span className="text-[11px] text-text-secondary">Anchored</span>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                        checked={selectedObj.anchored === true}
                        disabled={isPlaying}
                        onChange={(e) => updateObject(selectedObj.id, { anchored: e.target.checked })}
                      />
                      <span className="text-xs text-text-primary">Enabled</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-[80px_1fr] items-center gap-2 mb-1">
                    <span className="text-[11px] text-text-secondary">Is Solid</span>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                        checked={selectedObj.isSolid === true}
                        disabled={isPlaying}
                        onChange={(e) => updateObject(selectedObj.id, { isSolid: e.target.checked })}
                      />
                      <span className="text-xs text-text-primary">Enabled</span>
                    </label>
                  </div>

                  {selectedObj.physicsCollisions !== false && (
                    <div className="grid grid-cols-[80px_1fr] items-center gap-2 mb-2">
                      <span className="text-[11px] text-text-secondary">Collider Shape</span>
                      <select
                        className="w-full bg-bg-deep border border-border rounded px-2 py-1 text-xs text-text-primary focus:border-accent outline-none"
                        value={selectedObj.physicsColliderType || 'auto'}
                        disabled={isPlaying}
                        onChange={(e) => updateObject(selectedObj.id, { physicsColliderType: e.target.value as any })}
                      >
                        <option value="auto">Auto (Hull)</option>
                        <option value="cuboid">Cuboid / Box</option>
                        <option value="ball">Ball / Sphere</option>
                        <option value="hull">Convex Hull</option>
                        <option value="trimesh">Trimesh (Complex)</option>
                      </select>
                    </div>
                  )}

                  <div className="h-px bg-border my-2" />
                  <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary">Mass (kg)</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        className="w-full bg-bg-deep border border-border text-text-primary px-2 py-1 rounded-[4px] font-mono text-[11px] focus:border-accent focus:outline-none disabled:opacity-50"
                        value={selectedObj.physicsMass ?? 1}
                        disabled={selectedObj.physics === 'fixed' || isPlaying}
                        onChange={(e) =>
                          updateObject(selectedObj.id, { physicsMass: Math.max(0.1, parseFloat(e.target.value) || 1) })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary">Bounciness</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        className="w-full accent-orange-400 disabled:opacity-50"
                        value={selectedObj.physicsRestitution ?? 0}
                        disabled={isPlaying}
                        onChange={(e) =>
                          updateObject(selectedObj.id, { physicsRestitution: parseFloat(e.target.value) })
                        }
                      />
                      <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {(selectedObj.physicsRestitution ?? 0).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary">Friction</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        className="w-full accent-orange-400 disabled:opacity-50"
                        value={selectedObj.physicsFriction ?? 0.5}
                        disabled={isPlaying}
                        onChange={(e) => updateObject(selectedObj.id, { physicsFriction: parseFloat(e.target.value) })}
                      />
                      <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {(selectedObj.physicsFriction ?? 0.5).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
