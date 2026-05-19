import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Folder, FileCode2, TerminalSquare, Image as ImageIcon, Box, Search, Upload, X, Clapperboard, Play, Pause, RotateCcw, Bone } from 'lucide-react';
import { useAssetStore } from '../store/useAssetStore';
import { useStore } from '../store/useStore';

function BottomPanel(): JSX.Element {
  const [activeTab, setActiveTab] = useState('browser');
  const { assets, addAsset, deleteAsset, isLoading, error } = useAssetStore();
  const openScript = useStore((s) => s.openScript);
  const { objects, selectedIds, activeTool, setActiveTool, updateJoint } = useStore();

  const selectedId = selectedIds[0] || null;
  const selectedObj = objects.find((o) => o.id === selectedId);

  useEffect(() => {
    if (activeTool === 'skeleton_rig') {
      setActiveTab('animation_preview');
    }
  }, [activeTool]);

  const [isPlayingAnim, setIsPlayingAnim] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const animIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (isPlayingAnim) {
      animIntervalRef.current = setInterval(() => {
        setCurrentFrame((prev) => {
          const next = (prev + 1) % 100;
          
          if (selectedObj && selectedObj.joints && selectedObj.joints.length > 0) {
            const time = (next / 100) * Math.PI * 2;
            const angle = Math.sin(time) * 25;
            
            selectedObj.joints.forEach((joint: any, idx: number) => {
              const direction = idx % 2 === 0 ? 1 : -1;
              updateJoint(selectedObj.id, joint.id, {
                rotation: [0, 0, angle * direction],
              });
            });
          }
          
          return next;
        });
      }, 30);
    } else {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current);
      }
    }
    return () => {
      if (animIntervalRef.current) {
        clearInterval(animIntervalRef.current);
      }
    };
  }, [isPlayingAnim, selectedObj, updateJoint]);

  const tabs = [
    { id: 'browser', label: 'Content Browser', icon: Folder },
    { id: 'animation_preview', label: 'Animation & Rig Preview', icon: Clapperboard },
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
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold tracking-wide border-t border-l border-r rounded-t-lg transition-colors pb-2 -mb-px ${isActive ? 'bg-bg-surface border-border text-accent z-10' : 'bg-bg-panel border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-deep'}`}
              >
                <Icon size={14} className={isActive ? 'text-accent' : ''} /> {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'browser' && (
          <div className="flex gap-3 text-text-secondary items-center pb-2 pr-2">
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
          </div>
        )}
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
        {activeTab === 'animation_preview' && (
          <div className="flex h-full text-text-primary p-3.5 gap-3.5 divide-x divide-border overflow-hidden">
            {/* Left Preview Pane */}
            <div className="flex-1 flex flex-col justify-between pr-3.5 select-none overflow-hidden h-full">
              <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-1.5">
                  <Clapperboard size={14} className="text-amber-400" />
                  <span className="text-xs font-semibold tracking-wider uppercase text-neutral-300">Live Skeleton Bend Rig</span>
                </div>
                {selectedObj ? (
                  <span className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                    Previewing: {selectedObj.name}
                  </span>
                ) : (
                  <span className="text-[10px] text-text-secondary">No model selected</span>
                )}
              </div>

              {/* Skeleton visual graph map */}
              <div className="flex-1 bg-bg-deep/40 border border-border/80 rounded-lg my-2 flex items-center justify-center relative overflow-hidden h-full">
                <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 via-neutral-950 to-black opacity-80" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
                
                {selectedObj && selectedObj.joints && selectedObj.joints.length > 0 ? (
                  <div className="relative z-10 flex flex-col items-center justify-center h-full w-full py-4 overflow-y-auto custom-scrollbar">
                    {/* Golden bone stick-figure visualization diagram */}
                    <div className="flex flex-col gap-6 items-center">
                      {selectedObj.joints.map((joint: any, idx: number) => (
                        <div key={joint.id} className="flex flex-col items-center relative">
                          {/* Bone link vertical bar */}
                          {idx > 0 && (
                            <div className="absolute -top-6 w-[2px] h-6 bg-gradient-to-b from-amber-500 to-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                          )}
                          <div className="flex items-center gap-2 bg-neutral-900 border border-amber-500/40 rounded-full px-3 py-1 shadow-[0_0_12px_rgba(245,158,11,0.15)] hover:border-amber-400 transition-all cursor-pointer">
                            <Bone size={10} className="text-amber-400 animate-pulse" />
                            <span className="text-[10px] font-mono font-semibold text-text-primary">{joint.name}</span>
                            <span className="text-[8px] font-mono text-neutral-500">[{joint.rotation[2].toFixed(0)}°]</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="relative z-10 text-center space-y-2">
                    <Bone size={32} className="mx-auto text-amber-500/30 animate-bounce" />
                    <p className="text-[11px] text-text-secondary max-w-[280px] leading-relaxed font-semibold">
                      {selectedObj
                        ? 'No joint bones rigged yet. Open the Skeleton Rigger on the right panel and add joints!'
                        : 'Select an object in the viewport or Hierarchy panel to view skeletal rigs.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Timeline Controls Pane */}
            <div className="w-[340px] flex flex-col justify-between pl-3.5 select-none shrink-0 h-full">
              <div className="text-xs font-semibold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5 shrink-0">
                <Play size={12} className="text-amber-400" />
                <span>Animation Timeline</span>
              </div>

              {/* Scrubbing slider & Frame meter */}
              <div className="bg-neutral-950/80 border border-border rounded-lg p-3 my-2 space-y-3 flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-center text-[10px] font-mono text-text-secondary">
                  <span>Frame: <strong className="text-amber-400">{currentFrame}</strong> / 100</span>
                  <span>Time: <strong className="text-amber-400">{(currentFrame * 0.03).toFixed(2)}s</strong></span>
                </div>

                {/* Timeline slider */}
                <input
                  type="range"
                  min="0"
                  max="99"
                  value={currentFrame}
                  onChange={(e) => {
                    const f = parseInt(e.target.value) || 0;
                    setCurrentFrame(f);
                    if (selectedObj && selectedObj.joints && selectedObj.joints.length > 0) {
                      const time = (f / 100) * Math.PI * 2;
                      const angle = Math.sin(time) * 25;
                      selectedObj.joints.forEach((joint: any, idx: number) => {
                        const direction = idx % 2 === 0 ? 1 : -1;
                        updateJoint(selectedObj.id, joint.id, {
                          rotation: [0, 0, angle * direction],
                        });
                      });
                    }
                  }}
                  className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />

                {/* Playback Buttons */}
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      setCurrentFrame(0);
                      if (selectedObj && selectedObj.joints) {
                        selectedObj.joints.forEach((joint: any) => {
                          updateJoint(selectedObj.id, joint.id, { rotation: [0, 0, 0] });
                        });
                      }
                    }}
                    className="p-1.5 bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-text-primary rounded cursor-pointer transition-colors"
                    title="Reset to Frame 0"
                  >
                    <RotateCcw size={12} />
                  </button>

                  <button
                    onClick={() => setIsPlayingAnim(!isPlayingAnim)}
                    className={`px-4 py-1.5 ${isPlayingAnim ? 'bg-amber-600 text-white shadow-[0_0_8px_rgba(217,119,6,0.3)]' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'} rounded font-semibold text-[11px] flex items-center gap-1.5 cursor-pointer hover:bg-amber-500/20 transition-all`}
                  >
                    {isPlayingAnim ? (
                      <>
                        <Pause size={12} fill="currentColor" /> Pause Timeline
                      </>
                    ) : (
                      <>
                        <Play size={12} fill="currentColor" /> Play Skeleton
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="text-[9px] text-text-secondary/70 bg-bg-deep/30 border border-border/40 rounded p-2 leading-relaxed shrink-0">
                Timeline plays a rhythmic skeletal loop using real-time degree interpolation. Set bones in the Hierarchy panel to modify connections dynamically.
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
