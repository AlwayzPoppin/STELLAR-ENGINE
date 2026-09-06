import React, { useState, useMemo, useEffect } from 'react';
import { useStore, SceneObject } from '../store/useStore';
import * as THREE from 'three';
import {
  Eye,
  Key,
  FolderTree,
  Smile,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Trash2,
  Settings,
  Flame,
  Sparkles,
  Palette,
  Skull,
  RefreshCw,
  Paintbrush,
  Activity,
  Settings2,
  Sliders,
  Zap,
  Plus,
} from 'lucide-react';
import { toast } from '../store/useToastStore';
import { animationRegistry, useAnimationRegistry } from '../utils/animationRegistry';
import { IRIS_COLOR_PRESETS } from '../utils/EyeGeometryLibrary';
import { FACIAL_LANDMARKS } from '../utils/FacialLandmarks';

export default function AnimationSidebar() {
  const { isLoaded: isRegistryLoaded } = useAnimationRegistry();
  const {
    objects,
    selectedIds,
    selectObject,
    updateObject,
    activeClonedScene,
    activeSkeleton,
    animationTargetId,
    selectedBoneId,
    tracks,
    updateKeyframe,
    setTracks,
    addObject,
    deleteObject,
    facialFocusMode,
    setFacialFocusMode,
    generateFacialRig,
    removeFacialRig,
    generateEyeRig,
    removeEyeRig,
    updateEyeRigProps,
    facialWizardState,
    startFacialRigWizard,
    setSelectedBoneId,
    alignFacialRigToMesh,
    flipPoseSymmetrically,
    currentFrame,
    activeTool,
    setActiveTool,
    weightBrushRadius,
    setWeightBrushRadius,
    weightBrushStrength,
    setWeightBrushStrength,
    weightBrushValue,
    setWeightBrushValue,
    activeWeightChannel,
    setActiveWeightChannel,
  } = useStore();

  const roundedFrame = Math.round(currentFrame);

  const [expandedRigMap, setExpandedRigMap] = useState<string | null>(null);
  const [confirmRemoveFacialRig, setConfirmRemoveFacialRig] = useState(false);
  const [confirmRemoveEyeRig, setConfirmRemoveEyeRig] = useState(false);

  const [activeTab, setActiveTab] = useState<'bone' | 'face' | 'paint'>('bone');

  // Unidirectional sync from activeTool to activeTab (handles external tool changes)
  useEffect(() => {
    if ((activeTool as string) === 'weightPaint') {
      setActiveTab('paint');
    } else {
      setActiveTab((prev) => (prev === 'paint' ? 'bone' : prev));
    }
  }, [activeTool]);

  // Extract all bones for rigging
  const bonesList = useMemo(() => {
    const list: string[] = [];
    if (activeClonedScene) {
      activeClonedScene.traverse((child: any) => {
        if (child.isBone || child instanceof THREE.Bone) {
          list.push(child.name);
        }
      });
    }
    return list.sort();
  }, [activeClonedScene]);



  // Resolve target object for animation:
  // 1. Explicit animationTargetId
  // 2. Currently selected object in viewport
  // 3. Fallback to first scene model/mesh
  const targetObj = useMemo(() => {
    if (animationTargetId) {
      const found = objects.find((o) => o.id === animationTargetId);
      if (found) return found;
    }
    if (selectedIds.length === 1) {
      const found = objects.find((o) => o.id === selectedIds[0]);
      if (found) return found;
    }
    return objects.find(
      (o) =>
        ['mesh', 'gltf', 'obj', 'fbx', 'csg', 'group'].includes(o.type) &&
        !o.id.startsWith('obj_sun') &&
        !o.id.startsWith('obj_moon')
    );
  }, [objects, animationTargetId, selectedIds]);

  useEffect(() => {
    if (targetObj && targetObj.id !== animationTargetId) {
      useStore.getState().setAnimationTargetId(targetObj.id);
    }
  }, [targetObj?.id, animationTargetId]);

  // Extract all unique morph targets on the active cloned scene
  const availableMorphTargets = useMemo(() => {
    if (targetObj?.availableMorphs) {
      return targetObj.availableMorphs;
    }
    const names = new Set<string>();
    if (activeClonedScene) {
      activeClonedScene.traverse((child: any) => {
        if (child.isMesh && child.morphTargetDictionary) {
          Object.keys(child.morphTargetDictionary).forEach((name) => {
            names.add(name);
          });
        }
      });
    }
    return Array.from(names).sort();
  }, [activeClonedScene, targetObj?.availableMorphs]);

  // Auto-initialize facialExpressionRig for the target object if not present
  useEffect(() => {
    if (!targetObj) return;
    if (targetObj.facialExpressionRig) return;

    const morphs = availableMorphTargets;
    const findMorph = (queries: string[]) => {
      return morphs.find((m) => queries.some((q) => m.toLowerCase().includes(q))) || '';
    };

    const findBone = (queries: string[]) => {
      return bonesList.find((b) => queries.some((q) => b.toLowerCase().includes(q))) || '';
    };

    const smileUp = findMorph(['smile', 'happy', 'grin']);
    const frownDown = findMorph(['frown', 'sad', 'mouth_down', 'mouthdown']);
    const mouthOpenMorph = findMorph(['jawopen', 'mouthopen', 'mouth_open', 'openmouth']);
    const mouthBone = findBone(['jaw', 'mouth']);
    const browsUp = findMorph(['browup', 'browraise', 'browouterup', 'browinnerup']);
    const browsDown = findMorph(['browdown', 'browfurrow', 'browlower']);
    const browsBone = findBone(['brow']);
    const eyesWide = findMorph(['eyewide', 'wide', 'openwide']);
    const eyesSquint = findMorph(['squint', 'eyesquint']);
    const eyesBone = findBone(['eyelid', 'eye']);

    const defaultRig = {
      mappings: {
        smileFrown: {
          type: (smileUp || frownDown) ? 'morph' as const : 'bone' as const,
          morphUp: smileUp,
          morphDown: frownDown,
          boneName: mouthBone || bonesList[0] || '',
          property: 'rotation' as const,
          axis: 'z' as const,
          multiplier: 0.2,
        },
        mouthOpen: {
          type: mouthOpenMorph ? 'morph' as const : 'bone' as const,
          morphUp: mouthOpenMorph,
          boneName: mouthBone || bonesList[0] || '',
          property: 'rotation' as const,
          axis: 'x' as const,
          multiplier: 0.3,
        },
        browsRaise: {
          type: (browsUp || browsDown) ? 'morph' as const : 'bone' as const,
          morphUp: browsUp,
          morphDown: browsDown,
          boneName: browsBone || bonesList[0] || '',
          property: 'position' as const,
          axis: 'y' as const,
          multiplier: 0.05,
        },
        eyesSquint: {
          type: (eyesWide || eyesSquint) ? 'morph' as const : 'bone' as const,
          morphUp: eyesWide,
          morphDown: eyesSquint,
          boneName: eyesBone || bonesList[0] || '',
          property: 'scale' as const,
          axis: 'y' as const,
          multiplier: 0.5,
        },
      },
      values: {
        smileFrown: 0,
        mouthOpen: 0,
        browsRaise: 0,
        eyesSquint: 0,
      },
    };

    updateObject(targetObj.id, { facialExpressionRig: defaultRig });
  }, [targetObj, availableMorphTargets, bonesList, updateObject]);

  // Helper to add keyframe for an expression channel
  const handleKeyframeExpression = (exprKey: string, value: number) => {
    const frame = Math.round(useStore.getState().currentFrame);
    const trackName = `expression_${exprKey}`;
    updateKeyframe(trackName, 'expression', frame, value);
    toast.success(`Keyframe added for ${exprKey} at frame ${frame}`);
  };

  // Helper to remove keyframe for an expression channel
  const handleRemoveKeyframeExpression = (exprKey: string) => {
    const frame = Math.round(useStore.getState().currentFrame);
    const trackName = `expression_${exprKey}`;
    const trackIdx = tracks.findIndex(
      (t) => t.boneName === trackName && t.property === 'expression'
    );
    if (trackIdx === -1) return;

    const track = tracks[trackIdx];
    const newKeyframes = { ...track.keyframes };
    delete newKeyframes[frame];

    const nextTracks = [...tracks];
    if (Object.keys(newKeyframes).length === 0) {
      nextTracks.splice(trackIdx, 1);
    } else {
      nextTracks[trackIdx] = {
        ...track,
        keyframes: newKeyframes,
      };
    }
    setTracks(nextTracks);
    toast.info(`Keyframe removed for ${exprKey} at frame ${frame}`);
  };

  // Helper to add/toggle keyframe for a morph target
  const handleKeyframeMorph = (morphName: string, value: number) => {
    const frame = Math.round(useStore.getState().currentFrame);
    updateKeyframe(morphName, 'morph', frame, value);
    toast.success(`Keyframe added for ${morphName} at frame ${frame}`);
  };

  // Helper to remove keyframe for a morph target
  const handleRemoveKeyframeMorph = (morphName: string) => {
    const frame = Math.round(useStore.getState().currentFrame);
    const trackIdx = tracks.findIndex(
      (t) => t.boneName === morphName && t.property === 'morph'
    );
    if (trackIdx === -1) return;

    const track = tracks[trackIdx];
    const newKeyframes = { ...track.keyframes };
    delete newKeyframes[frame];

    const nextTracks = [...tracks];
    if (Object.keys(newKeyframes).length === 0) {
      // Remove track completely if empty
      nextTracks.splice(trackIdx, 1);
    } else {
      nextTracks[trackIdx] = {
        ...track,
        keyframes: newKeyframes,
      };
    }
    setTracks(nextTracks);
    toast.info(`Keyframe removed for ${morphName} at frame ${frame}`);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111116] border-l border-border select-none">
      {/* Target Model Select Indicator */}
      <div className="p-3 bg-bg-panel/40 border-b border-border/80 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-text-secondary uppercase font-semibold tracking-wider font-mono">
            Animation Target Model
          </span>
          {targetObj && (
            <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-accent/20 text-accent font-semibold font-mono">
              {targetObj.type.toUpperCase()}
            </span>
          )}
        </div>
        <select
          value={targetObj?.id || ''}
          onChange={(e) => {
            const newId = e.target.value || null;
            useStore.getState().setAnimationTargetId(newId);
            if (newId) {
              useStore.getState().selectObject(newId);
            }
          }}
          className="w-full bg-bg-deep border border-border text-text-primary px-2 py-1.5 rounded-[4px] text-[11px] font-mono focus:border-accent focus:outline-none transition-colors cursor-pointer"
        >
          <option value="">-- No Model Selected --</option>
          {objects
            .filter(
              (o) =>
                ['mesh', 'gltf', 'obj', 'fbx', 'csg', 'group'].includes(o.type) &&
                !o.id.startsWith('obj_sun') &&
                !o.id.startsWith('obj_moon')
            )
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.type.toUpperCase()})
              </option>
            ))}
        </select>
      </div>

      {/* Tab Switcher Buttons */}
      <div className="flex bg-bg-deep border-b border-border p-1">
        <button
          onClick={() => {
            setActiveTab('bone');
            if ((activeTool as string) === 'weightPaint') setActiveTool('select');
          }}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-[4px] text-[10px] font-medium transition-all cursor-pointer ${
            activeTab === 'bone'
              ? 'bg-accent text-white shadow-md'
              : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
          }`}
        >
          <FolderTree size={12} />
          Bones
        </button>
        <button
          onClick={() => {
            setActiveTab('face');
            if ((activeTool as string) === 'weightPaint') setActiveTool('select');
          }}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-[4px] text-[10px] font-medium transition-all cursor-pointer ${
            activeTab === 'face'
              ? 'bg-accent text-white shadow-md'
              : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
          }`}
        >
          <Smile size={12} />
          Facial
        </button>
        <button
          onClick={() => {
            setActiveTab('paint');
            if ((activeTool as string) !== 'weightPaint') setActiveTool('weightPaint');
          }}
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-[4px] text-[10px] font-medium transition-all cursor-pointer ${
            activeTab === 'paint'
              ? 'bg-accent text-white shadow-md'
              : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
          }`}
        >
          <Paintbrush size={12} />
          Weight Paint
        </button>
      </div>

      {/* Scrollable Panel Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-4">
        {activeTab === 'bone' ? (
          /* ─── BONE RIGGING TAB ─── */
          <div className="flex flex-col gap-4">
            {targetObj && (!activeSkeleton || activeSkeleton.length === 0) && (
              <div className="bg-bg-panel/30 border border-fuchsia-500/30 p-3 rounded-lg flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-fuchsia-400 uppercase font-semibold font-mono flex items-center gap-1.5">
                    <FolderTree size={13} />
                    Quick Rigging
                  </span>
                  <span className="text-[9px] font-mono text-neutral-400">Unrigged</span>
                </div>
                <p className="text-[10px] text-text-secondary leading-relaxed">
                  Add bones to <strong className="text-text-primary">{targetObj.name}</strong> to create skeletal animations.
                </p>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    onClick={() => {
                      const name = prompt('Root bone name:', 'Root');
                      if (name && name.trim()) {
                        useStore.getState().addRootBoneToRig(targetObj.id, name.trim());
                      }
                    }}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white rounded text-[10px] font-bold uppercase transition-colors cursor-pointer shadow-sm"
                  >
                    <Plus size={11} />
                    Add Root Bone
                  </button>
                  <button
                    onClick={() => {
                      useStore.getState().generateBasicRig(targetObj.id);
                    }}
                    className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 rounded text-[10px] font-bold uppercase transition-colors cursor-pointer"
                  >
                    <Sparkles size={11} className="text-amber-400" />
                    Auto-Rig
                  </button>
                </div>
              </div>
            )}

            {targetObj && activeSkeleton && activeSkeleton.length > 0 && (
              <div className="bg-bg-panel/30 border border-border/60 p-3 rounded-lg flex flex-col gap-2">
                <span className="text-[10px] text-text-secondary uppercase font-semibold font-mono">
                  Symmetry Actions
                </span>
                <button
                  onClick={() => {
                    flipPoseSymmetrically();
                    toast.success('Pose flipped symmetrically');
                  }}
                  className="w-full bg-accent hover:bg-accent/80 text-white py-2 px-3 rounded text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <RefreshCw size={13} className="text-sky-400" />
                  Flip Pose Symmetrically
                </button>
              </div>
            )}

            {targetObj && targetObj.activeAnimation && targetObj.activeAnimation !== 'None' && (() => {
              const activeClipName = targetObj.activeAnimation;
              const currentConfig = targetObj.animationConfigs?.[activeClipName] || {};
              const timeScale = currentConfig.timeScale ?? 1.0;

              return (
                <div className="bg-bg-panel/30 border border-border/60 p-3 rounded-lg flex flex-col gap-2.5">
                  <span className="text-[10px] text-text-secondary uppercase font-semibold font-mono flex items-center gap-1.5">
                    <span>⏳</span> Playback Speed & Direction
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="-2"
                      max="2"
                      step="0.1"
                      className="flex-1 accent-accent bg-bg-deep h-1.5 rounded-lg appearance-none cursor-pointer"
                      value={timeScale}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        const newConfigs = {
                          ...(targetObj.animationConfigs || {}),
                          [activeClipName]: {
                            ...currentConfig,
                            timeScale: val,
                          },
                        };
                        updateObject(targetObj.id, { animationConfigs: newConfigs });
                      }}
                    />
                    <input
                      type="number"
                      min="-2"
                      max="2"
                      step="0.1"
                      className="w-14 bg-bg-deep border border-border text-text-primary px-1.5 py-0.5 rounded text-[11px] font-mono focus:border-accent focus:outline-none"
                      value={timeScale}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (isNaN(val)) return;
                        const clamped = Math.max(-2, Math.min(2, val));
                        const newConfigs = {
                          ...(targetObj.animationConfigs || {}),
                          [activeClipName]: {
                            ...currentConfig,
                            timeScale: clamped,
                          },
                        };
                        updateObject(targetObj.id, { animationConfigs: newConfigs });
                      }}
                    />
                  </div>

                  {/* Loop Animation Configuration Toggle */}
                  <div className="flex items-center justify-between border-t border-border/40 pt-2.5 mt-1">
                    <span className="text-[10px] text-text-primary font-medium flex items-center gap-1 font-mono uppercase">
                      <span>🔁</span> Loop Animation
                    </span>
                    <input
                      type="checkbox"
                      checked={currentConfig.loop ?? animationRegistry.isLooping(activeClipName)}
                      onChange={(e) => {
                        const newConfigs = {
                          ...(targetObj.animationConfigs || {}),
                          [activeClipName]: {
                            ...currentConfig,
                            loop: e.target.checked,
                          },
                        };
                        updateObject(targetObj.id, { animationConfigs: newConfigs });
                        if (e.target.checked) {
                          toast.success('Looping Enabled', `"${activeClipName}" will now loop continuously in the engine.`);
                        } else {
                          toast.info('Looping Disabled', `"${activeClipName}" will play once and stop in the engine.`);
                        }
                      }}
                      className="w-3.5 h-3.5 accent-accent bg-bg-deep rounded border border-border/60 cursor-pointer"
                    />
                  </div>

                  {(currentConfig.loop ?? animationRegistry.isLooping(activeClipName)) && (
                    <>
                      {/* Alternating Animations Settings */}
                      <div className="flex items-center justify-between border-t border-border/40 pt-2.5 mt-1">
                        <span className="text-[10.5px] text-text-secondary font-medium flex items-center gap-1 font-mono uppercase">
                          <span>🔄</span> Alternate Idle
                        </span>
                        <input
                          type="checkbox"
                          checked={targetObj.alternatingIdles ?? false}
                          onChange={(e) => {
                            updateObject(targetObj.id, { alternatingIdles: e.target.checked });
                            if (e.target.checked) {
                              toast.success('Alternating Idles Enabled', 'Idle states will transition to secondary variations.');
                            } else {
                              toast.info('Alternating Idles Disabled', 'Standard idle animations will loop normally.');
                            }
                          }}
                          className="w-3.5 h-3.5 accent-accent bg-bg-deep rounded border border-border/60 cursor-pointer"
                        />
                      </div>

                      {(targetObj.alternatingIdles ?? false) && (
                        <>
                          <div className="grid grid-cols-[90px_1fr] items-center gap-2 mt-1">
                            <span className="text-[10px] text-text-secondary font-mono uppercase">Alt Clip</span>
                            <select
                              className="w-full bg-bg-deep border border-border text-text-primary px-2 py-1 rounded-[4px] text-[10px] focus:border-accent focus:outline-none transition-all cursor-pointer font-mono"
                              value={targetObj.alternateAnimation ?? 'None'}
                              onChange={(e) => {
                                updateObject(targetObj.id, { alternateAnimation: e.target.value });
                              }}
                            >
                              <option value="None">None</option>
                              {(targetObj.availableAnimations || []).map((clipName) => (
                                <option key={clipName} value={clipName}>
                                  {clipName}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="grid grid-cols-[90px_1fr] items-center gap-2 mt-1">
                            <span className="text-[10px] text-text-secondary font-mono uppercase">Loops</span>
                            <input
                              type="number"
                              min="1"
                              max="20"
                              className="w-full bg-bg-deep border border-border text-text-primary px-2 py-1 rounded-[4px] text-[10px] font-mono focus:border-accent focus:outline-none"
                              value={targetObj.alternateFrequency ?? 2}
                              onChange={(e) => {
                                updateObject(targetObj.id, { alternateFrequency: Math.max(1, parseInt(e.target.value) || 2) });
                              }}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              );
            })()}

            {selectedBoneId ? (
              <div className="bg-bg-panel/20 border border-border/60 p-3 rounded-lg flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-text-secondary uppercase font-semibold font-mono">
                      Selected Joint
                    </span>
                    <span className="text-xs font-mono text-emerald-400 font-semibold truncate max-w-[160px]">
                      {selectedBoneId}
                    </span>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                <p className="text-[10px] text-text-secondary italic">
                  Use the transform tools (W/E/R) in the viewport to move, rotate, and scale this bone. Poses are recorded as keyframes in the timeline.
                </p>

                {/* Snapping Sockets Note */}
                {selectedBoneId.includes('Socket') && (
                  <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded text-[10px] text-amber-300 flex items-start gap-1.5">
                    <Flame size={12} className="shrink-0 mt-0.5" />
                    <span>
                      Rigging socket detected. Move it close to other bones to snap automatically!
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-border/80 rounded-lg bg-bg-panel/10">
                <FolderTree size={28} className="text-text-secondary opacity-40 mb-2" />
                <span className="text-[11px] text-text-secondary font-medium">
                  No Bone Selected
                </span>
                <p className="text-[10px] text-text-secondary/70 mt-1 max-w-[180px]">
                  Select a bone from the left hierarchy or click one in the viewport to start rigging.
                </p>
              </div>
            )}
          </div>
        ) : activeTab === 'face' ? (
          /* ─── FACIAL FEATURES SUITE TAB ─── */
          <div className="flex flex-col gap-4">
            {targetObj ? (
              <>
                {/* Facial Focus Mode Toggle */}
                <div className="bg-bg-panel/40 border border-border p-3 rounded-lg flex items-center justify-between shadow-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                      <Eye size={13} className="text-purple-400" />
                      Facial Focus Mode
                    </span>
                    <span className="text-[10px] text-text-secondary">
                      Isolate facial bones and snap camera to face
                    </span>
                  </div>
                  <button
                    onClick={() => setFacialFocusMode(!facialFocusMode)}
                    className={`px-3 py-1.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                      facialFocusMode
                        ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md'
                        : 'bg-bg-deep border border-border text-text-secondary hover:text-text-primary hover:bg-white/5'
                    }`}
                  >
                    {facialFocusMode ? 'ACTIVE' : 'ENABLE'}
                  </button>
                </div>


                {/* 1.5. 3D Cinematic Eyeball & Socket Rig */}
                <div className="bg-bg-panel/20 border border-border/60 p-3 rounded-lg flex flex-col gap-3">
                  <span className="text-xs font-semibold text-text-primary flex items-center justify-between border-b border-border/40 pb-2">
                    <span className="flex items-center gap-1.5">
                      <Eye size={14} className="text-blue-400" />
                      3D Eyeball & Socket Rig
                    </span>
                    {targetObj.eyeRigProps?.enabled && (
                      <span className="text-[9px] bg-blue-500/20 text-blue-300 font-mono px-1.5 py-0.5 rounded border border-blue-500/30">
                        ACTIVE
                      </span>
                    )}
                  </span>

                  {!targetObj.eyeRigProps?.enabled ? (
                    <div className="flex flex-col gap-3 pt-1">
                      <p className="text-[10px] text-text-secondary">
                        Replaces flat-textured eye surfaces with recessed 3D sockets, high-gloss physical eyeball spheres, gaze lookAt tracking, and eyelid blinking.
                      </p>

                      <button
                        onClick={() => generateEyeRig(targetObj.id)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                      >
                        <Sparkles size={13} />
                        Generate 3D Eyes & Inset Sockets
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 pt-1">
                      {/* 1. Gaze & LookAt Controller */}
                      <div className="flex flex-col gap-2 bg-bg-deep/40 p-2.5 rounded border border-border/40">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-text-secondary uppercase font-mono flex items-center gap-1">
                            <Activity size={12} className="text-blue-400" />
                            Gaze Tracking & LookAt
                          </span>
                          <button
                            onClick={() => {
                              const newMode = targetObj.eyeRigProps?.lookAtMode === 'camera' ? 'manual' : 'camera';
                              updateEyeRigProps(targetObj.id, { lookAtMode: newMode });
                              toast.info(newMode === 'camera' ? 'Eyes locked onto active camera' : 'Manual eye gaze active');
                            }}
                            className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
                              targetObj.eyeRigProps?.lookAtMode === 'camera'
                                ? 'bg-blue-600 text-white shadow'
                                : 'bg-bg-deep border border-border text-text-secondary hover:text-white'
                            }`}
                          >
                            {targetObj.eyeRigProps?.lookAtMode === 'camera' ? 'TRACKING CAMERA' : 'TRACK CAMERA'}
                          </button>
                        </div>

                        {targetObj.eyeRigProps?.lookAtMode !== 'camera' && (
                          <div className="flex flex-col gap-2 mt-1">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between text-[9px] text-text-secondary">
                                <span>Look Horizontal (Yaw)</span>
                                <span className="font-mono text-text-primary bg-bg-deep px-1 rounded">
                                  {(targetObj.eyeRigProps?.lookYaw ?? 0).toFixed(0)}°
                                </span>
                              </div>
                              <input
                                type="range"
                                min="-35"
                                max="35"
                                step="1"
                                className="w-full accent-blue-500 h-1 rounded-lg bg-neutral-800 appearance-none cursor-pointer"
                                value={targetObj.eyeRigProps?.lookYaw ?? 0}
                                onChange={(e) => updateEyeRigProps(targetObj.id, { lookYaw: parseFloat(e.target.value) })}
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between text-[9px] text-text-secondary">
                                <span>Look Vertical (Pitch)</span>
                                <span className="font-mono text-text-primary bg-bg-deep px-1 rounded">
                                  {(targetObj.eyeRigProps?.lookPitch ?? 0).toFixed(0)}°
                                </span>
                              </div>
                              <input
                                type="range"
                                min="-25"
                                max="25"
                                step="1"
                                className="w-full accent-blue-500 h-1 rounded-lg bg-neutral-800 appearance-none cursor-pointer"
                                value={targetObj.eyeRigProps?.lookPitch ?? 0}
                                onChange={(e) => updateEyeRigProps(targetObj.id, { lookPitch: parseFloat(e.target.value) })}
                              />
                            </div>

                            <div className="flex gap-1.5 mt-1">
                              <button
                                onClick={() => updateEyeRigProps(targetObj.id, { lookYaw: 0, lookPitch: 0 })}
                                className="flex-1 bg-bg-deep hover:bg-white/5 border border-border text-[9px] font-semibold py-1 rounded text-text-secondary hover:text-white transition-all cursor-pointer"
                              >
                                Center Gaze
                              </button>
                              <button
                                onClick={() => {
                                  const yawRad = THREE.MathUtils.degToRad(targetObj.eyeRigProps?.lookYaw || 0);
                                  const pitchRad = THREE.MathUtils.degToRad(targetObj.eyeRigProps?.lookPitch || 0);
                                  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitchRad, yawRad, 0));
                                  const f = Math.round(useStore.getState().currentFrame);
                                  if (targetObj.eyeRigProps?.leftEyeObjId) {
                                    updateKeyframe(targetObj.eyeRigProps.leftEyeObjId, 'rotation', f, [q.x, q.y, q.z, q.w]);
                                  }
                                  if (targetObj.eyeRigProps?.rightEyeObjId) {
                                    updateKeyframe(targetObj.eyeRigProps.rightEyeObjId, 'rotation', f, [q.x, q.y, q.z, q.w]);
                                  }
                                  toast.success(`Keyframed eye gaze at frame ${f}`);
                                }}
                                className="px-2.5 bg-bg-deep hover:bg-white/5 border border-border text-[9px] font-semibold py-1 rounded text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-all cursor-pointer"
                                title="Keyframe Eye Gaze"
                              >
                                <Key size={10} />
                                Keyframe
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. Iris & PBR Eye Appearance */}
                      <div className="flex flex-col gap-2 border-t border-border/20 pt-2">
                        <span className="text-[10px] font-semibold text-text-secondary uppercase font-mono flex items-center gap-1">
                          <Palette size={12} className="text-purple-400" />
                          Iris & Cornea Appearance
                        </span>

                        {/* Presets */}
                        <div className="grid grid-cols-5 gap-1.5">
                          {IRIS_COLOR_PRESETS.map((preset) => (
                            <button
                              key={preset.name}
                              onClick={() => updateEyeRigProps(targetObj.id, { irisColor: preset.hex })}
                              className={`h-6 rounded border transition-all flex items-center justify-center cursor-pointer ${
                                targetObj.eyeRigProps?.irisColor === preset.hex
                                  ? 'border-white scale-105 shadow'
                                  : 'border-transparent opacity-80 hover:opacity-100'
                              }`}
                              style={{ backgroundColor: preset.hex }}
                              title={preset.name}
                            />
                          ))}
                        </div>

                        {/* Custom Color & Pupil */}
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="color"
                            className="w-7 h-7 rounded border border-border bg-transparent cursor-pointer"
                            value={targetObj.eyeRigProps?.irisColor || '#2563eb'}
                            onChange={(e) => updateEyeRigProps(targetObj.id, { irisColor: e.target.value })}
                          />
                          <input
                            type="text"
                            className="flex-1 bg-bg-deep border border-border text-text-primary px-2 py-1 rounded text-[10px] focus:border-accent outline-none font-mono"
                            value={targetObj.eyeRigProps?.irisColor || '#2563eb'}
                            onChange={(e) => updateEyeRigProps(targetObj.id, { irisColor: e.target.value })}
                          />
                        </div>

                        {/* Pupil Dilation */}
                        <div className="flex flex-col gap-1 mt-1">
                          <div className="flex items-center justify-between text-[9px] text-text-secondary">
                            <span>Pupil Dilation</span>
                            <span className="font-mono text-text-primary bg-bg-deep px-1 rounded">
                              {((targetObj.eyeRigProps?.pupilSize ?? 0.35) * 100).toFixed(0)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.15"
                            max="0.85"
                            step="0.02"
                            className="w-full accent-blue-500 h-1 rounded-lg bg-neutral-800 appearance-none cursor-pointer"
                            value={targetObj.eyeRigProps?.pupilSize ?? 0.35}
                            onChange={(e) => updateEyeRigProps(targetObj.id, { pupilSize: parseFloat(e.target.value) })}
                          />
                        </div>

                        {/* Eye Sphere Scale */}
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[9px] text-text-secondary">
                            <span>Eye Scale</span>
                            <span className="font-mono text-text-primary bg-bg-deep px-1 rounded">
                              {(targetObj.eyeRigProps?.eyeScale ?? 0.18).toFixed(3)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.01"
                            max="0.5"
                            step="0.005"
                            className="w-full accent-blue-500 h-1 rounded-lg bg-neutral-800 appearance-none cursor-pointer"
                            value={targetObj.eyeRigProps?.eyeScale ?? 0.18}
                            onChange={(e) => updateEyeRigProps(targetObj.id, { eyeScale: parseFloat(e.target.value) })}
                          />
                        </div>
                      </div>

                      {/* 3. Recessed Socket Depth Tuning */}
                      <div className="flex flex-col gap-2 border-t border-border/20 pt-2">
                        <span className="text-[10px] font-semibold text-text-secondary uppercase font-mono flex items-center gap-1">
                          <Sliders size={12} className="text-amber-400" />
                          Socket Inset Tuning
                        </span>

                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[9px] text-text-secondary">
                            <span>Socket Depth (Recess into Head)</span>
                            <span className="font-mono text-text-primary bg-bg-deep px-1 rounded">
                              {(targetObj.eyeRigProps?.socketDepth ?? 0.035).toFixed(3)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="-0.2"
                            max="0.5"
                            step="0.005"
                            className="w-full accent-amber-500 h-1 rounded-lg bg-neutral-800 appearance-none cursor-pointer"
                            value={targetObj.eyeRigProps?.socketDepth ?? 0.035}
                            onChange={(e) => updateEyeRigProps(targetObj.id, { socketDepth: parseFloat(e.target.value) })}
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[9px] text-text-secondary">
                            <span>Socket Radius</span>
                            <span className="font-mono text-text-primary bg-bg-deep px-1 rounded">
                              {(targetObj.eyeRigProps?.socketRadius ?? 0.045).toFixed(3)}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="0.01"
                            max="0.5"
                            step="0.005"
                            className="w-full accent-amber-500 h-1 rounded-lg bg-neutral-800 appearance-none cursor-pointer"
                            value={targetObj.eyeRigProps?.socketRadius ?? 0.045}
                            onChange={(e) => updateEyeRigProps(targetObj.id, { socketRadius: parseFloat(e.target.value) })}
                          />
                        </div>
                      </div>

                      {/* 4. Blinking & Auto-Blink */}
                      <div className="flex flex-col gap-2 border-t border-border/20 pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-text-secondary uppercase font-mono">
                            Auto-Blinking Engine
                          </span>
                          <input
                            type="checkbox"
                            className="rounded bg-bg-deep border-border text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer"
                            checked={targetObj.eyeRigProps?.autoBlink ?? true}
                            onChange={(e) => updateEyeRigProps(targetObj.id, { autoBlink: e.target.checked })}
                          />
                        </div>

                        {targetObj.eyeRigProps?.autoBlink && (
                          <div className="flex flex-col gap-2 pl-1.5 border-l border-blue-500/30">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between text-[9px] text-text-secondary">
                                <span>Blink Duration</span>
                                <span className="font-mono text-text-primary bg-bg-deep px-1 rounded">
                                  {(targetObj.eyeRigProps?.autoBlinkDuration ?? 0.14).toFixed(2)}s
                                </span>
                              </div>
                              <input
                                type="range"
                                min="0.08"
                                max="0.35"
                                step="0.01"
                                className="w-full accent-accent h-1 rounded-lg bg-neutral-800 appearance-none cursor-pointer"
                                value={targetObj.eyeRigProps?.autoBlinkDuration ?? 0.14}
                                onChange={(e) => updateEyeRigProps(targetObj.id, { autoBlinkDuration: parseFloat(e.target.value) })}
                              />
                            </div>

                            <div className="flex flex-col gap-1">
                              <div className="flex items-center justify-between text-[9px] text-text-secondary">
                                <span>Blink Delay Interval</span>
                                <span className="font-mono text-text-primary bg-bg-deep px-1 rounded">
                                  {(targetObj.eyeRigProps?.autoBlinkIntervalMin ?? 3.5).toFixed(1)}s
                                </span>
                              </div>
                              <input
                                type="range"
                                min="1.0"
                                max="10.0"
                                step="0.5"
                                className="w-full accent-accent h-1 rounded-lg bg-neutral-800 appearance-none cursor-pointer"
                                value={targetObj.eyeRigProps?.autoBlinkIntervalMin ?? 3.5}
                                onChange={(e) => updateEyeRigProps(targetObj.id, { autoBlinkIntervalMin: parseFloat(e.target.value) })}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 5. Action Buttons */}
                      <div className="flex gap-2 border-t border-border/20 pt-3">
                        <button
                          onClick={() => {
                            updateEyeRigProps(targetObj.id, {
                              irisColor: '#2563eb',
                              pupilSize: 0.35,
                              lookYaw: 0,
                              lookPitch: 0,
                              socketDepth: 0.035,
                              socketRadius: 0.045,
                              autoBlink: true,
                              lookAtMode: 'manual',
                            });
                            toast.success('3D Eye settings reset to default');
                          }}
                          className="flex-1 border border-border hover:bg-white/5 text-text-secondary hover:text-white text-xs font-bold py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                        >
                          <RefreshCw size={12} />
                          Reset
                        </button>

                        {!confirmRemoveEyeRig ? (
                          <button
                            onClick={() => setConfirmRemoveEyeRig(true)}
                            className="flex-1 border border-rose-500/30 hover:bg-rose-500/10 text-rose-400 text-xs font-bold py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                          >
                            <Trash2 size={12} />
                            Remove Eyes
                          </button>
                        ) : (
                          <div className="flex-1 flex gap-1">
                            <button
                              onClick={() => {
                                removeEyeRig(targetObj.id);
                                setConfirmRemoveEyeRig(false);
                              }}
                              className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold py-1.5 rounded transition-colors cursor-pointer"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setConfirmRemoveEyeRig(false)}
                              className="px-2 bg-bg-deep hover:bg-white/5 border border-border text-text-secondary text-[11px] rounded cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 1.75. Facial Control Rig (Auto-Generated Bones) */}
                <div className="bg-bg-panel/20 border border-border/60 p-3 rounded-lg flex flex-col gap-3">
                  <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5 border-b border-border/40 pb-2">
                    <Skull size={14} className="text-cyan-400" />
                    Facial Control Rig
                  </span>

                  {(() => {
                    // Auto-detect head bone name
                    const headBoneName = bonesList.find((b) => b.toLowerCase().includes('head')) || null;

                    const mappedLandmarks =
                      targetObj.userData?.facialLandmarks || facialWizardState.placedLandmarks || {};
                    const mappedCount = Object.keys(mappedLandmarks).length;

                    return (
                      <div className="flex flex-col gap-3 pt-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-text-secondary">Calibrated Face Points:</span>
                          <span className="font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-1.5 py-0.2 rounded font-bold">
                            {mappedCount} / 12 Mapped
                          </span>
                        </div>

                        {/* Interactive Landmark List */}
                        <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
                          {FACIAL_LANDMARKS.map((lm) => {
                            const pos = mappedLandmarks[lm.key] || facialWizardState.placedLandmarks[lm.key];
                            const isPlaced = !!pos;
                            const isSelected = selectedBoneId === lm.boneName;

                            return (
                              <button
                                key={lm.key}
                                onClick={() => {
                                  setSelectedBoneId(lm.boneName);
                                  setFacialFocusMode(true);
                                }}
                                className={`flex items-center justify-between px-2 py-1.5 rounded text-left transition-all border cursor-pointer ${
                                  isSelected
                                    ? 'bg-cyan-600/30 border-cyan-500/60 text-cyan-200 shadow-sm'
                                    : isPlaced
                                    ? 'bg-bg-deep border-border/60 hover:border-cyan-500/40 text-text-secondary hover:text-white'
                                    : 'bg-bg-deep/40 border-border/30 text-text-secondary/50 hover:text-text-secondary'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isPlaced ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
                                  <span className="text-[10px] font-medium truncate">{lm.label}</span>
                                </div>

                                {pos ? (
                                  <span className="font-mono text-[8px] bg-neutral-900/90 text-cyan-300 px-1 rounded border border-cyan-500/20 shrink-0 ml-1">
                                    [{pos[0].toFixed(2)}, {pos[1].toFixed(2)}, {pos[2].toFixed(2)}]
                                  </span>
                                ) : (
                                  <span className="font-mono text-[8px] text-neutral-600 uppercase shrink-0">
                                    unmapped
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Launch / Recalibrate Wizard */}
                        <button
                          onClick={() => startFacialRigWizard(targetObj.id)}
                          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold py-2 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-900/20"
                        >
                          <Sparkles size={13} className="text-cyan-200" />
                          {targetObj.hasFacialRig || mappedCount > 0
                            ? 'Recalibrate Face Points (Wizard)'
                            : 'Rig Face Setup Wizard (Interactive)'}
                        </button>

                        {/* Secondary: Auto-Align / Auto-Generate */}
                        {headBoneName && (
                          <button
                            onClick={() => {
                              if (targetObj.hasFacialRig) {
                                alignFacialRigToMesh(targetObj.id);
                              } else {
                                generateFacialRig(targetObj.id);
                                toast.success('Facial control rig generated — 13 bones added to head');
                              }
                            }}
                            className="w-full bg-bg-deep hover:bg-white/5 border border-border text-text-secondary hover:text-white text-[11px] font-semibold py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Sliders size={12} className="text-text-secondary" />
                            {targetObj.hasFacialRig ? 'Auto-Align Bones (AI Projection)' : 'Quick Auto-Generate'}
                          </button>
                        )}

                          {/* Remove Facial Rig */}
                          {!confirmRemoveFacialRig ? (
                            <button
                              onClick={() => setConfirmRemoveFacialRig(true)}
                              className="w-full border border-rose-500/30 hover:bg-rose-500/10 text-rose-400 text-xs font-bold py-1.5 rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Trash2 size={12} />
                              Remove Facial Rig
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  removeFacialRig(targetObj.id);
                                  setConfirmRemoveFacialRig(false);
                                  toast.info('Facial rig removed');
                                }}
                                className="flex-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-1.5 rounded transition-colors cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmRemoveFacialRig(false)}
                                className="flex-1 bg-bg-deep border border-border text-text-secondary text-xs font-bold py-1.5 rounded hover:text-text-primary transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          )}

                          <p className="text-[9px] text-text-secondary/70 italic">
                            Tip: Select a bone above, then rotate/translate it in the viewport to pose the face. Use Unbind/Rebind to correct offsets.
                          </p>
                        </div>
                      );
                    })()}
                </div>

                {/* 2. Facial Blend Shapes & Pose Controls */}
                <div className="bg-bg-panel/20 border border-border/60 p-3 rounded-lg flex flex-col gap-3">
                  <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5 border-b border-border/40 pb-2">
                    <SlidersHorizontal size={14} className="text-emerald-400" />
                    Facial Blend Shapes (Morphs)
                  </span>

                  {availableMorphTargets.length > 0 ? (
                    <div className="flex flex-col gap-3.5 pt-1">
                      {availableMorphTargets.map((name) => {
                        const sliderVal = targetObj.morphWeights?.[name] ?? 0;

                        // Check if keyframe exists at the current frame on this morph track
                        const hasKeyframe = tracks
                          .find((t) => t.boneName === name && t.property === 'morph')
                          ?.keyframes[roundedFrame] !== undefined;

                        return (
                          <div key={name} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10.5px] font-mono text-text-primary truncate max-w-[130px]" title={name}>
                                {name}
                              </span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="font-mono text-[9px] text-text-secondary bg-bg-deep px-1 rounded border border-border/60">
                                  {sliderVal.toFixed(2)}
                                </span>
                                
                                {/* Keyframe Button */}
                                <button
                                  onClick={() => handleKeyframeMorph(name, sliderVal)}
                                  className={`p-1 rounded transition-all cursor-pointer ${
                                    hasKeyframe
                                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                                      : 'bg-bg-deep text-text-secondary hover:text-text-primary border border-border/60'
                                  }`}
                                  title={hasKeyframe ? `Keyframe set at frame ${roundedFrame}` : "Add Keyframe"}
                                >
                                  <Key size={11} />
                                </button>

                                {/* Remove Keyframe Button */}
                                {hasKeyframe && (
                                  <button
                                    onClick={() => handleRemoveKeyframeMorph(name)}
                                    className="p-1 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                                    title="Remove Keyframe"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                )}
                              </div>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              className="w-full accent-emerald-500 h-1 rounded-lg bg-neutral-800 appearance-none cursor-pointer"
                              value={sliderVal}
                              onChange={(e) => {
                                const weights = targetObj.morphWeights || {};
                                updateObject(targetObj.id, {
                                  morphWeights: {
                                    ...weights,
                                    [name]: parseFloat(e.target.value),
                                  },
                                });
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-[10px] text-text-secondary font-mono">
                      No morph targets detected on this model. Make sure the GLTF/FBX contains blend shape keys (e.g. eyeBlink, smile).
                    </div>
                  )}
                </div>

                {/* 3. Facial Expression Rig */}
                <div className="bg-bg-panel/20 border border-border/60 p-3 rounded-lg flex flex-col gap-3">
                  <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5 border-b border-border/40 pb-2 font-mono uppercase tracking-wider">
                    <Sparkles size={14} className="text-purple-400" />
                    Facial Expression Rig
                  </span>

                  {targetObj.facialExpressionRig ? (
                    <div className="flex flex-col gap-3.5 pt-1">
                      {Object.entries({
                        smileFrown: { label: 'Smile / Frown', min: -1, max: 1, step: 0.01, isBidirectional: true },
                        mouthOpen: { label: 'Mouth Open', min: 0, max: 1, step: 0.01, isBidirectional: false },
                        browsRaise: { label: 'Brows Raise / Lower', min: -1, max: 1, step: 0.01, isBidirectional: true },
                        eyesSquint: { label: 'Eyes Wide / Squint', min: -1, max: 1, step: 0.01, isBidirectional: true }
                      }).map(([key, info]) => {
                        const rigVal = targetObj.facialExpressionRig!.values[key as keyof typeof targetObj.facialExpressionRig.values] ?? 0;
                        const mapping = targetObj.facialExpressionRig!.mappings[key as keyof typeof targetObj.facialExpressionRig.mappings] as any;
                        const trackName = `expression_${key}`;
                        const hasKeyframe = tracks.some(
                          (t) => t.boneName === trackName && t.property === 'expression' && t.keyframes[roundedFrame] !== undefined
                        );

                        return (
                          <div key={key} className="flex flex-col gap-1.5 p-2 bg-bg-deep/45 rounded border border-border/30">
                            {/* Header row with Label, Keyframing, Settings Toggle */}
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold text-text-primary">{info.label}</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[9px] text-text-secondary bg-bg-deep px-1 rounded border border-border/60">
                                  {rigVal.toFixed(2)}
                                </span>
                                
                                {/* Keyframe Button */}
                                <button
                                  onClick={() => handleKeyframeExpression(key, rigVal)}
                                  className={`p-1 rounded transition-all cursor-pointer ${
                                    hasKeyframe
                                      ? 'bg-amber-500 text-white hover:bg-amber-600'
                                      : 'bg-bg-deep text-text-secondary hover:text-text-primary border border-border/60'
                                  }`}
                                  title={hasKeyframe ? `Keyframe set at frame ${roundedFrame}` : "Add Keyframe"}
                                >
                                  <Key size={11} />
                                </button>

                                {/* Remove Keyframe Button */}
                                {hasKeyframe && (
                                  <button
                                    onClick={() => handleRemoveKeyframeExpression(key)}
                                    className="p-1 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white transition-all cursor-pointer"
                                    title="Remove Keyframe"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                )}

                                {/* Configure Mapping Toggle */}
                                <button
                                  onClick={() => setExpandedRigMap(expandedRigMap === key ? null : key)}
                                  className={`p-1 rounded transition-all border border-border/60 cursor-pointer ${
                                    expandedRigMap === key
                                      ? 'bg-purple-500/25 text-purple-400 border-purple-500/40'
                                      : 'bg-bg-deep text-text-secondary hover:text-text-primary'
                                  }`}
                                  title="Configure Rig Mapping"
                                >
                                  <Settings size={11} />
                                </button>
                              </div>
                            </div>

                            {/* Slider */}
                            <input
                              type="range"
                              min={info.min}
                              max={info.max}
                              step={info.step}
                              className="w-full accent-purple-500 h-1 rounded-lg bg-neutral-800 appearance-none cursor-pointer"
                              value={rigVal}
                              onChange={(e) => {
                                const currentRig = targetObj.facialExpressionRig!;
                                updateObject(targetObj.id, {
                                  facialExpressionRig: {
                                    ...currentRig,
                                    values: {
                                      ...currentRig.values,
                                      [key]: parseFloat(e.target.value),
                                    },
                                  },
                                });
                              }}
                            />

                            {/* Rig Mapping Configuration Panel */}
                            {expandedRigMap === key && mapping && (
                              <div className="flex flex-col gap-2 border-t border-border/20 mt-1.5 pt-2 text-[10px] text-text-secondary animate-in fade-in duration-100">
                                {/* Type selector */}
                                <div className="flex items-center justify-between">
                                  <span>Mapping Type</span>
                                  <select
                                    className="bg-bg-deep border border-border text-text-primary px-1 py-0.5 rounded text-[10px] outline-none cursor-pointer"
                                    value={mapping.type}
                                    onChange={(e) => {
                                      const currentRig = targetObj.facialExpressionRig!;
                                      const updatedMappings = { ...currentRig.mappings };
                                      updatedMappings[key as keyof typeof currentRig.mappings] = {
                                        ...mapping,
                                        type: e.target.value as 'morph' | 'bone',
                                      } as any;
                                      updateObject(targetObj.id, {
                                        facialExpressionRig: {
                                          ...currentRig,
                                          mappings: updatedMappings,
                                        },
                                      });
                                    }}
                                  >
                                    <option value="morph">Morph Target</option>
                                    <option value="bone">Bone Joint</option>
                                  </select>
                                </div>

                                {mapping.type === 'morph' ? (
                                  <>
                                    {/* Morph Up mapping (Smile / Brows Raise / Eyes Wide) */}
                                    <div className="flex flex-col gap-0.5">
                                      <span>
                                        {info.isBidirectional ? 'Positive Morph (+)' : 'Morph Target'}
                                      </span>
                                      <select
                                        className="w-full bg-bg-deep border border-border text-text-primary px-1.5 py-1 rounded text-[10px] outline-none cursor-pointer"
                                        value={mapping.morphUp || ''}
                                        onChange={(e) => {
                                          const currentRig = targetObj.facialExpressionRig!;
                                          const updatedMappings = { ...currentRig.mappings };
                                          updatedMappings[key as keyof typeof currentRig.mappings] = {
                                            ...mapping,
                                            morphUp: e.target.value || undefined,
                                          } as any;
                                          updateObject(targetObj.id, {
                                            facialExpressionRig: {
                                              ...currentRig,
                                              mappings: updatedMappings,
                                            },
                                          });
                                        }}
                                      >
                                        <option value="">-- Select Morph Target --</option>
                                        {availableMorphTargets.map((m) => (
                                          <option key={m} value={m}>{m}</option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Morph Down mapping (Frown / Brows Lower / Eyes Squint) */}
                                    {info.isBidirectional && (
                                      <div className="flex flex-col gap-0.5">
                                        <span>Negative Morph (-)</span>
                                        <select
                                          className="w-full bg-bg-deep border border-border text-text-primary px-1.5 py-1 rounded text-[10px] outline-none cursor-pointer"
                                          value={mapping.morphDown || ''}
                                          onChange={(e) => {
                                            const currentRig = targetObj.facialExpressionRig!;
                                            const updatedMappings = { ...currentRig.mappings };
                                            updatedMappings[key as keyof typeof currentRig.mappings] = {
                                              ...mapping,
                                              morphDown: e.target.value || undefined,
                                            } as any;
                                            updateObject(targetObj.id, {
                                              facialExpressionRig: {
                                                ...currentRig,
                                                mappings: updatedMappings,
                                              },
                                            });
                                          }}
                                        >
                                          <option value="">-- Select Morph Target --</option>
                                          {availableMorphTargets.map((m) => (
                                            <option key={m} value={m}>{m}</option>
                                          ))}
                                        </select>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {/* Bone selection */}
                                    <div className="flex flex-col gap-0.5">
                                      <span>Target Bone</span>
                                      <select
                                        className="w-full bg-bg-deep border border-border text-text-primary px-1.5 py-1 rounded text-[10px] outline-none cursor-pointer"
                                        value={mapping.boneName || ''}
                                        onChange={(e) => {
                                          const currentRig = targetObj.facialExpressionRig!;
                                          const updatedMappings = { ...currentRig.mappings };
                                          updatedMappings[key as keyof typeof currentRig.mappings] = {
                                            ...mapping,
                                            boneName: e.target.value || undefined,
                                          } as any;
                                          updateObject(targetObj.id, {
                                            facialExpressionRig: {
                                              ...currentRig,
                                              mappings: updatedMappings,
                                            },
                                          });
                                        }}
                                      >
                                        <option value="">-- Select Joint --</option>
                                        {bonesList.map((b) => (
                                          <option key={b} value={b}>{b}</option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Property selection */}
                                    <div className="flex items-center justify-between">
                                      <span>Transform Property</span>
                                      <select
                                        className="bg-bg-deep border border-border text-text-primary px-1 py-0.5 rounded text-[10px] outline-none cursor-pointer"
                                        value={mapping.property || 'rotation'}
                                        onChange={(e) => {
                                          const currentRig = targetObj.facialExpressionRig!;
                                          const updatedMappings = { ...currentRig.mappings };
                                          updatedMappings[key as keyof typeof currentRig.mappings] = {
                                            ...mapping,
                                            property: e.target.value as any,
                                          } as any;
                                          updateObject(targetObj.id, {
                                            facialExpressionRig: {
                                              ...currentRig,
                                              mappings: updatedMappings,
                                            },
                                          });
                                        }}
                                      >
                                        <option value="rotation">Rotation</option>
                                        <option value="position">Position</option>
                                        <option value="scale">Scale</option>
                                      </select>
                                    </div>

                                    {/* Axis selection */}
                                    <div className="flex items-center justify-between">
                                      <span>Transform Axis</span>
                                      <select
                                        className="bg-bg-deep border border-border text-text-primary px-1 py-0.5 rounded text-[10px] outline-none cursor-pointer"
                                        value={mapping.axis || 'x'}
                                        onChange={(e) => {
                                          const currentRig = targetObj.facialExpressionRig!;
                                          const updatedMappings = { ...currentRig.mappings };
                                          updatedMappings[key as keyof typeof currentRig.mappings] = {
                                            ...mapping,
                                            axis: e.target.value as any,
                                          } as any;
                                          updateObject(targetObj.id, {
                                            facialExpressionRig: {
                                              ...currentRig,
                                              mappings: updatedMappings,
                                            },
                                          });
                                        }}
                                      >
                                        <option value="x">X Axis</option>
                                        <option value="y">Y Axis</option>
                                        <option value="z">Z Axis</option>
                                      </select>
                                    </div>

                                    {/* Multiplier input */}
                                    <div className="flex items-center justify-between">
                                      <span>Multiplier (Sensitivity)</span>
                                      <input
                                        type="number"
                                        step="0.05"
                                        className="w-16 bg-bg-deep border border-border text-text-primary px-1 py-0.5 rounded text-[10px] text-center outline-none font-mono"
                                        value={mapping.multiplier ?? 1.0}
                                        onChange={(e) => {
                                          const currentRig = targetObj.facialExpressionRig!;
                                          const updatedMappings = { ...currentRig.mappings };
                                          updatedMappings[key as keyof typeof currentRig.mappings] = {
                                            ...mapping,
                                            multiplier: parseFloat(e.target.value) || 1.0,
                                          } as any;
                                          updateObject(targetObj.id, {
                                            facialExpressionRig: {
                                              ...currentRig,
                                              mappings: updatedMappings,
                                            },
                                          });
                                        }}
                                      />
                                    </div>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-[10px] text-text-secondary">
                      Loading and pre-configuring facial expression rig...
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="text-center py-6 text-[10px] text-text-secondary">
                Import and select a GLTF/FBX model to configure facial animation.
              </div>
            )}
          </div>
        ) : (
          /* ─── WEIGHT PAINT TAB ─── */
          <div className="flex flex-col gap-4">
            {!targetObj ? (
              <div className="text-center py-6 text-[10px] text-text-secondary">
                Select a model to configure weight painting.
              </div>
            ) : (
              <>
                {/* Paint Mode Section */}
                <div className="bg-bg-panel/30 border border-border/60 p-3 rounded-lg flex flex-col gap-2">
                  <span className="text-[10px] text-text-secondary uppercase font-semibold font-mono flex items-center gap-1.5">
                    <Settings2 size={13} className="text-yellow-400" />
                    Paint Mode
                  </span>
                  <div className="grid grid-cols-2 gap-2 w-full mt-1">
                    {([{ label: 'Paint', value: 1.0 }, { label: 'Erase', value: 0.0 }] as const).map(({ label, value }) => {
                      const isSelected = weightBrushValue === value;
                      return (
                        <button
                          key={label}
                          onClick={() => setWeightBrushValue(value)}
                          className={`py-1.5 rounded-[4px] border transition-all text-center cursor-pointer text-[10px] font-bold uppercase tracking-wider ${
                            isSelected
                              ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-400 font-bold shadow-[0_0_8px_rgba(234,179,8,0.1)]'
                              : 'border-border bg-bg-deep/50 text-text-secondary hover:border-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => {
                      if (targetObj) {
                        updateObject(targetObj.id, { vertexWeights: undefined });
                        window.dispatchEvent(new Event('weight_paint_reset'));
                        toast.success('Vertex weights reset successfully');
                      }
                    }}
                    className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 rounded-[4px] border border-red-500/30 bg-red-500/5 text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-[10px] font-bold uppercase tracking-wider"
                  >
                    <Trash2 size={12} />
                    <span>Reset Weights</span>
                  </button>
                </div>

                {/* Brush Effect Channel Section */}
                <div className="bg-bg-panel/30 border border-border/60 p-3 rounded-lg flex flex-col gap-2">
                  <span className="text-[10px] text-text-secondary uppercase font-semibold font-mono flex items-center gap-1.5">
                    <Zap size={13} className="text-yellow-400" />
                    Active Channel
                  </span>
                  <div className="flex flex-col gap-1.5 w-full mt-1">
                    {([
                      { label: '⚡ Electrical (Red)', value: 'r', activeClass: 'border-red-500 bg-red-500/10 text-red-400 font-bold shadow-[0_0_8px_rgba(239,68,68,0.15)]' },
                      { label: '🍃 Wind Sway (Green)', value: 'g', activeClass: 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold shadow-[0_0_8px_rgba(16,185,129,0.15)]' },
                      { label: '🔥 Pulse Glow (Blue)', value: 'b', activeClass: 'border-blue-500 bg-blue-500/10 text-blue-400 font-bold shadow-[0_0_8px_rgba(59,130,246,0.15)]' },
                      { label: '💫 Jiggle Physics (Alpha)', value: 'a', activeClass: 'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-400 font-bold shadow-[0_0_8px_rgba(217,70,239,0.15)]' }
                    ] as const).map(({ label, value, activeClass }) => {
                      const isSelected = activeWeightChannel === value;
                      return (
                        <button
                          key={label}
                          onClick={() => setActiveWeightChannel(value)}
                          className={`py-1.5 rounded-[4px] border transition-all text-left px-3 cursor-pointer text-[10px] font-bold uppercase tracking-wider ${
                            isSelected
                              ? activeClass
                              : 'border-border bg-bg-deep/50 text-text-secondary hover:border-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Brush Properties Section */}
                <div className="bg-bg-panel/30 border border-border/60 p-3 rounded-lg flex flex-col gap-2">
                  <span className="text-[10px] text-text-secondary uppercase font-semibold font-mono flex items-center gap-1.5">
                    <SlidersHorizontal size={13} className="text-emerald-400" />
                    Brush Size & Strength
                  </span>
                  
                  <div className="flex flex-col gap-2 mt-1">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-text-secondary">Brush Radius</span>
                        <span className="font-mono text-text-primary">{weightBrushRadius.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="3.0"
                        step="0.05"
                        className="w-full accent-emerald-500 cursor-pointer"
                        value={weightBrushRadius}
                        onChange={(e) => setWeightBrushRadius(parseFloat(e.target.value))}
                      />
                    </div>

                    <div className="flex flex-col gap-1 mt-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-text-secondary">Brush Strength</span>
                        <span className="font-mono text-text-primary">{weightBrushStrength.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.01"
                        max="1.0"
                        step="0.01"
                        className="w-full accent-emerald-500 cursor-pointer"
                        value={weightBrushStrength}
                        onChange={(e) => setWeightBrushStrength(parseFloat(e.target.value))}
                      />
                    </div>
                  </div>
                </div>

                {/* Effect Parameters Section */}
                {(() => {
                  const suffix = activeWeightChannel.toUpperCase() as 'R' | 'G' | 'B' | 'A';
                  const speedKey = `weightEffectSpeed${suffix}` as const;
                  const strengthKey = `weightEffectStrength${suffix}` as const;
                  const scaleKey = `weightEffectScale${suffix}` as const;

                  const currentSpeed = targetObj[speedKey] ?? targetObj.weightEffectSpeed ?? 1.0;
                  const currentStrength = targetObj[strengthKey] ?? targetObj.weightEffectStrength ?? 1.0;
                  const currentScale = targetObj[scaleKey] ?? targetObj.weightEffectScale ?? 1.0;

                  const speedLabel = activeWeightChannel === 'r' ? 'Electric Speed' 
                                   : activeWeightChannel === 'g' ? 'Wind Speed' 
                                   : activeWeightChannel === 'b' ? 'Pulse Speed' 
                                   : 'Jiggle Damping';

                  const strengthLabel = activeWeightChannel === 'r' ? 'Electric Strength' 
                                      : activeWeightChannel === 'g' ? 'Sway Amplitude' 
                                      : activeWeightChannel === 'b' ? 'Glow Intensity' 
                                      : 'Jiggle Stiffness';

                  const scaleLabel = activeWeightChannel === 'r' ? 'Electric Frequency' 
                                   : activeWeightChannel === 'g' ? 'Sway Frequency' 
                                   : activeWeightChannel === 'b' ? 'Glow Scale' 
                                   : 'Jiggle Scale';

                  return (
                    <div className="bg-bg-panel/30 border border-border/60 p-3 rounded-lg flex flex-col gap-2">
                      <span className="text-[10px] text-text-secondary uppercase font-semibold font-mono flex items-center gap-1.5">
                        <Sliders size={13} className="text-yellow-400" />
                        Effect Parameters ({activeWeightChannel === 'r' ? 'Electrical' : activeWeightChannel === 'g' ? 'Wind Sway' : activeWeightChannel === 'b' ? 'Pulse Glow' : 'Jiggle Physics'})
                      </span>

                      <div className="flex flex-col gap-2 mt-1">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-text-secondary">{speedLabel}</span>
                            <span className="font-mono text-text-primary">{currentSpeed.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min="0.0"
                            max="3.0"
                            step="0.05"
                            className="w-full accent-yellow-500 cursor-pointer"
                            value={currentSpeed}
                            onChange={(e) => updateObject(targetObj.id, { [speedKey]: parseFloat(e.target.value) })}
                          />
                        </div>

                        <div className="flex flex-col gap-1 mt-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-text-secondary">{strengthLabel}</span>
                            <span className="font-mono text-text-primary">{currentStrength.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min="0.0"
                            max="3.0"
                            step="0.05"
                            className="w-full accent-yellow-500 cursor-pointer"
                            value={currentStrength}
                            onChange={(e) => updateObject(targetObj.id, { [strengthKey]: parseFloat(e.target.value) })}
                          />
                        </div>

                        <div className="flex flex-col gap-1 mt-1">
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="text-text-secondary">{scaleLabel}</span>
                            <span className="font-mono text-text-primary">{currentScale.toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min="0.1"
                            max="3.0"
                            step="0.05"
                            className="w-full accent-yellow-500 cursor-pointer"
                            value={currentScale}
                            onChange={(e) => updateObject(targetObj.id, { [scaleKey]: parseFloat(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Quick Tips */}
                <div className="text-[9px] text-text-secondary/60 bg-bg-deep/30 border border-border/50 rounded-lg p-2.5 space-y-1">
                  <div className="font-semibold text-text-secondary text-[10px]">Weight Paint Quick Tips:</div>
                  <div>• Press <span className="font-mono text-text-primary bg-bg-deep px-1 py-0.5 rounded border border-border">B</span> to toggle weight paint mode.</div>
                  <div>• <span className="text-yellow-400 font-semibold">Click and drag</span> to paint effect weights onto model vertices.</div>
                  <div>• <span className="text-red-400 font-semibold">Red</span> = Electrical, <span className="text-emerald-400 font-semibold">Green</span> = Sway, <span className="text-blue-400 font-semibold">Blue</span> = Glow, <span className="text-fuchsia-400 font-semibold">Magenta</span> = Jiggle.</div>
                  <div>• Switch to <strong>Erase</strong> mode to remove painted weights.</div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
