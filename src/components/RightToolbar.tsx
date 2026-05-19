import React, { useMemo } from 'react';
import { useStore } from '../store/useStore';
import {
  Copy,
  Trash2,
  FolderPlus,
  FolderMinus,
  Combine,
  Scissors,
  Crop,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Target,
} from 'lucide-react';

function RightToolbar() {
  const {
    objects,
    selectedIds,
    duplicateObject,
    deleteObject,
    groupSelected,
    ungroupSelected,
    csgOperation,
    updateObject,
  } = useStore();

  const isSelectionDisabled = selectedIds.length === 0 || selectedIds.includes('world_settings');
  const isMultiSelectionDisabled = selectedIds.length <= 1 || selectedIds.includes('world_settings');

  // Find the active primary selected object to track its current local states
  const activeObject = useMemo(() => {
    return objects.find((o) => o.id === selectedIds[0]);
  }, [objects, selectedIds]);

  const isLocked = activeObject?.locked ?? false;
  const isVisible = activeObject?.visible !== false;

  const handleToggleLock = () => {
    if (!activeObject) return;
    updateObject(activeObject.id, { locked: !isLocked });
  };

  const handleToggleVisibility = () => {
    if (!activeObject) return;
    updateObject(activeObject.id, { visible: !isVisible });
  };

  const handleFocusCamera = () => {
    window.dispatchEvent(new Event('focus_camera'));
  };

  return (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col bg-neutral-950/80 backdrop-blur-md border border-neutral-800/50 p-1.5 rounded-xl gap-1 shadow-2xl animate-in fade-in slide-in-from-right-4 duration-200">
      
      {/* SECTION 1: Viewport & Selection State Modifiers */}
      <button
        onClick={handleFocusCamera}
        disabled={isSelectionDisabled}
        className={`p-2 rounded-lg transition-colors ${isSelectionDisabled ? 'opacity-20 cursor-not-allowed text-neutral-500' : 'text-neutral-300 hover:bg-neutral-900 hover:text-sky-400 cursor-pointer'}`}
        title="Focus Camera on Object (F)"
      >
        <Target size={16} />
      </button>

      <button
        onClick={handleToggleVisibility}
        disabled={isSelectionDisabled}
        className={`p-2 rounded-lg transition-colors ${isSelectionDisabled ? 'opacity-20 cursor-not-allowed text-neutral-500' : isVisible ? 'text-neutral-300 hover:bg-neutral-900 hover:text-amber-400' : 'text-amber-500/80 bg-amber-500/5 border border-amber-500/20 hover:bg-neutral-900'}`}
        title={isVisible ? "Hide Object" : "Show Object"}
      >
        {isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>

      <button
        onClick={handleToggleLock}
        disabled={isSelectionDisabled}
        className={`p-2 rounded-lg transition-colors ${isSelectionDisabled ? 'opacity-20 cursor-not-allowed text-neutral-500' : isLocked ? 'text-red-400 bg-red-500/5 border border-red-500/20 hover:bg-neutral-900' : 'text-neutral-300 hover:bg-neutral-900 hover:text-red-400'}`}
        title={isLocked ? "Unlock Transformation" : "Lock Transformation"}
      >
        {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
      </button>

      <div className="w-full h-px bg-neutral-800/60 my-0.5" />

      {/* SECTION 2: Structural Object Creation/Duplication */}
      <button
        onClick={() => selectedIds.filter((id) => id !== 'world_settings').forEach((id) => duplicateObject(id))}
        disabled={isSelectionDisabled}
        className={`p-2 rounded-lg transition-colors ${isSelectionDisabled ? 'opacity-20 cursor-not-allowed text-neutral-500' : 'text-neutral-300 hover:bg-neutral-900 hover:text-sky-400 cursor-pointer shadow-sm'}`}
        title="Duplicate Selected"
      >
        <Copy size={16} />
      </button>
      
      <button
        onClick={() => selectedIds.filter((id) => id !== 'world_settings').forEach((id) => deleteObject(id))}
        disabled={isSelectionDisabled}
        className={`p-2 rounded-lg transition-colors ${isSelectionDisabled ? 'opacity-20 cursor-not-allowed text-neutral-500' : 'text-neutral-400 hover:bg-red-950/40 hover:text-red-400 cursor-pointer shadow-sm'}`}
        title="Delete Selected"
      >
        <Trash2 size={16} />
      </button>

      <div className="w-full h-px bg-neutral-800/60 my-0.5" />

      {/* SECTION 3: Node Hierarchy Grouping */}
      <button
        onClick={groupSelected}
        disabled={isMultiSelectionDisabled}
        className={`p-2 rounded-lg transition-colors ${isMultiSelectionDisabled ? 'opacity-20 cursor-not-allowed text-neutral-500' : 'text-neutral-300 hover:bg-neutral-900 hover:text-sky-400 cursor-pointer shadow-sm'}`}
        title="Group Selected"
      >
        <FolderPlus size={16} />
      </button>
      
      <button
        onClick={ungroupSelected}
        disabled={isSelectionDisabled}
        className={`p-2 rounded-lg transition-colors ${isSelectionDisabled ? 'opacity-20 cursor-not-allowed text-neutral-500' : 'text-neutral-300 hover:bg-neutral-900 hover:text-white cursor-pointer shadow-sm'}`}
        title="Ungroup Selected"
      >
        <FolderMinus size={16} />
      </button>

      <div className="w-full h-px bg-neutral-800/60 my-0.5" />

      {/* SECTION 4: Constructive Solid Geometry Boolean Operations */}
      <button
        onClick={() => csgOperation('addition')}
        disabled={isMultiSelectionDisabled}
        className={`p-2 rounded-lg transition-colors ${isMultiSelectionDisabled ? 'opacity-20 cursor-not-allowed text-neutral-500' : 'text-purple-400 hover:bg-purple-950/40 cursor-pointer shadow-sm'}`}
        title="CSG Union (Combine)"
      >
        <Combine size={16} />
      </button>
      
      <button
        onClick={() => csgOperation('subtraction')}
        disabled={isMultiSelectionDisabled}
        className={`p-2 rounded-lg transition-colors ${isMultiSelectionDisabled ? 'opacity-20 cursor-not-allowed text-neutral-500' : 'text-purple-400 hover:bg-purple-950/40 cursor-pointer shadow-sm'}`}
        title="CSG Subtract (Cut)"
      >
        <Scissors size={16} />
      </button>
      
      <button
        onClick={() => csgOperation('intersection')}
        disabled={isMultiSelectionDisabled}
        className={`p-2 rounded-lg transition-colors ${isMultiSelectionDisabled ? 'opacity-20 cursor-not-allowed text-neutral-500' : 'text-purple-400 hover:bg-purple-950/40 cursor-pointer shadow-sm'}`}
        title="CSG Intersect"
      >
        <Crop size={16} />
      </button>
    </div>
  );
}

export default React.memo(RightToolbar);