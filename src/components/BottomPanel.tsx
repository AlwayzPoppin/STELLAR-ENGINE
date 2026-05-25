import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Folder, FileCode2, TerminalSquare, Image as ImageIcon, Box, Search, Upload, X, ChevronDown, Film, Play, Pause, Activity } from 'lucide-react';
import { useAssetStore } from '../store/useAssetStore';
import { useStore } from '../store/useStore';
import { useAnimationStore } from '../store/useAnimationStore';

function BottomPanel(): JSX.Element {
  const [activeTab, setActiveTab] = useState('browser');
  const { assets, addAsset, deleteAsset, isLoading, error } = useAssetStore();
  const openScript = useStore((s) => s.openScript);
  const { objects, selectedIds, activeTool, setActiveTool, updateJoint, toggleBottomPanel, setPreviewedAsset } = useStore();
  const {
    isPlaying,
    setPlaying,
    currentTime,
    setCurrentTime,
    playbackSpeed,
    setPlaybackSpeed,
    clips,
    activeClipId,
    insymmetryEnabled,
    setInsymmetryEnabled,
    gaitAsymmetry,
    setGaitAsymmetry,
    postureBias,
    setPostureBias,
    dynamicVariance,
    setDynamicVariance,
  } = useAnimationStore();

  const selectedId = selectedIds[0] || null;
  const selectedObj = objects.find((o) => o.id === selectedId);

  useEffect(() => {
    if (activeTool === 'skeleton_rig' && selectedId) {
      setPreviewedAsset(selectedId);
    }
  }, [activeTool, selectedId, setPreviewedAsset]);

  useEffect(() => {
    if (activeTool === 'animations') {
      setActiveTab('timeline');
    }
  }, [activeTool]);

  const tabs = [
    { id: 'browser', label: 'Content Browser', icon: Folder },
    { id: 'timeline', label: 'Timeline', icon: Film },
    { id: 'console', label: 'Output Log', icon: TerminalSquare },
  ];

  return (
    <div
      role="region"
      aria-label="Bottom Panel: Content Browser and Console"
      className="flex flex-col h-full bg-bg-surface select-none"
    >
      <div className="bg-bg-panel border-b border-border flex justify-between items-end px-2 pt-2">
        <div className="flex gap-1 h-full">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'timeline') {
                    const targetId = selectedId || 'obj_player';
                    setPreviewedAsset(targetId);
                    setActiveTool('animations');
                  }
                }}
                className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold tracking-wide border-t border-l border-r rounded-t-lg transition-colors pb-2 -mb-px ${isActive ? 'bg-bg-surface border-border text-accent z-10' : 'bg-bg-panel border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-deep'}`}
              >
                <Icon size={14} className={isActive ? 'text-accent' : ''} /> {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 text-text-secondary items-center pb-2 pr-2">
          {activeTab === 'browser' && (
            <>
              <div className="relative flex items-center">
                <Search size={12} className="absolute left-2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search assets..."
                  className="bg-bg-deep border border-border rounded pl-6 pr-2 py-1 text-[10px] text-text-primary focus:outline-none focus:border-accent w-40 placeholder:text-text-secondary/50"
                />
              </div>
              <button
                onClick={() => document.getElementById('asset-upload')?.click()}
                className="flex items-center gap-1.5 text-[10px] font-medium hover:text-text-primary bg-bg-deep border border-border px-2 py-1 rounded transition-colors"
              >
                <Upload size={12} /> Import
              </button>
              <input
                id="asset-upload"
                type="file"
                accept=".glb,.gltf,.png,.jpg,.jpeg,.js,.ts"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    let type: 'material' | 'model' | 'scene' | 'image' | 'script' = 'model';
                    if (file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')) {
                      type = 'image';
                    } else if (file.name.endsWith('.js') || file.name.endsWith('.ts')) {
                      type = 'script';
                    }
                    addAsset({
                      id: crypto.randomUUID(),
                      name: file.name,
                      type: type,
                    });
                    // Reset the input so the same file can be uploaded again if needed
                    e.target.value = '';
                  }
                }}
              />
            </>
          )}

          <button
            onClick={toggleBottomPanel}
            className="text-text-secondary hover:text-text-primary p-0.5 hover:bg-neutral-800 rounded transition-colors cursor-pointer flex items-center justify-center"
            title="Collapse Panel"
          >
            <ChevronDown size={13} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'browser' && (
          <div className="flex flex-wrap gap-4 p-5">
            {isLoading ? (
              <div className="text-text-secondary text-xs">Loading assets...</div>
            ) : error ? (
              <div className="text-red-400 text-xs">Error: {error}</div>
            ) : assets.length === 0 ? (
              <div className="text-text-secondary text-xs">No assets found.</div>
            ) : (
              assets.map((asset) => (
                <div
                  key={asset.id}
                  onClick={() => {
                    if (asset.type === 'model') {
                      setPreviewedAsset(asset.id);
                    }
                  }}
                  className="flex flex-col items-center gap-2 cursor-pointer group w-20 relative"
                  draggable={true}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify(asset));
                  }}
                  onDoubleClick={() => {
                    if (asset.type === 'script') openScript(asset.id);
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAsset(asset.id);
                    }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-600"
                    title="Delete Asset"
                  >
                    <X size={10} />
                  </button>
                  <div className="w-16 h-16 bg-bg-panel rounded-lg flex items-center justify-center transition-all shadow-sm border border-border text-text-secondary group-hover:border-text-secondary group-hover:text-text-primary">
                    {asset.type === 'material' ? (
                      <ImageIcon size={24} strokeWidth={1.5} />
                    ) : asset.type === 'script' ? (
                      <FileCode2 size={24} strokeWidth={1.5} />
                    ) : (
                      <Box size={24} strokeWidth={1.5} />
                    )}
                  </div>
                  <span className="text-[10px] font-medium text-center w-full truncate px-1 rounded text-text-secondary group-hover:text-text-primary">
                    {asset.name}
                  </span>
                </div>
              ))
            )}
          </div>
        )}
        {activeTab === 'timeline' && (
          <div className="flex flex-col h-full bg-neutral-950 p-4 gap-4 select-none">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <Film size={14} className="text-amber-400" />
                <span className="text-xs font-bold text-neutral-200 uppercase tracking-wider">Animation Timeline</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded">
                  {activeClipId ? clips.find(c => c.id === activeClipId)?.name || 'Custom Rig Pose' : 'Manual FK Pose'}
                </span>
              </div>
            </div>

            {/* Visual Tracks & Scrubber */}
            <div className="flex-1 flex flex-col justify-center bg-neutral-900/40 border border-neutral-800/80 rounded-lg p-4 gap-4 min-h-0">
              <div className="flex items-center justify-between text-[10px] font-mono text-neutral-500">
                <span>0.00s</span>
                <span className="text-amber-400 font-bold">{currentTime.toFixed(2)}s</span>
                <span>{(activeClipId ? clips.find(c => c.id === activeClipId)?.duration || 1.0 : 1.0).toFixed(2)}s</span>
              </div>

              {/* Scrubber slider */}
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max={activeClipId ? clips.find(c => c.id === activeClipId)?.duration || 1 : 1}
                  step="0.01"
                  value={currentTime}
                  onChange={(e) => setCurrentTime(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-neutral-955 border border-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              {/* Ticks timeline ruler */}
              <div className="h-6 flex justify-between border-t border-neutral-800/50 pt-1 text-[8px] font-mono text-neutral-600 select-none">
                {Array.from({ length: 11 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="w-[1px] h-1.5 bg-neutral-800" />
                    <span>{(i * 10)}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Procedural Animation Modifiers / Insymmetry Controls */}
            <div className="flex flex-col bg-neutral-900/40 border border-neutral-800/80 p-3 rounded-lg gap-2.5 shrink-0">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-[10px] text-neutral-300 cursor-pointer select-none font-bold uppercase tracking-wider">
                  <input
                    type="checkbox"
                    checked={insymmetryEnabled}
                    onChange={(e) => setInsymmetryEnabled(e.target.checked)}
                    className="rounded bg-neutral-950 border-neutral-800 text-indigo-500 focus:ring-0 cursor-pointer"
                  />
                  <span className="flex items-center gap-1">
                    <Activity size={12} className="text-indigo-400" />
                    Procedural Insymmetry
                  </span>
                </label>
                {insymmetryEnabled && (
                  <span className="text-[8px] font-mono text-indigo-400 font-bold uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                    Procedural Modifiers Active
                  </span>
                )}
              </div>

              {insymmetryEnabled && (
                <div className="grid grid-cols-3 gap-6 pt-1">
                  {/* Limp (Gait) */}
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center justify-between text-[9px] font-mono text-neutral-500 uppercase tracking-wider">
                      <span>Limp (Gait)</span>
                      <span className="font-bold text-indigo-400">{(gaitAsymmetry * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={gaitAsymmetry}
                      onChange={(e) => setGaitAsymmetry(parseFloat(e.target.value))}
                      className="w-full h-1 bg-neutral-955 border border-neutral-850 rounded appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Lean (Posture) */}
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center justify-between text-[9px] font-mono text-neutral-500 uppercase tracking-wider">
                      <span>Lean (Posture)</span>
                      <span className="font-bold text-indigo-400">
                        {postureBias > 0 ? `R:${(postureBias * 100).toFixed(0)}%` : postureBias < 0 ? `L:${(Math.abs(postureBias) * 100).toFixed(0)}%` : '0%'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.05"
                      value={postureBias}
                      onChange={(e) => setPostureBias(parseFloat(e.target.value))}
                      className="w-full h-1 bg-neutral-955 border border-neutral-850 rounded appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  {/* Swagger (Variance) */}
                  <div className="flex flex-col gap-1 w-full">
                    <div className="flex items-center justify-between text-[9px] font-mono text-neutral-500 uppercase tracking-wider">
                      <span>Swagger (Variance)</span>
                      <span className="font-bold text-indigo-400">{(dynamicVariance * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={dynamicVariance}
                      onChange={(e) => setDynamicVariance(parseFloat(e.target.value))}
                      className="w-full h-1 bg-neutral-955 border border-neutral-850 rounded appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Transport controls */}
            <div className="flex items-center gap-4 shrink-0 bg-neutral-900/20 border border-neutral-800/50 p-2.5 rounded-lg">
              <button
                onClick={() => setPlaying(!isPlaying)}
                disabled={!activeClipId}
                className={`p-2 rounded-lg transition-all cursor-pointer flex items-center justify-center border shadow-sm ${!activeClipId ? 'opacity-40 cursor-not-allowed border-neutral-800 text-neutral-600' : isPlaying ? 'bg-amber-600 hover:bg-amber-500 border-amber-500 text-white' : 'bg-neutral-850 hover:bg-neutral-800 border-neutral-750 text-neutral-200'}`}
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              </button>

              <div className="flex-1 flex items-center gap-2">
                <span className="text-[9px] font-mono text-neutral-500 uppercase">Speed</span>
                <input
                  type="range"
                  min="0.25"
                  max="2.0"
                  step="0.05"
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                  className="w-24 h-1 bg-neutral-955 border border-neutral-800 rounded appearance-none cursor-pointer accent-amber-500"
                />
                <span className="text-[9px] font-mono text-neutral-400 w-8">{playbackSpeed.toFixed(2)}x</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    alert("Keyframe created at current timeline frame!");
                  }}
                  className="px-3 py-1.5 bg-sky-600/10 hover:bg-sky-600/20 border border-sky-500/30 hover:border-sky-500/50 text-sky-400 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer"
                >
                  Key Pose
                </button>
                <button
                  onClick={() => setCurrentTime(0)}
                  className="px-3 py-1.5 bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 text-neutral-350 text-[10px] font-bold uppercase tracking-wider rounded transition-all cursor-pointer"
                >
                  Rewind
                </button>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'console' && (
          <div className="font-mono text-[11px] text-text-secondary space-y-1.5 p-4 select-text">
            <div className="text-emerald-400">[Log] Stellar Engine initialized successfully.</div>
            <div>[Log] React Three Fiber mounted securely.</div>
            <div>[Log] Checking environment configs... OK.</div>
            <div className="text-amber-400">[Warn] PostProcessing cache miss for bloom pass.</div>
          </div>
        )}
      </div>
    </div>
  );
}
export default React.memo(BottomPanel);
