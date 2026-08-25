import React, { useEffect, useState, useMemo } from 'react';
import { useStore, SceneObject } from '../store/useStore';
import { useAssetStore } from '../store/useAssetStore';
import { toast } from '../store/useToastStore';
import {
  Box,
  Circle,
  Square,
  Globe,
  Lightbulb,
  Folder,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Sun,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  User,
  Code2,
  Package,
  Layers,
  Volume2,
  VolumeX,
  Gamepad2,
} from 'lucide-react';

const getIcon = (geom?: string, type?: string) => {
  if (type === 'script')
    return <Code2 className="w-[14px] h-[14px] text-yellow-400" style={{ filter: 'drop-shadow(0 0 2px #facc15)' }} />;
  if (type === 'voxel_hotbar')
    return <Layers className="w-[14px] h-[14px] text-cyan-400" style={{ filter: 'drop-shadow(0 0 2px #06b6d4)' }} />;
  if (type === 'light')
    return (
      <Lightbulb className="w-[14px] h-[14px] text-yellow-500" style={{ filter: 'drop-shadow(0 0 2px #eab308)' }} />
    );
  if (type === 'group')
    return (
      <Folder
        className="w-[14px] h-[14px] text-amber-400 fill-amber-400/30"
        style={{ filter: 'drop-shadow(0 0 2px #fbbf24)' }}
      />
    );
  if (type === 'gltf')
    return <Globe className="w-[14px] h-[14px] text-emerald-400" style={{ filter: 'drop-shadow(0 0 2px #34d399)' }} />;
  if (type === 'gltf_part')
    return <Package className="w-[14px] h-[14px] text-teal-400" style={{ filter: 'drop-shadow(0 0 2px #2dd4bf)' }} />;
  if (type === 'texture' || type === 'decal')
    return <Layers className="w-[14px] h-[14px] text-orange-400" style={{ filter: 'drop-shadow(0 0 2px #fb923c)' }} />;

  switch (geom) {
    case 'box':
      return <Box className="w-[14px] h-[14px] text-sky-400" style={{ filter: 'drop-shadow(0 0 2px #38bdf8)' }} />;
    case 'sphere':
      return <Circle className="w-[14px] h-[14px] text-sky-400" style={{ filter: 'drop-shadow(0 0 2px #38bdf8)' }} />;
    case 'plane':
      return <Square className="w-[14px] h-[14px] text-sky-400" style={{ filter: 'drop-shadow(0 0 2px #38bdf8)' }} />;
    case 'cylinder':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-[14px] h-[14px] text-sky-400"
          style={{ filter: 'drop-shadow(0 0 2px #38bdf8)' }}
        >
          <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
          <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"></path>
        </svg>
      );
    case 'cone':
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-[14px] h-[14px] text-sky-400"
          style={{ filter: 'drop-shadow(0 0 2px #38bdf8)' }}
        >
          <path d="M12 2L2 20h20L12 2z"></path>
          <ellipse cx="12" cy="20" rx="10" ry="2"></ellipse>
        </svg>
      );
    default:
      return <Box className="w-[14px] h-[14px] text-sky-400" style={{ filter: 'drop-shadow(0 0 2px #38bdf8)' }} />;
  }
};

