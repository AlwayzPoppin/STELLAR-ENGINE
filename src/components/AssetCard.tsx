import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, FileCode2, ImageIcon, Play, Box, Layers, Music, Compass } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Asset, useAssetStore } from '../store/useAssetStore';
import { toast } from '../store/useToastStore';
import { formatDisplayUrl } from '../utils/format';
import { AssetStagingManager } from '../utils/AssetStagingManager';

// Get category metadata (colors, badges, styles)
export const getCategoryMeta = (category: string) => {
  switch (category) {
    case 'Models':
      return {
        color: 'sky',
        border: 'border-sky-500/20 group-hover:border-sky-500/60',
        text: 'text-sky-400',
        bg: 'bg-sky-500/10',
        dot: 'bg-sky-500',
        glow: 'group-hover:shadow-[0_0_15px_rgba(56,189,248,0.25)]',
        badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
        icon: Box,
      };
    case 'Textures':
      return {
        color: 'orange',
        border: 'border-orange-500/20 group-hover:border-orange-500/60',
        text: 'text-orange-400',
        bg: 'bg-orange-500/10',
        dot: 'bg-orange-500',
        glow: 'group-hover:shadow-[0_0_15px_rgba(251,146,60,0.25)]',
        badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        icon: ImageIcon,
      };
    case 'Materials':
      return {
        color: 'violet',
        border: 'border-violet-500/20 group-hover:border-violet-500/60',
        text: 'text-violet-400',
        bg: 'bg-violet-500/10',
        dot: 'bg-violet-500',
        glow: 'group-hover:shadow-[0_0_15px_rgba(192,132,252,0.25)]',
        badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
        icon: Layers,
      };
    case 'Scripts':
      return {
        color: 'emerald',
        border: 'border-emerald-500/20 group-hover:border-emerald-500/60',
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        dot: 'bg-emerald-500',
        glow: 'group-hover:shadow-[0_0_15px_rgba(52,211,153,0.25)]',
        badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        icon: FileCode2,
      };
    case 'Audio':
      return {
        color: 'amber',
        border: 'border-amber-500/20 group-hover:border-amber-500/60',
        text: 'text-amber-400',
        bg: 'bg-amber-500/10',
        dot: 'bg-amber-500',
        glow: 'group-hover:shadow-[0_0_15px_rgba(251,191,36,0.25)]',
        badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        icon: Music,
      };
    case 'Prefabs':
      return {
        color: 'rose',
        border: 'border-rose-500/20 group-hover:border-rose-500/60',
        text: 'text-rose-400',
        bg: 'bg-rose-500/10',
        dot: 'bg-rose-500',
        glow: 'group-hover:shadow-[0_0_15px_rgba(251,113,133,0.25)]',
        badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        icon: Play,
      };
    case 'Scenes':
      return {
        color: 'teal',
        border: 'border-teal-500/20 group-hover:border-teal-500/60',
        text: 'text-teal-400',
        bg: 'bg-teal-500/10',
        dot: 'bg-teal-500',
        glow: 'group-hover:shadow-[0_0_15px_rgba(45,212,191,0.25)]',
        badge: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
        icon: Compass,
      };
    default:
      return {
        color: 'neutral',
        border: 'border-neutral-500/20 group-hover:border-neutral-500/60',
        text: 'text-neutral-400',
        bg: 'bg-neutral-500/10',
        dot: 'bg-neutral-500',
        glow: 'shadow-sm',
        badge: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
        icon: Box,
      };
  }
};

