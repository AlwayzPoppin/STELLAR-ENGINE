import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Folder, FileCode2, TerminalSquare, Image as ImageIcon, Box, Search, Upload, X, ChevronDown } from 'lucide-react';
import { useAssetStore } from '../store/useAssetStore';
import { useStore } from '../store/useStore';

function BottomPanel(): JSX.Element {
  const [activeTab, setActiveTab] = useState('browser');
  const { assets, addAsset, deleteAsset, isLoading, error } = useAssetStore();
  const openScript = useStore((s) => s.openScript);
  const { objects, selectedIds, activeTool, setActiveTool, updateJoint, toggleBottomPanel, setPreviewedAsset } = useStore();

  const selectedId = selectedIds[0] || null;
  const selectedObj = objects.find((o) => o.id === selectedId);

  useEffect(() => {
    if (activeTool === 'skeleton_rig' && selectedId) {
      setPreviewedAsset(selectedId);
    }
  }, [activeTool, selectedId, setPreviewedAsset]);

  const tabs = [
    { id: 'browser', label: 'Content Browser', icon: Folder },
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
