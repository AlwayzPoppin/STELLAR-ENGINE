import React, { useEffect } from 'react';
import { useStore, SceneObject } from '../store/useStore';
import { Layers, Box, Triangle, Cylinder, Circle, Square } from 'lucide-react';

export default function VoxelHotbarOverlay() {
  const { objects, isPlaying, selectedIds, updateObject, gameplaySettings } = useStore();

  // Find active voxel hotbar object in scene
  const hotbarObj = objects.find((o) => o.type === 'voxel_hotbar');

  return (
    <>
      {/* Central Screen Crosshair HUD */}
      {isPlaying && gameplaySettings?.showCrosshair && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50 flex items-center justify-center">
          {gameplaySettings.crosshairStyle === 'dot' ? (
            <div
              className="w-2.5 h-2.5 rounded-full border border-black/40 shadow-sm"
              style={{ backgroundColor: gameplaySettings.crosshairColor || '#ffffff' }}
            />
          ) : gameplaySettings.crosshairStyle === 'circle' ? (
            <div
              className="w-5 h-5 rounded-full border-2 shadow-sm"
              style={{ borderColor: gameplaySettings.crosshairColor || '#ffffff' }}
            />
          ) : gameplaySettings.crosshairStyle === 'dynamic' ? (
            <div className="relative w-6 h-6 flex items-center justify-center">
              <div className="absolute w-2 h-2 border-t-2 border-l-2" style={{ borderColor: gameplaySettings.crosshairColor || '#ffffff', top: 0, left: 0 }} />
              <div className="absolute w-2 h-2 border-t-2 border-r-2" style={{ borderColor: gameplaySettings.crosshairColor || '#ffffff', top: 0, right: 0 }} />
              <div className="absolute w-2 h-2 border-b-2 border-l-2" style={{ borderColor: gameplaySettings.crosshairColor || '#ffffff', bottom: 0, left: 0 }} />
              <div className="absolute w-2 h-2 border-b-2 border-r-2" style={{ borderColor: gameplaySettings.crosshairColor || '#ffffff', bottom: 0, right: 0 }} />
              <div className="w-1 h-1 rounded-full" style={{ backgroundColor: gameplaySettings.crosshairColor || '#ffffff' }} />
            </div>
          ) : (
            /* Classic Crosshair */
            <div className="relative w-4 h-4 flex items-center justify-center">
              <div className="absolute w-3.5 h-[2px] rounded-full drop-shadow" style={{ backgroundColor: gameplaySettings.crosshairColor || '#ffffff' }} />
              <div className="absolute h-3.5 w-[2px] rounded-full drop-shadow" style={{ backgroundColor: gameplaySettings.crosshairColor || '#ffffff' }} />
            </div>
          )}
        </div>
      )}

      <HotbarBarContent hotbarObj={hotbarObj} isPlaying={isPlaying} selectedIds={selectedIds} updateObject={updateObject} />
    </>
  );
}

function HotbarBarContent({ hotbarObj, isPlaying, selectedIds, updateObject }: any) {
  if (!isPlaying || !hotbarObj || !hotbarObj.voxelHotbarProps) return null;

  const props = hotbarObj.voxelHotbarProps;

  // Keyboard 1-9 & Mouse Wheel Slot Switching Hook
  useEffect(() => {
    if (!isPlaying) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const keyNum = parseInt(e.key, 10);
      if (!isNaN(keyNum) && keyNum >= 1 && keyNum <= props.slotCount) {
        updateObject(hotbarObj.id, {
          voxelHotbarProps: {
            ...props,
            activeSlotIndex: keyNum - 1,
          },
        });
      }
    };

    const handleWheel = (e: WheelEvent) => {
      const direction = e.deltaY > 0 ? 1 : -1;
      const nextIndex = (props.activeSlotIndex + direction + props.slotCount) % props.slotCount;
      updateObject(hotbarObj.id, {
        voxelHotbarProps: {
          ...props,
          activeSlotIndex: nextIndex,
        },
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, [isPlaying, props, hotbarObj.id, updateObject]);

  const activeItem = props.items[props.activeSlotIndex];

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 pointer-events-auto select-none animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* Active Item Title Badge */}
      {activeItem && (
        <div className="mb-2 text-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#181824]/90 border border-neutral-700/80 text-xs font-bold text-white shadow-lg backdrop-blur-md">
            <span
              className="w-2.5 h-2.5 rounded-full inline-block border border-white/20"
              style={{ backgroundColor: activeItem.color }}
            />
            {activeItem.name}
            <span className="text-[10px] text-neutral-400 font-mono">({activeItem.material})</span>
          </span>
        </div>
      )}

      {/* 9-Slot Hotbar Container */}
      <div className="flex items-center gap-1.5 p-2 rounded-2xl bg-[#12121c]/90 border border-neutral-800/80 shadow-[0_12px_36px_rgba(0,0,0,0.6)] backdrop-blur-xl">
        {props.items.slice(0, props.slotCount).map((item, idx) => {
          const isActive = idx === props.activeSlotIndex;
          return (
            <button
              key={item.id || idx}
              onClick={() => {
                updateObject(hotbarObj.id, {
                  voxelHotbarProps: {
                    ...props,
                    activeSlotIndex: idx,
                  },
                });
              }}
              className={`relative w-12 h-12 rounded-xl flex flex-col items-center justify-center transition-all duration-150 cursor-pointer group ${
                isActive
                  ? 'bg-gradient-to-b from-sky-500/30 to-blue-600/40 border-2 border-sky-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] scale-105'
                  : 'bg-neutral-900/60 border border-neutral-800 hover:bg-neutral-800/80 hover:border-neutral-700'
              }`}
            >
              {/* Keybind Number Badge */}
              {props.showKeybinds && (
                <span className="absolute top-1 left-1.5 text-[9px] font-bold font-mono text-neutral-400 group-hover:text-white">
                  {idx + 1}
                </span>
              )}

              {/* Block Color Thumbnail Preview */}
              <div
                className="w-6 h-6 rounded-md border border-white/20 shadow-inner flex items-center justify-center transition-transform group-hover:scale-110"
                style={{ backgroundColor: item.color }}
              >
                {item.geometry === 'pyramid' ? (
                  <Triangle size={12} className="text-white drop-shadow" />
                ) : item.geometry === 'cylinder' ? (
                  <Cylinder size={12} className="text-white drop-shadow" />
                ) : item.geometry === 'sphere' ? (
                  <Circle size={12} className="text-white drop-shadow" />
                ) : (
                  <Box size={12} className="text-white drop-shadow" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
