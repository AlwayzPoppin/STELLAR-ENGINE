import React, { useState, useRef, useEffect } from 'react';
import { Cuboid, Code2, X, Plus, Layers, Edit2 } from 'lucide-react';
import { useStore, SceneData } from '../store/useStore';
import { useAssetStore } from '../store/useAssetStore';

export default function ViewportTabBar() {
  const openScripts = useStore((s) => s.openScripts);
  const activeScriptId = useStore((s) => s.activeScriptId);
  const closeScript = useStore((s) => s.closeScript);
  const setActiveScript = useStore((s) => s.setActiveScript);
  const assets = useAssetStore((s) => s.assets);
  const objects = useStore((s) => s.objects);

  // Multi-scene state
  const scenes = useStore((s) => s.scenes);
  const activeSceneId = useStore((s) => s.activeSceneId);
  const switchScene = useStore((s) => s.switchScene);
  const createNewScene = useStore((s) => s.createNewScene);
  const deleteScene = useStore((s) => s.deleteScene);
  const renameScene = useStore((s) => s.renameScene);

  // Inline rename state
  const [renamingSceneId, setRenamingSceneId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingSceneId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingSceneId]);

  useEffect(() => {
    const handleRenameTrigger = (e: Event) => {
      const customEvent = e as CustomEvent;
      const sceneId = customEvent.detail.sceneId;
      const targetScene = scenes[sceneId];
      if (targetScene) {
        setRenamingSceneId(sceneId);
        setRenameValue(targetScene.name);
      }
    };
    window.addEventListener('rename_scene_trigger', handleRenameTrigger);
    return () => {
      window.removeEventListener('rename_scene_trigger', handleRenameTrigger);
    };
  }, [scenes]);

  const sceneList = Object.values(scenes);
  const canDelete = sceneList.length > 1;

  const handleSceneClick = (sceneId: string) => {
    switchScene(sceneId);
    setActiveScript(null); // Show viewport, not a script
  };

  const handleDoubleClick = (sceneId: string, currentName: string) => {
    setRenamingSceneId(sceneId);
    setRenameValue(currentName);
  };

  const commitRename = () => {
    if (renamingSceneId && renameValue.trim()) {
      renameScene(renamingSceneId, renameValue.trim());
    }
    setRenamingSceneId(null);
  };

  const handleDeleteScene = (e: React.MouseEvent, sceneId: string) => {
    e.stopPropagation();
    if (!canDelete) return;
    deleteScene(sceneId);
  };

  return (
    <div
      className="flex items-center gap-px bg-[#1a1a1f] border-b border-[#2e2e35] shrink-0 overflow-x-auto"
      style={{ height: 34 }}
    >
      {/* Scene tabs */}
      {sceneList.map((scene) => {
        const isActive = scene.id === activeSceneId && activeScriptId === null;
        const isRenaming = renamingSceneId === scene.id;
        return (
          <div
            key={scene.id}
            onClick={() => handleSceneClick(scene.id)}
            onDoubleClick={() => handleDoubleClick(scene.id, scene.name)}
            onContextMenu={(e) => {
              e.preventDefault();
              useStore.getState().openContextMenu(e.clientX, e.clientY, 'sceneTab' as any, scene.id);
            }}
            className={`flex items-center gap-1.5 px-3 h-full text-[11px] border-r border-[#2e2e35] transition-colors shrink-0 group cursor-pointer ${
              isActive
                ? 'bg-[#111116] text-white border-t-2 border-t-accent'
                : 'text-[#888] hover:text-white hover:bg-[#22222a]'
            }`}
          >
            <Layers size={12} className="text-blue-400 shrink-0" />
            {isRenaming ? (
              <input
                ref={renameInputRef}
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  if (e.key === 'Escape') setRenamingSceneId(null);
                }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#2a2a35] text-white text-[11px] px-1 rounded border border-accent outline-none w-[80px]"
              />
            ) : (
              <>
                <span className="max-w-[120px] truncate">{scene.name}</span>
                <span
                  role="button"
                  title="Rename scene"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDoubleClick(scene.id, scene.name);
                  }}
                  className="ml-0.5 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-[#444] transition-all text-[#888] hover:text-white"
                >
                  <Edit2 size={10} />
                </span>
              </>
            )}
            {canDelete && !isRenaming && (
              <span
                role="button"
                aria-label={`Delete ${scene.name}`}
                onClick={(e) => handleDeleteScene(e, scene.id)}
                className="ml-1 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-[#444] transition-all"
              >
                <X size={10} />
              </span>
            )}
          </div>
        );
      })}

      {/* Add scene button */}
      <button
        onClick={() => createNewScene()}
        className="flex items-center justify-center h-full px-2 text-[#666] hover:text-white hover:bg-[#22222a] transition-colors shrink-0 border-r border-[#2e2e35]"
        title="Create new scene"
      >
        <Plus size={14} />
      </button>

      {/* Visual separator between scene tabs and script tabs */}
      {openScripts.length > 0 && (
        <div className="w-px h-[18px] bg-[#3e3e45] mx-1 shrink-0" />
      )}

      {/* Dynamic script tabs */}
      {openScripts.map((id) => {
        const asset = assets.find((a) => a.id === id);
        const objNode = objects.find((o) => o.id === id);
        const name = asset ? asset.name : (objNode?.name ?? id);
        const isActive = id === activeScriptId;
        return (
          <button
            key={id}
            onClick={() => setActiveScript(id)}
            className={`flex items-center gap-1.5 px-3 h-full text-[11px] border-r border-[#2e2e35] transition-colors shrink-0 group ${
              isActive
                ? 'bg-[#111116] text-white border-t-2 border-t-accent'
                : 'text-[#888] hover:text-white hover:bg-[#22222a]'
            }`}
          >
            <Code2 size={12} className="text-yellow-400 shrink-0" />
            <span className="max-w-[120px] truncate">{name}</span>
            <span
              role="button"
              aria-label={`Close ${name}`}
              onClick={(e) => {
                e.stopPropagation();
                closeScript(id);
              }}
              className="ml-1 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-[#444] transition-all"
            >
              <X size={10} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
