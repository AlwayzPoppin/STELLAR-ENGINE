import React, { useEffect, useState, useMemo } from 'react';
import { useStore, SceneObject } from '../store/useStore';
import {
  Box,
  Circle,
  Square,
  Globe,
  Lightbulb,
  Folder,
  ChevronDown,
  ChevronRight,
  Search,
  Sun,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from 'lucide-react';

const getIcon = (geom?: string, type?: string) => {
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

const TreeItem = React.memo(function TreeItem({ obj, depth }: { obj: SceneObject; depth: number }) {
  const isSelected = useStore((state) => state.selectedIds.includes(obj.id));
  const selectObject = useStore((state) => state.selectObject);
  const setParent = useStore((state) => state.setParent);
  const updateObject = useStore((state) => state.updateObject);

  const objects = useStore((state) => state.objects);
  const children = useMemo(() => objects.filter((o) => o.parentId === obj.id), [objects, obj.id]);

  const [isExpanded, setIsExpanded] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);

  const hasChildren = children.length > 0;

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
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId && draggedId !== obj.id) {
      setParent(draggedId, obj.id);
    }
  };

  return (
    <div>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={(e) => {
          e.stopPropagation();
          selectObject(obj.id, e.shiftKey || e.ctrlKey || e.metaKey);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!isSelected) {
            selectObject(obj.id, e.shiftKey || e.ctrlKey || e.metaKey);
          }
          useStore.getState().openContextMenu(e.clientX, e.clientY, 'hierarchy', obj.id);
        }}
        className={`group flex items-center w-full cursor-pointer select-none border-b border-bg-deep/50 ${isDragOver ? 'bg-accent/30' : ''} ${isSelected ? 'bg-accent text-white' : 'text-text-primary hover:bg-bg-panel'}`}
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

            {useStore.getState().renamingId === obj.id ? (
              <input
                autoFocus
                defaultValue={obj.name}
                className="text-[12px] bg-bg-deep border border-accent text-white px-1 py-[1px] outline-none w-full ml-0.5 rounded-sm"
                onBlur={() => useStore.getState().setRenamingId(null)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateObject(obj.id, { name: e.currentTarget.value });
                    useStore.getState().setRenamingId(null);
                  } else if (e.key === 'Escape') {
                    useStore.getState().setRenamingId(null);
                  }
                }}
              />
            ) : (
              <span
                className={`truncate text-[12px] font-mono tracking-tight ${isSelected ? 'font-medium text-white' : 'text-text-primary'}`}
              >
                {obj.name}
              </span>
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
      {isExpanded && hasChildren && children.map((child) => <TreeItem key={child.id} obj={child} depth={depth + 1} />)}
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

  const [searchQuery, setSearchQuery] = useState('');
  const [workspaceExpanded, setWorkspaceExpanded] = useState(true);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA'].includes(target.tagName.toUpperCase())) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, deleteObject, duplicateObject, groupSelected, setRenamingId]);

  const [lightingExpanded, setLightingExpanded] = useState(true);

  const workspaceObjects = objects.filter(
    (o) =>
      !o.parentId &&
      o.type !== 'light' &&
      o.id !== 'obj_sun' &&
      o.id !== 'obj_moon' &&
      (searchQuery ? o.name.toLowerCase().includes(searchQuery.toLowerCase()) : true),
  );

  const lightingObjects = objects.filter(
    (o) =>
      !o.parentId &&
      (o.type === 'light' || o.id === 'obj_sun' || o.id === 'obj_moon') &&
      (searchQuery ? o.name.toLowerCase().includes(searchQuery.toLowerCase()) : true),
  );

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    if (draggedId) {
      setParent(draggedId, null);
    }
  };

  return (
    <div role="region" aria-label="Hierarchy Panel (Explorer)" className="flex flex-col h-full overflow-hidden select-none bg-bg-surface/80 backdrop-blur-md">
      <div className="px-3 py-2 bg-transparent text-xs font-semibold text-text-primary border-b border-border shadow-sm flex justify-between items-center tracking-wide">
        Explorer
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

        {/* Workspace Root Node */}
        <div className="group flex flex-col w-full">
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

        {/* Lighting Root Node */}
        <div className="group flex flex-col w-full mt-1">
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
              <Sun size={14} className="text-yellow-400 fill-yellow-400/20" />
              <span className="truncate text-[12px] font-medium">Lighting</span>
            </div>
          </div>

          {lightingExpanded && (
            <div className="flex flex-col w-full">
              {lightingObjects.map((obj) => (
                <TreeItem key={obj.id} obj={obj} depth={1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
