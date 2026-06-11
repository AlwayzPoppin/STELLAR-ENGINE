import * as React from 'react';
import { useState, useMemo } from 'react';
import { Folder, FileCode2, TerminalSquare, Image as ImageIcon, Box, Search, Upload, X, ChevronDown } from 'lucide-react';
import { useAssetStore } from '../store/useAssetStore';
import { useStore } from '../store/useStore';
import { AssetCard, AssetPreviewPortal } from './AssetCard';

function BottomPanel(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState('browser');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(() => {
    return localStorage.getItem('content_browser_category') || 'All';
  });
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

  const { assets, addAsset, deleteAsset, isLoading, error } = useAssetStore();
  const openScript = useStore((s) => s.openScript);
  const { objects, selectedIds, activeTool, setActiveTool, toggleBottomPanel, isPickingAsset, setIsPickingAsset, setActivePickerTarget, activePickerTarget } = useStore();

  const selectedId = selectedIds[0] || null;
  const selectedObj = objects.find((o) => o.id === selectedId);

  // Categories list with Tailwind background and text colors
  const categories = [
    { name: 'All', color: 'bg-neutral-500', text: 'text-text-secondary' },
    { name: 'Models', color: 'bg-sky-500', text: 'text-sky-400' },
    { name: 'Textures', color: 'bg-orange-500', text: 'text-orange-400' },
    { name: 'Materials', color: 'bg-violet-500', text: 'text-violet-400' },
    { name: 'Scripts', color: 'bg-emerald-500', text: 'text-emerald-400' },
    { name: 'Audio', color: 'bg-amber-500', text: 'text-amber-400' },
    { name: 'Prefabs', color: 'bg-rose-500', text: 'text-rose-400' },
    { name: 'Scenes', color: 'bg-teal-500', text: 'text-teal-400' },
  ];

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    localStorage.setItem('content_browser_category', category);
    setIsCategoryMenuOpen(false);
  };


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
                onClick={() => {
                  setActiveTab(tab.id);
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
              {/* Category Dropdown Selector */}
              <div className="relative">
                <button
                  onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
                  className="flex items-center gap-1.5 text-[10px] font-medium hover:text-text-primary bg-bg-deep border border-border px-2.5 py-1 rounded transition-colors cursor-pointer"
                >
                  <span className="text-text-secondary">Category:</span>
                  <span className={categories.find(c => c.name === selectedCategory)?.text || 'text-text-primary'}>
                    {selectedCategory}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                </button>

                {isCategoryMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsCategoryMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1.5 w-36 bg-bg-surface border border-border rounded-lg shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      {categories.map((cat) => {
                        const isSelected = selectedCategory === cat.name;
                        return (
                          <button
                            key={cat.name}
                            onClick={() => handleCategoryChange(cat.name)}
                            className={`w-full text-left px-3 py-1.5 hover:bg-neutral-800/80 flex items-center justify-between transition-colors text-[10px] cursor-pointer ${
                              isSelected ? 'bg-bg-deep text-text-primary font-semibold' : 'text-text-secondary hover:text-text-primary'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`w-1.5 h-1.5 rounded-full ${cat.color}`} />
                              <span>{cat.name}</span>
                            </div>
                            {isSelected && (
                              <span className="w-1 h-1 rounded-full bg-accent" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="relative flex items-center">
                <Search size={12} className="absolute left-2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                accept=".glb,.gltf,.png,.jpg,.jpeg,.js,.ts,.mp3,.wav,.ogg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    let type: 'material' | 'model' | 'scene' | 'image' | 'script' | 'audio' | 'prefab' = 'model';
                    let category: 'Models' | 'Textures' | 'Materials' | 'Scripts' | 'Audio' | 'Prefabs' | 'Scenes' = 'Models';
                    if (file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')) {
                      type = 'image';
                      category = 'Textures';
                    } else if (file.name.endsWith('.js') || file.name.endsWith('.ts')) {
                      type = 'script';
                      category = 'Scripts';
                    } else if (file.name.endsWith('.mp3') || file.name.endsWith('.wav') || file.name.endsWith('.ogg')) {
                      type = 'audio';
                      category = 'Audio';
                    }

                    const reader = new FileReader();
                    if (type === 'script') {
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        addAsset({
                          id: crypto.randomUUID(),
                          name: file.name,
                          type: type,
                          category: category,
                          content: content,
                        });
                      };
                      reader.readAsText(file);
                    } else {
                      reader.onload = (event) => {
                        const url = event.target?.result as string;
                        addAsset({
                          id: crypto.randomUUID(),
                          name: file.name,
                          type: type,
                          category: category,
                          url: url,
                        });
                      };
                      reader.readAsDataURL(file);
                    }

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

      <div className="flex-1 overflow-auto relative">
        {activeTab === 'browser' && isPickingAsset && (
          <div className="mx-5 mt-4 p-2.5 bg-accent/10 border border-accent/30 rounded-xl backdrop-blur-md flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              <span className="text-[10px] font-semibold text-text-primary">
                {activePickerTarget === 'materialMap'
                  ? 'Selection Mode: Click any texture/image asset below to link it as the Color/Base Map.'
                  : activePickerTarget === 'materialNormalMap'
                  ? 'Selection Mode: Click any texture/image asset below to link it as the Normal Map.'
                  : 'Selection Mode: Click any asset below to link its path as the Footstep Audio sample.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsPickingAsset(false);
                setActivePickerTarget(null);
              }}
              className="text-[9px] text-text-secondary hover:text-text-primary bg-bg-deep border border-border px-2 py-0.5 rounded cursor-pointer transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
        {activeTab === 'browser' && (
          <div className={`grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-4 p-5 ${isPickingAsset ? 'pt-3' : ''}`}>
            {isLoading ? (
              <div className="text-text-secondary text-xs">Loading assets...</div>
            ) : error ? (
              <div className="text-red-400 text-xs">Error: {error}</div>
            ) : (() => {
              const filtered = assets.filter((asset) => {
                const assetCat = asset.category || (
                  asset.type === 'model' ? 'Models' :
                  asset.type === 'image' ? 'Textures' :
                  asset.type === 'material' ? 'Materials' :
                  asset.type === 'script' ? 'Scripts' :
                  asset.type === 'scene' ? 'Scenes' :
                  asset.type === 'audio' ? 'Audio' :
                  asset.type === 'prefab' ? 'Prefabs' : 'Models'
                );
                const matchesCategory = selectedCategory === 'All' || assetCat === selectedCategory;
                const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase());
                return matchesCategory && matchesSearch;
              });

              if (filtered.length === 0) {
                return <div className="text-text-secondary text-xs col-span-full">No assets found.</div>;
              }

              return filtered.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onDelete={deleteAsset}
                  onDoubleClick={(a) => {
                    if (a.type === 'script') {
                      openScript(a.id);
                    } else if (a.type === 'model' || a.type === 'scene') {
                      const selectedId = useStore.getState().selectedIds[0] || null;
                      const selectedObj = useStore.getState().objects.find((o) => o.id === selectedId);
                      // Never auto-insert into the starter_player system folder
                      let parentId: string | null = null;
                      if (selectedObj) {
                        if (selectedObj.type === 'group' && selectedObj.id !== 'starter_player') {
                          parentId = selectedObj.id;
                        } else if (selectedObj.parentId && selectedObj.parentId !== 'starter_player') {
                          parentId = selectedObj.parentId;
                        }
                      }
                      if (a.url) {
                        useStore.getState().addObject({
                          id: `obj_${crypto.randomUUID()}`,
                          name: a.name,
                          type: 'gltf',
                          url: a.url,
                          position: [0, 0, 0],
                          rotation: [0, 0, 0],
                          scale: [1, 1, 1],
                          parentId: parentId,
                        });
                      } else {
                        useStore.getState().addObject({
                          id: `obj_${crypto.randomUUID()}`,
                          name: a.name,
                          type: 'mesh',
                          geometry: 'box',
                          position: [0, 1, 0],
                          rotation: [0, 0, 0],
                          scale: [1, 1, 1],
                          material: { color: '#ffffff', roughness: 0.5, metalness: 0, envMapIntensity: 1 },
                          parentId: parentId,
                        });
                      }
                    } else if (a.type === 'material') {
                      const selectedId = useStore.getState().selectedIds[0] || null;
                      const selectedObj = useStore.getState().objects.find((o) => o.id === selectedId);
                      // Never auto-insert into the starter_player system folder
                      let parentId: string | null = null;
                      if (selectedObj) {
                        if (selectedObj.type === 'group' && selectedObj.id !== 'starter_player') {
                          parentId = selectedObj.id;
                        } else if (selectedObj.parentId && selectedObj.parentId !== 'starter_player') {
                          parentId = selectedObj.parentId;
                        }
                      }
                      useStore.getState().addObject({
                        id: `obj_${crypto.randomUUID()}`,
                        name: `Box with ${a.name}`,
                        type: 'mesh',
                        geometry: 'box',
                        position: [0, 1, 0],
                        rotation: [0, 0, 0],
                        scale: [1, 1, 1],
                        material: { color: '#888888', roughness: 0.2, metalness: 0.8, envMapIntensity: 1 },
                        parentId: parentId,
                      });
                    }
                  }}
                />
              ));
            })()}
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
      <AssetPreviewPortal />
    </div>
  );
}

export default React.memo(BottomPanel);
