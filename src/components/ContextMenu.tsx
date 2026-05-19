import React, { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import {
  Trash2,
  Edit2,
  Copy,
  Box,
  Circle,
  Lightbulb,
  Cylinder,
  Triangle,
  Magnet,
  Paintbrush,
  Camera,
  Trash,
  Code2,
  Upload,
  Folder,
  Square,
} from 'lucide-react';

export default function ContextMenu() {
  const {
    objects,
    contextMenu,
    closeContextMenu,
    deleteObject,
    duplicateObject,
    setRenamingId,
    addPrimitive,
    updateObject,
    clearScene,
    createScriptForObject,
    addObject,
    groupSelected,
    copyProperties,
    pasteProperties,
    copiedProperties,
    openScript,
  } = useStore();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeContextMenu();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!menuRef.current) return;
      const buttons = menuRef.current.querySelectorAll('button');
      if (buttons.length === 0) return;

      const activeElement = document.activeElement;
      const currentIndex = Array.from(buttons).indexOf(activeElement as HTMLButtonElement);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % buttons.length;
        buttons[nextIndex].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + buttons.length) % buttons.length;
        buttons[prevIndex].focus();
      } else if (e.key === 'Escape') {
        closeContextMenu();
      }
    };

    requestAnimationFrame(() => {
      window.addEventListener('click', handleClickOutside);
      window.addEventListener('contextmenu', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);

      // Focus first button when menu opens
      const buttons = menuRef.current?.querySelectorAll('button');
      if (buttons && buttons.length > 0) {
        buttons[0].focus();
      }
    });

    return () => {
      window.removeEventListener('click', handleClickOutside);
      window.removeEventListener('contextmenu', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeContextMenu, contextMenu]);

  if (!contextMenu) return null;

  const { x, y, targetId, type } = contextMenu;
  const obj = objects.find((o) => o.id === targetId);

  const handleFocus = () => {
    window.dispatchEvent(new CustomEvent('focus_camera'));
    closeContextMenu();
  };

  const togglePhysics = () => {
    if (!obj) return;
    const isPhysics = obj.physics && obj.physics !== 'none';
    updateObject(obj.id, { physics: isPhysics ? 'none' : 'dynamic' });
    closeContextMenu();
  };

  const applyMaterial = (preset: string) => {
    if (!obj || !obj.material) return;
    let updates = {};
    if (preset === 'chrome') updates = { roughness: 0.1, metalness: 0.9 };
    if (preset === 'neon') updates = { envMapIntensity: 5, roughness: 0.5 };
    updateObject(obj.id, { material: { ...obj.material, ...updates } });
    closeContextMenu();
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-bg-panel border border-border rounded-md shadow-xl py-1.5 min-w-[170px] text-[12px] text-text-primary select-none custom-context-menu"
      style={{ top: Math.min(y, window.innerHeight - 250), left: Math.min(x, window.innerWidth - 200) }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {(type === 'viewport' || type === 'hierarchy') && !targetId ? (
        <>
          <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-text-secondary tracking-wider">Add Part</div>
          <button
            onClick={() => {
              addPrimitive('box');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Box size={14} className="text-zinc-400" /> Cube
          </button>
          <button
            onClick={() => {
              addPrimitive('sphere');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Circle size={14} className="text-zinc-400" /> Sphere
          </button>
          <button
            onClick={() => {
              addPrimitive('cylinder');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Cylinder size={14} className="text-zinc-400" /> Cylinder
          </button>
          <button
            onClick={() => {
              addPrimitive('wedge');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Triangle size={14} className="text-zinc-400" /> Wedge
          </button>
          <button
            onClick={() => {
              addPrimitive('light');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Lightbulb size={14} className="text-yellow-500" /> Light
          </button>

          <div className="h-px bg-border my-1.5 mx-2" />
          <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-text-secondary tracking-wider">Scene</div>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('focus_camera'));
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Camera size={14} /> Focus Scene
          </button>
          <button
            onClick={() => {
              clearScene();
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 text-red-400 transition-colors"
          >
            <Trash size={14} /> Clear Scene
          </button>
        </>
      ) : type === 'workspace' ? (
        <>
          <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-text-secondary tracking-wider">Workspace</div>
          <button
            onClick={() => {
              addPrimitive('box');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Box size={14} className="text-sky-400" /> Add Cube
          </button>
          <button
            onClick={() => {
              addPrimitive('sphere');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Circle size={14} className="text-sky-400" /> Add Sphere
          </button>
          <button
            onClick={() => {
              addPrimitive('plane');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Square size={14} className="text-sky-400" /> Add Plane
          </button>
          <button
            onClick={() => {
              addPrimitive('cylinder');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Cylinder size={14} className="text-sky-400" /> Add Cylinder
          </button>
          
          <div className="h-px bg-border my-1.5 mx-2" />
          
          <button
            onClick={() => {
              document.getElementById('asset-upload')?.click();
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Upload size={14} className="text-emerald-400" /> Import Model...
          </button>
          <button
            onClick={() => {
              addPrimitive('group');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Folder size={14} className="text-amber-400" /> Add Folder
          </button>
          <button
            onClick={() => {
              createScriptForObject();
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Code2 size={14} className="text-yellow-400" /> Add Script
          </button>
        </>
      ) : type === 'lighting' ? (
        <>
          <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-text-secondary tracking-wider">Lighting</div>
          <button
            onClick={() => {
              addPrimitive('light');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Lightbulb size={14} className="text-yellow-500" /> Add Point Light
          </button>
          <button
            onClick={() => {
              addObject({
                id: `obj_${crypto.randomUUID()}`,
                name: 'Spot Light',
                type: 'light',
                position: [0, 5, 0],
                rotation: [-Math.PI / 2, 0, 0],
                scale: [1, 1, 1],
                lightProps: { lightType: 'spot', color: '#ffffff', intensity: 5, distance: 20, angle: 0.5, penumbra: 0.5 },
              });
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Lightbulb size={14} className="text-yellow-300" /> Add Spot Light
          </button>
          <button
            onClick={() => {
              addObject({
                id: `obj_${crypto.randomUUID()}`,
                name: 'Directional Light',
                type: 'light',
                position: [5, 5, 5],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
                lightProps: { lightType: 'directional', color: '#ffffff', intensity: 1.5, distance: 0 },
              });
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Lightbulb size={14} className="text-yellow-200" /> Add Environmental Light
          </button>
        </>
      ) : (
        <>
          <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-text-secondary tracking-wider">
            Object Actions
          </div>
          <button
            onClick={() => {
              if (targetId) createScriptForObject(targetId);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Code2 size={14} className="text-yellow-400" /> Add Script
          </button>
          <button
            onClick={handleFocus}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Camera size={14} /> Focus Camera
          </button>

          <div className="h-px bg-border my-1.5 mx-2" />
          <button
            onClick={() => {
              if (obj) copyProperties(obj);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
          >
            <Copy size={14} className="text-zinc-400" /> Copy Properties
          </button>
          <button
            onClick={() => {
              if (targetId) pasteProperties(targetId);
              closeContextMenu();
            }}
            disabled={!copiedProperties}
            className={`w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors ${!copiedProperties ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Copy size={14} className="text-zinc-400" /> Paste Properties
          </button>

          {obj && obj.scripts && obj.scripts.length > 0 && (
            <>
              <div className="h-px bg-border my-1.5 mx-2" />
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-text-secondary tracking-wider">Scripts</div>
              {obj.scripts.map((scriptId) => {
                const script = useAssetStore.getState().assets.find((a) => a.id === scriptId);
                return (
                  <button
                    key={scriptId}
                    onClick={() => {
                      openScript(scriptId);
                      closeContextMenu();
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
                  >
                    <Code2 size={14} className="text-yellow-400" /> {script?.name || 'Unknown Script'}
                  </button>
                );
              })}
            </>
          )}

          {obj && obj.type !== 'light' && obj.type !== 'group' && (
            <>
              <button
                onClick={togglePhysics}
                className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
              >
                <Magnet
                  size={14}
                  className={obj.physics && obj.physics !== 'none' ? 'text-orange-400' : 'text-zinc-400'}
                />
                {obj.physics && obj.physics !== 'none' ? 'Disable Physics' : 'Enable Gravity'}
              </button>

              {obj.material && (
                <button
                  onClick={() => applyMaterial('chrome')}
                  className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 transition-colors"
                >
                  <Paintbrush size={14} className="text-zinc-400" /> Make Metallic
                </button>
              )}
            </>
          )}

          <div className="h-px bg-border my-1.5 mx-2" />
          <button
            onClick={() => {
              setRenamingId(targetId);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 text-text-primary transition-colors"
          >
            <Edit2 size={14} /> Rename (F2)
          </button>
          <button
            onClick={() => {
              if (targetId) duplicateObject(targetId);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 text-blue-400 transition-colors"
          >
            <Copy size={14} /> Duplicate (Ctrl+D)
          </button>
          <button
            onClick={() => {
              groupSelected();
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 text-amber-400 transition-colors"
          >
            <Folder size={14} /> Group (Ctrl+G)
          </button>
          <button
            onClick={() => {
              if (targetId) deleteObject(targetId);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-bg-deep flex items-center gap-2 text-red-400 transition-colors"
          >
            <Trash2 size={14} /> Delete (Del)
          </button>
        </>
      )}
    </div>
  );
}
