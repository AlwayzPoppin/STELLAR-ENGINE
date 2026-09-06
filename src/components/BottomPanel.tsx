import * as React from 'react';
import { useState, useMemo } from 'react';
import { Folder, FileCode2, TerminalSquare, Image as ImageIcon, Box, Search, Upload, X, ChevronDown, Sparkles, Trash2, Copy } from 'lucide-react';
import { useAssetStore, processImportedFile } from '../store/useAssetStore';
import { useStore } from '../store/useStore';
import { useLogStore, initConsoleInterceptor } from '../store/useLogStore';
import { toast } from '../store/useToastStore';
import { AssetCard, AssetPreviewPortal } from './AssetCard';
import { usePanelResizer } from '../hooks/usePanelResizer';

export async function importFilesBatch(files: File[]): Promise<{ successCount: number; failCount: number; lastSuccessName: string }> {
  let successCount = 0;
  let failCount = 0;
  let lastSuccessName = '';

  for (const file of files) {
    try {
      const imported = await processImportedFile(file);
      successCount++;
      lastSuccessName = imported.name;
    } catch (err) {
      failCount++;
      console.error(`Failed to import ${file.name}:`, err);
    }
  }

  if (successCount === 1) {
    toast.success(`Imported ${lastSuccessName} into My Assets`);
  } else if (successCount > 1) {
    toast.success(`Imported ${successCount} assets into My Assets`);
  }

  if (failCount > 0) {
    toast.error(`Failed to import ${failCount} asset${failCount > 1 ? 's' : ''}`);
  }

  return { successCount, failCount, lastSuccessName };
}

