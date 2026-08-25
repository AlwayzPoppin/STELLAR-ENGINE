import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useStore, SceneObject } from '../store/useStore';
import { useAssetStore } from '../store/useAssetStore';
import { toast } from '../store/useToastStore';
import { createPortal } from 'react-dom';
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
  Merge,
  Download,
  FolderPlus,
  DoorOpen,
  Bone,
  Droplets,
  Wind,
  Flame,
  FlipHorizontal,
  FlipVertical,
} from 'lucide-react';

export function computeClampedMenuPosition(
  x: number,
  y: number,
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number = typeof window !== 'undefined' ? window.innerWidth : 1920,
  viewportHeight: number = typeof window !== 'undefined' ? window.innerHeight : 1080,
  padding: number = 8
): { top: number; left: number } {
  let left = x;
  let top = y;

  if (x + menuWidth + padding > viewportWidth) {
    left = Math.max(padding, viewportWidth - menuWidth - padding);
  }
  if (y + menuHeight + padding > viewportHeight) {
    top = Math.max(padding, viewportHeight - menuHeight - padding);
  }

  return {
    top: Math.max(padding, Math.min(top, Math.max(padding, viewportHeight - menuHeight - padding))),
    left: Math.max(padding, Math.min(left, Math.max(padding, viewportWidth - menuWidth - padding))),
  };
}