// Lazy Image Component with loading skeleton
export function LazyImage({
  src,
  alt,
  className,
  loading = 'lazy',
  fetchPriority,
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  fetchPriority?: 'high' | 'low' | 'auto';
}) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(loading === 'eager' ? src : null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    if (loading === 'eager') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLoadedSrc(src);
          observer.disconnect();
        }
      },
      { rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src, loading]);

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${className}`}>
      {loadedSrc ? (
        <img
          src={loadedSrc}
          alt={alt}
          className="w-full h-full object-cover transition-opacity duration-300 opacity-100"
          loading={loading}
          fetchPriority={fetchPriority}
        />
      ) : (
        <div className="w-full h-full bg-neutral-900 animate-pulse flex items-center justify-center">
          <span className="text-[10px] text-text-secondary/30">Loading...</span>
        </div>
      )}
    </div>
  );
}

// Styled visual placeholder SVGs for premium aesthetics
export function AssetThumbnailPlaceholder({ type, category }: { type: string; category: string }) {
  switch (category) {
    case 'Models':
      return (
        <svg className="w-full h-full bg-gradient-to-br from-sky-950/20 to-neutral-950" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="45" stroke="rgba(14,165,233,0.1)" strokeWidth="1" strokeDasharray="3 3" />
          <path d="M50 20 L80 35 L80 65 L50 80 L20 65 L20 35 Z" stroke="rgb(14, 165, 233)" strokeWidth="1.5" strokeLinejoin="round" opacity="0.8" />
          <path d="M50 20 L50 50 M80 35 L50 50 M80 65 L50 50 M50 80 L50 50 M20 65 L50 50 M20 35 L50 50" stroke="rgba(14, 165, 233, 0.4)" strokeWidth="1" />
          <circle cx="50" cy="50" r="4" fill="rgb(14, 165, 233)" />
        </svg>
      );
    case 'Textures':
      return (
        <svg className="w-full h-full bg-gradient-to-br from-orange-950/20 to-neutral-950" viewBox="0 0 100 100" fill="none">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <rect width="10" height="10" fill="rgba(249,115,22,0.05)" />
              <rect x="10" y="10" width="10" height="10" fill="rgba(249,115,22,0.05)" />
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(249,115,22,0.15)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          <circle cx="50" cy="50" r="25" stroke="rgb(249, 115, 22)" strokeWidth="1.5" opacity="0.6" />
          <line x1="20" y1="50" x2="80" y2="50" stroke="rgba(249, 115, 22, 0.3)" strokeWidth="1" />
          <line x1="50" y1="20" x2="50" y2="80" stroke="rgba(249, 115, 22, 0.3)" strokeWidth="1" />
        </svg>
      );
    case 'Materials':
      return (
        <svg className="w-full h-full bg-gradient-to-br from-violet-950/20 to-neutral-950" viewBox="0 0 100 100" fill="none">
          <defs>
            <radialGradient id="sphereGrad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#d8b4fe" />
              <stop offset="40%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#1e1b4b" />
            </radialGradient>
          </defs>
          <circle cx="50" cy="50" r="30" fill="url(#sphereGrad)" stroke="rgba(139,92,246,0.3)" strokeWidth="1" />
          <ellipse cx="50" cy="80" rx="20" ry="4" fill="rgba(0,0,0,0.4)" filter="blur(2px)" />
        </svg>
      );
    case 'Scripts':
      return (
        <svg className="w-full h-full bg-gradient-to-br from-emerald-950/20 to-neutral-950" viewBox="0 0 100 100" fill="none">
          <rect x="15" y="20" width="70" height="60" rx="5" fill="rgba(16,185,129,0.03)" stroke="rgba(16,185,129,0.3)" strokeWidth="1.5" />
          <line x1="15" y1="35" x2="85" y2="35" stroke="rgba(16,185,129,0.3)" strokeWidth="1" />
          <circle cx="25" cy="27.5" r="2" fill="#ef4444" />
          <circle cx="32" cy="27.5" r="2" fill="#eab308" />
          <circle cx="39" cy="27.5" r="2" fill="#22c55e" />
          <text x="50" y="62" fill="rgb(16, 185, 129)" fontSize="18" fontWeight="bold" fontFamily="monospace" textAnchor="middle" opacity="0.8">
            &lt;/&gt;
          </text>
        </svg>
      );
    case 'Audio':
      return (
        <svg className="w-full h-full bg-gradient-to-br from-amber-950/20 to-neutral-950" viewBox="0 0 100 100" fill="none">
          <path d="M15 50 Q 25 20, 35 50 T 55 50 T 75 50 T 85 50" stroke="rgba(245,158,11,0.3)" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M25 50 Q 35 10, 45 50 T 65 50 T 85 50" stroke="rgb(245, 158, 11)" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
          <line x1="10" y1="50" x2="90" y2="50" stroke="rgba(245,158,11,0.15)" strokeWidth="1" />
        </svg>
      );
    case 'Prefabs':
      return (
        <svg className="w-full h-full bg-gradient-to-br from-rose-950/20 to-neutral-950" viewBox="0 0 100 100" fill="none">
          <rect x="25" y="25" width="20" height="20" rx="3" fill="rgba(244,63,94,0.1)" stroke="rgb(244, 63, 94)" strokeWidth="1.5" />
          <rect x="55" y="55" width="20" height="20" rx="3" fill="rgba(244,63,94,0.1)" stroke="rgb(244, 63, 94)" strokeWidth="1.5" />
          <path d="M45 35 L65 35 L65 55" stroke="rgba(244,63,94,0.4)" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="3 3" />
          <circle cx="65" cy="35" r="3" fill="rgb(244,63,94)" />
        </svg>
      );
    case 'Scenes':
      return (
        <svg className="w-full h-full bg-gradient-to-br from-teal-950/20 to-neutral-950" viewBox="0 0 100 100" fill="none">
          <circle cx="50" cy="50" r="35" stroke="rgba(20,184,166,0.2)" strokeWidth="1" />
          <path d="M50 15 L50 85 M15 50 L85 50" stroke="rgba(20,184,166,0.2)" strokeWidth="1" />
          <rect x="35" y="35" width="30" height="30" rx="2" stroke="rgb(20, 184, 166)" strokeWidth="1.5" />
          <polygon points="50,40 45,55 55,55" fill="rgba(20, 184, 166, 0.4)" />
        </svg>
      );
    default:
      return (
        <svg className="w-full h-full bg-neutral-950" viewBox="0 0 100 100" fill="none">
          <rect x="30" y="30" width="40" height="40" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        </svg>
      );
  }
}

// AssetCard Component
export function AssetCard({
  asset,
  onDelete,
  onDoubleClick,
}: {
  asset: Asset;
  onDelete: (id: string) => void;
  onDoubleClick: (asset: Asset) => void;
}) {
  const [hoverTimer, setHoverTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const activePreviewAsset = useStore((s) => s.activePreviewAsset);
  const isPickingAsset = useStore((s) => s.isPickingAsset);
  const setIsPickingAsset = useStore((s) => s.setIsPickingAsset);
  const activePickerTarget = useStore((s) => s.activePickerTarget);
  const setActivePickerTarget = useStore((s) => s.setActivePickerTarget);

  const renamingAssetId = useStore((s) => s.renamingAssetId);
  const setRenamingAssetId = useStore((s) => s.setRenamingAssetId);
  const isRenaming = renamingAssetId === asset.id;
  const [tempName, setTempName] = useState(asset.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempName(asset.name);
  }, [asset.name]);

  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRenameSubmit = () => {
    setRenamingAssetId(null);
    const trimmed = tempName.trim();
    if (trimmed && trimmed !== asset.name) {
      useAssetStore.getState().updateAsset(asset.id, { name: trimmed });
    } else {
      setTempName(asset.name);
    }
  };

  const assetCat = asset.category || (
    asset.type === 'model' ? 'Models' :
    asset.type === 'image' ? 'Textures' :
    asset.type === 'material' ? 'Materials' :
    asset.type === 'script' ? 'Scripts' :
    asset.type === 'scene' ? 'Scenes' :
    asset.type === 'audio' ? 'Audio' :
    asset.type === 'prefab' || asset.type === 'primitive_prefab' ? 'Prefabs' : 'Models'
  );

  const meta = getCategoryMeta(assetCat);
  const glowBorderClass = getCategoryClasses(assetCat);

  const handlePointerEnter = () => {
    if (hoverTimer) clearTimeout(hoverTimer);

    // Warm asset in background staging queue on hover
    if (asset.url) {
      AssetStagingManager.stageAsset(asset.url, asset.type as any).catch(() => {});
    }

    const timer = setTimeout(() => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        useStore.getState().setActivePreviewAsset(asset, {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    }, 200);

    setHoverTimer(timer);
  };

  const handlePointerLeave = () => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      setHoverTimer(null);
    }
    const currentActive = useStore.getState().activePreviewAsset;
    if (currentActive && currentActive.id === asset.id) {
      useStore.getState().setActivePreviewAsset(null, null);
    }
  };

  const clearHoverState = () => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      setHoverTimer(null);
    }
    useStore.getState().setActivePreviewAsset(null, null);
  };

  // Ensure timer is cleared on unmount
  useEffect(() => {
    return () => {
      if (hoverTimer) clearTimeout(hoverTimer);
    };
  }, [hoverTimer]);

  const IconComponent = meta.icon;

  return (
    <div
      ref={cardRef}
      className={`w-24 h-28 flex flex-col bg-bg-panel/40 backdrop-blur-sm border rounded-xl overflow-hidden cursor-pointer transition-all duration-200 select-none group relative ${
        isPickingAsset
          ? 'border-accent shadow-[0_0_12px_rgba(56,189,248,0.3)] animate-pulse hover:scale-105'
          : `border-border/60 ${meta.glow} ${glowBorderClass}`
      }`}
      draggable={!isPickingAsset && !isRenaming}
      onDragStart={(e) => {
        clearHoverState();
        if (asset.url) {
          AssetStagingManager.stageAsset(asset.url, asset.type as any).catch(() => {});
        }
        e.dataTransfer.setData('application/json', JSON.stringify(asset));
      }}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onContextMenu={(e) => {
        if (!isPickingAsset) {
          e.preventDefault();
          e.stopPropagation();
          clearHoverState();
          useStore.getState().openContextMenu(e.clientX, e.clientY, 'asset', asset.id, asset);
        }
      }}
      onClick={() => {
        if (isPickingAsset) {
          clearHoverState();
          const { selectedIds, updateObject, objects } = useStore.getState();
          const selectedId = selectedIds[0] || null;
          const selectedObj = objects.find((o) => o.id === selectedId);
          const pathVal = asset.url || (asset as any).path || asset.id;
          if (activePickerTarget === 'terrainSandTexture' || activePickerTarget === 'terrainDirtTexture') {
            if (asset.type !== 'image') {
              toast.error('Invalid Asset Type', 'Please select a texture (image) asset to map.');
              return;
            }
            const { setBrushSettings } = useStore.getState();
            if (activePickerTarget === 'terrainSandTexture') {
              setBrushSettings({ sandTextureUrl: pathVal });
            } else {
              setBrushSettings({ dirtTextureUrl: pathVal });
            }
            setIsPickingAsset(false);
            setActivePickerTarget(null);
            toast.success('Texture Assigned', `Terrain ${activePickerTarget === 'terrainSandTexture' ? 'Sand' : 'Dirt'} texture updated.`);
          } else if (activePickerTarget === 'celestialTexture') {
            if (asset.type !== 'image' && (asset as any).type !== 'texture' && (asset as any).type !== 'material') {
              toast.error('Invalid Asset Type', 'Please select a texture or image asset.');
              return;
            }
            const targetId = selectedId || 'moon-light';
            updateObject(targetId, {
              textureUrl: pathVal,
              textureName: asset.name,
            });
            toast.success('Texture Assigned', `${asset.name} assigned to celestial object.`);
            setIsPickingAsset(false);
            setActivePickerTarget(null);
            return;
          } else if (activePickerTarget === 'rainTexture' || activePickerTarget === 'snowTexture') {
            if (asset.type !== 'image' && (asset as any).type !== 'texture' && (asset as any).type !== 'material') {
              toast.error('Invalid Asset Type', 'Please select a texture or image asset.');
              return;
            }
            const { updateEnvironment } = useStore.getState();
            if (activePickerTarget === 'rainTexture') {
              updateEnvironment({ rainTextureUrl: pathVal });
            } else {
              updateEnvironment({ snowTextureUrl: pathVal });
            }
            toast.success('Texture Assigned', `${asset.name} assigned as ${activePickerTarget === 'rainTexture' ? 'Rain' : 'Snow'} particle texture.`);
            setIsPickingAsset(false);
            setActivePickerTarget(null);
            return;
          } else if (activePickerTarget.startsWith('lensFlare')) {
            if (asset.type !== 'image' && (asset as any).type !== 'texture' && (asset as any).type !== 'material') {
              toast.error('Invalid Asset Type', 'Please select a texture or image asset.');
              return;
            }
            const env = useStore.getState().environment;
            const layers = env.lensFlareLayers || [];
            const parts = activePickerTarget.split('_');
            const targetType = parts[0];
            const layerIdx = parts.length > 1 ? parseInt(parts[1], 10) : 0;
            const updated = [...layers];
            if (updated[layerIdx]) {
              if (targetType === 'lensFlareSun') {
                updated[layerIdx] = { ...updated[layerIdx], sunTextureUrl: pathVal, textureUrl: pathVal };
              } else if (targetType === 'lensFlareMoon') {
                updated[layerIdx] = { ...updated[layerIdx], moonTextureUrl: pathVal };
              } else {
                updated[layerIdx] = { ...updated[layerIdx], textureUrl: pathVal };
              }
            } else if (updated.length > 0) {
              updated[0] = { ...updated[0], textureUrl: pathVal };
            }
            useStore.getState().updateEnvironment({ lensFlareLayers: updated });
            toast.success('Lens Flare Updated', `${asset.name} assigned to Lens Flare Layer ${layerIdx + 1}`);
            setIsPickingAsset(false);
            setActivePickerTarget(null);
            return;
          } else if (selectedObj) {
            if (activePickerTarget === 'footstepAudioPath' || activePickerTarget === 'footstepAudioUrl') {
              if (asset.type !== 'audio') {
                toast.error('Invalid Asset Type', 'Please select an audio asset.');
                return;
              }
              if (selectedObj.characterActions) {
                updateObject(selectedObj.id, {
                  characterActions: {
                    ...selectedObj.characterActions,
                    footstepAudioUrl: pathVal,
                    footstepAudioPath: pathVal,
                  }
                });
              }
            } else if (activePickerTarget === 'audioAsset' || (activePickerTarget && activePickerTarget.startsWith('audioUrl_'))) {
              try {
                if (asset.type !== 'audio' && !pathVal.endsWith('.mp3') && !pathVal.endsWith('.wav') && !pathVal.endsWith('.ogg')) {
                  toast.error('Invalid Asset Type', `Asset type is ${asset.type}, expected audio.`);
                  return;
                }
                const targetObjId = activePickerTarget.startsWith('audioUrl_')
                  ? activePickerTarget.replace('audioUrl_', '')
                  : selectedObj.id;
                const targetObj = objects.find((o) => o.id === targetObjId) || selectedObj;
                const currentAudioProps = targetObj.audioProps || {
                  volume: 1,
                  loop: true,
                  refDistance: 1,
                  maxDistance: 50,
                  rolloffFactor: 1,
                  distanceModel: 'inverse',
                  autoplay: true,
                  sourceType: 'point',
                };
                updateObject(targetObj.id, {
                  audioProps: {
                    ...currentAudioProps,
                    assetId: asset.id,
                    url: pathVal,
                  }
                });
                toast.success('Audio Assigned', `${asset.name} linked to ${targetObj.name}.`);
                setIsPickingAsset(false);
                setActivePickerTarget(null);
                return; // Early return to ensure it doesn't fall through
              } catch (err: any) {
                toast.error('Error in audioAsset', err.message || 'Unknown error');
              }
            } else if (activePickerTarget === 'materialMap') {
              if (asset.type !== 'image') {
                toast.error('Invalid Asset Type', 'Please select a texture (image) asset to map.');
                return;
              }
              const currentMat = selectedObj.material || {
                color: '#ffffff',
                roughness: 0.5,
                metalness: 0.0,
                envMapIntensity: 1.0,
              };
              updateObject(selectedObj.id, {
                material: {
                  ...currentMat,
                  map: pathVal,
                  customMap: pathVal,
                }
              });
            } else if (activePickerTarget === 'materialNormalMap') {
              if (asset.type !== 'image') {
                toast.error('Invalid Asset Type', 'Please select a texture (image) asset to map.');
                return;
              }
              if (selectedObj.material) {
                updateObject(selectedObj.id, {
                  material: {
                    ...selectedObj.material,
                    normalMap: pathVal,
                  }
                });
              }
            } else if (activePickerTarget.startsWith('faceMaterialMap_')) {
              if (asset.type !== 'image') {
                toast.error('Invalid Asset Type', 'Please select a texture (image) asset to map.');
                return;
              }
              const face = activePickerTarget.split('_')[1];
              // Update the texture child node's sourceId
              const { objects } = useStore.getState();
              const textureChild = objects.find(
                (o) => o.parentId === selectedObj.id && (o.type === 'texture' || o.type === 'decal') && o.targetFace === face
              );
              if (textureChild) {
                updateObject(textureChild.id, { sourceId: pathVal });
              }
              // Also update faceMaterials for viewport rendering compatibility
              updateObject(selectedObj.id, {
                faceMaterials: {
                  ...selectedObj.faceMaterials,
                  [face]: {
                    ...selectedObj.faceMaterials?.[face as any],
                    map: pathVal,
                  }
                } as any
              });
            } else if (activePickerTarget.startsWith('faceMaterialNormalMap_')) {
              if (asset.type !== 'image') {
                toast.error('Invalid Asset Type', 'Please select a texture (image) asset to map.');
                return;
              }
              const face = activePickerTarget.split('_')[1];
              updateObject(selectedObj.id, {
                faceMaterials: {
                  ...selectedObj.faceMaterials,
                  [face]: {
                    ...selectedObj.faceMaterials?.[face as any],
                    normalMap: pathVal,
                  }
                } as any
              });
            }
            setIsPickingAsset(false);
            setActivePickerTarget(null);
          }
        }
      }}
      onDoubleClick={() => {
        if (!isPickingAsset) {
          clearHoverState();
          onDoubleClick(asset);
        }
      }}
    >
      {/* Selection Overlay */}
      {isPickingAsset && (
        <div className="absolute inset-0 bg-accent/10 group-hover:bg-accent/20 transition-colors z-10 flex flex-col items-center justify-center pointer-events-none">
          <div className="bg-bg-panel/85 backdrop-blur-sm border border-accent/30 rounded-lg px-1.5 py-0.5 text-[8px] font-bold text-accent shadow-md tracking-wide transform translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
            Link Asset
          </div>
        </div>
      )}
      {/* Delete Trigger */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          clearHoverState();
          onDelete(asset.id);
        }}
        className="absolute top-1.5 right-1.5 bg-red-500/80 text-white rounded-lg p-1 opacity-0 group-hover:opacity-100 transition-opacity z-20 hover:bg-red-600 shadow-md backdrop-blur-sm cursor-pointer"
        title="Delete Asset"
      >
        <Trash2 size={10} />
      </button>

      {/* Thumbnail Area - Top 70% */}
      <div className="h-[70%] w-full relative overflow-hidden bg-neutral-950/45 flex items-center justify-center">
        {asset.thumbnailUrl ? (
          <LazyImage
            src={asset.thumbnailUrl}
            alt={asset.name}
            className="w-full h-full object-cover"
            loading={asset.thumbnailUrl.includes('waternormals.jpg') ? 'eager' : 'lazy'}
            fetchPriority={asset.thumbnailUrl.includes('waternormals.jpg') ? 'high' : undefined}
          />
        ) : (
          <AssetThumbnailPlaceholder type={asset.type} category={assetCat} />
        )}
      </div>

      {/* Metadata Strip - Bottom 30% */}
      <div className="h-[30%] w-full px-2 py-1 flex flex-col justify-between bg-bg-panel/70 border-t border-border/40">
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit();
              if (e.key === 'Escape') {
                setRenamingAssetId(null);
                setTempName(asset.name);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
            className="text-[9px] font-semibold text-text-primary bg-bg-deep border border-accent rounded px-1 py-0.5 focus:outline-none w-full"
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              clearHoverState();
              setRenamingAssetId(asset.id);
            }}
            className="text-[9px] font-semibold text-text-primary truncate w-full text-left hover:text-accent transition-colors"
            title="Double-click to rename"
          >
            {asset.name}
          </span>
        )}
        <div className="flex items-center justify-between w-full mb-0.5">
          <span className={`text-[7px] font-bold tracking-wider px-1 py-0.25 rounded-md border leading-none ${meta.badge}`}>
            {assetCat.toUpperCase().slice(0, 5)}
          </span>
          <span className="text-[7px] text-text-secondary/70 font-mono leading-none">
            {asset.type}
          </span>
        </div>
      </div>
    </div>
  );
}

// Float Preview Component using React Portal
export function AssetPreviewPortal() {
  const activePreviewAsset = useStore((s) => s.activePreviewAsset);
  const previewRect = useStore((s) => s.previewRect);

  if (!activePreviewAsset || !previewRect) return null;

  const assetCat = activePreviewAsset.category || (
    activePreviewAsset.type === 'model' ? 'Models' :
    activePreviewAsset.type === 'image' ? 'Textures' :
    activePreviewAsset.type === 'material' ? 'Materials' :
    activePreviewAsset.type === 'script' ? 'Scripts' :
    activePreviewAsset.type === 'scene' ? 'Scenes' :
    activePreviewAsset.type === 'audio' ? 'Audio' :
    activePreviewAsset.type === 'prefab' || activePreviewAsset.type === 'primitive_prefab' ? 'Prefabs' : 'Models'
  );

  const meta = getCategoryMeta(assetCat);

  // Position calculation
  const gap = 8;
  const left = previewRect.left + previewRect.width / 2;
  const bottom = window.innerHeight - previewRect.top + gap;

  // Clamping left boundary to avoid floating preview slipping offscreen
  const previewWidth = 240; // width of container below
  const halfWidth = previewWidth / 2;
  let adjustedLeft = left;

  if (left - halfWidth < 10) {
    adjustedLeft = halfWidth + 10;
  } else if (left + halfWidth > window.innerWidth - 10) {
    adjustedLeft = window.innerWidth - halfWidth - 10;
  }

  const style: React.CSSProperties = {
    position: 'fixed',
    left: `${adjustedLeft}px`,
    bottom: `${bottom}px`,
    transform: 'translateX(-50%)',
    zIndex: 99999,
    pointerEvents: 'none', // Critical: do not block pointer hover movements
  };

  // Preview contents according to type
  const renderDetails = () => {
    switch (activePreviewAsset.type) {
      case 'script':
        const codeLines = activePreviewAsset.content
          ? activePreviewAsset.content.split('\n').slice(0, 5).join('\n')
          : '// No content';
        return (
          <div className="flex flex-col gap-1 w-full">
            <span className="text-[8px] text-text-secondary uppercase tracking-widest font-semibold">Code Snippet:</span>
            <pre className="bg-neutral-950/80 border border-border/80 p-1.5 rounded-lg text-[8px] font-mono text-emerald-400/90 leading-tight overflow-hidden text-left max-h-24 whitespace-pre-wrap select-none">
              {codeLines}
              {activePreviewAsset.content && activePreviewAsset.content.split('\n').length > 5 && '\n// ...'}
            </pre>
          </div>
        );
      case 'material':
        return (
          <div className="text-[8.5px] text-text-secondary space-y-1 w-full text-left">
            <div><span className="font-semibold text-text-primary">Type:</span> Standard PBR Material</div>
            <div><span className="font-semibold text-text-primary">Roughness:</span> 0.2</div>
            <div><span className="font-semibold text-text-primary">Metalness:</span> 0.8</div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="font-semibold text-text-primary">Color:</span>
              <span className="w-2.5 h-2.5 rounded bg-violet-500 border border-violet-400 inline-block shadow-sm" />
              <span className="font-mono text-[8px]">#8b5cf6</span>
            </div>
          </div>
        );
      case 'model':
        return (
          <div className="text-[8.5px] text-text-secondary space-y-1 w-full text-left">
            <div><span className="font-semibold text-text-primary">Format:</span> GLTF / GLB 3D Object</div>
            <div className="truncate" title={formatDisplayUrl(activePreviewAsset.url) || 'Local Memory'}>
              <span className="font-semibold text-text-primary">Source:</span> {formatDisplayUrl(activePreviewAsset.url) || 'Local Memory'}
            </div>
            <div><span className="font-semibold text-text-primary">Collider:</span> Auto Cuboid</div>
          </div>
        );
      default:
        return (
          <div className="text-[8.5px] text-text-secondary space-y-0.5 w-full text-left">
            <div><span className="font-semibold text-text-primary">Asset Type:</span> {activePreviewAsset.type.toUpperCase()}</div>
            <div className="truncate" title={formatDisplayUrl(activePreviewAsset.url) || 'None'}>
              <span className="font-semibold text-text-primary">URL:</span> {formatDisplayUrl(activePreviewAsset.url) || 'None'}
            </div>
          </div>
        );
    }
  };

  return createPortal(
    <div
      style={style}
      className={`w-[240px] bg-neutral-950/90 border rounded-xl shadow-[0_20px_40px_rgba(0,0,0,0.65)] p-3 backdrop-blur-lg flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150 border-${meta.color}-500/40`}
    >
      {/* Decorative colored glow band at top */}
      <div className={`absolute top-0 inset-x-0 h-1 bg-${meta.color}-500 rounded-t-xl opacity-60`} />

      {/* Visual Thumbnail Area */}
      <div className="w-full h-24 rounded-lg bg-neutral-900/60 border border-border/30 overflow-hidden flex items-center justify-center relative">
        {activePreviewAsset.thumbnailUrl ? (
          <img
            src={activePreviewAsset.thumbnailUrl}
            alt={activePreviewAsset.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <AssetThumbnailPlaceholder type={activePreviewAsset.type} category={assetCat} />
        )}
        <span className={`absolute bottom-1.5 right-1.5 text-[7px] font-bold tracking-widest px-1.5 py-0.5 rounded border ${meta.badge}`}>
          {assetCat.toUpperCase()}
        </span>
      </div>

      {/* Asset Meta Info */}
      <div className="flex flex-col text-left gap-0.5">
        <h4 className="text-[10px] font-bold text-text-primary leading-tight truncate">
          {activePreviewAsset.name}
        </h4>
        <span className="text-[7.5px] font-mono text-text-secondary/70">
          ID: {activePreviewAsset.id.slice(0, 18)}...
        </span>
      </div>

      <hr className="border-border/30" />

      {/* Dynamically Rendered Details */}
      {renderDetails()}

      {/* Bottom hint */}
      <span className="text-[7.5px] text-text-secondary/40 font-medium italic text-center mt-0.5">
        Double-click to load / drag to Viewport
      </span>
    </div>,
    document.body
  );
}

// Helpers for grid-glow borders compatible with Tailwind
const getCategoryClasses = (category: string) => {
  switch (category) {
    case 'Models':
      return 'hover:border-sky-500/50 hover:shadow-[0_0_15px_rgba(14,165,233,0.3)]';
    case 'Textures':
      return 'hover:border-orange-500/50 hover:shadow-[0_0_15px_rgba(249,115,22,0.3)]';
    case 'Materials':
      return 'hover:border-violet-500/50 hover:shadow-[0_0_15px_rgba(139,92,246,0.3)]';
    case 'Scripts':
      return 'hover:border-emerald-500/50 hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]';
    case 'Audio':
      return 'hover:border-amber-500/50 hover:shadow-[0_0_15px_rgba(245,158,11,0.3)]';
    case 'Prefabs':
      return 'hover:border-rose-500/50 hover:shadow-[0_0_15px_rgba(244,63,94,0.3)]';
    case 'Scenes':
      return 'hover:border-teal-500/50 hover:shadow-[0_0_15px_rgba(20,184,166,0.3)]';
    default:
      return 'hover:border-neutral-500/50 hover:shadow-[0_0_15px_rgba(115,115,115,0.3)]';
  }
};