function BottomPanel(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState('browser');
  const [browserTab, setBrowserTab] = useState<'user' | 'system'>('user');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(() => {
    return localStorage.getItem('content_browser_category') || 'All';
  });
  const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);

  const { assets, addAsset, deleteAsset, isLoading, error } = useAssetStore();
  const openScript = useStore((s) => s.openScript);
  const { objects, selectedIds, activeTool, setActiveTool, toggleBottomPanel, isPickingAsset, setIsPickingAsset, setActivePickerTarget, activePickerTarget } = useStore();
  const { handleMouseDown, handleDoubleClick } = usePanelResizer({ defaultHeight: 240, minHeight: 120 });

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
    { id: 'ai-generator', label: 'AI Generator', icon: Sparkles },
    { id: 'console', label: 'Output Log', icon: TerminalSquare },
  ];

  return (
    <div
      role="region"
      aria-label="Bottom Panel: Content Browser and Console"
      className="relative flex flex-col h-full bg-bg-surface select-none"
    >
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        className="absolute top-0 left-0 right-0 h-3 cursor-row-resize bg-white/0 hover:bg-purple-500/10 hover:border-t hover:border-purple-500/40 transition-all z-[60]"
        title="Drag to resize timeline, double-click to toggle minimized state"
      />
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
              {/* Dual-Tab Navigation */}
              <div className="flex bg-bg-deep border border-border p-[2px] rounded-md h-[24px] items-center mr-1">
                <button
                  type="button"
                  onClick={() => setBrowserTab('user')}
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wide transition-all cursor-pointer h-full border-none ${browserTab === 'user' ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-primary bg-transparent'}`}
                >
                  📁 My Assets
                </button>
                <button
                  type="button"
                  onClick={() => setBrowserTab('system')}
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wide transition-all cursor-pointer h-full border-none ${browserTab === 'system' ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-primary bg-transparent'}`}
                >
                  📦 Starter Content
                </button>
              </div>

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
                multiple
                accept=".glb,.gltf,.png,.PNG,.jpg,.JPG,.jpeg,.JPEG,.webp,.WEBP,.ktx2,.KTX2,.basis,.BASIS,.js,.ts,.mp3,.wav,.ogg"
                className="hidden"
                onChange={async (e) => {
                  const fileList = e.target.files;
                  if (fileList && fileList.length > 0) {
                    setBrowserTab('user');
                    const files = Array.from(fileList);
                    await importFilesBatch(files);
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
                {activePickerTarget === 'materialMap' || activePickerTarget?.startsWith('faceMaterialMap_')
                  ? 'Selection Mode: Click any texture/image asset below to link it as the Color/Base Map.'
                  : activePickerTarget === 'materialNormalMap'
                  ? 'Selection Mode: Click any texture/image asset below to link it as the Normal Map.'
                  : activePickerTarget === 'celestialTexture'
                  ? 'Selection Mode: Click any texture/image asset below to assign as the celestial surface map.'
                  : activePickerTarget === 'rainTexture'
                  ? 'Selection Mode: Click any texture/image asset below to assign as the Rain particle texture.'
                  : activePickerTarget === 'snowTexture'
                  ? 'Selection Mode: Click any texture/image asset below to assign as the Snow particle texture.'
                  : activePickerTarget?.startsWith('lensFlareTexture')
                  ? 'Selection Mode: Click any texture/image asset below to assign to the selected Lens Flare Layer.'
                  : activePickerTarget === 'terrainSandTexture'
                  ? 'Selection Mode: Click any texture/image asset below to use as the Sand texture.'
                  : activePickerTarget === 'terrainDirtTexture'
                  ? 'Selection Mode: Click any texture/image asset below to use as the Dirt texture.'
                  : 'Selection Mode: Click any asset below to link its path.'}
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
          <div 
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDrop={async (e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                setBrowserTab('user');
                const files = Array.from(e.dataTransfer.files);
                await importFilesBatch(files);
              }
            }}
            className={`grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-4 p-5 relative min-h-[140px] ${isPickingAsset ? 'pt-3' : ''}`}
          >
            {isLoading ? (
              <div className="text-text-secondary text-xs">Loading assets...</div>
            ) : error ? (
              <div className="text-red-400 text-xs">Error: {error}</div>
            ) : (() => {
              const filtered = assets.filter((asset) => {
                const assetSource = asset.source || 'system';
                if (assetSource !== browserTab) return false;

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

              if (browserTab === 'user') {
                filtered.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
              }

              if (filtered.length === 0) {
                if (browserTab === 'user') {
                  return (
                    <div className="col-span-full flex flex-col items-center justify-center py-12 text-center select-none animate-in fade-in duration-200">
                      <span className="text-3xl mb-3">📁</span>
                      <span className="text-white text-[11px] font-bold">No custom assets found</span>
                      <p className="text-[10px] text-text-secondary mt-1">
                        Drag & drop files here directly from File Explorer, or click Import!
                      </p>
                    </div>
                  );
                }
                return <div className="text-text-secondary text-[11px] col-span-full">No assets found.</div>;
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
          <OutputLogTab />
        )}

        {activeTab === 'ai-generator' && (
          <AiGeneratorTab />
        )}

      </div>
      <AssetPreviewPortal />
    </div>
  );
}

function AiGeneratorTab() {
  const { meshyApiKey, setMeshyApiKey, aiGenerationTasks, generateAiAsset } = useStore();
  const [prompt, setPrompt] = useState('');
  const [artStyle, setArtStyle] = useState<'realistic' | 'stylized'>('stylized');
  const [apiKeyInput, setApiKeyInput] = useState(meshyApiKey === 'msy_dummy_api_key_for_test_mode_12345678' ? '' : meshyApiKey);
  const [showKeyConfig, setShowKeyConfig] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    await generateAiAsset(prompt.trim(), artStyle);
    setPrompt('');
  };

  const handleSaveKey = () => {
    setMeshyApiKey(apiKeyInput.trim() || 'msy_dummy_api_key_for_test_mode_12345678');
    setShowKeyConfig(false);
  };

  const isMockMode = !meshyApiKey || meshyApiKey.startsWith('msy_dummy_') || meshyApiKey === 'empty';

  return (
    <div className="flex-1 flex gap-6 p-4 h-full min-h-0 text-text-primary overflow-hidden">
      {/* Left: Input Form */}
      <div className="w-80 flex flex-col gap-4 bg-bg-panel border border-border p-4 rounded-xl shrink-0">
        <div className="flex justify-between items-center border-b border-border pb-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
            <Sparkles size={14} className="text-fuchsia-400" />
            AI 3D Generator
          </h3>
          <button
            onClick={() => setShowKeyConfig(!showKeyConfig)}
            className="text-[10px] text-accent hover:underline cursor-pointer border-none bg-transparent"
          >
            {showKeyConfig ? 'Cancel' : 'API Config'}
          </button>
        </div>

        {showKeyConfig ? (
          <div className="flex flex-col gap-3 animate-in fade-in duration-200">
            <label className="text-[10px] font-bold text-text-secondary uppercase">Meshy API Key</label>
            <input
              type="password"
              placeholder="Paste your msy_... key here"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className="bg-bg-deep border border-border rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent"
            />
            <p className="text-[9px] text-text-secondary leading-normal">
              Leave blank to run in <b>Mock Mode</b> (uses local geometry presets without consuming credits).
            </p>
            <button
              onClick={handleSaveKey}
              className="bg-accent hover:bg-sky-400 text-neutral-950 font-semibold py-1.5 rounded text-xs transition-colors cursor-pointer border-none"
            >
              Save API Key
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2.5 flex-1 min-h-0">
            {/* Mode Banner */}
            <div className={`px-2 py-1 rounded border text-[9px] flex items-center gap-1.5 ${
              isMockMode 
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isMockMode ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              <span>{isMockMode ? 'Running in Mock Mode' : 'Meshy API Connected'}</span>
            </div>

            {/* Prompt input */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-text-secondary uppercase">Generation Prompt</label>
              <textarea
                placeholder="e.g. grunge baseball bat with barbed wire, low poly..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                className="bg-bg-deep border border-border rounded p-2 text-xs text-white resize-none focus:outline-none focus:border-fuchsia-500"
              />
            </div>

            {/* Art style selector */}
            <div className="flex flex-col gap-1">
              <label className="text-[9px] font-bold text-text-secondary uppercase">Art Style</label>
              <select
                value={artStyle}
                onChange={(e) => setArtStyle(e.target.value as any)}
                className="bg-bg-deep border border-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-fuchsia-500 cursor-pointer"
              >
                <option value="stylized">Stylized</option>
                <option value="realistic">Realistic</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={!prompt.trim()}
              className="mt-auto bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-40 disabled:hover:bg-fuchsia-600 text-white font-semibold py-2 px-3 rounded text-xs transition-all shadow-md hover:shadow-fuchsia-600/20 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 border-none"
            >
              <Sparkles size={13} className="fill-current" />
              <span>Generate 3D Asset</span>
            </button>
          </form>
        )}
      </div>

      {/* Right: Active Generation Tasks Queue */}
      <div className="flex-1 flex flex-col gap-3 min-w-0 bg-bg-panel/40 border border-border p-4 rounded-xl h-full min-h-0">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
          Active Tasks Queue ({aiGenerationTasks.length})
        </h4>

        {aiGenerationTasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-border rounded-xl">
            <span className="text-2xl mb-2 opacity-40">🤖</span>
            <span className="text-white text-xs font-semibold">Queue is Empty</span>
            <p className="text-[9px] text-text-secondary max-w-[200px] mt-1">
              Enter a prompt on the left to start generating custom textured models in real-time.
            </p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-0">
            {aiGenerationTasks.map((task) => {
              const isPending = task.status === 'PENDING';
              const isProcessing = task.status === 'IN_PROGRESS';
              const isSucceeded = task.status === 'SUCCEEDED';
              const isFailed = task.status === 'FAILED';

              return (
                <div 
                  key={task.id} 
                  className={`border p-3.5 rounded-lg flex flex-col gap-2.5 transition-all ${
                    isSucceeded 
                      ? 'bg-fuchsia-950/10 border-fuchsia-500/20' 
                      : isFailed 
                      ? 'bg-red-950/10 border-red-500/20' 
                      : 'bg-bg-deep border-border'
                  }`}
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex flex-col min-w-0">
                      <span className="text-white text-xs font-semibold truncate max-w-lg" title={task.prompt}>
                        {task.prompt}
                      </span>
                      <span className="text-[9px] text-text-secondary font-mono mt-0.5">
                        ID: {task.id}
                      </span>
                    </div>

                    {/* Status Badge */}
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold tracking-wide uppercase ${
                      isSucceeded 
                        ? 'bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30' 
                        : isFailed 
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                        : isPending 
                        ? 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
                    }`}>
                      {task.status}
                    </span>
                  </div>

                  {/* Progress Section */}
                  {(isPending || isProcessing) && (
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between text-[9px] font-mono text-text-secondary">
                        <span>{isPending ? 'Queued...' : task.stage === 'rigging' ? 'Auto-Rigging Model via Meshy...' : 'Generating Mesh & Textures...'}</span>
                        <span className="font-bold text-white">{task.progress}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-900 rounded-full overflow-hidden border border-border/30">
                        <div 
                          className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-300"
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Success State */}
                  {isSucceeded && (
                    <div className="flex items-center justify-between gap-4 bg-fuchsia-950/20 border border-fuchsia-500/10 px-3 py-2 rounded-lg text-[10px] text-fuchsia-300">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-xs">✨</span>
                        <span className="truncate text-[10px]">{task.stage === 'rigging' ? 'Model Successfully Rigged & Replaced!' : 'Ingested into Assets & Spawned on Stage!'}</span>
                      </div>
                      <button
                        onClick={() => {
                          const objId = task.stage === 'rigging' ? (task as any).targetObjectId : `obj_ai_${task.id}`;
                          if (objId) {
                            useStore.getState().selectObject(objId);
                          }
                        }}
                        className="bg-fuchsia-500 hover:bg-fuchsia-400 text-neutral-950 px-2 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors shrink-0 border-none"
                      >
                        Select Object
                      </button>
                    </div>
                  )}

                  {/* Fail State */}
                  {isFailed && (
                    <div className="text-[10px] text-red-400 bg-red-950/20 border border-red-500/10 px-3 py-2 rounded-lg">
                      ⚠️ <b>{task.stage === 'rigging' ? 'Rigging' : 'Generation'} Failed:</b> {task.errorMsg || 'Unknown error'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function OutputLogTab() {
  const { logs, clearLogs } = useLogStore();
  const [filterType, setFilterType] = useState<'all' | 'log' | 'warn' | 'error'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    initConsoleInterceptor();
  }, []);

  React.useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterType !== 'all' && log.type !== filterType) return false;
      if (searchFilter.trim() && !log.message.toLowerCase().includes(searchFilter.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [logs, filterType, searchFilter]);

  const counts = useMemo(() => {
    let logCount = 0;
    let warnCount = 0;
    let errorCount = 0;
    for (const l of logs) {
      if (l.type === 'log') logCount++;
      else if (l.type === 'warn') warnCount++;
      else if (l.type === 'error') errorCount++;
    }
    return { all: logs.length, log: logCount, warn: warnCount, error: errorCount };
  }, [logs]);

  const handleCopyLogs = () => {
    const text = filteredLogs.map((l) => `[${l.timestamp}] [${l.type.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Logs Copied', 'Console logs copied to clipboard.');
  };

  const visibleLogs = useMemo(() => {
    return filteredLogs.length > 100 ? filteredLogs.slice(-100) : filteredLogs;
  }, [filteredLogs]);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-bg-deep text-text-primary overflow-hidden border border-border/40 rounded-xl m-2 font-mono">
      {/* Console Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg-panel/90 border-b border-border text-xs shrink-0 select-none">
        <div className="flex items-center gap-2">
          {/* Filter Pills */}
          <button
            onClick={() => setFilterType('all')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors ${
              filterType === 'all' ? 'bg-neutral-700 text-white border-neutral-600' : 'bg-transparent text-neutral-400 border-transparent hover:bg-neutral-800'
            }`}
          >
            All ({counts.all})
          </button>
          <button
            onClick={() => setFilterType('log')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors flex items-center gap-1 ${
              filterType === 'log' ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40' : 'bg-transparent text-neutral-400 border-transparent hover:bg-neutral-800'
            }`}
          >
            Info ({counts.log})
          </button>
          <button
            onClick={() => setFilterType('warn')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors flex items-center gap-1 ${
              filterType === 'warn' ? 'bg-amber-950/60 text-amber-400 border-amber-500/40' : 'bg-transparent text-neutral-400 border-transparent hover:bg-neutral-800'
            }`}
          >
            Warnings ({counts.warn})
          </button>
          <button
            onClick={() => setFilterType('error')}
            className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-colors flex items-center gap-1 ${
              filterType === 'error' ? 'bg-red-950/60 text-red-400 border-red-500/40' : 'bg-transparent text-neutral-400 border-transparent hover:bg-neutral-800'
            }`}
          >
            Errors ({counts.error})
          </button>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative flex items-center">
            <Search className="absolute left-2 w-3 h-3 text-neutral-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter output..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="bg-bg-surface border border-border rounded pl-6 pr-2 py-0.5 text-[10px] text-white focus:outline-none focus:border-accent w-40"
            />
          </div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors cursor-pointer ${
              autoScroll ? 'bg-accent/20 text-accent border-accent/40' : 'bg-transparent text-neutral-500 border-border'
            }`}
            title="Auto-scroll to bottom on new logs"
          >
            Auto-Scroll
          </button>

          <button
            onClick={handleCopyLogs}
            className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded transition-colors cursor-pointer border-none bg-transparent"
            title="Copy logs to clipboard"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={clearLogs}
            className="p-1 hover:bg-red-950/50 text-neutral-400 hover:text-red-400 rounded transition-colors cursor-pointer border-none bg-transparent"
            title="Clear output log"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Log Entries Container */}
      <div ref={logContainerRef} className="flex-1 overflow-y-auto p-3 space-y-1 min-h-0 select-text">
        {visibleLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-neutral-600 text-xs py-8">
            <span>Terminal ready. No console output recorded.</span>
          </div>
        ) : (
          visibleLogs.map((log) => {
            const isError = log.type === 'error';
            const isWarn = log.type === 'warn';

            return (
              <div
                key={log.id}
                className={`flex gap-2 text-[11px] leading-relaxed p-1.5 rounded transition-colors font-mono whitespace-pre-wrap break-all ${
                  isError
                    ? 'bg-red-950/30 text-red-300 border-l-2 border-red-500 font-semibold'
                    : isWarn
                    ? 'bg-amber-950/20 text-amber-300 border-l-2 border-amber-500'
                    : 'hover:bg-white/5 text-neutral-300 border-l-2 border-transparent'
                }`}
              >
                <span className="text-neutral-500 shrink-0 text-[10px] select-none font-mono opacity-70">
                  [{log.timestamp}]
                </span>
                <span className={`shrink-0 font-bold text-[10px] uppercase select-none ${
                  isError ? 'text-red-400' : isWarn ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  [{log.type}]
                </span>
                <span className="flex-1 min-w-0">
                  {log.count && log.count > 1 && (
                    <span className="inline-flex items-center justify-center px-1.5 py-0.5 mr-1.5 text-[9px] font-bold text-white bg-neutral-600 rounded-full leading-none">
                      {log.count}
                    </span>
                  )}
                  {log.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default React.memo(BottomPanel);