export default function ContextMenu() {
  const {
    objects,
    contextMenu,
    closeContextMenu,
    deleteObject,
    duplicateObject,
    duplicateAndMirrorObject,
    setRenamingId,
    addPrimitive,
    updateObject,
    clearScene,
    addScript,
    addObject,
    groupSelected,
    ungroupSelected,
    copyProperties,
    pasteProperties,
    copiedProperties,
    copiedObject,
    copyObject,
    pasteObject,
    openScript,
    createScriptForObject,
    renameAnimation,
    deleteAnimation,
    selectedIds,
    csgOperation,
    deleteScene,
    duplicateScene,
  } = useStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current) return;
    const { x, y } = contextMenu;
    const rect = menuRef.current.getBoundingClientRect();
    const clamped = computeClampedMenuPosition(
      x,
      y,
      rect.width || 185,
      rect.height || 250,
      window.innerWidth,
      window.innerHeight
    );
    setAdjustedPos(clamped);
  }, [contextMenu]);

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

  const [showConfirmClear, setShowConfirmClear] = useState(false);

  if (!contextMenu && !showConfirmClear) return null;

  if (showConfirmClear) {
    return createPortal(
      <div 
        onClick={() => {
          setShowConfirmClear(false);
          closeContextMenu();
        }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      >
        <div 
          onClick={(e) => e.stopPropagation()}
          className="bg-bg-panel/85 border border-border/80 p-6 rounded-xl max-w-sm w-full mx-4 shadow-2xl backdrop-blur-md flex flex-col gap-4 text-left"
        >
          <div className="flex items-center gap-3 text-red-400">
            <Trash2 size={20} className="shrink-0" />
            <h3 className="text-[14px] font-semibold text-text-primary">Clear Scene?</h3>
          </div>
          <p className="text-[11px] text-text-secondary leading-relaxed">
            Are you sure you want to clear the scene? This will delete all user objects, scripts, and environmental settings. This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2.5 mt-2">
            <button
              type="button"
              onClick={() => {
                setShowConfirmClear(false);
                closeContextMenu();
              }}
              className="px-3.5 py-1.5 rounded-[4px] border border-border bg-bg-deep text-text-secondary hover:text-text-primary text-[11px] font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                clearScene();
                setShowConfirmClear(false);
                closeContextMenu();
                toast.success('Scene Cleared', 'All objects have been removed.');
              }}
              className="px-3.5 py-1.5 rounded-[4px] bg-red-500 hover:bg-red-600 text-white text-[11px] font-medium transition-colors shadow-lg shadow-red-500/20 cursor-pointer"
            >
              Clear Everything
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const { x, y, targetId, type, extra } = contextMenu!;
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
      className="fixed z-50 bg-[#181824]/95 backdrop-blur-md border border-neutral-800/80 rounded-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] py-1.5 min-w-[185px] text-[11px] font-medium text-text-primary select-none custom-context-menu animate-in fade-in zoom-in-95 duration-100"
      style={{
        top: adjustedPos ? adjustedPos.top : (contextMenu ? Math.max(8, Math.min(y, window.innerHeight - 300)) : y),
        left: adjustedPos ? adjustedPos.left : (contextMenu ? Math.max(8, Math.min(x, window.innerWidth - 220)) : x),
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {(type === 'viewport' || type === 'hierarchy') && !targetId ? (
        <>
          <div className="px-3 py-1 text-[9px] uppercase font-bold text-text-secondary/60 tracking-wider">Add Part</div>
          <button
            onClick={() => {
              addPrimitive('box');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Box size={14} className="text-zinc-400" /> Cube
          </button>
          <button
            onClick={() => {
              addPrimitive('sphere');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Circle size={14} className="text-zinc-400" /> Sphere
          </button>
          <button
            onClick={() => {
              addPrimitive('cylinder');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Cylinder size={14} className="text-zinc-400" /> Cylinder
          </button>
          <button
            onClick={() => {
              addPrimitive('pyramid');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Triangle size={14} className="text-zinc-400" /> Pyramid
          </button>
          <button
            onClick={() => {
              addPrimitive('cone');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Triangle size={14} className="text-zinc-400 rotate-180" /> Cone
          </button>
          <button
            onClick={() => {
              addPrimitive('roundedCube');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Box size={14} className="text-zinc-400" /> Rounded Block
          </button>
          <button
            onClick={() => {
              addPrimitive('teardrop');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Droplets size={14} className="text-zinc-400" /> Teardrop / Egg
          </button>
          <button
            onClick={() => {
              addPrimitive('wingBlade');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Wind size={14} className="text-zinc-400" /> Wing Blade / Fin
          </button>
          <button
            onClick={() => {
              addPrimitive('curvedHorn');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Flame size={14} className="text-zinc-400" /> Curved Horn / Claw
          </button>
          <button
            onClick={() => {
              addPrimitive('taperedTorso');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Bone size={14} className="text-zinc-400" /> Tapered Torso
          </button>
          <button
            onClick={() => {
              addPrimitive('forearm');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Bone size={14} className="text-zinc-400 rotate-90" /> Forearm / Leg Limb
          </button>
          <button
            onClick={() => {
              addPrimitive('wedge');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Triangle size={14} className="text-zinc-400" /> Wedge
          </button>
          <button
            onClick={() => {
              addPrimitive('doorway');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <DoorOpen size={14} className="text-zinc-400" /> Doorway Cutout
          </button>
          <button
            onClick={() => {
              addPrimitive('frame');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Square size={14} className="text-zinc-400" /> Frame (Vertical)
          </button>
          <button
            onClick={() => {
              addPrimitive('horizontalFrame');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Square size={14} className="text-zinc-400 rotate-90" /> Frame (Horizontal)
          </button>
          <button
            onClick={() => {
              addPrimitive('light');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Lightbulb size={14} className="text-yellow-500" /> Light
          </button>

          <div className="h-px bg-neutral-800/50 my-1 mx-2" />
          <div className="px-3 py-1 text-[9px] uppercase font-bold text-text-secondary/60 tracking-wider">Scene</div>
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent('focus_camera'));
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Camera size={14} /> Focus Scene
          </button>
          <button
            onClick={() => {
              setShowConfirmClear(true);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-red-300 flex items-center gap-2 text-red-400 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Trash size={14} /> Clear Scene
          </button>
        </>
      ) : type === 'workspace' ? (
        <>
          <div className="px-3 py-1 text-[9px] uppercase font-bold text-text-secondary/60 tracking-wider">Workspace</div>
          <button
            onClick={() => {
              addPrimitive('box');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Box size={14} className="text-sky-400" /> Add Cube
          </button>
          <button
            onClick={() => {
              addPrimitive('sphere');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Circle size={14} className="text-sky-400" /> Add Sphere
          </button>
          <button
            onClick={() => {
              addPrimitive('plane');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Square size={14} className="text-sky-400" /> Add Plane
          </button>
          <button
            onClick={() => {
              addPrimitive('cylinder');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Cylinder size={14} className="text-sky-400" /> Add Cylinder
          </button>
          <button
            onClick={() => {
              addPrimitive('doorway');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <DoorOpen size={14} className="text-sky-400" /> Add Doorway
          </button>
          
          <div className="h-px bg-neutral-800/50 my-1 mx-2" />
          
          <button
            onClick={() => {
              document.getElementById('asset-upload')?.click();
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Upload size={14} className="text-emerald-400" /> Import Model...
          </button>
          <button
            onClick={() => {
              addPrimitive('group');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Folder size={14} className="text-amber-400" /> Add Folder
          </button>
          <button
            onClick={() => {
              addPrimitive('motor6d');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Bone size={14} className="text-cyan-400" /> Add Motor6D Joint
          </button>
          <button
            onClick={() => {
              addScript();
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Code2 size={14} className="text-yellow-400" /> Add Script
          </button>
        </>
      ) : type === 'lighting' ? (
        <>
          <div className="px-3 py-1 text-[9px] uppercase font-bold text-text-secondary/60 tracking-wider">Lighting</div>
          <button
            onClick={() => {
              addPrimitive('light');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
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
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
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
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Lightbulb size={14} className="text-yellow-200" /> Add Environmental Light
          </button>
        </>
      ) : type === 'animation' ? (
        <>
          <div className="px-3 py-1.5 text-[9px] uppercase font-bold text-text-secondary/60 tracking-wider truncate max-w-[170px]">
            Animation: {extra}
          </div>
          <button
            onClick={() => {
              const newName = prompt('Rename animation to:', extra);
              if (newName && newName.trim() && targetId) {
                renameAnimation(targetId, extra, newName.trim());
              }
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Edit2 size={14} className="text-zinc-400" /> Rename Animation
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete animation "${extra}"? This cannot be undone.`)) {
                if (targetId) deleteAnimation(targetId, extra);
              }
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-red-300 flex items-center gap-2 text-red-400 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Trash2 size={14} /> Delete Animation
          </button>
        </>
      ) : type === 'asset' ? (
        <>
          <div className="px-3 py-1.5 text-[9px] uppercase font-bold text-text-secondary/60 tracking-wider truncate max-w-[170px]">
            Asset: {extra?.name || 'Unknown'}
          </div>
          <button
            onClick={() => {
              if (targetId) {
                useStore.getState().setRenamingAssetId(targetId);
              }
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Edit2 size={14} className="text-zinc-400" /> Rename Asset
          </button>
          <button
            onClick={() => {
              if (confirm(`Delete asset "${extra?.name || 'Unknown'}"? This cannot be undone.`)) {
                if (targetId) useAssetStore.getState().deleteAsset(targetId);
              }
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-red-300 flex items-center gap-2 text-red-400 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Trash2 size={14} /> Delete Asset
          </button>
        </>
      ) : type === 'sceneTab' ? (
        <>
          <div className="px-3 py-1 text-[9px] uppercase font-bold text-text-secondary/60 tracking-wider">
            Scene Options
          </div>
          <button
            onClick={() => {
              if (targetId) {
                window.dispatchEvent(new CustomEvent('rename_scene_trigger', { detail: { sceneId: targetId } }));
              }
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Edit2 size={14} className="text-zinc-400" /> Rename Scene
          </button>
          <button
            onClick={() => {
              if (targetId) {
                duplicateScene(targetId);
                toast.success('Scene Duplicated', 'Duplicated scene successfully.');
              }
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Copy size={14} className="text-zinc-400" /> Duplicate Scene
          </button>
          <button
            onClick={() => {
              if (targetId) {
                const { scenes } = useStore.getState();
                if (Object.keys(scenes).length > 1) {
                  deleteScene(targetId);
                  toast.success('Scene Deleted', 'The scene has been removed.');
                } else {
                  toast.error('Cannot Delete', 'You must have at least one scene.');
                }
              }
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-red-300 flex items-center gap-2 text-red-400 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Trash2 size={14} /> Delete Scene
          </button>
        </>
      ) : (
        <>
          <div className="px-3 py-1 text-[9px] uppercase font-bold text-text-secondary/60 tracking-wider">
            Object Actions
          </div>
          <button
            onClick={() => {
              if (targetId) createScriptForObject(targetId);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Code2 size={14} className="text-yellow-400" /> Attach Logic Script
          </button>
          <button
            onClick={() => {
              if (targetId) {
                window.dispatchEvent(new CustomEvent('export_object_glb', { detail: { id: targetId } }));
              }
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Download size={14} className="text-sky-400" /> Export GLB with Animations
          </button>
          <button
            onClick={() => {
              if (targetId) {
                window.dispatchEvent(new CustomEvent('save_object_to_browser', { detail: { id: targetId } }));
              }
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <FolderPlus size={14} className="text-emerald-400" /> Save to Content Browser
          </button>
          <button
            onClick={handleFocus}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Camera size={14} /> Focus Camera
          </button>

          <div className="h-px bg-neutral-800/50 my-1 mx-2" />
          <button
            onClick={() => {
              if (obj) copyProperties(obj);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Copy size={14} className="text-zinc-400" /> Copy Properties
          </button>
          <button
            onClick={() => {
              if (targetId) pasteProperties(targetId);
              closeContextMenu();
            }}
            disabled={!copiedProperties}
            className={`w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] ${!copiedProperties ? 'opacity-35 cursor-not-allowed hover:bg-transparent hover:text-text-primary' : 'cursor-pointer'}`}
          >
            <Copy size={14} className="text-zinc-400" /> Paste Properties
          </button>

          {obj && obj.scripts && obj.scripts.length > 0 && (
            <>
              <div className="h-px bg-neutral-800/50 my-1 mx-2" />
              <div className="px-3 py-1 text-[9px] uppercase font-bold text-text-secondary/60 tracking-wider">Scripts</div>
              {obj.scripts.map((scriptId) => {
                const script = useAssetStore.getState().assets.find((a) => a.id === scriptId);
                return (
                  <button
                    key={scriptId}
                    onClick={() => {
                      openScript(scriptId);
                      closeContextMenu();
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
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
                className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
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
                  className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
                >
                  <Paintbrush size={14} className="text-zinc-400" /> Make Metallic
                </button>
              )}
            </>
          )}

          <div className="h-px bg-neutral-800/50 my-1 mx-2" />
          <button
            onClick={() => {
              setRenamingId(targetId);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 text-text-primary transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Edit2 size={14} /> Rename (F2)
          </button>
          <button
            onClick={() => {
              if (targetId) duplicateObject(targetId);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 text-blue-400 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Copy size={14} /> Duplicate (Ctrl+D)
          </button>
          <button
            onClick={() => {
              if (targetId) duplicateAndMirrorObject(targetId, 'x');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 text-cyan-400 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
            title="Duplicate and mirror model along X-axis (left ↔ right symmetry)"
          >
            <FlipHorizontal size={14} /> Duplicate & Mirror (X-Axis)
          </button>
          <button
            onClick={() => {
              if (targetId) duplicateAndMirrorObject(targetId, 'z');
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 text-cyan-400 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
            title="Duplicate and mirror model along Z-axis (front ↔ back symmetry)"
          >
            <FlipVertical size={14} /> Duplicate & Mirror (Z-Axis)
          </button>
          {obj && (
            <button
              onClick={() => {
                copyObject(obj);
                closeContextMenu();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 text-text-primary transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
            >
              <Copy size={14} className="text-zinc-400" /> Copy (Ctrl+C)
            </button>
          )}
          {copiedObject && (
            <button
              onClick={() => {
                if (targetId) pasteObject(targetId);
                closeContextMenu();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 text-text-primary transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
            >
              <Copy size={14} className="text-zinc-400" /> Paste (Ctrl+V)
            </button>
          )}
          <button
            onClick={() => {
              groupSelected();
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 text-amber-400 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Folder size={14} /> Group (Ctrl+G)
          </button>
          {obj && obj.type === 'csg' && (
            <button
              onClick={() => {
                ungroupSelected();
                closeContextMenu();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 text-rose-400 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
            >
              <Merge size={14} className="rotate-180" /> Separate (Deunionize)
            </button>
          )}
          {obj && obj.type === 'group' && (
            <button
              onClick={() => {
                ungroupSelected();
                closeContextMenu();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 text-rose-400 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
            >
              <Folder size={14} className="opacity-75" /> Ungroup
            </button>
          )}
          {selectedIds.length > 1 && (
            <>
              <button
                onClick={() => {
                  const selectedObjects = selectedIds
                    .map((id) => objects.find((o) => o.id === id))
                    .filter(Boolean) as SceneObject[];
                  const hasNonPrimitives = selectedObjects.some((o) => o.type !== 'mesh');
                  if (hasNonPrimitives) {
                    toast.error("CSG operations (Union, Subtract, Intersect) can only be performed on primitive shapes (Cubes, Spheres, Cylinders, Wedges, Doorways). For models, please use Group (Ctrl+G).");
                  } else {
                    csgOperation('addition');
                  }
                  closeContextMenu();
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 text-indigo-400 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
              >
                <Merge size={14} /> Union (CSG Add)
              </button>
              <button
                onClick={() => {
                  const selectedObjects = selectedIds
                    .map((id) => objects.find((o) => o.id === id))
                    .filter(Boolean) as SceneObject[];
                  const hasNonPrimitives = selectedObjects.some((o) => o.type !== 'mesh');
                  if (hasNonPrimitives) {
                    toast.error("CSG operations (Union, Subtract, Intersect) can only be performed on primitive shapes (Cubes, Spheres, Cylinders, Wedges, Doorways). For models, please use Group (Ctrl+G).");
                  } else {
                    csgOperation('subtraction');
                  }
                  closeContextMenu();
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 text-indigo-400 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
              >
                <Merge size={14} className="rotate-180" /> Subtract (CSG Cut)
              </button>
              <button
                onClick={() => {
                  const selectedObjects = selectedIds
                    .map((id) => objects.find((o) => o.id === id))
                    .filter(Boolean) as SceneObject[];
                  const hasNonPrimitives = selectedObjects.some((o) => o.type !== 'mesh');
                  if (hasNonPrimitives) {
                    toast.error("CSG operations (Union, Subtract, Intersect) can only be performed on primitive shapes (Cubes, Spheres, Cylinders, Wedges, Doorways). For models, please use Group (Ctrl+G).");
                  } else {
                    csgOperation('intersection');
                  }
                  closeContextMenu();
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-white flex items-center gap-2 text-indigo-400 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
              >
                <Merge size={14} className="rotate-90" /> Intersect (CSG)
              </button>
            </>
          )}
          <button
            onClick={() => {
              if (targetId) deleteObject(targetId);
              closeContextMenu();
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-white/5 hover:text-red-300 flex items-center gap-2 text-red-400 transition-colors font-medium rounded-md mx-1 w-[calc(100%-8px)] cursor-pointer"
          >
            <Trash2 size={14} /> Delete (Del)
          </button>
        </>
      )}
    </div>
  );
}