const AnimationFolderItem = React.memo(function AnimationFolderItem({
  objId,
  clips,
  depth,
}: {
  objId: string;
  clips: string[];
  depth: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const activeAnimation = useStore((state) => {
    const obj = state.objects.find((o) => o.id === objId);
    return obj?.activeAnimation || null;
  });

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const { sourceObjId, clipName } = JSON.parse(dataStr);
      if (sourceObjId && clipName) {
        if (sourceObjId === objId) {
          toast.error('Copy Cancelled', 'Cannot copy animation to the same character.');
          return;
        }
        useStore.getState().copyAnimationToTarget(sourceObjId, objId, clipName);
      }
    } catch (err) {
      console.error('Failed to parse drag drop data:', err);
    }
  };

  return (
    <div>
      <div
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`group flex items-center w-full cursor-pointer select-none border-b border-bg-deep/30 text-text-primary hover:bg-bg-panel transition-all duration-200 ${
          isDragOver ? 'bg-purple-500/25 border-l-2 border-purple-500 shadow-[inset_0_0_8px_rgba(168,85,247,0.3)]' : ''
        }`}
      >
        <div
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
          className="flex items-center gap-1.5 w-full py-[4px] pr-2"
        >
          <div className="w-[18px] h-[18px] flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors shrink-0">
            {isExpanded ? (
              <ChevronDown size={14} strokeWidth={2.5} />
            ) : (
              <ChevronRight size={14} strokeWidth={2.5} />
            )}
          </div>
          <Folder className="w-[14px] h-[14px] text-purple-400 fill-purple-400/20" style={{ filter: 'drop-shadow(0 0 2px #c084fc)' }} />
          <span className="truncate text-[12px] font-semibold text-purple-300">
            Animations
          </span>
          <span className="ml-auto text-[9px] font-mono uppercase tracking-wider text-purple-400/60 pr-1">
            folder
          </span>
        </div>
      </div>
      {isExpanded &&
        [...clips].sort((a, b) => a.localeCompare(b)).map((clip) => {
          const isSelected = activeAnimation === clip;
          return (
            <div
              key={clip}
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData('text/plain', JSON.stringify({ sourceObjId: objId, clipName: clip }));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={(e) => {
                e.stopPropagation();
                // Select the main model object
                useStore.getState().selectObject(objId);
                const nextAnim = isSelected ? 'None' : clip;
                // Set the active animation on the model
                useStore.getState().updateObject(objId, { activeAnimation: nextAnim });
                
                if (nextAnim === 'None') {
                  useStore.getState().setTracks([]);
                } else {
                  // Bake the animation track keyframes into the store
                  useStore.getState().loadClipToTimeline(objId, nextAnim);
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                useStore.getState().openContextMenu(e.clientX, e.clientY, 'animation', objId, clip);
              }}
              className={`group flex items-center w-full cursor-pointer select-none border-b border-bg-deep/10 ${isSelected ? 'bg-purple-500/20 text-purple-200' : 'text-text-secondary hover:text-text-primary hover:bg-bg-panel/30'}`}
            >
              <div
                style={{ paddingLeft: `${(depth + 1) * 16 + 4}px` }}
                className="flex items-center gap-1.5 w-full py-[3px] pr-2"
              >
                <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                  <span className="w-[14px]" />
                </div>
                {/* A play icon or film icon */}
                <svg
                  viewBox="0 0 24 24"
                  fill={isSelected ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className={`w-[11px] h-[11px] ${isSelected ? 'text-purple-400' : 'text-text-secondary group-hover:text-text-primary'}`}
                >
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span className={`truncate text-[11px] font-mono ${isSelected ? 'font-bold' : ''}`}>
                  {clip}
                </span>
                {isSelected && (
                  <span className="ml-auto text-[8px] font-mono bg-purple-500/30 text-purple-300 px-1 py-[1px] rounded uppercase shrink-0">
                    playing
                  </span>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
});

const TreeItem = React.memo(function TreeItem({ obj, depth }: { obj: SceneObject; depth: number }) {
  const selectedIds = useStore((state) => state.selectedIds);
  const isSelected = selectedIds.includes(obj.id);
  const isMarqueeSelected = useStore((state) => state.marqueeSelectedIds.includes(obj.id));
  const selectObject = useStore((state) => state.selectObject);
  const setSelectedBoneId = useStore((state) => state.setSelectedBoneId);
  const setParent = useStore((state) => state.setParent);
  const updateObject = useStore((state) => state.updateObject);
  const renamingId = useStore((state) => state.renamingId);
  const setRenamingId = useStore((state) => state.setRenamingId);

  const objects = useStore((state) => state.objects);
  const modelAnimations = useStore((state) => state.modelAnimations);

  const clips = useMemo(() => obj.availableAnimations || modelAnimations[obj.id] || [], [obj.availableAnimations, modelAnimations, obj.id]);
  const shouldShowChildren = (obj.type as string) !== 'csg';
  const children = useMemo(() => {
    if (!shouldShowChildren) return []; // CSG Union absorbs children visually
    return objects.filter((o) => o.parentId === obj.id);
  }, [objects, obj.id, shouldShowChildren]);
  const attachedScripts = useMemo(() => {
    if (!obj.scripts) return [];
    return obj.scripts
      .map((id) => useAssetStore.getState().assets.find((a) => a.id === id))
      .filter(Boolean);
  }, [obj.scripts]);

  const [isExpanded, setIsExpanded] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  const itemRef = React.useRef<HTMLDivElement | null>(null);

  const hasChildren = (shouldShowChildren && children.length > 0) || clips.length > 0 || attachedScripts.length > 0;

  // Auto-expand parents/ancestors if a child/descendant is selected
  const hasSelectedDescendant = useMemo(() => {
    const checkDescendants = (id: string): boolean => {
      const childrenList = objects.filter((o) => o.parentId === id);
      for (const child of childrenList) {
        if (selectedIds.includes(child.id)) return true;
        if (checkDescendants(child.id)) return true;
      }
      return false;
    };
    return checkDescendants(obj.id);
  }, [objects, obj.id, selectedIds]);

  useEffect(() => {
    if (hasSelectedDescendant) {
      setIsExpanded(true);
    }
  }, [hasSelectedDescendant]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (isSelected && itemRef.current) {
      itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [isSelected]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', obj.id);
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    // Check if dropping a linked script in the hierarchy
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId.startsWith('script:')) {
      const parts = draggedId.split(':');
      const scriptId = parts[1];
      const sourceId = parts[2];
      if (scriptId && sourceId && sourceId !== obj.id) {
        const { objects, updateObject } = useStore.getState();
        const sourceObj = objects.find(o => o.id === sourceId);
        const targetObj = objects.find(o => o.id === obj.id);
        if (sourceObj && targetObj) {
          const nextSourceScripts = (sourceObj.scripts || []).filter(id => id !== scriptId);
          updateObject(sourceId, { scripts: nextSourceScripts });
          const nextTargetScripts = [...(targetObj.scripts || []), scriptId];
          updateObject(obj.id, { scripts: nextTargetScripts });
        }
      }
      return;
    }

    // Check if dropping an asset from bottom panel
    const assetData = e.dataTransfer.getData('application/json');
    if (assetData) {
      try {
        const asset = JSON.parse(assetData);
        if (asset.type === 'model' || asset.type === 'scene') {
          const lower = (asset.name || asset.url || '').toLowerCase();
          const modelType = lower.endsWith('.obj') ? 'obj' : (lower.endsWith('.fbx') ? 'fbx' : 'gltf');
          useStore.getState().addObject({
            id: `obj_${crypto.randomUUID()}`,
            name: asset.name,
            type: modelType,
            url: asset.url?.startsWith('data:') ? asset.id : (asset.url || ''),
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            parentId: obj.id,
          });
        } else if (asset.type === 'material') {
          useStore.getState().addObject({
            id: `obj_${crypto.randomUUID()}`,
            name: `Box with ${asset.name}`,
            type: 'mesh',
            geometry: 'box',
            position: [0, 1, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            material: { color: '#888888', roughness: 0.2, metalness: 0.8, envMapIntensity: 1 },
            parentId: obj.id,
          });
        }
      } catch (err) {
        console.error('Failed to parse dropped asset data:', err);
      }
      return;
    }

    const draggedData = e.dataTransfer.getData('text/plain');
    if (draggedData) {
      try {
        const parsed = JSON.parse(draggedData);
        if (parsed.sourceObjId && parsed.clipName) {
          if (parsed.sourceObjId === obj.id) {
            toast.error('Copy Cancelled', 'Cannot copy animation to the same character.');
            return;
          }
          const { objects, updateObject } = useStore.getState();
          const targetObj = objects.find(o => o.id === obj.id);
          if (targetObj) {
            const nextAnims = { ...(targetObj.customAnimations || {}) };
            const sourceObj = objects.find(o => o.id === parsed.sourceObjId);
            const sourceTracks = sourceObj?.customAnimations?.[parsed.clipName] || [];
            nextAnims[parsed.clipName] = sourceTracks;
            
            updateObject(obj.id, {
              customAnimations: nextAnims,
              availableAnimations: [...new Set([...(targetObj.availableAnimations || []), parsed.clipName])],
            });
            toast.success('Animation Copied', `Successfully copied "${parsed.clipName}" to "${targetObj.name}".`);
          }
        } else {
          setParent(parsed, obj.id);
        }
      } catch (err) {
        // Not a JSON string, perform normal re-parenting
        setParent(draggedData, obj.id);
      }
    }
  };

  return (
    <div
      draggable={obj.id !== 'world_settings'}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex flex-col w-full"
    >
      <div
        ref={itemRef}
        onClick={(e) => {
          selectObject(obj.id, e.shiftKey || e.ctrlKey || e.metaKey);
          if (obj.attachedBoneName) {
            setSelectedBoneId(obj.id);
          }
          if (obj.type === 'script') {
            useStore.getState().openScript(obj.id);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isSelected) {
            selectObject(obj.id, e.shiftKey || e.ctrlKey || e.metaKey);
            if (obj.attachedBoneName) {
              setSelectedBoneId(obj.id);
            }
          }
          useStore.getState().openContextMenu(e.clientX, e.clientY, 'hierarchy', obj.id);
        }}
        className={`group flex items-center w-full cursor-pointer select-none border-b border-bg-deep/50 ${
          isDragOver ? 'bg-accent/30' : ''
        } ${
          isSelected 
            ? 'bg-accent text-white' 
            : isMarqueeSelected 
              ? 'bg-amber-500/20 text-amber-300 border-l-2 border-l-amber-500' 
              : 'text-text-primary hover:bg-bg-panel'
        }`}
      >
        <div
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
          className="flex items-center justify-between w-full py-[4px] pr-2"
        >
          <div className="flex items-center gap-1.5 truncate">
            <div
              onClick={(e) => {
                if (hasChildren) {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }
              }}
              className="w-[18px] h-[18px] flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors shrink-0"
            >
              {hasChildren ? (
                isExpanded ? (
                  <ChevronDown size={14} strokeWidth={2.5} />
                ) : (
                  <ChevronRight size={14} strokeWidth={2.5} />
                )
              ) : (
                <span className="w-[14px]" />
              )}
            </div>
            {getIcon(obj.geometry, obj.type)}

            {renamingId === obj.id ? (
              <input
                autoFocus
                defaultValue={obj.name}
                className="text-[12px] bg-bg-deep border border-accent text-white px-1 py-[1px] outline-none w-full ml-0.5 rounded-sm"
                onBlur={() => setRenamingId(null)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateObject(obj.id, { name: e.currentTarget.value });
                    setRenamingId(null);
                  } else if (e.key === 'Escape') {
                    setRenamingId(null);
                  }
                }}
              />
            ) : (
              <div className="flex items-center gap-1.5 min-w-0 flex-1 truncate">
                <span
                  className={`truncate text-[12px] font-mono tracking-tight ${
                    isSelected 
                      ? 'font-medium text-white' 
                      : isMarqueeSelected 
                        ? 'font-medium text-amber-300' 
                        : (obj.type === 'texture' || obj.type === 'decal')
                          ? 'text-orange-300'
                          : 'text-text-primary'
                  }`}
                >
                  {(obj.type === 'texture' || obj.type === 'decal')
                    ? `Texture - ${obj.targetFace ? obj.targetFace.charAt(0).toUpperCase() + obj.targetFace.slice(1) : 'Unknown'}`
                    : obj.name}
                </span>
                {obj.material && obj.material.map && obj.material.map !== 'none' && (
                  <span title="Has global texture applied" className="flex shrink-0">
                    <Layers
                      size={11}
                      className="text-orange-400"
                      style={{ filter: 'drop-shadow(0 0 2px #fb923c)' }}
                    />
                  </span>
                )}
                {obj.audioProps && obj.audioProps.url && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      selectObject(obj.id);
                      const isMuted = obj.audioProps?.autoplay === false;
                      updateObject(obj.id, {
                        audioProps: {
                          ...obj.audioProps,
                          autoplay: isMuted,
                        }
                      });
                      toast.success(
                        isMuted ? 'Audio Active' : 'Audio Muted',
                        `${obj.name} audio is now ${isMuted ? 'playing' : 'muted'}.`
                      );
                    }}
                    title={`Click to ${obj.audioProps.autoplay === false ? 'Unmute' : 'Mute'} (${obj.audioProps.sourceType || 'point'})`}
                    className="flex shrink-0 p-0.5 hover:bg-white/10 rounded transition-colors cursor-pointer"
                  >
                    {obj.audioProps.autoplay === false ? (
                      <VolumeX
                        size={11}
                        className="text-red-400 opacity-80"
                        style={{ filter: 'drop-shadow(0 0 2px #f87171)' }}
                      />
                    ) : (
                      <Volume2
                        size={11}
                        className="text-emerald-400"
                        style={{ filter: 'drop-shadow(0 0 2px #34d399)' }}
                      />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateObject(obj.id, { visible: obj.visible === false ? true : false });
              }}
              className={`p-0.5 hover:bg-bg-deep rounded transition-colors ${obj.visible === false ? 'text-accent' : 'text-text-secondary opacity-0 group-hover:opacity-100'}`}
              title={obj.visible === false ? 'Show' : 'Hide'}
            >
              {obj.visible === false ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                updateObject(obj.id, { locked: !obj.locked });
              }}
              className={`p-0.5 hover:bg-bg-deep rounded transition-colors ${obj.locked ? 'text-amber-500' : 'text-text-secondary opacity-0 group-hover:opacity-100'}`}
              title={obj.locked ? 'Unlock' : 'Lock'}
            >
              {obj.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
          </div>
        </div>
      </div>
      {isExpanded && hasChildren && (
        <div className="flex flex-col w-full">
          {clips.length > 0 && (
            <AnimationFolderItem objId={obj.id} clips={clips} depth={depth + 1} />
          )}
          {attachedScripts.map((script: any) => (
            <div
              key={script.id}
              draggable={true}
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData('text/plain', `script:${script.id}:${obj.id}`);
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                useStore.getState().openScript(script.id);
              }}
              className="group flex items-center w-full cursor-pointer select-none border-b border-bg-deep/50 text-text-primary hover:bg-bg-panel"
            >
              <div
                style={{ paddingLeft: `${(depth + 1) * 16 + 4}px` }}
                className="flex items-center justify-between w-full py-[4px] pr-2"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                    <span className="w-[14px]" />
                  </div>
                  {getIcon('', 'script')}
                  <span className="truncate text-[12px] font-mono tracking-tight text-text-primary/95">
                    {script.name}
                  </span>
                </div>
              </div>
            </div>
          ))}
          {children.map((child) => (
            <TreeItem key={child.id} obj={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
});

export default function HierarchyPanel() {
  const objects = useStore((state) => state.objects);
  const selectedIds = useStore((state) => state.selectedIds);
  const deleteObject = useStore((state) => state.deleteObject);
  const setParent = useStore((state) => state.setParent);
  const duplicateObject = useStore((state) => state.duplicateObject);
  const groupSelected = useStore((state) => state.groupSelected);
  const setRenamingId = useStore((state) => state.setRenamingId);
  const toggleSidebar = useStore((state) => state.toggleSidebar);
  const copyObject = useStore((state) => state.copyObject);
  const pasteObject = useStore((state) => state.pasteObject);

  const [searchQuery, setSearchQuery] = useState('');
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true);
  const [starterPlayerExpanded, setStarterPlayerExpanded] = useState(true);
  const [assetVaultExpanded, setAssetVaultExpanded] = useState(true);
  const [isWorkspaceDragOver, setIsWorkspaceDragOver] = useState(false);
  const [isStarterPlayerDragOver, setIsStarterPlayerDragOver] = useState(false);
  const [isAssetVaultDragOver, setIsAssetVaultDragOver] = useState(false);
  const [isLightingDragOver, setIsLightingDragOver] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const activeEl = document.activeElement as HTMLElement | null;

      const isInput = (el: HTMLElement | null) => {
        if (!el) return false;
        const tag = el.tagName?.toUpperCase();
        return (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          el.isContentEditable ||
          el.getAttribute('contenteditable') === 'true' ||
          Boolean(el.closest?.('.monaco-editor, [contenteditable="true"], input, textarea, select'))
        );
      };

      if (isInput(target) || isInput(activeEl)) return;

      if (e.key === 'Delete') {
        if (selectedIds.length > 0) {
          selectedIds.filter((id) => id !== 'world_settings').forEach((id) => deleteObject(id));
        }
      } else if (e.key === 'F2') {
        if (selectedIds.length === 1) {
          e.preventDefault();
          setRenamingId(selectedIds[0]);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedIds.length === 1) {
          e.preventDefault();
          duplicateObject(selectedIds[0]);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          groupSelected();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedIds.length === 1) {
          const obj = objects.find((o) => o.id === selectedIds[0]);
          if (obj) {
            e.preventDefault();
            copyObject(obj);
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        const targetParentId = selectedIds[0] || 'workspace';
        pasteObject(targetParentId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, deleteObject, duplicateObject, groupSelected, setRenamingId, objects, copyObject, pasteObject]);

  const [lightingExpanded, setLightingExpanded] = useState(true);
  const [starterGuiExpanded, setStarterGuiExpanded] = useState(true);

  // Workspace: root objects that are NOT lights, NOT sun/moon, and NOT system folders
  const workspaceObjects = objects.filter(
    (o) =>
      !o.parentId &&
      o.type !== 'light' &&
      o.type !== 'SUN' &&
      o.type !== 'MOON' &&
      o.type !== 'voxel_hotbar' &&
      o.id !== 'sun-light' &&
      o.id !== 'moon-light' &&
      o.id !== 'starter_player' &&
      o.id !== 'asset_vault' &&
      (searchQuery ? o.name.toLowerCase().includes(searchQuery.toLowerCase()) : true),
  );

  // StarterGui (HUD & UI): GUI/HUD elements
  const starterGuiChildren = objects.filter(
    (o) =>
      (o.parentId === 'starter_gui' || o.type === 'voxel_hotbar') &&
      (searchQuery ? o.name.toLowerCase().includes(searchQuery.toLowerCase()) : true),
  );

  // StarterPlayer: children of the starter_player service folder
  const starterPlayerChildren = objects.filter(
    (o) =>
      o.parentId === 'starter_player' &&
      (searchQuery ? o.name.toLowerCase().includes(searchQuery.toLowerCase()) : true),
  );

  // AssetVault: children of the asset_vault service folder
  const assetVaultChildren = objects.filter(
    (o) =>
      o.parentId === 'asset_vault' &&
      (searchQuery ? o.name.toLowerCase().includes(searchQuery.toLowerCase()) : true),
  );

  // Lighting: children of the lighting service folder (guarantees Sun & Moon exist)
  const lightingChildren = useMemo(() => {
    const matched = objects.filter(
      (o) =>
        (o.parentId === 'lighting' || o.parentId === 'lighting-service' || o.type === 'SUN' || o.type === 'MOON' || o.id === 'sun-light' || o.id === 'moon-light') &&
        (searchQuery ? o.name.toLowerCase().includes(searchQuery.toLowerCase()) : true),
    );

    const hasSun = matched.some((o) => o.id === 'sun-light' || o.type === 'SUN');
    const hasMoon = matched.some((o) => o.id === 'moon-light' || o.type === 'MOON');

    const result = [...matched];

    if (!hasSun && (!searchQuery || 'sun (directional light)'.includes(searchQuery.toLowerCase()))) {
      result.unshift({
        id: 'sun-light',
        name: 'Sun (Directional Light)',
        type: 'SUN',
        position: [100, 100, 100],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        textureUrl: null,
        parentId: 'lighting',
      });
    }

    if (!hasMoon && (!searchQuery || 'moon (directional light)'.includes(searchQuery.toLowerCase()))) {
      result.push({
        id: 'moon-light',
        name: 'Moon (Directional Light)',
        type: 'MOON',
        position: [-100, -100, -100],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        textureUrl: null,
        parentId: 'lighting',
      });
    }

    return result;
  }, [objects, searchQuery]);

  const handleWorkspaceDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsWorkspaceDragOver(true);
  };

  const handleWorkspaceDragLeave = () => {
    setIsWorkspaceDragOver(false);
  };

  const handleWorkspaceDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsWorkspaceDragOver(false);
    
    // Check if dropping an asset from bottom panel
    const assetData = e.dataTransfer.getData('application/json');
    if (assetData) {
      try {
        const asset = JSON.parse(assetData);
        if (asset.type === 'primitive_prefab' || asset.type === 'prefab' || asset.primitiveType || (asset.geometry && !asset.url)) {
          useStore.getState().addObject({
            id: `obj_${crypto.randomUUID()}`,
            name: asset.name || 'Primitive Prefab',
            type: 'mesh',
            geometry: asset.geometry || 'box',
            primitiveType: asset.primitiveType || 'custom',
            position: [0, 1, 0],
            rotation: [0, 0, 0],
            scale: (Array.isArray(asset.scale) && asset.scale.length === 3 ? [asset.scale[0], asset.scale[1], asset.scale[2]] as [number, number, number] : [1, 1, 1]),
            material: {
              color: '#ffffff',
              roughness: 0.5,
              metalness: 0,
              envMapIntensity: 1,
              presetMap: 'none',
              customMap: null,
              ...asset.material,
            },
            parentId: null,
          });
        } else if (asset.type === 'model' || asset.type === 'scene') {
          if (asset.url) {
            const lower = (asset.name || asset.url || '').toLowerCase();
            const modelType = lower.endsWith('.obj') ? 'obj' : (lower.endsWith('.fbx') ? 'fbx' : 'gltf');
            useStore.getState().addObject({
              id: `obj_${crypto.randomUUID()}`,
              name: asset.name,
              type: modelType,
              url: asset.url.startsWith('data:') ? asset.id : asset.url,
              position: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: (Array.isArray(asset.scale) && asset.scale.length === 3 ? [asset.scale[0], asset.scale[1], asset.scale[2]] as [number, number, number] : [1, 1, 1]),
              parentId: null,
            });
          } else {
            useStore.getState().addObject({
              id: `obj_${crypto.randomUUID()}`,
              name: asset.name,
              type: 'mesh',
              geometry: asset.geometry || 'box',
              primitiveType: asset.primitiveType || 'custom',
              position: [0, 1, 0],
              rotation: [0, 0, 0],
              scale: (Array.isArray(asset.scale) && asset.scale.length === 3 ? [asset.scale[0], asset.scale[1], asset.scale[2]] as [number, number, number] : [1, 1, 1]),
              material: {
                color: '#ffffff',
                roughness: 0.5,
                metalness: 0,
                envMapIntensity: 1,
                presetMap: 'none',
                customMap: null,
                ...asset.material,
              },
              parentId: null,
            });
          }
        } else if (asset.type === 'material') {
          useStore.getState().addObject({
            id: `obj_${crypto.randomUUID()}`,
            name: `Box with ${asset.name}`,
            type: 'mesh',
            geometry: 'box',
            primitiveType: 'custom',
            position: [0, 1, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            material: { color: '#888888', roughness: 0.2, metalness: 0.8, envMapIntensity: 1 },
            parentId: null,
          });
        }
      } catch (err) {
        console.error('Failed to parse dropped asset data:', err);
      }
      return;
    }

    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId.startsWith('script:')) {
      const parts = draggedId.split(':');
      const scriptId = parts[1];
      const sourceId = parts[2];
      if (scriptId && sourceId) {
        const { objects, updateObject } = useStore.getState();
        const sourceObj = objects.find(o => o.id === sourceId);
        if (sourceObj) {
          const nextSourceScripts = (sourceObj.scripts || []).filter(id => id !== scriptId);
          updateObject(sourceId, { scripts: nextSourceScripts });
        }
      }
      return;
    }

    if (draggedId) {
      setParent(draggedId, null);
    }
  };

  // --- StarterPlayer drop handlers ---
  const handleStarterPlayerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsStarterPlayerDragOver(true);
  };

  const handleStarterPlayerDragLeave = () => {
    setIsStarterPlayerDragOver(false);
  };

  const handleStarterPlayerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsStarterPlayerDragOver(false);

    // Check if dropping an asset from bottom panel
    const assetData = e.dataTransfer.getData('application/json');
    if (assetData) {
      try {
        const asset = JSON.parse(assetData);
        if (asset.type === 'model' || asset.type === 'scene') {
          if (asset.url) {
            const lower = (asset.name || asset.url || '').toLowerCase();
            const modelType = lower.endsWith('.obj') ? 'obj' : (lower.endsWith('.fbx') ? 'fbx' : 'gltf');
            useStore.getState().addObject({
              id: `obj_${crypto.randomUUID()}`,
              name: asset.name,
              type: modelType,
              url: asset.url.startsWith('data:') ? asset.id : asset.url,
              position: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
              parentId: 'starter_player',
            });
          }
        } else if (asset.type === 'primitive' || asset.type === 'mesh' || asset.geometry) {
          useStore.getState().addObject({
            id: `obj_${crypto.randomUUID()}`,
            name: asset.name || 'Player Mesh',
            type: 'mesh',
            geometry: asset.geometry || 'sphere',
            position: [0, 1, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            material: asset.material || { color: '#3b82f6', roughness: 0.3, metalness: 0.2, envMapIntensity: 1 },
            parentId: 'starter_player',
          });
        }
      } catch (err) {
        console.error('Failed to parse dropped asset data:', err);
      }
      return;
    }

    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId) {
      setParent(draggedId, 'starter_player');
    }
  };

  // --- AssetVault drop handlers ---
  const handleAssetVaultDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsAssetVaultDragOver(true);
  };

  const handleAssetVaultDragLeave = () => {
    setIsAssetVaultDragOver(false);
  };

  const handleAssetVaultDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsAssetVaultDragOver(false);

    // Check if dropping an asset from bottom panel (Content Browser)
    const assetData = e.dataTransfer.getData('application/json');
    if (assetData) {
      try {
        const asset = JSON.parse(assetData);
        if (asset.type === 'model' || asset.type === 'scene') {
          if (asset.url) {
            const lower = (asset.name || asset.url || '').toLowerCase();
            const modelType = lower.endsWith('.obj') ? 'obj' : (lower.endsWith('.fbx') ? 'fbx' : 'gltf');
            useStore.getState().addObject({
              id: `obj_${crypto.randomUUID()}`,
              name: asset.name,
              type: modelType,
              url: asset.url.startsWith('data:') ? asset.id : asset.url,
              position: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
              parentId: 'asset_vault',
            });
          }
        }
      } catch (err) {
        console.error('Failed to parse dropped asset data:', err);
      }
      return;
    }

    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId) {
      setParent(draggedId, 'asset_vault');
    }
  };

  // --- Lighting drop handlers ---
  const handleLightingDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsLightingDragOver(true);
  };

  const handleLightingDragLeave = () => {
    setIsLightingDragOver(false);
  };

  const handleLightingDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsLightingDragOver(false);

    // Check if dropping an asset from bottom panel
    const assetData = e.dataTransfer.getData('application/json');
    if (assetData) {
      try {
        const asset = JSON.parse(assetData);
        if (asset.type === 'model' || asset.type === 'scene') {
          if (asset.url) {
            const lower = (asset.name || asset.url || '').toLowerCase();
            const modelType = lower.endsWith('.obj') ? 'obj' : (lower.endsWith('.fbx') ? 'fbx' : 'gltf');
            useStore.getState().addObject({
              id: `obj_${crypto.randomUUID()}`,
              name: asset.name,
              type: modelType,
              url: asset.url.startsWith('data:') ? asset.id : asset.url,
              position: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
              parentId: 'lighting',
            });
          }
        }
      } catch (err) {
        console.error('Failed to parse dropped asset data:', err);
      }
      return;
    }

    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId) {
      setParent(draggedId, 'lighting');
    }
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    // Check if dropping an asset from bottom panel
    const assetData = e.dataTransfer.getData('application/json');
    if (assetData) {
      try {
        const asset = JSON.parse(assetData);
        if (asset.type === 'model' || asset.type === 'scene') {
          if (asset.url) {
            const lower = (asset.name || asset.url || '').toLowerCase();
            const modelType = lower.endsWith('.obj') ? 'obj' : (lower.endsWith('.fbx') ? 'fbx' : 'gltf');
            useStore.getState().addObject({
              id: `obj_${crypto.randomUUID()}`,
              name: asset.name,
              type: modelType,
              url: asset.url.startsWith('data:') ? asset.id : asset.url,
              position: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
              parentId: null,
            });
          }
        }
      } catch (err) {
        console.error('Failed to parse dropped asset data:', err);
      }
      return;
    }

    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId) {
      setParent(draggedId, null);
    }
  };

  return (
    <div role="region" aria-label="Hierarchy Panel (Explorer)" className="flex flex-col h-full overflow-hidden select-none bg-bg-surface/80 backdrop-blur-md">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-neutral-900/50">
        <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-500">Explorer</span>
        <button
          onClick={toggleSidebar}
          className="p-1 hover:bg-neutral-800 rounded-md text-neutral-500 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
          title="Collapse Panel"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      <div className="p-1 px-2 border-b border-border bg-transparent shrink-0">
        <div className="relative flex items-center">
          <Search size={13} className="absolute left-2 text-text-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="Filter workspace..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg-deep border border-border rounded-sm py-1 pl-7 pr-2 text-[11px] text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent focus:ring-[0.5px] focus:ring-accent transition-all"
          />
        </div>
      </div>

      <div
        role="tree"
        aria-label="Scene Objects"
        className="flex-1 overflow-y-auto py-1 outline-none"
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={handleRootDrop}
        tabIndex={0}
        onContextMenu={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            useStore.getState().openContextMenu(e.clientX, e.clientY, 'hierarchy', null);
          }
        }}
      >
        {/* World Settings Node */}
        <div className="group flex flex-col w-full mb-1">
          <div
            onClick={() => useStore.getState().selectObject('world_settings')}
            className={`flex items-center w-full cursor-pointer select-none hover:bg-bg-panel/50 ${selectedIds.includes('world_settings') ? 'bg-bg-panel/50 text-white' : 'text-text-primary'}`}
          >
            <div style={{ paddingLeft: '4px' }} className="flex items-center gap-1.5 w-full py-[4px] pr-2">
              <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                <span className="w-[14px]" />
              </div>
              <Sun size={14} className="text-amber-400" style={{ filter: 'drop-shadow(0 0 2px #eab308)' }} />
              <span className="truncate text-[12px] font-medium font-mono">World Settings</span>
            </div>
          </div>
        </div>

        {/* Gameplay Settings Node */}
        <div className="group flex flex-col w-full mb-1">
          <div
            onClick={() => useStore.getState().selectObject('gameplay_settings')}
            className={`flex items-center w-full cursor-pointer select-none hover:bg-bg-panel/50 ${selectedIds.includes('gameplay_settings') ? 'bg-bg-panel/50 text-white' : 'text-text-primary'}`}
          >
            <div style={{ paddingLeft: '4px' }} className="flex items-center gap-1.5 w-full py-[4px] pr-2">
              <div className="w-[18px] h-[18px] flex items-center justify-center shrink-0">
                <span className="w-[14px]" />
              </div>
              <Gamepad2 size={14} className="text-emerald-400" style={{ filter: 'drop-shadow(0 0 2px #10b981)' }} />
              <span className="truncate text-[12px] font-medium font-mono">Gameplay Settings</span>
            </div>
          </div>
        </div>

        {/* Workspace Root Node */}
        <div
          onDragOver={handleWorkspaceDragOver}
          onDragLeave={handleWorkspaceDragLeave}
          onDrop={handleWorkspaceDrop}
          className={`group flex flex-col w-full transition-colors duration-150 ${isWorkspaceDragOver ? 'bg-accent/20 border-y border-accent/40' : ''}`}
        >
          <div
            onClick={() => setWorkspaceExpanded(!workspaceExpanded)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              useStore.getState().openContextMenu(e.clientX, e.clientY, 'workspace', null);
            }}
            className="flex items-center w-full cursor-pointer select-none text-text-primary hover:bg-bg-panel"
          >
            <div style={{ paddingLeft: '4px' }} className="flex items-center gap-1.5 w-full py-[3px] pr-2">
              <div className="w-[18px] h-[18px] flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors shrink-0">
                {workspaceExpanded ? (
                  <ChevronDown size={14} strokeWidth={2.5} />
                ) : (
                  <ChevronRight size={14} strokeWidth={2.5} />
                )}
              </div>
              <Globe size={14} className="text-emerald-400" />
              <span className="truncate text-[12px] font-medium">Workspace</span>
            </div>
          </div>
 
          {workspaceExpanded && (
            <div className="flex flex-col w-full">
              {workspaceObjects.map((obj) => (
                <TreeItem key={obj.id} obj={obj} depth={1} />
              ))}
            </div>
          )}
        </div>

        {/* StarterPlayer Root Service Node */}
        <div
          onDragOver={handleStarterPlayerDragOver}
          onDragLeave={handleStarterPlayerDragLeave}
          onDrop={handleStarterPlayerDrop}
          className={`group flex flex-col w-full mt-1 transition-colors duration-150 ${isStarterPlayerDragOver ? 'bg-violet-500/20 border-y border-violet-400/40' : ''}`}
        >
          <div
            onClick={() => setStarterPlayerExpanded(!starterPlayerExpanded)}
            className="flex items-center w-full cursor-pointer select-none text-text-primary hover:bg-bg-panel"
          >
            <div style={{ paddingLeft: '4px' }} className="flex items-center gap-1.5 w-full py-[3px] pr-2">
              <div className="w-[18px] h-[18px] flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors shrink-0">
                {starterPlayerExpanded ? (
                  <ChevronDown size={14} strokeWidth={2.5} />
                ) : (
                  <ChevronRight size={14} strokeWidth={2.5} />
                )}
              </div>
              <User size={14} className="text-violet-400" style={{ filter: 'drop-shadow(0 0 2px #8b5cf6)' }} />
              <span className="truncate text-[12px] font-medium">Starter Player</span>
              <span className="ml-auto text-[9px] font-mono uppercase tracking-wider text-violet-400/60 pr-1">service</span>
            </div>
          </div>

          {starterPlayerExpanded && (
            <div className="flex flex-col w-full">
              {starterPlayerChildren.map((obj) => (
                <TreeItem key={obj.id} obj={obj} depth={1} />
              ))}
            </div>
          )}
        </div>

        {/* StarterGui (HUD & UI) Root Service Node */}
        <div className="group flex flex-col w-full mt-1 transition-colors duration-150">
          <div
            onClick={() => setStarterGuiExpanded(!starterGuiExpanded)}
            className="flex items-center w-full cursor-pointer select-none text-text-primary hover:bg-bg-panel"
          >
            <div style={{ paddingLeft: '4px' }} className="flex items-center gap-1.5 w-full py-[3px] pr-2">
              <div className="w-[18px] h-[18px] flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors shrink-0">
                {starterGuiExpanded ? (
                  <ChevronDown size={14} strokeWidth={2.5} />
                ) : (
                  <ChevronRight size={14} strokeWidth={2.5} />
                )}
              </div>
              <Layers size={14} className="text-cyan-400" style={{ filter: 'drop-shadow(0 0 2px #06b6d4)' }} />
              <span className="truncate text-[12px] font-medium">StarterGui (HUD & UI)</span>
              <span className="ml-auto text-[9px] font-mono uppercase tracking-wider text-cyan-400/60 pr-1">service</span>
            </div>
          </div>

          {starterGuiExpanded && (
            <div className="flex flex-col w-full">
              {starterGuiChildren.map((obj) => (
                <TreeItem key={obj.id} obj={obj} depth={1} />
              ))}
            </div>
          )}
        </div>

        {/* Asset Vault Root Service Node */}
        <div
          onDragOver={handleAssetVaultDragOver}
          onDragLeave={handleAssetVaultDragLeave}
          onDrop={handleAssetVaultDrop}
          className={`group flex flex-col w-full mt-1 transition-colors duration-150 ${isAssetVaultDragOver ? 'bg-purple-500/20 border-y border-purple-400/40' : ''}`}
        >
          <div
            onClick={() => setAssetVaultExpanded(!assetVaultExpanded)}
            className="flex items-center w-full cursor-pointer select-none text-text-primary hover:bg-bg-panel"
          >
            <div style={{ paddingLeft: '4px' }} className="flex items-center gap-1.5 w-full py-[3px] pr-2">
              <div className="w-[18px] h-[18px] flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors shrink-0">
                {assetVaultExpanded ? (
                  <ChevronDown size={14} strokeWidth={2.5} />
                ) : (
                  <ChevronRight size={14} strokeWidth={2.5} />
                )}
              </div>
              <Package size={14} className="text-purple-400" style={{ filter: 'drop-shadow(0 0 2px #a855f7)' }} />
              <span className="truncate text-[12px] font-medium">Asset Vault</span>
              <span className="ml-auto text-[9px] font-mono uppercase tracking-wider text-purple-400/60 pr-1">service</span>
            </div>
          </div>

          {assetVaultExpanded && (
            <div className="flex flex-col w-full">
              {assetVaultChildren.map((obj) => (
                <TreeItem key={obj.id} obj={obj} depth={1} />
              ))}
            </div>
          )}
        </div>
 
        {/* Lighting Root Node */}
        <div
          onDragOver={handleLightingDragOver}
          onDragLeave={handleLightingDragLeave}
          onDrop={handleLightingDrop}
          className={`group flex flex-col w-full mt-1 transition-colors duration-150 ${isLightingDragOver ? 'bg-accent/20 border-y border-accent/40' : ''}`}
        >
          <div
            onClick={() => setLightingExpanded(!lightingExpanded)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              useStore.getState().openContextMenu(e.clientX, e.clientY, 'lighting', null);
            }}
            className="flex items-center w-full cursor-pointer select-none text-text-primary hover:bg-bg-panel"
          >
            <div style={{ paddingLeft: '4px' }} className="flex items-center gap-1.5 w-full py-[3px] pr-2">
              <div className="w-[18px] h-[18px] flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors shrink-0">
                {lightingExpanded ? (
                  <ChevronDown size={14} strokeWidth={2.5} />
                ) : (
                  <ChevronRight size={14} strokeWidth={2.5} />
                )}
              </div>
              <Sun size={14} className="text-amber-400 fill-amber-400/20" style={{ filter: 'drop-shadow(0 0 2px #f59e0b)' }} />
              <span className="truncate text-[12px] font-medium">Lighting</span>
              <span className="ml-auto text-[9px] font-mono uppercase tracking-wider text-amber-400/60 pr-1">service</span>
            </div>
          </div>

          {lightingExpanded && (
            <div className="flex flex-col w-full">
              {lightingChildren.map((obj) => (
                <TreeItem key={obj.id} obj={obj} depth={1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
