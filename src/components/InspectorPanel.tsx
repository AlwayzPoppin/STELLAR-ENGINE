import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore, EnvironmentSettings } from '../store/useStore';
import { useAssetStore } from '../store/useAssetStore';
import {
  Settings2,
  SlidersHorizontal,
  Sun,
  Layers,
  Box,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Hash,
  Magnet,
  Eye,
  Brush,
  Trash2,
  Bone,
  Plus,
  Dna,
  RotateCcw,
  Sliders,
  Flame,
  Play,
  Pause,
  Activity,
  Search,
  X,
  Folder,
} from 'lucide-react';
import { ScrubbableInput } from './ScrubbableInput';
import { AssetThumbnailPlaceholder } from './AssetCard';

const Section = ({ title, icon: Icon, colorClass = 'text-text-secondary', defaultExpanded = true, children }: any) => {
  const [expanded, setExpanded] = useState(defaultExpanded);

  React.useEffect(() => {
    const handleGlobalToggle = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setExpanded(customEvent.detail);
    };
    window.addEventListener('stellar-inspector-expand-all', handleGlobalToggle);
    return () => {
      window.removeEventListener('stellar-inspector-expand-all', handleGlobalToggle);
    };
  }, []);

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
    toggleInspector,
    isPickingAsset,
    setIsPickingAsset,
    activePickerTarget,
    setActivePickerTarget,
  } = useStore();

  const [isReplacingMesh, setIsReplacingMesh] = useState(false);
  const [meshSearch, setMeshSearch] = useState('');

  const { assets } = useAssetStore();
  const models = assets.filter(a => a.type === 'model' && a.url);
  const foliageModels = models.filter((m) =>
    ['grass', 'tree', 'rock', 'stone', 'dirt', 'log', 'bush', 'plant', 'flower'].some((k) =>
      m.name.toLowerCase().includes(k)
    )
  );



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
                {foliageModels.map((m) => {
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
          {/* Expand/Collapse All controls */}
          <div className="flex justify-end gap-2 px-1 text-[10px] pb-1 border-b border-border/20">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('stellar-inspector-expand-all', { detail: true }))}
              className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer font-medium border-none bg-transparent"
            >
              Expand All
            </button>
            <span className="text-text-secondary/40 select-none">|</span>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('stellar-inspector-expand-all', { detail: false }))}
              className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer font-medium border-none bg-transparent"
            >
              Collapse All
            </button>
          </div>

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
      <div
        role="region"
        aria-label="Object Properties Inspector"
        className="flex flex-col h-full select-none bg-bg-surface/80 backdrop-blur-md"
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-neutral-900/50">
          <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-500">Inspector</span>
          <button
            onClick={toggleInspector}
            className="p-1 hover:bg-neutral-800 rounded-md text-neutral-500 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            title="Collapse Panel"
          >
            <ChevronRight size={14} />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-xs text-text-secondary/50">
          <SlidersHorizontal size={32} className="mb-3 opacity-20" />
          Select an object in the viewport or outliner to inspect properties.
        </div>
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
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-neutral-900/50">
        <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-500">Inspector</span>
        <button
          onClick={toggleInspector}
          className="p-1 hover:bg-neutral-800 rounded-md text-neutral-500 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
          title="Collapse Panel"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="p-3 space-y-4">
        {/* Expand/Collapse All controls */}
        <div className="flex justify-end gap-2 px-1 text-[10px] pb-1 border-b border-border/20">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('stellar-inspector-expand-all', { detail: true }))}
            className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer font-medium border-none bg-transparent"
          >
            Expand All
          </button>
          <span className="text-text-secondary/40 select-none">|</span>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('stellar-inspector-expand-all', { detail: false }))}
            className="text-text-secondary hover:text-text-primary transition-colors cursor-pointer font-medium border-none bg-transparent"
          >
            Collapse All
          </button>
        </div>

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

        {(selectedObj.type === 'mesh' || selectedObj.type === 'gltf' || (selectedObj.type as string) === 'fbx') && (
          <Section title="Asset Source" icon={Layers} colorClass="text-sky-400">
            <div className="space-y-3">
              {/* Asset visual card */}
              <div className="flex gap-3 bg-bg-deep/40 p-2.5 rounded-lg border border-border/40 items-center">
                {/* Thumbnail area */}
                <div className="w-12 h-12 rounded border border-border/60 bg-neutral-950 overflow-hidden shrink-0 flex items-center justify-center relative shadow-inner">
                  {selectedObj.type === 'gltf' || (selectedObj.type as string) === 'fbx' ? (
                    (() => {
                      const matchedAsset = assets.find(a => a.url === selectedObj.url);
                      return (matchedAsset && matchedAsset.thumbnailUrl) ? (
                        <img src={matchedAsset.thumbnailUrl} alt={selectedObj.name} className="w-full h-full object-cover" />
                      ) : (
                        <AssetThumbnailPlaceholder type={selectedObj.type} category="Models" />
                      );
                    })()
                  ) : (
                    // Primitive visual placeholder (a simple clean Box SVG)
                    <svg className="w-8 h-8 opacity-70" viewBox="0 0 100 100" fill="none">
                      <rect x="20" y="20" width="60" height="60" rx="4" stroke="#94a3b8" strokeWidth="2" />
                      <path d="M20 20 L50 40 L80 20 M50 40 L50 80" stroke="#64748b" strokeWidth="1.5" />
                    </svg>
                  )}
                </div>

                {/* Details area */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-[9px] text-text-secondary font-bold uppercase tracking-wider leading-none mb-1">
                    {selectedObj.type === 'gltf' || (selectedObj.type as string) === 'fbx' ? '3D Model Asset' : 'Primitive Shape'}
                  </div>
                  <div className="text-[10.5px] text-text-primary font-bold truncate">
                    {selectedObj.type === 'gltf' || (selectedObj.type as string) === 'fbx'
                      ? (assets.find(a => a.url === selectedObj.url)?.name || selectedObj.url?.split('/').pop() || 'Unknown Model')
                      : `${selectedObj.geometry ? selectedObj.geometry.charAt(0).toUpperCase() + selectedObj.geometry.slice(1) : 'Box'} Geometry`
                    }
                  </div>
                  <div className="text-[8.5px] text-text-secondary/70 font-mono truncate mt-0.5" title={selectedObj.url || 'Built-in Procedural Mesh'}>
                    {selectedObj.type === 'gltf' || (selectedObj.type as string) === 'fbx'
                      ? selectedObj.url
                      : 'Built-in Procedural Mesh'
                    }
                  </div>
                </div>
              </div>

              {/* Replace Button */}
              <button
                type="button"
                onClick={() => setIsReplacingMesh(true)}
                className="w-full py-1.5 px-3 bg-accent hover:bg-accent/80 text-white font-semibold rounded-md text-[10.5px] font-sans transition-all duration-150 active:scale-[0.98] shadow-sm flex items-center justify-center gap-1.5 cursor-pointer border-none"
              >
                <Layers size={12} />
                <span>Replace Mesh</span>
              </button>
            </div>
          </Section>
        )}

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
                  let updates: any = {
                    roughness: selectedObj.material!.roughness,
                    metalness: selectedObj.material!.metalness,
                    envMapIntensity: selectedObj.material!.envMapIntensity,
                  };

                  if (preset !== 'water_lake' && preset !== 'water_sea' && preset !== 'water_tropical') {
                    if (selectedObj.material!.map === 'water') updates.map = undefined;
                    if (selectedObj.material!.normalMap === 'water') updates.normalMap = undefined;
                    updates.waveHeight = undefined;
                    updates.waveSpeed = undefined;
                  }

                  if (preset === 'plastic') {
                    updates = { ...updates, roughness: 0.2, metalness: 0, envMapIntensity: 1 };
                  }
                  if (preset === 'neon') {
                    updates = { ...updates, roughness: 1, metalness: 0, envMapIntensity: 5 };
                  }
                  if (preset === 'metal') {
                    updates = { ...updates, roughness: 0.1, metalness: 0.9, envMapIntensity: 1 };
                  }
                  if (preset === 'glass') {
                    updates = { ...updates, roughness: 0, metalness: 0.1, envMapIntensity: 1 };
                  }
                  if (preset === 'water' || preset === 'water_lake') {
                    updates = {
                      color: '#0f5e9c',
                      roughness: 0.05,
                      metalness: 0.1,
                      envMapIntensity: 1,
                      map: 'water',
                      normalMap: 'water',
                      repeatX: 4,
                      repeatY: 4,
                      waveHeight: 0.08,
                      waveSpeed: 1.0,
                    };
                  }
                  if (preset === 'water_sea') {
                    updates = {
                      color: '#021447',
                      roughness: 0.05,
                      metalness: 0.1,
                      envMapIntensity: 1.2,
                      map: 'water',
                      normalMap: 'water',
                      repeatX: 6,
                      repeatY: 6,
                      waveHeight: 0.18,
                      waveSpeed: 1.3,
                    };
                  }
                  if (preset === 'water_tropical') {
                    updates = {
                      color: '#058596',
                      roughness: 0.05,
                      metalness: 0.1,
                      envMapIntensity: 1.0,
                      map: 'water',
                      normalMap: 'water',
                      repeatX: 3,
                      repeatY: 3,
                      waveHeight: 0.05,
                      waveSpeed: 0.8,
                    };
                  }

                  const isWaterPreset = preset === 'water' || preset === 'water_lake' || preset === 'water_sea' || preset === 'water_tropical';
                  updateObject(selectedObj.id, {
                    material: { ...selectedObj.material!, ...updates },
                    isSolid: !isWaterPreset,
                    physicsCollisions: !isWaterPreset,
                  });
                }}
                value={
                  selectedObj.material.map === 'water' && selectedObj.material.normalMap === 'water'
                    ? selectedObj.material.color === '#021447'
                      ? 'water_sea'
                      : selectedObj.material.color === '#058596'
                        ? 'water_tropical'
                        : 'water_lake'
                    : selectedObj.material.envMapIntensity > 2
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
                <option value="water_lake">Moving Water (Lake)</option>
                <option value="water_sea">Moving Water (Deep Sea)</option>
                <option value="water_tropical">Moving Water (Tropical)</option>
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
              <span className="text-[11px] text-text-secondary">Preset Map</span>
              <select
                className="w-full bg-bg-deep border border-border text-text-primary px-2 py-1 rounded-[4px] text-[11px] focus:border-accent focus:outline-none transition-all animate-fade-in"
                onChange={(e) => handleMaterialChange('map', e.target.value)}
                value={
                  ['grid', 'brick', 'wood', 'metal', 'water'].includes(selectedObj.material.map || '')
                    ? selectedObj.material.map
                    : selectedObj.material.map ? 'custom' : ''
                }
              >
                <option value="">None (Color Only)</option>
                <option value="grid">Grid Pattern</option>
                <option value="brick">Brick Wall</option>
                <option value="wood">Hardwood</option>
                <option value="metal">Metal Plate</option>
                <option value="water">Moving Water</option>
                {selectedObj.material.map && !['grid', 'brick', 'wood', 'metal', 'water'].includes(selectedObj.material.map) && (
                  <option value="custom">Custom Texture</option>
                )}
              </select>
            </div>

            {/* Custom Color/Base Map Picker */}
            <div className="grid grid-cols-[80px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Custom Map</span>
              <div className="flex gap-1.5 items-center w-full">
                {(() => {
                  const mapPath = selectedObj.material.map || '';
                  const isPreset = ['grid', 'brick', 'wood', 'metal', 'water'].includes(mapPath);
                  const mapDisplayPath = isPreset ? `Preset: ${mapPath}` : mapPath;
                  const mapAsset = assets.find((a) => a.id === mapPath || a.url === mapPath);
                  const mapFileName = mapAsset
                    ? mapAsset.name
                    : mapPath
                      ? isPreset
                        ? `${mapPath.charAt(0).toUpperCase() + mapPath.slice(1)} Preset`
                        : mapPath.split(/[/\\]/).pop() || 'None'
                      : 'None';
                  const isPickingThis = isPickingAsset && activePickerTarget === 'materialMap';
                  return (
                    <>
                      <div
                        className="flex-1 bg-bg-deep/50 border border-border/40 text-text-secondary px-2.5 py-1.5 rounded-[4px] text-[11px] font-mono truncate select-all cursor-default min-w-0"
                        title={mapDisplayPath || 'No texture linked'}
                      >
                        {mapFileName}
                      </div>
                      {mapPath && (
                        <button
                          type="button"
                          onClick={() => handleMaterialChange('map', '')}
                          className="px-2 py-1.5 rounded-[4px] border border-border bg-bg-deep text-red-400 hover:text-red-350 hover:border-red-500/50 transition-all cursor-pointer flex items-center justify-center shrink-0 text-xs font-semibold"
                          title="Remove custom texture"
                        >
                          ×
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (isPickingThis) {
                            setIsPickingAsset(false);
                            setActivePickerTarget(null);
                          } else {
                            setIsPickingAsset(true);
                            setActivePickerTarget('materialMap');
                          }
                        }}
                        className={`px-2 py-1.5 rounded-[4px] border transition-all flex items-center justify-center gap-1 shrink-0 cursor-pointer text-[10px] font-medium ${
                          isPickingThis
                            ? 'bg-accent text-white border-accent shadow-[0_0_12px_rgba(56,189,248,0.5)] animate-pulse'
                            : 'bg-bg-deep border-border text-text-secondary hover:text-text-primary hover:border-text-secondary'
                        }`}
                        title={isPickingThis ? 'Click to cancel picking' : 'Assign from Content Browser'}
                      >
                        <Folder size={11} />
                        <span>{isPickingThis ? 'Picking...' : 'Assign'}</span>
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Custom Normal Map Picker */}
            <div className="grid grid-cols-[80px_1fr] items-center gap-2">
              <span className="text-[11px] text-text-secondary">Normal Map</span>
              <div className="flex gap-1.5 items-center w-full">
                {(() => {
                  const normalPath = selectedObj.material.normalMap || '';
                  const normalAsset = assets.find((a) => a.id === normalPath || a.url === normalPath);
                  const normalFileName = normalAsset
                    ? normalAsset.name
                    : normalPath
                      ? normalPath.split(/[/\\]/).pop() || 'None'
                      : 'None';
                  const isPickingThis = isPickingAsset && activePickerTarget === 'materialNormalMap';
                  return (
                    <>
                      <div
                        className="flex-1 bg-bg-deep/50 border border-border/40 text-text-secondary px-2.5 py-1.5 rounded-[4px] text-[11px] font-mono truncate select-all cursor-default min-w-0"
                        title={normalPath || 'No normal map linked'}
                      >
                        {normalFileName}
                      </div>
                      {normalPath && (
                        <button
                          type="button"
                          onClick={() => handleMaterialChange('normalMap', '')}
                          className="px-2 py-1.5 rounded-[4px] border border-border bg-bg-deep text-red-400 hover:text-red-350 hover:border-red-500/50 transition-all cursor-pointer flex items-center justify-center shrink-0 text-xs font-semibold"
                          title="Remove normal map"
                        >
                          ×
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (isPickingThis) {
                            setIsPickingAsset(false);
                            setActivePickerTarget(null);
                          } else {
                            setIsPickingAsset(true);
                            setActivePickerTarget('materialNormalMap');
                          }
                        }}
                        className={`px-2 py-1.5 rounded-[4px] border transition-all flex items-center justify-center gap-1 shrink-0 cursor-pointer text-[10px] font-medium ${
                          isPickingThis
                            ? 'bg-accent text-white border-accent shadow-[0_0_12px_rgba(56,189,248,0.5)] animate-pulse'
                            : 'bg-bg-deep border-border text-text-secondary hover:text-text-primary hover:border-text-secondary'
                        }`}
                        title={isPickingThis ? 'Click to cancel picking' : 'Assign from Content Browser'}
                      >
                        <Folder size={11} />
                        <span>{isPickingThis ? 'Picking...' : 'Assign'}</span>
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>

            {(selectedObj.material.map || selectedObj.material.normalMap) && (
              <>
                <div className="grid grid-cols-[80px_1fr] items-center gap-2 animate-in fade-in duration-200">
                  <span className="text-[11px] text-text-secondary">Tiling Repeat X</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.1"
                      max="20"
                      step="0.1"
                      className="w-full accent-accent"
                      value={selectedObj.material.repeatX ?? 2}
                      onChange={(e) => handleMaterialChange('repeatX', parseFloat(e.target.value))}
                    />
                    <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {(selectedObj.material.repeatX ?? 2).toFixed(1)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-[80px_1fr] items-center gap-2 animate-in fade-in duration-200">
                  <span className="text-[11px] text-text-secondary">Tiling Repeat Y</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.1"
                      max="20"
                      step="0.1"
                      className="w-full accent-accent"
                      value={selectedObj.material.repeatY ?? 2}
                      onChange={(e) => handleMaterialChange('repeatY', parseFloat(e.target.value))}
                    />
                    <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {(selectedObj.material.repeatY ?? 2).toFixed(1)}
                    </span>
                  </div>
                </div>
              </>
            )}

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

            <div className="grid grid-cols-[80px_1fr] items-center gap-2 animate-fade-in">
              <span className="text-[11px] text-text-secondary">Opacity</span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  className="w-full accent-accent"
                  value={selectedObj.material.opacity ?? 1.0}
                  onChange={(e) => handleMaterialChange('opacity', parseFloat(e.target.value))}
                />
                <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                  {(selectedObj.material.opacity ?? 1.0).toFixed(2)}
                </span>
              </div>
            </div>

            {(() => {
              const isWater =
                selectedObj.material.map === 'water' ||
                selectedObj.material.normalMap === 'water' ||
                (selectedObj.material.map && selectedObj.material.map.includes('waternormals.jpg')) ||
                (selectedObj.material.normalMap && selectedObj.material.normalMap.includes('waternormals.jpg'));
              if (!isWater) return null;
              return (
                <>
                  <div className="grid grid-cols-[80px_1fr] items-center gap-2 animate-fade-in">
                    <span className="text-[11px] text-text-secondary">Wave Height</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="0.5"
                        step="0.01"
                        className="w-full accent-accent"
                        value={selectedObj.material.waveHeight ?? 0.08}
                        onChange={(e) => handleMaterialChange('waveHeight', parseFloat(e.target.value))}
                      />
                      <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {(selectedObj.material.waveHeight ?? 0.08).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-[80px_1fr] items-center gap-2 animate-fade-in">
                    <span className="text-[11px] text-text-secondary">Wave Speed</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="3.0"
                        step="0.1"
                        className="w-full accent-accent"
                        value={selectedObj.material.waveSpeed ?? 1.0}
                        onChange={(e) => handleMaterialChange('waveSpeed', parseFloat(e.target.value))}
                      />
                      <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {(selectedObj.material.waveSpeed ?? 1.0).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}
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
                    updateObject(selectedObj.id, { behavior: e.target.value as 'none' | 'spin' | 'float' | 'follow' | 'buoyancy' })
                  }
                  disabled={isPlaying}
                >
                  <option value="none">Static (None)</option>
                  <option value="spin">Constant Spin</option>
                  <option value="float">Hover & Bob</option>
                  <option value="buoyancy">Buoyant Float</option>
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

        {selectedObj.characterActions && (
          <Section title="Character Actions" icon={Activity} colorClass="text-rose-500">
            <div className="space-y-3">
              {/* Toggles grid */}
              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                    checked={selectedObj.characterActions.autoJump === true}
                    onChange={(e) =>
                      updateObject(selectedObj.id, {
                        characterActions: { ...selectedObj.characterActions!, autoJump: e.target.checked },
                      })
                    }
                  />
                  <span className="text-[11px] text-text-primary">Auto Jump</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                    checked={selectedObj.characterActions.doubleJump === true}
                    onChange={(e) =>
                      updateObject(selectedObj.id, {
                        characterActions: { ...selectedObj.characterActions!, doubleJump: e.target.checked },
                      })
                    }
                  />
                  <span className="text-[11px] text-text-primary">Double Jump</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                    checked={selectedObj.characterActions.sprintEnabled === true}
                    onChange={(e) =>
                      updateObject(selectedObj.id, {
                        characterActions: { ...selectedObj.characterActions!, sprintEnabled: e.target.checked },
                      })
                    }
                  />
                  <span className="text-[11px] text-text-primary">Sprint</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                    checked={selectedObj.characterActions.crouchEnabled === true}
                    onChange={(e) =>
                      updateObject(selectedObj.id, {
                        characterActions: { ...selectedObj.characterActions!, crouchEnabled: e.target.checked },
                      })
                    }
                  />
                  <span className="text-[11px] text-text-primary">Crouch</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                    checked={selectedObj.characterActions.dashEnabled === true}
                    onChange={(e) =>
                      updateObject(selectedObj.id, {
                        characterActions: { ...selectedObj.characterActions!, dashEnabled: e.target.checked },
                      })
                    }
                  />
                  <span className="text-[11px] text-text-primary">Dash / Dodge</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                    checked={selectedObj.characterActions.autoClimb === true}
                    onChange={(e) =>
                      updateObject(selectedObj.id, {
                        characterActions: { ...selectedObj.characterActions!, autoClimb: e.target.checked },
                      })
                    }
                  />
                  <span className="text-[11px] text-text-primary">Auto-Climb</span>
                </label>
              </div>

              {selectedObj.characterActions.dashEnabled && (
                <>
                  <div className="h-px bg-border my-2" />
                  <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary">Dash Dist</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1"
                        max="20"
                        step="0.5"
                        className="w-full accent-rose-500"
                        value={selectedObj.characterActions.dashDistance ?? 5.0}
                        onChange={(e) =>
                          updateObject(selectedObj.id, {
                            characterActions: {
                              ...selectedObj.characterActions!,
                              dashDistance: parseFloat(e.target.value),
                            },
                          })
                        }
                      />
                      <span className="w-10 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {(selectedObj.characterActions.dashDistance ?? 5.0).toFixed(1)}m
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary">Cooldown</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.1"
                        max="5"
                        step="0.1"
                        className="w-full accent-rose-500"
                        value={selectedObj.characterActions.dashCooldown ?? 1.0}
                        onChange={(e) =>
                          updateObject(selectedObj.id, {
                            characterActions: {
                              ...selectedObj.characterActions!,
                              dashCooldown: parseFloat(e.target.value),
                            },
                          })
                        }
                      />
                      <span className="w-10 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {(selectedObj.characterActions.dashCooldown ?? 1.0).toFixed(1)}s
                      </span>
                    </div>
                  </div>
                </>
              )}

              <div className="h-px bg-border my-2" />

              <div className="grid grid-cols-2 gap-2">
                <label className="flex items-center gap-2 cursor-pointer select-none col-span-2">
                  <input
                    type="checkbox"
                    className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                    checked={selectedObj.characterActions.footstepAudioEnabled === true}
                    onChange={(e) =>
                      updateObject(selectedObj.id, {
                        characterActions: {
                          ...selectedObj.characterActions!,
                          footstepAudioEnabled: e.target.checked,
                        },
                      })
                    }
                  />
                  <span className="text-[11px] text-text-primary">Footstep Audio</span>
                </label>
              </div>

              {selectedObj.characterActions.footstepAudioEnabled && (
                <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary">Sample Path</span>
                  <div className="flex gap-1.5 items-center w-full">
                    {(() => {
                      const footstepPath = selectedObj.characterActions.footstepAudioUrl || selectedObj.characterActions.footstepAudioPath || '';
                      const footstepAsset = assets.find((a) => a.id === footstepPath || a.url === footstepPath);
                      const footstepFileName = footstepAsset ? footstepAsset.name : (footstepPath ? footstepPath.split(/[/\\]/).pop() || 'None' : 'None');
                      const isPickingThis = isPickingAsset && activePickerTarget === 'footstepAudioPath';
                      return (
                        <>
                          <div
                            className="flex-1 bg-bg-deep/50 border border-border/40 text-text-secondary px-2.5 py-1.5 rounded-[4px] text-[11px] font-mono truncate select-all cursor-default min-w-0"
                            title={footstepPath || 'No sound linked'}
                          >
                            {footstepFileName}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (isPickingThis) {
                                setIsPickingAsset(false);
                                setActivePickerTarget(null);
                              } else {
                                setIsPickingAsset(true);
                                setActivePickerTarget('footstepAudioPath');
                              }
                            }}
                            className={`px-2.5 py-1.5 rounded-[4px] border transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer text-[11px] font-medium ${
                              isPickingThis
                                ? 'bg-accent text-white border-accent shadow-[0_0_12px_rgba(56,189,248,0.5)] animate-pulse'
                                : 'bg-bg-deep border-border text-text-secondary hover:text-text-primary hover:border-text-secondary'
                            }`}
                            title={isPickingThis ? 'Click to cancel picking' : 'Assign from Browser'}
                          >
                            <Folder size={12} />
                            <span>{isPickingThis ? 'Picking...' : 'Assign'}</span>
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}
      </div>

      {isReplacingMesh && selectedObj &&
        createPortal(
          <div 
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-md z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-200" 
            onClick={() => {
              setIsReplacingMesh(false);
              setMeshSearch('');
            }}
          >
            <div 
              className="bg-bg-panel/75 backdrop-blur-2xl border border-white/10 rounded-2xl w-full max-w-md p-5 flex flex-col shadow-2xl max-h-[80vh] overflow-hidden relative" 
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top ambient glow line */}
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/60 to-transparent" />

              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="text-left">
                  <h3 className="text-sm font-bold text-text-primary tracking-wide">Replace Mesh</h3>
                  <p className="text-[10px] text-text-secondary mt-1 leading-snug">
                    Select a 3D model asset to swap the visual mesh. Logic behaviors, parent hierarchy, and physics properties will remain fully intact.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsReplacingMesh(false);
                    setMeshSearch('');
                  }}
                  className="text-text-secondary hover:text-text-primary transition-colors p-1 bg-neutral-900 border border-neutral-800 rounded-lg cursor-pointer flex items-center justify-center shrink-0"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Search input */}
              <div className="relative mb-4 shrink-0">
                <Search className="absolute left-2.5 top-2.5 text-text-secondary/50" size={12} />
                <input
                  type="text"
                  placeholder="Search 3D models..."
                  value={meshSearch}
                  onChange={(e) => setMeshSearch(e.target.value)}
                  className="w-full bg-bg-deep border border-border text-text-primary pl-8 pr-3 py-1.5 rounded-lg text-[11px] font-sans placeholder-text-secondary/50 focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-all"
                />
              </div>

              {/* Scrollable Model Grid */}
              <div className="grid grid-cols-3 gap-2.5 overflow-y-auto flex-1 pr-1 scrollbar-thin">
                {models
                  .filter((model) => model.name.toLowerCase().includes(meshSearch.toLowerCase()))
                  .map((model) => {
                    return (
                      <div
                        key={model.id}
                        onClick={() => {
                          const isFbx = model.url?.toLowerCase().endsWith('.fbx');
                          updateObject(selectedObj.id, {
                            type: isFbx ? ('fbx' as any) : 'gltf',
                            url: model.url,
                            geometry: undefined,
                          });
                          setIsReplacingMesh(false);
                          setMeshSearch('');
                        }}
                        className="bg-bg-surface/30 hover:bg-accent/10 hover:border-accent/40 border border-border/50 rounded-xl p-2 flex flex-col items-center gap-2 cursor-pointer transition-all duration-150 group relative"
                      >
                        <div className="w-12 h-12 rounded-lg bg-neutral-950/65 overflow-hidden flex items-center justify-center shrink-0 border border-border/20 shadow-inner">
                          {model.thumbnailUrl ? (
                            <img src={model.thumbnailUrl} alt={model.name} className="w-full h-full object-cover" />
                          ) : (
                            <AssetThumbnailPlaceholder type={model.type} category="Models" />
                          )}
                        </div>
                        <div className="flex flex-col w-full text-center min-w-0">
                          <span className="text-[9px] font-semibold text-text-primary truncate px-0.5" title={model.name}>
                            {model.name}
                          </span>
                          <span className="text-[7.5px] text-text-secondary/60 font-mono mt-0.5">
                            {model.url?.toLowerCase().endsWith('.fbx') ? 'fbx' : 'gltf'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                {models.filter((model) => model.name.toLowerCase().includes(meshSearch.toLowerCase())).length === 0 && (
                  <div className="col-span-3 py-8 text-center text-[11px] text-text-secondary">
                    No matching models found.
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end pt-3 border-t border-border/30 mt-4 shrink-0">
                <button
                  onClick={() => {
                    setIsReplacingMesh(false);
                    setMeshSearch('');
                  }}
                  className="px-3.5 py-1.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-text-primary rounded-lg text-[10px] font-bold cursor-pointer active:scale-95 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      }
    </div>
  );
}
