import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useStore, BoneNode } from '../store/useStore';
import { toast } from '../store/useToastStore';
import { ChevronDown, ChevronRight, Search, Target, FolderTree, Folder, Eye, EyeOff, Plus, Trash2, PenLine, Copy } from 'lucide-react';

// ─── Bone Context Menu ───────────────────────────────────────────────────────
interface BoneContextMenuProps {
  x: number;
  y: number;
  boneName: string;
  onClose: () => void;
}

function BoneContextMenu({ x, y, boneName, onClose }: BoneContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const addBoneToRig = useStore((s) => s.addBoneToRig);
  const deleteBoneFromRig = useStore((s) => s.deleteBoneFromRig);
  const renameBone = useStore((s) => s.renameBone);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  const handleAddChild = () => {
    const name = prompt('New bone name:', `${boneName}_child`);
    if (name && name.trim()) {
      addBoneToRig(boneName, name.trim());
    }
    onClose();
  };

  const handleRename = () => {
    const name = prompt('Rename bone to:', boneName);
    if (name && name.trim() && name.trim() !== boneName) {
      renameBone(boneName, name.trim());
    }
    onClose();
  };

  const handleDelete = () => {
    if (confirm(`Delete bone "${boneName}"? Children will be reparented.`)) {
      deleteBoneFromRig(boneName);
    }
    onClose();
  };

  // Adjust position so menu doesn't go off-screen
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 150);

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] bg-[#181824]/95 backdrop-blur-md border border-neutral-800/80 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] py-1.5 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <button
        onClick={handleAddChild}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 hover:text-white transition-colors cursor-pointer text-[11px] font-medium text-text-primary rounded-md mx-1 w-[calc(100%-8px)]"
      >
        <Plus size={12} className="text-purple-400" />
        <span>Add Child Bone</span>
      </button>
      <button
        onClick={handleRename}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 hover:text-white transition-colors cursor-pointer text-[11px] font-medium text-text-primary rounded-md mx-1 w-[calc(100%-8px)]"
      >
        <PenLine size={12} className="text-blue-400" />
        <span>Rename Bone</span>
      </button>
      <div className="h-px bg-neutral-800/50 my-1 mx-2" />
      <button
        onClick={handleDelete}
        className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 hover:text-white transition-colors cursor-pointer text-[11px] font-medium text-red-400 rounded-md mx-1 w-[calc(100%-8px)]"
      >
        <Trash2 size={12} />
        <span>Delete Bone</span>
      </button>
    </div>
  );
}

// ─── Bone Tree Item ──────────────────────────────────────────────────────────
interface BoneTreeItemProps {
  node: BoneNode;
  depth: number;
  searchQuery: string;
  onContextMenu: (e: React.MouseEvent, boneName: string) => void;
}

