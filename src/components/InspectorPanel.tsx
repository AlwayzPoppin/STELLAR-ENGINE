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
  Sparkles,
  Cloud,
  CloudRain,
  Calendar,
  Gamepad2,
  Crosshair,
  Camera,
  Shield,
  Volume2,
  VolumeX,
  Radio,
  Music,
} from 'lucide-react';
import { ScrubbableInput } from './ScrubbableInput';
import { AssetThumbnailPlaceholder } from './AssetCard';
import { toast } from '../store/useToastStore';
import { PROCEDURAL_FOLIAGE_PRESETS } from '../utils/FoliageGeometryLibrary';

export const SUN_LENS_FLARES = [
  { name: 'Classic Clearcut Flare', url: '/Lens_flares_001-clearcut.png' },
  { name: 'Radiant Sunburst Flare', url: '/lens_flare.png' },
  { name: 'Atmospheric Sun Ray', url: '/SUN RAY.png' },
];

export const PUBLIC_LENS_FLARES = [...SUN_LENS_FLARES];

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
  const [massUnit, setMassUnit] = useState<'kg' | 'lbs'>('kg');
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

  const lensFlareLayers = environment.lensFlareLayers || [
    {
      id: 'layer-1',
      name: 'Classic Flare Layer',
      enabled: true,
      textureUrl: '/Lens_flares_001-clearcut.png',
      offsetX: -0.06,
      offsetY: 0.05,
      scale: 3600,
      opacity: 1.0,
    },
  ];

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
            <div className="space-y-3 w-full">
              <div>
                <span className="text-[11px] text-text-secondary block mb-1.5 font-medium">Procedural Presets</span>
                <div className="grid grid-cols-2 gap-1.5">
                  {PROCEDURAL_FOLIAGE_PRESETS.map((preset) => {
                    const isSelected = (foliageBrushAssetId || 'procedural:grass') === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => setFoliageBrushAssetId(preset.id)}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-all text-left cursor-pointer min-w-0 ${
                          isSelected
                            ? 'border-accent bg-accent/15 text-text-primary font-semibold shadow-sm'
                            : 'border-border bg-bg-deep/50 text-text-secondary hover:border-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0 shadow-inner"
                          style={{ backgroundColor: preset.thumbnailColor }}
                        />
                        <span className="text-[10px] truncate">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {foliageModels.length > 0 && (
                <div>
                  <span className="text-[11px] text-text-secondary block mb-1.5 font-medium">Custom 3D Models</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {foliageModels.map((m) => {
                      const isSelected = foliageBrushAssetId === m.url;
                      return (
                        <button
                          key={m.id}
                          onClick={() => setFoliageBrushAssetId(m.url || null)}
                          className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-center cursor-pointer min-w-0 ${
                            isSelected
                              ? 'border-accent bg-accent/15 text-text-primary font-semibold shadow-sm'
                              : 'border-border bg-bg-deep/50 text-text-secondary hover:border-text-secondary hover:text-text-primary'
                          }`}
                        >
                          <Box size={16} className="mb-1 text-sky-400" />
                          <span className="text-[10px] font-medium truncate w-full block">{m.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
  const selectedObj = objects.find((o) => o.id === selectedId) || (
    selectedId === 'sun-light'
      ? ({
          id: 'sun-light',
          name: 'Sun (Directional Light)',
          type: 'SUN',
          position: [100, 100, 100],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          textureUrl: null,
          parentId: 'lighting',
        } as any)
      : selectedId === 'moon-light'
      ? ({
          id: 'moon-light',
          name: 'Moon (Directional Light)',
          type: 'MOON',
          position: [-100, -100, -100],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          textureUrl: null,
          parentId: 'lighting',
        } as any)
      : null
  );

  if (selectedId === 'gameplay_settings') {
    const gs = useStore.getState().gameplaySettings || {
      showCrosshair: true,
      crosshairStyle: 'classic',
      crosshairColor: '#ffffff',
      cameraMode: 'third_person',
      fov: 75,
      pvpDamage: true,
      fallDamage: false,
      respawnTime: 3,
    };
    const updateGS = useStore.getState().updateGameplaySettings;

    return (
      <div role="region" aria-label="Gameplay Settings Inspector" className="flex flex-col h-full select-none bg-bg-surface/80 backdrop-blur-md">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-neutral-900/50">
          <div className="flex items-center gap-2">
            <Gamepad2 size={14} className="text-emerald-400" />
            <span className="text-[11px] font-bold tracking-wider uppercase text-neutral-300">Gameplay Settings</span>
          </div>
          <button
            onClick={toggleInspector}
            className="p-1 hover:bg-neutral-800 rounded-md text-neutral-500 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            title="Collapse Panel"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-3">
          {/* HUD & UI Settings */}
          <Section title="HUD & Reticle UI" icon={Crosshair} colorClass="text-cyan-400">
            <div className="space-y-3 p-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300">Show Crosshair HUD</span>
                <input
                  type="checkbox"
                  checked={gs.showCrosshair}
                  onChange={(e) => updateGS({ showCrosshair: e.target.checked })}
                  className="rounded border-neutral-800 bg-neutral-900 text-emerald-500 focus:ring-0 cursor-pointer"
                />
              </div>

              {gs.showCrosshair && (
                <>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400">Crosshair Style</span>
                    <select
                      value={gs.crosshairStyle}
                      onChange={(e) => updateGS({ crosshairStyle: e.target.value as any })}
                      className="bg-neutral-900 border border-neutral-800 rounded text-xs text-white px-2 py-1"
                    >
                      <option value="classic">Classic Cross</option>
                      <option value="dot">Target Dot</option>
                      <option value="circle">Ring Circle</option>
                      <option value="dynamic">Dynamic Reticle</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400">Crosshair Color</span>
                    <input
                      type="color"
                      value={gs.crosshairColor}
                      onChange={(e) => updateGS({ crosshairColor: e.target.value })}
                      className="w-7 h-7 rounded border border-white/20 bg-transparent p-0 cursor-pointer"
                    />
                  </div>
                </>
              )}
            </div>
          </Section>

          {/* Camera & World Rules */}
          <Section title="Camera & Rules" icon={Camera} colorClass="text-indigo-400">
            <div className="space-y-3 p-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Camera View Mode</span>
                <select
                  value={gs.cameraMode}
                  onChange={(e) => updateGS({ cameraMode: e.target.value as any })}
                  className="bg-neutral-900 border border-neutral-800 rounded text-xs text-white px-2 py-1"
                >
                  <option value="third_person">3rd Person Over-Shoulder</option>
                  <option value="first_person">1st Person FPS</option>
                  <option value="shift_lock">Shift Lock Toggle</option>
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Field of View (FOV)</span>
                  <span className="font-mono text-indigo-400">{gs.fov}°</span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={110}
                  value={gs.fov}
                  onChange={(e) => updateGS({ fov: parseInt(e.target.value, 10) })}
                  className="w-full accent-indigo-500 bg-neutral-900 rounded"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300">PVP Combat Damage</span>
                <input
                  type="checkbox"
                  checked={gs.pvpDamage}
                  onChange={(e) => updateGS({ pvpDamage: e.target.checked })}
                  className="rounded border-neutral-800 bg-neutral-900 text-indigo-500 focus:ring-0 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-300">Fall Damage</span>
                <input
                  type="checkbox"
                  checked={gs.fallDamage}
                  onChange={(e) => updateGS({ fallDamage: e.target.checked })}
                  className="rounded border-neutral-800 bg-neutral-900 text-indigo-500 focus:ring-0 cursor-pointer"
                />
              </div>
            </div>
          </Section>
        </div>
      </div>
    );
  }

  if (selectedId === 'world_settings') {
    const SKY_PRESETS = [
      { label: 'Dawn (5:00 AM)', time: 5.0 },
      { label: 'Morning (9:00 AM)', time: 9.0 },
      { label: 'Noon (12:00 PM)', time: 12.0 },
      { label: 'Afternoon (3:00 PM)', time: 15.0 },
      { label: 'Sunset / Golden Hour (6:30 PM)', time: 18.5 },
      { label: 'Dusk (8:00 PM)', time: 20.0 },
      { label: 'Night (10:00 PM)', time: 22.0 },
      { label: 'Midnight (12:00 AM)', time: 0.0 },
      { label: 'Custom', time: null },
    ];

    const matchedSkyPreset = SKY_PRESETS.find(
      (p) => p.time !== null && Math.abs(environment.timeOfDay - p.time) < 0.2
    );
    const currentSkyPresetLabel = matchedSkyPreset ? matchedSkyPreset.label : 'Custom';

    const seasonSettings = environment.seasonSettings || {
      enabled: false,
      activeSeason: 'spring',
      seasonCycleSpeed: 120,
      currentWeather: 'clear',
      weatherTransitionSpeed: 1.0,
      autoWeatherChange: true,
    };

    const lensFlareLayers = environment.lensFlareLayers || [
      {
        id: 'layer-1',
        name: 'Classic Flare Layer',
        enabled: true,
        textureUrl: '/Lens_flares_001-clearcut.png',
        offsetX: -0.06,
        offsetY: 0.05,
        scale: 3600,
        opacity: 1.0,
      },
    ];

    const skyLayers = (environment as any).skyLayers || [
      {
        id: 'sky-layer-1',
        name: 'Ethereal Clouds',
        enabled: true,
        textureUrl: null,
        offsetX: 0,
        offsetY: 0,
        scale: 1.0,
        opacity: 0.8,
      },
    ];

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

          {/* 1. SEASONS & WEATHER SECTION */}
          <Section title="Seasons & Weather" icon={Calendar} colorClass="text-sky-400">
            <div className="space-y-3">
              <div className="grid grid-cols-[130px_1fr] items-center gap-2">
                <span className="text-[11px] text-text-secondary font-medium">Dynamic Seasons</span>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                    checked={seasonSettings.enabled || false}
                    onChange={(e) =>
                      updateEnvironment({
                        seasonSettings: { ...seasonSettings, enabled: e.target.checked },
                      })
                    }
                  />
                  <span className="text-xs text-text-primary font-medium">
                    {seasonSettings.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </label>
              </div>

              {seasonSettings.enabled && (
                <>
                  <div className="grid grid-cols-[130px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary">Active Season</span>
                    <select
                      className="bg-bg-deep border border-border text-text-primary px-2 py-1 rounded-md w-full font-mono text-[11px] focus:border-accent outline-none"
                      value={seasonSettings.activeSeason || 'spring'}
                      onChange={(e) =>
                        updateEnvironment({
                          seasonSettings: { ...seasonSettings, activeSeason: e.target.value as any },
                        })
                      }
                    >
                      <option value="spring">🌸 Spring</option>
                      <option value="summer">☀️ Summer</option>
                      <option value="autumn">🍂 Autumn</option>
                      <option value="winter">❄️ Winter</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-[130px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary">Cycle Speed</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="10"
                        max="600"
                        step="10"
                        className="w-full accent-sky-400"
                        value={seasonSettings.seasonCycleSpeed || 120}
                        onChange={(e) =>
                          updateEnvironment({
                            seasonSettings: { ...seasonSettings, seasonCycleSpeed: parseInt(e.target.value) },
                          })
                        }
                      />
                      <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {seasonSettings.seasonCycleSpeed || 120}s
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Section>

          {/* 2. ENVIRONMENT & TIME CONTROLS SECTION */}
          <Section title="Environment" icon={Sun} colorClass="text-emerald-500">
            <div className="space-y-3">
              {/* Sky Presets Dropdown */}
              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <span className="text-[11px] text-text-secondary font-medium">Sky Preset</span>
                <select
                  className="bg-bg-deep border border-border text-text-primary px-2 py-1.5 rounded-md w-full font-mono text-[11px] focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none transition-all cursor-pointer"
                  value={currentSkyPresetLabel}
                  onChange={(e) => {
                    const found = SKY_PRESETS.find((p) => p.label === e.target.value);
                    if (found && found.time !== null) {
                      updateEnvironment({ timeOfDay: found.time, skyPreset: found.label });
                      toast.success('Sky Preset Loaded', `Loaded preset: ${found.label}`);
                    }
                  }}
                >
                  {SKY_PRESETS.map((p) => (
                    <option key={p.label} value={p.label}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Time of Day Slider */}
              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <span className="text-[11px] text-text-secondary font-medium">Time of Day</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="24"
                    step="0.1"
                    className="w-full accent-amber-500"
                    value={environment.timeOfDay}
                    onChange={(e) => updateEnvironment({ timeOfDay: parseFloat(e.target.value) })}
                  />
                  <span className="w-10 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                    {environment.timeOfDay.toFixed(1)}h
                  </span>
                </div>
              </div>

              {/* Ambient Light Slider */}
              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <span className="text-[11px] text-text-secondary font-medium">Ambient Light</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.01"
                    className="w-full accent-emerald-500"
                    value={environment.ambientIntensity}
                    onChange={(e) => updateEnvironment({ ambientIntensity: parseFloat(e.target.value) })}
                  />
                  <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                    {environment.ambientIntensity.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Space Mode Checkbox */}
              <div className="flex items-center justify-between pt-1 pb-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-border text-indigo-400 focus:ring-indigo-400 bg-bg-deep w-3.5 h-3.5"
                    checked={environment.spaceEnabled !== false}
                    onChange={(e) => updateEnvironment({ spaceEnabled: e.target.checked, spaceMode: e.target.checked })}
                  />
                  <span className="text-xs text-indigo-300 font-medium">🚀 Space Atmosphere Enabled (Altitude Transition)</span>
                </label>
              </div>

              {/* Exposure Slider */}
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
            </div>
          </Section>

          {/* Volumetric Clouds & Sky Atmosphere Section */}
          <Section title="Volumetric Clouds & Atmosphere" icon={Cloud} colorClass="text-sky-400">
            <div className="space-y-3">
              {/* Enable Clouds Checkbox */}
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                    checked={environment.cloudsEnabled !== false}
                    onChange={(e) => updateEnvironment({ cloudsEnabled: e.target.checked })}
                  />
                  <span className="text-xs text-text-primary font-medium">Volumetric Clouds Enabled</span>
                </label>
              </div>

              {environment.cloudsEnabled !== false && (
                <div className="space-y-2.5">
                  {/* Cloud Preset / Model Type */}
                  <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary font-medium">Cloud Type</span>
                    <select
                      className="bg-bg-deep border border-border text-text-primary px-2 py-1 rounded-md w-full font-mono text-[11px] focus:border-accent outline-none cursor-pointer"
                      value={environment.cloudsType || 'volumetric'}
                      onChange={(e) => updateEnvironment({ cloudsType: e.target.value as any })}
                    >
                      <option value="volumetric">☁️ Volumetric Cumulus</option>
                      <option value="flat">🌤️ Flat Stratus Layer</option>
                      <option value="cirrus">🌫️ Wispy Cirrus</option>
                      <option value="nimbus">🌧️ Storm Nimbus</option>
                      <option value="blizzard">🌨️ Blizzard</option>
                    </select>
                  </div>

                  {/* Cloud Density Slider */}
                  <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary font-medium">Density</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        className="w-full accent-sky-400"
                        value={environment.cloudsDensity ?? 0.5}
                        onChange={(e) => updateEnvironment({ cloudsDensity: parseFloat(e.target.value) })}
                      />
                      <span className="w-10 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {((environment.cloudsDensity ?? 0.5) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  {/* Cloud Speed Slider */}
                  <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary font-medium">Drift Speed</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.0"
                        max="5.0"
                        step="0.1"
                        className="w-full accent-sky-400"
                        value={environment.cloudsSpeed ?? 1.0}
                        onChange={(e) => updateEnvironment({ cloudsSpeed: parseFloat(e.target.value) })}
                      />
                      <span className="w-10 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {(environment.cloudsSpeed ?? 1.0).toFixed(1)}x
                      </span>
                    </div>
                  </div>

                  {/* Cloud Altitude / Height Slider */}
                  <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary font-medium">Altitude</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="100"
                        max="2500"
                        step="10"
                        className="w-full accent-sky-400"
                        value={environment.cloudsAltitude ?? 350}
                        onChange={(e) => updateEnvironment({ cloudsAltitude: parseInt(e.target.value) })}
                      />
                      <span className="w-10 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {environment.cloudsAltitude ?? 350}m
                      </span>
                    </div>
                  </div>

                  {/* Cloud Size / Scale Slider */}
                  <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary font-medium">Cloud Size</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.2"
                        max="8.0"
                        step="0.1"
                        className="w-full accent-sky-400"
                        value={environment.cloudsSize ?? 1.0}
                        onChange={(e) => updateEnvironment({ cloudsSize: parseFloat(e.target.value) })}
                      />
                      <span className="w-10 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {(environment.cloudsSize ?? 1.0).toFixed(1)}x
                      </span>
                    </div>
                  </div>

                  {/* Wind Integration */}
                  <div className="pt-2 border-t border-border/30 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-border text-sky-400 focus:ring-sky-400 bg-bg-deep w-3.5 h-3.5"
                        checked={environment.windEnabled !== false}
                        onChange={(e) => updateEnvironment({ windEnabled: e.target.checked })}
                      />
                      <span className="text-[11px] text-sky-300 font-medium">Wind Simulation & Drift</span>
                    </label>

                    {environment.windEnabled !== false && (
                      <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                        <span className="text-[11px] text-text-secondary font-medium">Wind Strength</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="0.5"
                            max="10.0"
                            step="0.5"
                            className="w-full accent-sky-400"
                            value={environment.windStrength ?? 2.0}
                            onChange={(e) => updateEnvironment({ windStrength: parseFloat(e.target.value) })}
                          />
                          <span className="w-10 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                            {(environment.windStrength ?? 2.0).toFixed(1)}m/s
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* 3. PLANAR SKY LAYERS */}
          <Section title="Planar Sky Layers" icon={Layers} colorClass="text-indigo-400">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-secondary font-medium">Multi-Layer Sky Maps</span>
                <button
                  type="button"
                  onClick={() => {
                    const newSky = {
                      id: `sky-${Date.now()}`,
                      name: `Sky Layer ${skyLayers.length + 1}`,
                      enabled: true,
                      textureUrl: null,
                      offsetX: 0,
                      offsetY: 0,
                      scale: 1.0,
                      opacity: 0.8,
                    };
                    updateEnvironment({ skyLayers: [...skyLayers, newSky] } as any);
                    toast.success('Sky Layer Added', 'New planar sky layer created.');
                  }}
                  className="px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={12} /> Add Sky Layer
                </button>
              </div>

              <div className="space-y-2 mt-2">
                {skyLayers.map((layer: any, idx: number) => (
                  <div key={layer.id || idx} className="p-2.5 bg-bg-deep border border-border rounded-lg space-y-2 relative">
                    <div className="flex items-center justify-between pb-1 border-b border-border/40">
                      <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">
                        Sky Layer {idx + 1}: {layer.name || 'Ethereal Clouds'}
                      </span>
                      {skyLayers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = skyLayers.filter((_: any, i: number) => i !== idx);
                            updateEnvironment({ skyLayers: updated } as any);
                          }}
                          className="text-text-secondary hover:text-rose-400 transition-colors p-0.5 cursor-pointer"
                          title="Remove Layer"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                      <span className="text-[10px] text-text-secondary">Preset Texture</span>
                      <select
                        className="w-full bg-bg-surface border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none"
                        value={layer.name || 'Ethereal Clouds'}
                        onChange={(e) => {
                          const updated = [...skyLayers];
                          updated[idx] = { ...updated[idx], name: e.target.value };
                          updateEnvironment({ skyLayers: updated } as any);
                        }}
                      >
                        <option value="Ethereal Clouds">Ethereal Clouds</option>
                        <option value="Wispy Cirrus">Wispy Cirrus</option>
                        <option value="Cumulus Puffs">Cumulus Puffs</option>
                        <option value="Nebula Glow">Nebula Glow</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                      <span className="text-[10px] text-text-secondary">Offset X / Y</span>
                      <div className="grid grid-cols-2 gap-1">
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step="0.01"
                          className="w-full accent-indigo-400"
                          value={layer.offsetX ?? 0}
                          onChange={(e) => {
                            const updated = [...skyLayers];
                            updated[idx] = { ...updated[idx], offsetX: parseFloat(e.target.value) };
                            updateEnvironment({ skyLayers: updated } as any);
                          }}
                        />
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step="0.01"
                          className="w-full accent-indigo-400"
                          value={layer.offsetY ?? 0}
                          onChange={(e) => {
                            const updated = [...skyLayers];
                            updated[idx] = { ...updated[idx], offsetY: parseFloat(e.target.value) };
                            updateEnvironment({ skyLayers: updated } as any);
                          }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                      <span className="text-[10px] text-text-secondary">Scale & Opacity</span>
                      <div className="grid grid-cols-2 gap-1">
                        <input
                          type="range"
                          min="0.1"
                          max="10"
                          step="0.1"
                          className="w-full accent-indigo-400"
                          value={layer.scale ?? 1.0}
                          onChange={(e) => {
                            const updated = [...skyLayers];
                            updated[idx] = { ...updated[idx], scale: parseFloat(e.target.value) };
                            updateEnvironment({ skyLayers: updated } as any);
                          }}
                        />
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          className="w-full accent-indigo-400"
                          value={layer.opacity ?? 0.8}
                          onChange={(e) => {
                            const updated = [...skyLayers];
                            updated[idx] = { ...updated[idx], opacity: parseFloat(e.target.value) };
                            updateEnvironment({ skyLayers: updated } as any);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* 5. ATMOSPHERIC DISTANCE FOG */}
          <Section title="Atmospheric Distance Fog" icon={Cloud} colorClass="text-sky-300">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                    checked={environment.fogEnabled}
                    onChange={(e) => updateEnvironment({ fogEnabled: e.target.checked })}
                  />
                  <span className="text-xs text-text-primary font-medium">Distance Fog Enabled</span>
                </label>
              </div>

              {environment.fogEnabled && (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary font-medium">Fog Color</span>
                    <div className="relative w-full h-7 rounded border border-border overflow-hidden">
                      <input
                        type="color"
                        className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                        value={environment.fogColor || '#a0c4ff'}
                        onChange={(e) => updateEnvironment({ fogColor: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary font-medium">Fog Density</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="0.1"
                        step="0.001"
                        className="w-full accent-sky-400"
                        value={environment.fogDensity ?? 0.015}
                        onChange={(e) => updateEnvironment({ fogDensity: parseFloat(e.target.value) })}
                      />
                      <span className="w-12 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {(environment.fogDensity ?? 0.015).toFixed(3)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* 6. WEATHER & PARTICLES */}
          <Section title="Weather Particles" icon={CloudRain} colorClass="text-blue-400">
            <div className="space-y-3">
              {/* Rain */}
              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <span className="text-[11px] text-text-secondary font-medium">Rain Particles</span>
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
                <div className="space-y-2 pl-2 border-l border-border/40 ml-1">
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

                  <div className="flex flex-col gap-2 mt-1">
                    <label className="text-[11px] text-text-secondary font-medium">Particle Texture</label>
                    {environment.rainTextureUrl ? (
                      <div className="flex items-center gap-2 bg-bg-deep p-2 rounded-lg border border-border">
                        <img src={environment.rainTextureUrl} className="w-8 h-8 rounded object-cover border border-border shrink-0" alt="Rain Texture" />
                        <span className="text-xs text-text-primary truncate flex-1 font-mono">
                          Custom Rain Texture
                        </span>
                        <button
                          type="button"
                          onClick={() => updateEnvironment({ rainTextureUrl: null })}
                          className="text-xs text-rose-400 hover:text-rose-300 transition-colors px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 rounded border border-rose-500/30 cursor-pointer shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-text-secondary/60 italic mb-1">Using default procedural rain particle</div>
                    )}

                    {(() => {
                      const isPickingThis = isPickingAsset && activePickerTarget === 'rainTexture';
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (isPickingThis) {
                              setIsPickingAsset(false);
                              setActivePickerTarget(null);
                            } else {
                              setIsPickingAsset(true);
                              setActivePickerTarget('rainTexture');
                            }
                          }}
                          className={`w-full py-1.5 px-3 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isPickingThis
                              ? 'bg-blue-500/20 border border-blue-500/50 text-blue-300 animate-pulse'
                              : 'bg-accent hover:bg-accent/90 text-white shadow-md'
                          }`}
                        >
                          <Folder size={14} />
                          <span>{isPickingThis ? 'Select Texture in Content Browser...' : environment.rainTextureUrl ? 'Change Rain Texture' : 'Assign Rain Texture from Assets'}</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              )}

              <div className="h-px bg-border my-2" />

              {/* Snow */}
              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <span className="text-[11px] text-text-secondary font-medium">Snow Particles</span>
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
                <div className="space-y-2 pl-2 border-l border-border/40 ml-1">
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

                  <div className="flex flex-col gap-2 mt-1">
                    <label className="text-[11px] text-text-secondary font-medium">Particle Texture</label>
                    {environment.snowTextureUrl ? (
                      <div className="flex items-center gap-2 bg-bg-deep p-2 rounded-lg border border-border">
                        <img src={environment.snowTextureUrl} className="w-8 h-8 rounded object-cover border border-border shrink-0" alt="Snow Texture" />
                        <span className="text-xs text-text-primary truncate flex-1 font-mono">
                          Custom Snow Texture
                        </span>
                        <button
                          type="button"
                          onClick={() => updateEnvironment({ snowTextureUrl: null })}
                          className="text-xs text-rose-400 hover:text-rose-300 transition-colors px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 rounded border border-rose-500/30 cursor-pointer shrink-0"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-text-secondary/60 italic mb-1">Using default procedural snow particle</div>
                    )}

                    {(() => {
                      const isPickingThis = isPickingAsset && activePickerTarget === 'snowTexture';
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (isPickingThis) {
                              setIsPickingAsset(false);
                              setActivePickerTarget(null);
                            } else {
                              setIsPickingAsset(true);
                              setActivePickerTarget('snowTexture');
                            }
                          }}
                          className={`w-full py-1.5 px-3 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            isPickingThis
                              ? 'bg-blue-500/20 border border-blue-500/50 text-blue-300 animate-pulse'
                              : 'bg-accent hover:bg-accent/90 text-white shadow-md'
                          }`}
                        >
                          <Folder size={14} />
                          <span>{isPickingThis ? 'Select Texture in Content Browser...' : environment.snowTextureUrl ? 'Change Snow Texture' : 'Assign Snow Texture from Assets'}</span>
                        </button>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* 7. VISIBILITY & DEBUGGER */}
          <Section title="Visibility & Debug" icon={Eye} colorClass="text-blue-500">
            <div className="space-y-2">
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

  const activePlayerId = useStore.getState().activePlayerId;

  const isStarterPlayer = selectedObj.id === 'starter_player' || 
                          selectedObj.parentId === 'starter_player' ||
                          selectedObj.name === 'Starter Player' ||
                          selectedObj.id === activePlayerId ||
                          !!selectedObj.characterActions;

  const targetPlayerObj = selectedObj.parentId === 'starter_player' || selectedObj.id === activePlayerId
    ? selectedObj 
    : (objects.find((o) => o.parentId === 'starter_player' || o.id === activePlayerId) || selectedObj);

  const targetActions = targetPlayerObj.characterActions || {
    autoJump: false,
    doubleJump: false,
    sprintEnabled: true,
    crouchEnabled: false,
    dashEnabled: false,
    dashDistance: 5.0,
    dashCooldown: 1.0,
    autoClimb: false,
    footstepAudioEnabled: false,
    footstepAudioUrl: '/sounds/footstep.wav',
    cameraZoomEnabled: true,
    minCameraDistance: 2.0,
    maxCameraDistance: 15.0,
  };

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

        {(selectedObj.type === 'SUN' || selectedObj.type === 'MOON' || selectedObj.id === 'sun-light' || selectedObj.id === 'moon-light' || selectedObj.celestialProps) && (
          <>
            <Section title={selectedObj.type === 'MOON' || selectedObj.id === 'moon-light' ? 'Moon & Lunar Controls' : 'Sun & Atmospheric Controls'} icon={Sun} colorClass="text-amber-400">
            <div className="space-y-3">
              {/* Solar Trajectory / Time of Day */}
              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <span className="text-[11px] text-text-secondary font-medium">Time of Day</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="24"
                    step="0.1"
                    className="w-full accent-amber-500"
                    value={environment.timeOfDay}
                    onChange={(e) => updateEnvironment({ timeOfDay: parseFloat(e.target.value) })}
                  />
                  <span className="w-10 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                    {environment.timeOfDay.toFixed(1)}h
                  </span>
                </div>
              </div>

              {/* Light Intensity */}
              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <span className="text-[11px] text-text-secondary font-medium">Light Intensity</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.1"
                    className="w-full accent-amber-500"
                    value={selectedObj.lightProps?.intensity ?? (selectedObj.type === 'SUN' || selectedObj.id === 'sun-light' ? 4.5 : 0.3)}
                    onChange={(e) => {
                      const newIntensity = parseFloat(e.target.value);
                      updateObject(selectedObj.id, {
                        lightProps: { ...selectedObj.lightProps, intensity: newIntensity }
                      });
                      if (selectedObj.type === 'SUN' || selectedObj.id === 'sun-light') {
                        updateEnvironment({ directionalIntensity: newIntensity });
                      }
                    }}
                  />
                  <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                    {(selectedObj.lightProps?.intensity ?? (selectedObj.type === 'SUN' || selectedObj.id === 'sun-light' ? 4.5 : 0.3)).toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Custom Celestial Surface Texture */}
              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <span className="text-[11px] text-text-secondary font-medium">Surface Texture</span>
                <input
                  type="text"
                  className="w-full bg-bg-deep border border-border text-text-primary px-2 py-1 rounded text-[11px] font-mono outline-none focus:border-accent"
                  placeholder="e.g. /sun_texture.png"
                  value={selectedObj.textureUrl || ''}
                  onChange={(e) => updateObject(selectedObj.id, { textureUrl: e.target.value })}
                />
              </div>

              {/* Core Disk Radius & Glow */}
              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <span className="text-[11px] text-text-secondary font-medium">Core Disk Scale</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="50"
                    max="1000"
                    step="10"
                    className="w-full accent-amber-500"
                    value={selectedObj.coreDiskRadius ?? 280}
                    onChange={(e) => updateObject(selectedObj.id, { coreDiskRadius: parseInt(e.target.value) })}
                  />
                  <span className="w-10 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                    {selectedObj.coreDiskRadius ?? 280}px
                  </span>
                </div>
              </div>
            </div>
          </Section>

          {/* Lens Flares Manager Section inside Inspector */}
          <Section title="Lens Flares Manager" icon={Sun} colorClass="text-amber-400">
            <div className="space-y-3">
              <div className="space-y-2 pb-2 border-b border-border/40">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                      checked={environment.lensFlareEnabled !== false}
                      onChange={(e) => updateEnvironment({ lensFlareEnabled: e.target.checked })}
                    />
                    <span className="text-xs text-text-primary font-medium">Lens Flares Enabled</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const newLayer = {
                        id: `layer-${Date.now()}`,
                        name: `Flare Layer ${lensFlareLayers.length + 1}`,
                        enabled: true,
                        textureUrl: '/Lens_flares_001-clearcut.png',
                        sunTextureUrl: '/Lens_flares_001-clearcut.png',
                        moonTextureUrl: '/moon flare.png',
                        autoSwitch: true,
                        offsetX: 0,
                        offsetY: 0,
                        scale: 3600,
                        opacity: 0.8,
                      };
                      updateEnvironment({ lensFlareLayers: [...lensFlareLayers, newLayer] });
                      toast.success('Layer Added', 'New Lens Flare layer created.');
                    }}
                    className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Add Layer
                  </button>
                </div>
              </div>

              {environment.lensFlareEnabled !== false && (
                <div className="space-y-2.5 mt-2">
                  {lensFlareLayers.map((layer: any, idx: number) => {
                    const sunPickerKey = `lensFlareSun_${idx}`;
                    const isPickingSun = isPickingAsset && activePickerTarget === sunPickerKey;

                    return (
                      <div key={layer.id || idx} className="p-2.5 bg-bg-deep border border-border rounded-lg space-y-2.5 relative">
                        <div className="flex items-center justify-between pb-1 border-b border-border/40">
                          <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">
                            Layer {idx + 1}: {layer.name || 'Flare Layer'}
                          </span>
                          {lensFlareLayers.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = lensFlareLayers.filter((_, i) => i !== idx);
                                updateEnvironment({ lensFlareLayers: updated });
                              }}
                              className="text-text-secondary hover:text-rose-400 transition-colors p-0.5 cursor-pointer"
                              title="Remove Layer"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>

                        {/* ☀️ Flare Texture Picker */}
                        <div className="space-y-1">
                          <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                            <span className="text-[10px] text-amber-300 font-medium">Flare Texture</span>
                            <select
                              className="w-full bg-bg-surface border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none cursor-pointer"
                              value={layer.sunTextureUrl || layer.textureUrl || '/Lens_flares_001-clearcut.png'}
                              onChange={(e) => {
                                const updated = [...lensFlareLayers];
                                updated[idx] = {
                                  ...updated[idx],
                                  sunTextureUrl: e.target.value,
                                  textureUrl: e.target.value,
                                };
                                updateEnvironment({ lensFlareLayers: updated });
                              }}
                            >
                              {SUN_LENS_FLARES.map((flare) => (
                                <option key={flare.url} value={flare.url}>
                                  {flare.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (isPickingSun) {
                                setIsPickingAsset(false);
                                setActivePickerTarget(null);
                              } else {
                                setIsPickingAsset(true);
                                setActivePickerTarget(sunPickerKey);
                              }
                            }}
                            className={`w-full py-1 px-2 text-[9px] font-medium rounded flex items-center justify-center gap-1 transition-all cursor-pointer ${
                              isPickingSun
                                ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 animate-pulse'
                                : 'bg-bg-surface hover:bg-bg-highlight border border-border text-text-secondary'
                            }`}
                          >
                            <Folder size={10} />
                            <span>{isPickingSun ? 'Selecting Flare in Content Browser...' : 'Assign Custom Flare Texture'}</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                          <span className="text-[10px] text-text-secondary">Offset X / Y</span>
                          <div className="grid grid-cols-2 gap-1">
                            <input
                              type="range"
                              min="-1"
                              max="1"
                              step="0.01"
                              className="w-full accent-amber-400"
                              value={layer.offsetX ?? -0.06}
                              onChange={(e) => {
                                const updated = [...lensFlareLayers];
                                updated[idx] = { ...updated[idx], offsetX: parseFloat(e.target.value) };
                                updateEnvironment({ lensFlareLayers: updated });
                              }}
                            />
                            <input
                              type="range"
                              min="-1"
                              max="1"
                              step="0.01"
                              className="w-full accent-amber-400"
                              value={layer.offsetY ?? 0.05}
                              onChange={(e) => {
                                const updated = [...lensFlareLayers];
                                updated[idx] = { ...updated[idx], offsetY: parseFloat(e.target.value) };
                                updateEnvironment({ lensFlareLayers: updated });
                              }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                          <span className="text-[10px] text-text-secondary">Scale & Opacity</span>
                          <div className="grid grid-cols-2 gap-1">
                            <input
                              type="range"
                              min="100"
                              max="10000"
                              step="100"
                              className="w-full accent-amber-400"
                              value={layer.scale ?? 3600}
                              onChange={(e) => {
                                const updated = [...lensFlareLayers];
                                updated[idx] = { ...updated[idx], scale: parseFloat(e.target.value) };
                                updateEnvironment({ lensFlareLayers: updated });
                              }}
                            />
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.05"
                              className="w-full accent-amber-400"
                              value={layer.opacity ?? 1.0}
                              onChange={(e) => {
                                const updated = [...lensFlareLayers];
                                updated[idx] = { ...updated[idx], opacity: parseFloat(e.target.value) };
                                updateEnvironment({ lensFlareLayers: updated });
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Section>
          </>
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
                <option value="square">Digital Square</option>
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
                  <div 
                    className="grid grid-cols-[80px_1fr] items-start gap-2 cursor-help"
                    title="Weight of object (in kg or lbs). Controls gravity force, inertia, and fluid displacement depth."
                  >
                    <div className="flex flex-col gap-1.5 pt-1 w-full">
                      <span className="text-[11px] text-text-secondary border-b border-dotted border-text-secondary/40 w-max hover:border-accent hover:text-text-primary transition-colors">Mass</span>
                      <div className="flex items-center bg-bg-deep border border-border/80 rounded p-0.5 select-none w-max">
                        <button
                          type="button"
                          onClick={() => setMassUnit('kg')}
                          className={`px-1 py-0.5 text-[9px] font-bold rounded transition-colors cursor-pointer border-none ${
                            massUnit === 'kg'
                              ? 'bg-accent text-white shadow-xs'
                              : 'text-text-secondary hover:text-text-primary bg-transparent'
                          }`}
                          title="Switch to Kilograms (kg)"
                        >
                          kg
                        </button>
                        <button
                          type="button"
                          onClick={() => setMassUnit('lbs')}
                          className={`px-1 py-0.5 text-[9px] font-bold rounded transition-colors cursor-pointer border-none ${
                            massUnit === 'lbs'
                              ? 'bg-accent text-white shadow-xs'
                              : 'text-text-secondary hover:text-text-primary bg-transparent'
                          }`}
                          title="Switch to Pounds (lbs)"
                        >
                          lbs
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        type="number"
                        step={massUnit === 'kg' ? '0.1' : '0.2'}
                        min="0.1"
                        className="w-full bg-bg-deep border border-border text-text-primary px-2 py-1 rounded-[4px] font-mono text-[11px] focus:border-accent focus:outline-none disabled:opacity-50"
                        value={
                          massUnit === 'kg'
                            ? (selectedObj.physicsMass ?? 1)
                            : parseFloat(((selectedObj.physicsMass ?? 1) * 2.20462).toFixed(2))
                        }
                        disabled={selectedObj.physics === 'fixed' || isPlaying}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (isNaN(val)) return;
                          const massKg = massUnit === 'kg' ? Math.max(0.1, val) : Math.max(0.05, val / 2.20462);
                          updateObject(selectedObj.id, { physicsMass: parseFloat(massKg.toFixed(3)) });
                        }}
                      />
                      <span className="text-[10px] font-mono text-text-tertiary select-none w-6 text-right">
                        {massUnit}
                      </span>
                    </div>
                  </div>

                  <div 
                    className="grid grid-cols-[80px_1fr] items-center gap-2 cursor-help"
                    title="Restitution coefficient (0.0 to 2.0). Higher values retain kinetic energy and cause springy bounces on impact."
                  >
                    <span className="text-[11px] text-text-secondary border-b border-dotted border-text-secondary/40 w-max hover:border-accent hover:text-text-primary transition-colors">Bounciness</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="2"
                        step="0.1"
                        className="w-full accent-orange-400 disabled:opacity-50"
                        value={selectedObj.physicsRestitution ?? 0}
                        disabled={isPlaying}
                        onChange={(e) => updateObject(selectedObj.id, { physicsRestitution: parseFloat(e.target.value) })}
                      />
                      <span className="w-8 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {(selectedObj.physicsRestitution ?? 0).toFixed(1)}
                      </span>
                    </div>
                  </div>

                  <div 
                    className="grid grid-cols-[80px_1fr] items-center gap-2 cursor-help"
                    title="Surface resistance (0.0 to 2.0). Higher values prevent sliding against other objects or terrain."
                  >
                    <span className="text-[11px] text-text-secondary border-b border-dotted border-text-secondary/40 w-max hover:border-accent hover:text-text-primary transition-colors">Friction</span>
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

        {(selectedObj.type === 'SUN' || selectedObj.type === 'MOON' || selectedObj.id === 'sun-light' || selectedObj.id === 'moon-light') && (
          <Section title="Celestial Properties & Texture" icon={Sun} colorClass="text-amber-400">
            <div className="space-y-3">
              <div className="flex flex-col gap-2">
                <label className="text-xs text-text-secondary font-medium">Surface Texture</label>

                {/* Current Texture Preview & Clear */}
                {selectedObj.textureUrl ? (
                  <div className="flex items-center gap-2 bg-bg-deep p-2 rounded-lg border border-border">
                    <img src={selectedObj.textureUrl} className="w-8 h-8 rounded object-cover border border-border shrink-0" alt="Celestial Texture" />
                    <span className="text-xs text-text-primary truncate flex-1 font-mono">
                      {selectedObj.textureName || selectedObj.textureUrl.split(/[/\\]/).pop() || 'Custom Texture'}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateObject(selectedObj.id, { textureUrl: null, textureName: null })}
                      className="text-xs text-rose-400 hover:text-rose-300 transition-colors px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 rounded border border-rose-500/30 cursor-pointer shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="text-xs text-text-secondary/60 italic mb-1">Using default procedural shader</div>
                )}

                {/* Dedicated Sun Optical Lens Flare Preset Quick Picker */}
                {(() => {
                  const isMoonObj = selectedObj.type === 'MOON' || selectedObj.id === 'moon-light';
                  if (isMoonObj) return null;
                  const flaresList = SUN_LENS_FLARES;
                  const activeLayer = (environment.lensFlareLayers || []).find((l: any) => l.targetCelestial === 'sun' || l.targetCelestial === 'auto');

                  return (
                    <div className="pt-2 border-t border-border/40 space-y-1.5">
                      <label className="text-[11px] text-text-secondary font-medium block">☀️ Sun Optical Lens Flare</label>
                      <select
                        className="w-full bg-bg-surface border border-border rounded px-2 py-1 text-xs text-text-primary outline-none cursor-pointer"
                        value={activeLayer?.textureUrl || flaresList[0].url}
                        onChange={(e) => {
                          const newUrl = e.target.value;
                          const currentLayers = [...(environment.lensFlareLayers || [])];
                          const existingIdx = currentLayers.findIndex((l: any) => l.targetCelestial === 'sun');

                          if (existingIdx >= 0) {
                            currentLayers[existingIdx] = {
                              ...currentLayers[existingIdx],
                              textureUrl: newUrl,
                              targetCelestial: 'sun',
                            };
                          } else {
                            currentLayers.push({
                              id: `layer-${Date.now()}`,
                              name: 'Sun Flare',
                              enabled: true,
                              textureUrl: newUrl,
                              offsetX: -0.06,
                              offsetY: 0.05,
                              scale: 3600,
                              opacity: 1.0,
                              targetCelestial: 'sun',
                            });
                          }
                          updateEnvironment({ lensFlareLayers: currentLayers });
                          toast.success('Flare Assigned', 'Assigned flare preset to Sun.');
                        }}
                      >
                        {flaresList.map((f) => (
                          <option key={f.url} value={f.url}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })()}

                {/* Button to Open Content Browser / Asset Vault Picker */}
                {(() => {
                  const isPickingThis = isPickingAsset && activePickerTarget === 'celestialTexture';
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        if (isPickingThis) {
                          setIsPickingAsset(false);
                          setActivePickerTarget(null);
                        } else {
                          setIsPickingAsset(true);
                          setActivePickerTarget('celestialTexture');
                        }
                      }}
                      className={`w-full py-2 px-3 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isPickingThis
                          ? 'bg-amber-500/20 border border-amber-500/50 text-amber-300 animate-pulse'
                          : 'bg-accent hover:bg-accent/90 text-white shadow-md'
                      }`}
                    >
                      <Folder size={14} />
                      <span>{isPickingThis ? 'Select Texture in Content Browser...' : selectedObj.textureUrl ? 'Change Texture from Assets' : 'Assign Texture from Assets'}</span>
                    </button>
                  );
                })()}

                {/* Texture Offset X / Y Controls */}
                <div className="grid grid-cols-[90px_1fr] items-center gap-2 pt-3 border-t border-border/40">
                  <span className="text-[11px] text-text-secondary font-medium">Offset X / Y</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-mono text-text-secondary">X</span>
                      <input
                        type="range"
                        min="-1.0"
                        max="1.0"
                        step="0.01"
                        className="w-full accent-amber-400"
                        value={selectedObj.offsetX ?? 0}
                        onChange={(e) => updateObject(selectedObj.id, { offsetX: parseFloat(e.target.value) })}
                      />
                      <span className="w-8 font-mono text-[9px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {(selectedObj.offsetX ?? 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-mono text-text-secondary">Y</span>
                      <input
                        type="range"
                        min="-1.0"
                        max="1.0"
                        step="0.01"
                        className="w-full accent-amber-400"
                        value={selectedObj.offsetY ?? 0}
                        onChange={(e) => updateObject(selectedObj.id, { offsetY: parseFloat(e.target.value) })}
                      />
                      <span className="w-8 font-mono text-[9px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {(selectedObj.offsetY ?? 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tiling (Repeat X / Y) Controls */}
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary font-medium">Tiling X / Y</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-mono text-text-secondary">X</span>
                      <input
                        type="range"
                        min="0.1"
                        max="10.0"
                        step="0.1"
                        className="w-full accent-amber-400"
                        value={selectedObj.repeatX ?? 1}
                        onChange={(e) => updateObject(selectedObj.id, { repeatX: parseFloat(e.target.value) })}
                      />
                      <span className="w-8 font-mono text-[9px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {(selectedObj.repeatX ?? 1).toFixed(1)}x
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-mono text-text-secondary">Y</span>
                      <input
                        type="range"
                        min="0.1"
                        max="10.0"
                        step="0.1"
                        className="w-full accent-amber-400"
                        value={selectedObj.repeatY ?? 1}
                        onChange={(e) => updateObject(selectedObj.id, { repeatY: parseFloat(e.target.value) })}
                      />
                      <span className="w-8 font-mono text-[9px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {(selectedObj.repeatY ?? 1).toFixed(1)}x
                      </span>
                    </div>
                  </div>
                </div>

                {/* Texture Rotation Control */}
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary font-medium">Rotation</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="1"
                      className="w-full accent-amber-400"
                      value={selectedObj.textureRotation ?? 0}
                      onChange={(e) => updateObject(selectedObj.id, { textureRotation: parseInt(e.target.value) })}
                    />
                    <span className="w-10 font-mono text-[9px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {selectedObj.textureRotation ?? 0}°
                    </span>
                  </div>
                </div>

                {/* Texture Opacity Control */}
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary font-medium">Texture Opacity</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.05"
                      className="w-full accent-amber-400"
                      value={selectedObj.textureOpacity ?? (selectedObj.type === 'MOON' || selectedObj.id === 'moon-light' ? 0.85 : 1.0)}
                      onChange={(e) => updateObject(selectedObj.id, { textureOpacity: parseFloat(e.target.value) })}
                    />
                    <span className="w-10 font-mono text-[9px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {(selectedObj.textureOpacity ?? (selectedObj.type === 'MOON' || selectedObj.id === 'moon-light' ? 0.85 : 1.0)).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Core Disk Radius Control */}
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary font-medium">Core Disk Radius</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="100"
                      max="1000"
                      step="10"
                      className="w-full accent-amber-400"
                      value={selectedObj.coreDiskRadius ?? (selectedObj.type === 'MOON' || selectedObj.id === 'moon-light' ? 180 : 280)}
                      onChange={(e) => updateObject(selectedObj.id, { coreDiskRadius: parseInt(e.target.value) })}
                    />
                    <span className="w-10 font-mono text-[9px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {selectedObj.coreDiskRadius ?? (selectedObj.type === 'MOON' || selectedObj.id === 'moon-light' ? 180 : 280)}px
                    </span>
                  </div>
                </div>

                {/* Glow Intensity Control */}
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary font-medium">Glow Brightness</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0.0"
                      max="4.0"
                      step="0.05"
                      className="w-full accent-amber-400"
                      value={selectedObj.glowIntensity ?? (selectedObj.type === 'MOON' || selectedObj.id === 'moon-light' ? 0.8 : 1.0)}
                      onChange={(e) => updateObject(selectedObj.id, { glowIntensity: parseFloat(e.target.value) })}
                    />
                    <span className="w-10 font-mono text-[9px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {(selectedObj.glowIntensity ?? (selectedObj.type === 'MOON' || selectedObj.id === 'moon-light' ? 0.8 : 1.0)).toFixed(2)}x
                    </span>
                  </div>
                </div>

                {/* Glow Edge Softness Control */}
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary font-medium">Glow Softness</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="1.0"
                      max="5.0"
                      step="0.1"
                      className="w-full accent-amber-400"
                      value={selectedObj.glowExponent ?? (selectedObj.type === 'MOON' || selectedObj.id === 'moon-light' ? 2.2 : 2.8)}
                      onChange={(e) => updateObject(selectedObj.id, { glowExponent: parseFloat(e.target.value) })}
                    />
                    <span className="w-10 font-mono text-[9px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {(selectedObj.glowExponent ?? (selectedObj.type === 'MOON' || selectedObj.id === 'moon-light' ? 2.2 : 2.8)).toFixed(1)}
                    </span>
                  </div>
                </div>

                {/* Mesh Rotation (Y-Axis) — rotate the sphere itself to hide texture seams */}
                <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                  <span className="text-[11px] text-text-secondary font-medium">Mesh Rotation</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="1"
                      className="w-full accent-amber-400"
                      value={selectedObj.meshRotationY ?? 0}
                      onChange={(e) => updateObject(selectedObj.id, { meshRotationY: parseInt(e.target.value) })}
                    />
                    <span className="w-10 font-mono text-[9px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                      {selectedObj.meshRotationY ?? 0}°
                    </span>
                  </div>
                </div>

                {/* Reset Alignment Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      updateObject(selectedObj.id, {
                        offsetX: 0,
                        offsetY: 0,
                        repeatX: 1,
                        repeatY: 1,
                        textureRotation: 0,
                        meshRotationY: 0,
                        textureOpacity: selectedObj.type === 'MOON' || selectedObj.id === 'moon-light' ? 0.85 : 1.0,
                        coreDiskRadius: selectedObj.type === 'MOON' || selectedObj.id === 'moon-light' ? 180 : 280,
                      });
                      toast.success('Alignment Reset', 'Texture alignment, opacity, and radius reset to defaults.');
                    }}
                    className="w-full py-1.5 px-3 text-[11px] font-medium rounded-md bg-bg-deep hover:bg-neutral-800 border border-border hover:border-amber-500/40 text-text-secondary hover:text-amber-300 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw size={12} />
                    <span>Reset Alignment & Tiling</span>
                  </button>
                </div>

                {/* Celestial Glow & Color Controls */}
                <div className="pt-3 border-t border-border/40 space-y-2">
                  <div className="text-[10px] font-semibold tracking-wider text-amber-400/80 uppercase">
                    Light & Surface Glow
                  </div>
                  
                  <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary">Light Tint</span>
                    <div className="relative w-full h-7 rounded border border-border overflow-hidden">
                      <input
                        type="color"
                        className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
                        value={selectedObj.lightProps?.color || (selectedObj.type === 'SUN' ? '#fff7ed' : '#e2e8f0')}
                        onChange={(e) =>
                          updateObject(selectedObj.id, {
                            lightProps: {
                              lightType: 'directional',
                              color: e.target.value,
                              intensity: selectedObj.lightProps?.intensity ?? (selectedObj.type === 'SUN' ? 2.8 : 0.4),
                              distance: selectedObj.lightProps?.distance ?? 1000,
                            },
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary">Glow Intensity</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="5"
                        step="0.1"
                        className="w-full accent-amber-400"
                        value={selectedObj.lightProps?.intensity ?? (selectedObj.type === 'SUN' ? 2.8 : 0.4)}
                        onChange={(e) =>
                          updateObject(selectedObj.id, {
                            lightProps: {
                              lightType: 'directional',
                              color: selectedObj.lightProps?.color || (selectedObj.type === 'SUN' ? '#fff7ed' : '#e2e8f0'),
                              intensity: parseFloat(e.target.value),
                              distance: selectedObj.lightProps?.distance ?? 1000,
                            },
                          })
                        }
                      />
                      <span className="w-8 font-mono text-[9px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {(selectedObj.lightProps?.intensity ?? (selectedObj.type === 'SUN' ? 2.8 : 0.4)).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Section>
        )}

        {isStarterPlayer && (
          <Section title="Character Controller & Camera" icon={Activity} colorClass="text-rose-500">
            <div className="space-y-3.5">
              {/* 1. CAMERA & VIEWPORT */}
              <div>
                <div className="text-[10px] font-semibold tracking-wider text-text-secondary/70 uppercase mb-2">
                  Camera & Viewport
                </div>
                
                <div className="space-y-2">
                  <div className="grid grid-cols-[90px_1fr] items-center gap-2" title="Active gameplay camera mode during simulation.">
                    <span className="text-[11px] text-text-secondary">Camera Mode</span>
                    <select
                      className="w-full bg-bg-deep border border-border rounded px-2 py-1 text-xs text-text-primary focus:border-accent outline-none font-sans"
                      value={environment.cameraMode || 'third-person'}
                      onChange={(e) => updateEnvironment({ cameraMode: e.target.value as any })}
                    >
                      <option value="third-person">Third Person</option>
                      <option value="top-down">Top Down</option>
                      <option value="side-scroller">Side Scroller (2.5D)</option>
                      <option value="moba">MOBA / RTS (Free Orbit & Pan)</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-text-secondary">Mouse Wheel Zoom</span>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                        checked={targetActions.cameraZoomEnabled !== false}
                        onChange={(e) =>
                          updateObject(targetPlayerObj.id, {
                            characterActions: { ...targetActions, cameraZoomEnabled: e.target.checked },
                          })
                        }
                      />
                    </label>
                  </div>

                  {targetActions.cameraZoomEnabled !== false && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between items-center text-[10px] text-text-secondary">
                        <span>Zoom Distance Range</span>
                        <span className="font-mono text-text-primary">
                          {(targetActions.minCameraDistance ?? 2.0).toFixed(1)}m - {(targetActions.maxCameraDistance ?? 15.0).toFixed(1)}m
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div title="Min Zoom (closest distance)">
                          <input
                            type="range"
                            min="0.5"
                            max="10"
                            step="0.5"
                            className="w-full accent-rose-500 cursor-pointer"
                            value={targetActions.minCameraDistance ?? 2.0}
                            onChange={(e) =>
                              updateObject(targetPlayerObj.id, {
                                characterActions: {
                                  ...targetActions,
                                  minCameraDistance: parseFloat(e.target.value),
                                },
                              })
                            }
                          />
                        </div>
                        <div title="Max Zoom (furthest distance)">
                          <input
                            type="range"
                            min="5"
                            max="50"
                            step="1"
                            className="w-full accent-rose-500 cursor-pointer"
                            value={targetActions.maxCameraDistance ?? 15.0}
                            onChange={(e) =>
                              updateObject(targetPlayerObj.id, {
                                characterActions: {
                                  ...targetActions,
                                  maxCameraDistance: parseFloat(e.target.value),
                                },
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-px bg-border/60 my-2" />

              {/* 2. LOCOMOTION & SPEED */}
              <div>
                <div className="text-[10px] font-semibold tracking-wider text-text-secondary/70 uppercase mb-2">
                  Locomotion
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div title="Base walking movement speed (m/s).">
                    <label className="text-[10px] text-text-secondary block mb-1">Walk Speed</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="50"
                      className="w-full bg-bg-deep border border-border text-text-primary px-2 py-1 rounded-[4px] font-mono text-[11px] focus:border-accent focus:outline-none"
                      value={targetPlayerObj.walkSpeed ?? 5.0}
                      onChange={(e) => updateObject(targetPlayerObj.id, { walkSpeed: parseFloat(e.target.value) || 5.0 })}
                    />
                  </div>
                  <div title="Sprint movement speed when holding Shift (m/s).">
                    <label className="text-[10px] text-text-secondary block mb-1">Run Speed</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="100"
                      className="w-full bg-bg-deep border border-border text-text-primary px-2 py-1 rounded-[4px] font-mono text-[11px] focus:border-accent focus:outline-none"
                      value={targetPlayerObj.runSpeed ?? 10.0}
                      onChange={(e) => updateObject(targetPlayerObj.id, { runSpeed: parseFloat(e.target.value) || 10.0 })}
                    />
                  </div>
                  <div className="col-span-2" title="Vertical launch velocity applied when jumping (Spacebar).">
                    <label className="text-[10px] text-text-secondary block mb-1">Jump Power</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="100"
                      className="w-full bg-bg-deep border border-border text-text-primary px-2 py-1 rounded-[4px] font-mono text-[11px] focus:border-accent focus:outline-none"
                      value={targetPlayerObj.jumpHeight ?? 15.0}
                      onChange={(e) => updateObject(targetPlayerObj.id, { jumpHeight: parseFloat(e.target.value) || 15.0 })}
                    />
                  </div>
                </div>
              </div>

              <div className="h-px bg-border/60 my-2" />

              {/* 3. ABILITIES & ACTIONS */}
              <div>
                <div className="text-[10px] font-semibold tracking-wider text-text-secondary/70 uppercase mb-2">
                  Abilities & Actions
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                      checked={targetActions.sprintEnabled === true}
                      onChange={(e) =>
                        updateObject(targetPlayerObj.id, {
                          characterActions: { ...targetActions, sprintEnabled: e.target.checked },
                        })
                      }
                    />
                    <span className="text-[11px] text-text-primary">Sprint</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                      checked={targetActions.crouchEnabled === true}
                      onChange={(e) =>
                        updateObject(targetPlayerObj.id, {
                          characterActions: { ...targetActions, crouchEnabled: e.target.checked },
                        })
                      }
                    />
                    <span className="text-[11px] text-text-primary">Crouch</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                      checked={targetActions.dashEnabled === true}
                      onChange={(e) =>
                        updateObject(targetPlayerObj.id, {
                          characterActions: { ...targetActions, dashEnabled: e.target.checked },
                        })
                      }
                    />
                    <span className="text-[11px] text-text-primary">Dash / Dodge</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                      checked={targetActions.doubleJump === true}
                      onChange={(e) =>
                        updateObject(targetPlayerObj.id, {
                          characterActions: { ...targetActions, doubleJump: e.target.checked },
                        })
                      }
                    />
                    <span className="text-[11px] text-text-primary">Double Jump</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                      checked={targetActions.autoJump === true}
                      onChange={(e) =>
                        updateObject(targetPlayerObj.id, {
                          characterActions: { ...targetActions, autoJump: e.target.checked },
                        })
                      }
                    />
                    <span className="text-[11px] text-text-primary">Auto Jump</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                      checked={targetActions.autoClimb === true}
                      onChange={(e) =>
                        updateObject(targetPlayerObj.id, {
                          characterActions: { ...targetActions, autoClimb: e.target.checked },
                        })
                      }
                    />
                    <span className="text-[11px] text-text-primary">Auto-Climb</span>
                  </label>
                </div>

                {targetActions.dashEnabled && (
                  <div className="space-y-2 pt-2.5">
                    <div className="grid grid-cols-[80px_1fr] items-center gap-2">
                      <span className="text-[11px] text-text-secondary">Dash Dist</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="1"
                          max="20"
                          step="0.5"
                          className="w-full accent-rose-500 cursor-pointer"
                          value={targetActions.dashDistance ?? 5.0}
                          onChange={(e) =>
                            updateObject(targetPlayerObj.id, {
                              characterActions: {
                                ...targetActions,
                                dashDistance: parseFloat(e.target.value),
                              },
                            })
                          }
                        />
                        <span className="w-10 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                          {(targetActions.dashDistance ?? 5.0).toFixed(1)}m
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
                          className="w-full accent-rose-500 cursor-pointer"
                          value={targetActions.dashCooldown ?? 1.0}
                          onChange={(e) =>
                            updateObject(targetPlayerObj.id, {
                              characterActions: {
                                ...targetActions,
                                dashCooldown: parseFloat(e.target.value),
                              },
                            })
                          }
                        />
                        <span className="w-10 font-mono text-[10px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                          {(targetActions.dashCooldown ?? 1.0).toFixed(1)}s
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="h-px bg-border/60 my-2" />

              {/* 4. AUDIO FX */}
              <div>
                <div className="text-[10px] font-semibold tracking-wider text-text-secondary/70 uppercase mb-2">
                  Audio FX
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-text-primary">Footstep Audio</span>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-border text-accent focus:ring-accent bg-bg-deep w-3.5 h-3.5"
                        checked={targetActions.footstepAudioEnabled === true}
                        onChange={(e) =>
                          updateObject(targetPlayerObj.id, {
                            characterActions: {
                              ...targetActions,
                              footstepAudioEnabled: e.target.checked,
                            },
                          })
                        }
                      />
                    </label>
                  </div>

                  {targetActions.footstepAudioEnabled && (
                    <div className="grid grid-cols-[80px_1fr] items-center gap-2 pt-1">
                      <span className="text-[11px] text-text-secondary">Sample Path</span>
                      <div className="flex gap-1.5 items-center w-full">
                        {(() => {
                          const footstepPath = targetActions.footstepAudioUrl || targetActions.footstepAudioPath || '';
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
                                className={`px-2.5 py-1 text-xs rounded border transition-all shrink-0 cursor-pointer ${
                                  isPickingThis
                                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 animate-pulse font-medium'
                                    : 'bg-bg-surface border-border text-text-primary hover:border-accent hover:text-accent'
                                }`}
                              >
                                {isPickingThis ? 'Cancel' : footstepPath ? 'Change' : 'Pick'}
                              </button>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Section>
        )}

        {/* SPATIAL AUDIO & SOUNDSCAPE SECTION */}
        {selectedObj && (
          <Section title="Spatial Audio & Soundscape" icon={Volume2} colorClass="text-emerald-400">
            <div className="space-y-3">
              {/* Enable / Track Audio */}
              <div className="flex items-center justify-between pb-2 border-b border-border/40">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    className="rounded border-border text-emerald-400 focus:ring-emerald-400 bg-bg-deep w-3.5 h-3.5"
                    checked={!!selectedObj.audioProps?.url}
                    onChange={(e) => {
                      if (!e.target.checked) {
                        updateObject(selectedObj.id, {
                          audioProps: undefined,
                        });
                      } else {
                        updateObject(selectedObj.id, {
                          audioProps: {
                            volume: 1,
                            loop: true,
                            refDistance: 1,
                            maxDistance: 50,
                            rolloffFactor: 1,
                            distanceModel: 'inverse',
                            autoplay: true,
                            sourceType: 'point',
                            url: selectedObj.audioProps?.url || '',
                          },
                        });
                      }
                    }}
                  />
                  <span className="text-xs text-text-primary font-medium">Audio Source Active</span>
                </label>

                {selectedObj.audioProps?.url && (
                  <button
                    type="button"
                    onClick={() => {
                      const isMuted = selectedObj.audioProps?.autoplay === false;
                      updateObject(selectedObj.id, {
                        audioProps: {
                          ...selectedObj.audioProps,
                          autoplay: isMuted,
                        },
                      });
                    }}
                    className="p-1 hover:bg-bg-deep rounded text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                    title={selectedObj.audioProps?.autoplay === false ? 'Unmute Audio' : 'Mute Audio'}
                  >
                    {selectedObj.audioProps?.autoplay === false ? <VolumeX size={14} className="text-red-400" /> : <Volume2 size={14} className="text-emerald-400" />}
                  </button>
                )}
              </div>

              {selectedObj.audioProps && (
                <div className="space-y-3 pt-1">
                  {/* Audio Asset / URL Picker */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-text-secondary">Audio Clip Asset</span>
                    <div className="flex gap-1.5 items-center w-full">
                      {(() => {
                        const audioUrl = selectedObj.audioProps.url || '';
                        const audioAsset = assets.find((a) => a.id === audioUrl || a.url === audioUrl);
                        const audioName = audioAsset ? audioAsset.name : (audioUrl ? audioUrl.split(/[/\\]/).pop() || 'Custom URL' : 'None Selected');
                        const isPickingAudio = isPickingAsset && activePickerTarget === `audioUrl_${selectedObj.id}`;

                        return (
                          <>
                            <div
                              className="flex-1 bg-bg-deep/50 border border-border/40 text-text-secondary px-2.5 py-1.5 rounded-[4px] text-[11px] font-mono truncate select-all cursor-default min-w-0"
                              title={audioUrl || 'No audio file linked'}
                            >
                              {audioName}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (isPickingAudio) {
                                  setIsPickingAsset(false);
                                  setActivePickerTarget(null);
                                } else {
                                  setIsPickingAsset(true);
                                  setActivePickerTarget(`audioUrl_${selectedObj.id}`);
                                }
                              }}
                              className={`px-2.5 py-1 text-xs rounded border transition-all shrink-0 cursor-pointer ${
                                isPickingAudio
                                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 animate-pulse font-medium'
                                  : 'bg-bg-surface border-border text-text-primary hover:border-accent hover:text-accent'
                              }`}
                            >
                              {isPickingAudio ? 'Cancel' : audioUrl ? 'Change' : 'Pick'}
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Source Type & Falloff Model */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Source Type</span>
                      <select
                        className="w-full bg-bg-deep border border-border rounded px-2 py-1 text-xs text-text-primary outline-none cursor-pointer"
                        value={selectedObj.audioProps.sourceType || 'point'}
                        onChange={(e) =>
                          updateObject(selectedObj.id, {
                            audioProps: {
                              ...selectedObj.audioProps,
                              sourceType: e.target.value as any,
                            },
                          })
                        }
                      >
                        <option value="point">Point (3D Positional)</option>
                        <option value="ambient">Ambient (Global)</option>
                        <option value="surface">Surface</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] text-text-secondary uppercase tracking-wider font-semibold">Falloff Curve</span>
                      <select
                        className="w-full bg-bg-deep border border-border rounded px-2 py-1 text-xs text-text-primary outline-none cursor-pointer"
                        value={selectedObj.audioProps.distanceModel || 'inverse'}
                        onChange={(e) =>
                          updateObject(selectedObj.id, {
                            audioProps: {
                              ...selectedObj.audioProps,
                              distanceModel: e.target.value as any,
                            },
                          })
                        }
                      >
                        <option value="inverse">Inverse (Realistic)</option>
                        <option value="linear">Linear (Constant)</option>
                        <option value="exponential">Exponential (Sharp)</option>
                      </select>
                    </div>
                  </div>

                  {/* Volume Slider */}
                  <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <span className="text-[11px] text-text-secondary">Master Volume</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        className="w-full accent-emerald-400"
                        value={selectedObj.audioProps.volume ?? 1}
                        onChange={(e) =>
                          updateObject(selectedObj.id, {
                            audioProps: {
                              ...selectedObj.audioProps,
                              volume: parseFloat(e.target.value),
                            },
                          })
                        }
                      />
                      <span className="w-9 font-mono text-[9px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {Math.round((selectedObj.audioProps.volume ?? 1) * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Reference Distance (refDistance) */}
                  <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-text-secondary">Ref Distance</span>
                      <span className="text-[9px] text-text-secondary/50 font-mono">100% Vol Range</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0.5"
                        max="20"
                        step="0.5"
                        className="w-full accent-emerald-400"
                        value={selectedObj.audioProps.refDistance ?? 1}
                        onChange={(e) =>
                          updateObject(selectedObj.id, {
                            audioProps: {
                              ...selectedObj.audioProps,
                              refDistance: parseFloat(e.target.value),
                            },
                          })
                        }
                      />
                      <span className="w-9 font-mono text-[9px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {(selectedObj.audioProps.refDistance ?? 1).toFixed(1)}m
                      </span>
                    </div>
                  </div>

                  {/* Max Distance (maxDistance) */}
                  <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-text-secondary">Max Distance</span>
                      <span className="text-[9px] text-text-secondary/50 font-mono">Audible Limit</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="5"
                        max="200"
                        step="5"
                        className="w-full accent-emerald-400"
                        value={selectedObj.audioProps.maxDistance ?? selectedObj.audioProps.distance ?? 50}
                        onChange={(e) =>
                          updateObject(selectedObj.id, {
                            audioProps: {
                              ...selectedObj.audioProps,
                              maxDistance: parseFloat(e.target.value),
                              distance: parseFloat(e.target.value),
                            },
                          })
                        }
                      />
                      <span className="w-9 font-mono text-[9px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {Math.round(selectedObj.audioProps.maxDistance ?? selectedObj.audioProps.distance ?? 50)}m
                      </span>
                    </div>
                  </div>

                  {/* Rolloff Factor (rolloffFactor) */}
                  <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <div className="flex flex-col">
                      <span className="text-[11px] text-text-secondary">Rolloff Factor</span>
                      <span className="text-[9px] text-text-secondary/50 font-mono">Curve Slope</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="5"
                        step="0.1"
                        className="w-full accent-emerald-400"
                        value={selectedObj.audioProps.rolloffFactor ?? 1}
                        onChange={(e) =>
                          updateObject(selectedObj.id, {
                            audioProps: {
                              ...selectedObj.audioProps,
                              rolloffFactor: parseFloat(e.target.value),
                            },
                          })
                        }
                      />
                      <span className="w-9 font-mono text-[9px] text-text-primary text-right bg-bg-deep px-1 py-0.5 rounded border border-border">
                        {(selectedObj.audioProps.rolloffFactor ?? 1).toFixed(1)}x
                      </span>
                    </div>
                  </div>

                  {/* Playback Settings Checkboxes */}
                  <div className="flex items-center gap-4 pt-1 border-t border-border/40 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-border text-emerald-400 focus:ring-emerald-400 bg-bg-deep w-3.5 h-3.5"
                        checked={selectedObj.audioProps.loop !== false}
                        onChange={(e) =>
                          updateObject(selectedObj.id, {
                            audioProps: {
                              ...selectedObj.audioProps,
                              loop: e.target.checked,
                            },
                          })
                        }
                      />
                      <span className="text-text-primary">Looping</span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="rounded border-border text-emerald-400 focus:ring-emerald-400 bg-bg-deep w-3.5 h-3.5"
                        checked={selectedObj.audioProps.autoplay !== false}
                        onChange={(e) =>
                          updateObject(selectedObj.id, {
                            audioProps: {
                              ...selectedObj.audioProps,
                              autoplay: e.target.checked,
                            },
                          })
                        }
                      />
                      <span className="text-text-primary">Autoplay</span>
                    </label>
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