const BoneTreeItem = React.memo(function BoneTreeItem({ node, depth, searchQuery, onContextMenu }: BoneTreeItemProps) {
  const selectedBoneId = useStore((s) => s.selectedBoneId);
  const setSelectedBoneId = useStore((s) => s.setSelectedBoneId);
  const [isExpanded, setIsExpanded] = useState(true);

  const isSelected = selectedBoneId === node.id;
  const isVirtualFolder = (node as any).isVirtualFolder;

  // Filter children based on search query
  const childrenFiltered = useMemo(() => {
    return node.children || [];
  }, [node.children]);

  // Check if this node or any descendants match the search query
  const matchesSearch = useMemo(() => {
    if (!searchQuery) return true;
    const cleanQuery = searchQuery.toLowerCase();
    const checkMatch = (n: BoneNode): boolean => {
      if (n.name.toLowerCase().includes(cleanQuery)) return true;
      return n.children.some(checkMatch);
    };
    return checkMatch(node);
  }, [node, searchQuery]);

  if (!matchesSearch) return null;

  const hasChildren = childrenFiltered.length > 0;

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const handleSelect = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isVirtualFolder) {
      setIsExpanded(!isExpanded);
    } else {
      setSelectedBoneId(node.id === selectedBoneId ? null : node.id);
    }
  };

  const handleRightClick = (e: React.MouseEvent) => {
    if (isVirtualFolder) return;
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node.id);
  };

  return (
    <div className="w-full">
      <div
        onClick={handleSelect}
        onContextMenu={handleRightClick}
        className={`group flex items-center w-full cursor-pointer select-none border-b border-bg-deep/30 transition-all duration-150 py-1.5 pr-2 ${
          isSelected && !isVirtualFolder
            ? 'bg-fuchsia-600/20 text-fuchsia-200 border-l-2 border-fuchsia-500 shadow-[inset_1px_0_10px_rgba(217,70,239,0.1)]'
            : isVirtualFolder
            ? 'text-purple-300 hover:bg-neutral-800/40 border-l-2 border-transparent font-semibold'
            : 'text-text-primary hover:bg-neutral-800/40 border-l-2 border-transparent'
        }`}
      >
        <div
          style={{ paddingLeft: `${depth * 14 + 4}px` }}
          className="flex items-center gap-1.5 w-full min-w-0"
        >
          <button
            onClick={handleToggleExpand}
            className={`w-[18px] h-[18px] flex items-center justify-center text-neutral-500 hover:text-white transition-colors shrink-0 ${
              !hasChildren ? 'opacity-0 pointer-events-none' : ''
            }`}
          >
            {isExpanded ? <ChevronDown size={13} strokeWidth={2.5} /> : <ChevronRight size={13} strokeWidth={2.5} />}
          </button>
          
          {isVirtualFolder ? (
            <Folder
              size={12}
              className="shrink-0 text-purple-400 fill-purple-400/20"
            />
          ) : (
            <Target
              size={12}
              className={`shrink-0 transition-transform duration-300 ${
                isSelected ? 'text-fuchsia-400 rotate-45 scale-110' : 'text-neutral-500 group-hover:text-neutral-400'
              }`}
            />
          )}
          
          <span
            className={`truncate text-xs font-mono tracking-tight min-w-0 ${
              isSelected && !isVirtualFolder ? 'font-bold' : 'group-hover:text-white'
            }`}
          >
            {node.name}
          </span>

          {/* Quick add child button on hover */}
          {!isVirtualFolder && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                const name = prompt('New bone name:', `${node.name}_child`);
                if (name && name.trim()) {
                  useStore.getState().addBoneToRig(node.id, name.trim());
                }
              }}
              className="ml-auto opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-fuchsia-600/30 text-neutral-500 hover:text-fuchsia-300 transition-all shrink-0"
              title="Add child bone"
            >
              <Plus size={11} />
            </button>
          )}
        </div>
      </div>
      
      {hasChildren && isExpanded && (
        <div className="flex flex-col w-full">
          {childrenFiltered.map((child) => (
            <BoneTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              searchQuery={searchQuery}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
});

function transformSkeletonWithFingerFolders(nodes: BoneNode[], hideFingers: boolean): BoneNode[] {
  return nodes.map((node) => {
    let newChildren = node.children ? transformSkeletonWithFingerFolders(node.children, hideFingers) : [];

    const isLeftHand = /left_?hand|l_?hand|hand_?l/i.test(node.name);
    const isRightHand = /right_?hand|r_?hand|hand_?r/i.test(node.name);

    if (isLeftHand || isRightHand) {
      // Find children that are finger bones
      const fingerBones = newChildren.filter((child) => {
        const nameLower = child.name.toLowerCase();
        return (
          nameLower.includes('thumb') ||
          nameLower.includes('index') ||
          nameLower.includes('middle') ||
          nameLower.includes('ring') ||
          nameLower.includes('pinky') ||
          nameLower.includes('finger')
        );
      });

      const nonFingerBones = newChildren.filter((child) => !fingerBones.includes(child));

      if (fingerBones.length > 0) {
        if (hideFingers) {
          newChildren = nonFingerBones;
        } else {
          newChildren = [
            ...nonFingerBones,
            {
              id: `${node.id}-fingers-virtual-folder`,
              name: isLeftHand ? 'Left Hand Fingers' : 'Right Hand Fingers',
              isVirtualFolder: true,
              children: fingerBones,
            } as any,
          ];
        }
      }
    }

    return {
      ...node,
      children: newChildren,
    };
  });
}

export default function BoneHierarchy() {
  const activeSkeleton = useStore((s) => s.activeSkeleton);
  const selectedBoneId = useStore((s) => s.selectedBoneId);
  const setSelectedBoneId = useStore((s) => s.setSelectedBoneId);
  const riggingSymmetry = useStore((s) => s.riggingSymmetry);
  const setRiggingSymmetry = useStore((s) => s.setRiggingSymmetry);
  const objects = useStore((s) => s.objects);
  const modelAnimations = useStore((s) => s.modelAnimations);
  const animationTargetId = useStore((s) => s.animationTargetId);
  const isSkeletonUnbound = useStore((s) => s.isSkeletonUnbound);
  const activeClonedScene = useStore((s) => s.activeClonedScene);
  const cloneActiveAnimation = useStore((s) => s.cloneActiveAnimation);

  const [searchQuery, setSearchQuery] = useState('');
  const [animationsExpanded, setAnimationsExpanded] = useState(true);
  const [hideFingers, setHideFingers] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; boneName: string } | null>(null);

  const activeAnimation = useMemo(() => {
    const obj = objects.find((o) => o.id === animationTargetId);
    return obj?.activeAnimation || null;
  }, [objects, animationTargetId]);

  const clips = useMemo(() => {
    if (!animationTargetId) return [];
    const obj = objects.find((o) => o.id === animationTargetId);
    return obj?.availableAnimations || modelAnimations[animationTargetId] || [];
  }, [objects, modelAnimations, animationTargetId]);

  const processedSkeleton = useMemo(() => {
    return transformSkeletonWithFingerFolders(activeSkeleton, hideFingers);
  }, [activeSkeleton, hideFingers]);

  const toggleSidebar = useStore((s) => s.toggleSidebar);

  const handleBoneContextMenu = (e: React.MouseEvent, boneName: string) => {
    setContextMenu({ x: e.clientX, y: e.clientY, boneName });
  };

  return (
    <div
      role="region"
      aria-label="Bone Hierarchy"
      className="flex flex-col h-full overflow-hidden select-none bg-bg-surface/80 backdrop-blur-md"
    >
      {/* Title block */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-neutral-900/50">
        <div className="flex items-center gap-1.5">
          <FolderTree size={12} className="text-fuchsia-400" />
          <span className="text-[10px] font-bold tracking-widest uppercase text-fuchsia-300">
            Bone Hierarchy
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick toggle fingers */}
          <button
            onClick={() => setHideFingers(!hideFingers)}
            className={`p-1 px-2 rounded text-[9px] font-bold uppercase border transition-all cursor-pointer flex items-center gap-1 ${
              hideFingers
                ? 'bg-purple-950/40 border-purple-500/40 text-purple-300 shadow-[0_0_6px_rgba(168,85,247,0.15)]'
                : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-700'
            }`}
            title={hideFingers ? 'Show Finger Bones' : 'Hide Finger Bones'}
          >
            {hideFingers ? <EyeOff size={10} /> : <Eye size={10} />}
            <span>Fingers</span>
          </button>
          
          {/* Symmetrical rigging toggle */}
          <button
            onClick={() => setRiggingSymmetry(!riggingSymmetry)}
            className={`p-1 px-2 rounded text-[9px] font-bold uppercase border transition-all cursor-pointer flex items-center gap-1 ${
              riggingSymmetry
                ? 'bg-fuchsia-950/40 border-fuchsia-500/40 text-fuchsia-300 shadow-[0_0_6px_rgba(217,70,239,0.15)]'
                : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white hover:bg-neutral-700'
            }`}
            title={riggingSymmetry ? 'Disable Symmetrical Rigging' : 'Enable Symmetrical Rigging'}
          >
            <svg
              viewBox="0 0 24 24"
              width="10"
              height="10"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M5 12h14"></path>
              <path d="M12 5l-7 7 7 7"></path>
              <path d="M12 5l7 7-7 7"></path>
            </svg>
            <span>Symmetry</span>
          </button>
          
          <button
            onClick={toggleSidebar}
            className="p-1 hover:bg-neutral-800 rounded-md text-neutral-500 hover:text-white transition-colors cursor-pointer flex items-center justify-center"
            title="Collapse Panel"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Search filter */}
      <div className="p-1 px-2 border-b border-border bg-transparent shrink-0">
        <div className="relative flex items-center">
          <Search size={13} className="absolute left-2 text-text-secondary pointer-events-none" />
          <input
            type="text"
            placeholder="Search bones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-bg-deep border border-border rounded-sm py-1 pl-7 pr-2 text-[11px] text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-fuchsia-500 focus:ring-[0.5px] focus:ring-fuchsia-500 transition-all font-mono"
          />
        </div>
      </div>

      {/* Rest Pose Rigging controls */}
      {activeClonedScene && (
        <div className="p-2 border-b border-border bg-neutral-900/20 flex flex-col gap-1.5 shrink-0">
          <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider font-mono">Rest Pose Rigging</div>
          <div className="flex gap-2">
            <button
              onClick={() => useStore.getState().unbindSkeleton()}
              disabled={isSkeletonUnbound}
              className={`flex-1 text-[10px] font-bold py-1.5 px-2 rounded border transition-all uppercase cursor-pointer text-center ${
                isSkeletonUnbound
                  ? 'bg-neutral-800 border-neutral-700 text-neutral-600 cursor-not-allowed'
                  : 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300'
              }`}
            >
              Unbind Skeleton
            </button>
            <button
              onClick={() => useStore.getState().rebindSkeleton()}
              disabled={!isSkeletonUnbound}
              className={`flex-1 text-[10px] font-bold py-1.5 px-2 rounded border transition-all uppercase cursor-pointer text-center ${
                !isSkeletonUnbound
                  ? 'bg-neutral-800 border-neutral-700 text-neutral-600 cursor-not-allowed'
                  : 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20 hover:text-green-300'
              }`}
            >
              Lock/Rebind
            </button>
          </div>
          <button
            onClick={() => useStore.getState().resetRestPose()}
            className="w-full text-[10px] font-bold py-1 px-2 rounded border transition-all uppercase cursor-pointer text-center bg-neutral-800/50 border-neutral-700/60 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200"
          >
            Reset to Default Rest Pose
          </button>
          {isSkeletonUnbound && (
            <div className="text-[9px] text-amber-400/90 bg-amber-500/5 border border-amber-500/10 p-1.5 rounded font-mono leading-tight">
              ⚠️ Skeleton is unbound. Use the transform gizmos to align the hand/finger bones inside the mesh, then click Lock/Rebind to lock the new pose.
            </div>
          )}
        </div>
      )}

      {/* Hierarchy tree */}
      <div className="flex-1 overflow-y-auto py-1 outline-none">
        {/* Animations List Section */}
        {clips.length > 0 && (
          <div className="border-b border-border/40 pb-2 mb-2">
            <div
              onClick={() => setAnimationsExpanded(!animationsExpanded)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-neutral-400 hover:text-white cursor-pointer select-none text-[10px] font-bold uppercase tracking-wider"
            >
              <div className="shrink-0 text-purple-400">
                {animationsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              </div>
              <span className="text-purple-300">Available Animations</span>
              <span className="ml-auto text-[9px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 px-1 rounded-sm">
                {clips.length}
              </span>
            </div>

            {animationsExpanded && (
              <div className="flex flex-col gap-0.5 px-1 mt-1">
                {clips.map((clip) => {
                  const isSelected = activeAnimation === clip;
                  return (
                    <div
                      key={clip}
                      onClick={() => {
                        if (animationTargetId) {
                          const isSelected = activeAnimation === clip;
                          const newAnim = isSelected ? 'None' : clip;
                          useStore.getState().updateObject(animationTargetId, { activeAnimation: newAnim });
                          if (newAnim === 'None') {
                            useStore.getState().setTracks([]);
                          } else {
                            useStore.getState().loadClipToTimeline(animationTargetId, newAnim);
                          }
                        }
                      }}
                      onContextMenu={(e) => {
                        if (animationTargetId) {
                          e.preventDefault();
                          e.stopPropagation();
                          useStore.getState().openContextMenu(e.clientX, e.clientY, 'animation', animationTargetId, clip);
                        }
                      }}
                      className={`group flex items-center w-full cursor-pointer select-none py-1.5 px-3 rounded transition-colors text-xs ${
                        isSelected
                          ? 'bg-purple-600/20 text-purple-200 font-bold border border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.15)]'
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill={isSelected ? 'currentColor' : 'none'}
                        stroke="currentColor"
                        strokeWidth="2.5"
                        className={`w-3 h-3 mr-2 shrink-0 ${isSelected ? 'text-purple-400' : 'text-neutral-500 group-hover:text-neutral-400'}`}
                      >
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                      </svg>
                      <span className="truncate font-mono text-[11px]">{clip}</span>
                      {isSelected && (
                        <div className="ml-auto flex items-center gap-1.5 shrink-0">
                          {clip !== 'None' && !clip.endsWith('_EDIT') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const clonedName = cloneActiveAnimation();
                                if (clonedName) {
                                  toast.success('Animation Cloned', `Successfully created editable clone: "${clonedName}"`);
                                }
                              }}
                              className="flex items-center gap-1 text-[9px] bg-purple-600 hover:bg-purple-500 text-white font-bold py-0.5 px-2 rounded-sm transition-colors cursor-pointer select-none border border-purple-500/30"
                              title="Clone this read-only animation to make it editable"
                            >
                              <Copy size={8} />
                              Clone to Edit
                            </button>
                          )}
                          <span className="text-[8px] font-mono bg-purple-500/30 text-purple-300 px-1 rounded uppercase tracking-wider scale-90">
                            active
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Bone Tree */}
        {processedSkeleton.length > 0 ? (
          processedSkeleton.map((rootNode) => (
            <BoneTreeItem
              key={rootNode.id}
              node={rootNode}
              depth={0}
              searchQuery={searchQuery}
              onContextMenu={handleBoneContextMenu}
            />
          ))
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-neutral-400 text-xs gap-3 bg-[#13131c]/60 rounded-xl border border-neutral-800/60 m-3 shadow-inner">
            <div className="w-10 h-10 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-400 shadow-[0_0_12px_rgba(217,70,239,0.15)]">
              <FolderTree size={18} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-white text-xs tracking-wide">No Skeleton Bones Detected</span>
              <span className="text-[10px] text-neutral-400 max-w-[200px] leading-relaxed font-mono">
                Select a rigged 3D character mesh (.GLB / .FBX) in the scene to inspect and manipulate its bone hierarchy.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer with Add Bone + Clear selection */}
      <div className="p-2 border-t border-border bg-neutral-900/30 flex items-center justify-between shrink-0 gap-2">
        {selectedBoneId ? (
          <>
            <button
              onClick={() => {
                const name = prompt('New bone name:', `${selectedBoneId}_child`);
                if (name && name.trim()) {
                  useStore.getState().addBoneToRig(selectedBoneId, name.trim());
                }
              }}
              className="flex items-center gap-1 text-[10px] font-bold text-fuchsia-400 hover:text-fuchsia-300 transition-colors uppercase cursor-pointer bg-fuchsia-500/10 hover:bg-fuchsia-500/20 px-2 py-1 rounded border border-fuchsia-500/20"
            >
              <Plus size={10} />
              Add Child Bone
            </button>
            <button
              onClick={() => setSelectedBoneId(null)}
              className="text-[10px] font-bold text-neutral-400 hover:text-neutral-200 transition-colors uppercase cursor-pointer"
            >
              Clear Selection
            </button>
          </>
        ) : (
          <span className="text-[10px] text-neutral-600 font-mono">Right-click a bone for options</span>
        )}
      </div>

      {/* Context menu portal */}
      {contextMenu && (
        <BoneContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          boneName={contextMenu.boneName}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
