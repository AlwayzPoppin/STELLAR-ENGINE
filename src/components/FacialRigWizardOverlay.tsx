import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import { FACIAL_LANDMARKS, FacialLandmarkDef, getMirroredPosition } from '../utils/FacialLandmarks';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Sparkles,
  Sliders,
  Target,
} from 'lucide-react';

/**
 * 3D Scene Interactive Overlay for Facial Rig Setup Wizard.
 * Renders interactive raycast reticles, placed landmark pins, and captures surface clicks.
 */
export function FacialWizard3D() {
  const { camera, raycaster, scene, pointer, gl } = useThree();
  const facialWizardState = useStore((s) => s.facialWizardState);
  const activeClonedScene = useStore((s) => s.activeClonedScene);
  const objects = useStore((s) => s.objects);
  const setFacialWizardLandmark = useStore((s) => s.setFacialWizardLandmark);

  const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
  const hoverPointRef = useRef<THREE.Vector3 | null>(null);

  const currentStep = FACIAL_LANDMARKS[facialWizardState.currentStepIndex];

  // Target object & head bone
  const targetObj = useMemo(() => {
    return objects.find((o) => o.id === facialWizardState.targetObjectId);
  }, [objects, facialWizardState.targetObjectId]);

  const headBone = useMemo(() => {
    if (!activeClonedScene) return null;
    let found: THREE.Bone | null = null;
    activeClonedScene.traverse((child: any) => {
      if ((child.isBone || child instanceof THREE.Bone) && child.name.toLowerCase().includes('head') && !found) {
        found = child;
      }
    });
    return found;
  }, [activeClonedScene]);

  // Compute prominent marker scale based on target object scale
  const markerScale = useMemo(() => {
    if (!targetObj) return 0.05;
    const maxDim = Math.max(targetObj.scale[0] || 1, targetObj.scale[1] || 1, targetObj.scale[2] || 1);
    return Math.max(0.04, Math.min(0.25, maxDim * 0.08));
  }, [targetObj]);

  // Continuous pointer raycasting against the scene / target mesh
  useFrame(() => {
    if (!facialWizardState.active) {
      if (hoverPoint) {
        setHoverPoint(null);
        hoverPointRef.current = null;
      }
      return;
    }

    raycaster.setFromCamera(pointer, camera);

    const candidates: THREE.Object3D[] = [];
    if (activeClonedScene) {
      candidates.push(activeClonedScene);
    }
    const exportGroup = scene.getObjectByName('export_scene');
    if (exportGroup) {
      candidates.push(exportGroup);
    } else {
      candidates.push(scene);
    }

    const intersects = raycaster.intersectObjects(candidates, true);
    const validHit = intersects.find((hit) => {
      const obj = hit.object;
      return (
        obj.visible &&
        !obj.name?.includes('facial-wizard') &&
        !(obj as any).isBone &&
        !(obj.parent as any)?.name?.includes('facial-wizard') &&
        obj.type !== 'LineSegments'
      );
    });

    if (validHit) {
      const p = validHit.point.clone();
      setHoverPoint(p);
      hoverPointRef.current = p;
    } else {
      setHoverPoint(null);
      hoverPointRef.current = null;
    }
  });

  // Handle global canvas click when wizard is active
  useEffect(() => {
    if (!facialWizardState.active) return;

    const handleCanvasClick = (e: PointerEvent) => {
      if (e.button !== 0) return; // Left click only
      const target = e.target as HTMLElement;
      if (target && (target.closest('button') || target.closest('input') || target.closest('.facial-wizard-hud-container'))) {
        return;
      }

      const hp = hoverPointRef.current;
      if (!hp || !currentStep) return;

      let localPoint = new THREE.Vector3();

      if (headBone) {
        const headInv = (headBone as THREE.Bone).matrixWorld.clone().invert();
        localPoint.copy(hp).applyMatrix4(headInv);
      } else if (targetObj) {
        let threeObj: THREE.Object3D | null = null;
        scene.traverse((c) => {
          if (c.userData?.id === targetObj.id || c.name === targetObj.name) {
            threeObj = c;
          }
        });
        if (threeObj) {
          const inv = (threeObj as THREE.Object3D).matrixWorld.clone().invert();
          localPoint.copy(hp).applyMatrix4(inv);
        } else {
          localPoint.copy(hp);
          localPoint.sub(new THREE.Vector3(...targetObj.position));
          localPoint.x /= targetObj.scale[0] || 1;
          localPoint.y /= targetObj.scale[1] || 1;
          localPoint.z /= targetObj.scale[2] || 1;
        }
      } else {
        localPoint.copy(hp);
      }

      const localArray: [number, number, number] = [localPoint.x, localPoint.y, localPoint.z];

      // Set current landmark
      setFacialWizardLandmark(currentStep.key, localArray);

      // Auto-mirror if symmetry is active and step has a pair
      if (facialWizardState.symmetryMode && currentStep.isPair && currentStep.pairedWith) {
        const mirrored = getMirroredPosition(localArray);
        setFacialWizardLandmark(currentStep.pairedWith, mirrored);
      }
    };

    const dom = gl.domElement;
    dom.addEventListener('pointerdown', handleCanvasClick);
    return () => {
      dom.removeEventListener('pointerdown', handleCanvasClick);
    };
  }, [facialWizardState.active, currentStep, headBone, targetObj, gl.domElement, facialWizardState.symmetryMode, setFacialWizardLandmark, scene]);

  if (!facialWizardState.active) return null;

  return (
    <group name="facial-wizard-3d-group">
      {/* Live Hover Reticle Cursor on Mesh Surface */}
      {hoverPoint && (
        <group position={hoverPoint}>
          {/* Inner Glowing Reticle Sphere */}
          <mesh renderOrder={999}>
            <sphereGeometry args={[markerScale * 0.4, 16, 16]} />
            <meshBasicMaterial color="#38bdf8" depthTest={false} transparent opacity={0.9} />
          </mesh>

          {/* Outer Pulsing Reticle Ring */}
          <mesh renderOrder={999}>
            <ringGeometry args={[markerScale * 0.6, markerScale * 0.85, 32]} />
            <meshBasicMaterial
              color="#0284c7"
              side={THREE.DoubleSide}
              depthTest={false}
              transparent
              opacity={0.8}
            />
          </mesh>

          {/* Compact 3D Floating Tooltip Badge */}
          {currentStep && (
            <Html position={[0, markerScale * 1.4, 0]} center style={{ pointerEvents: 'none' }}>
              <div className="bg-cyan-950/95 text-cyan-200 border border-cyan-400/80 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold whitespace-nowrap shadow-xl shadow-cyan-950/80 backdrop-blur-md flex items-center gap-1.5 animate-pulse">
                <Target size={11} className="text-cyan-400" />
                Click: {currentStep.label}
              </div>
            </Html>
          )}
        </group>
      )}

      {/* Placed Landmark Pins */}
      {Object.entries(facialWizardState.placedLandmarks).map(([key, localPos]) => {
        const landmarkDef = FACIAL_LANDMARKS.find((l) => l.key === key);
        if (!landmarkDef) return null;

        let worldPos = new THREE.Vector3(...localPos);
        if (headBone) {
          worldPos.applyMatrix4((headBone as THREE.Bone).matrixWorld);
        } else if (targetObj) {
          let threeObj: THREE.Object3D | null = null;
          scene.traverse((c) => {
            if (c.userData?.id === targetObj.id || c.name === targetObj.name) {
              threeObj = c;
            }
          });
          if (threeObj) {
            worldPos.applyMatrix4((threeObj as THREE.Object3D).matrixWorld);
          } else {
            worldPos.x *= targetObj.scale[0] || 1;
            worldPos.y *= targetObj.scale[1] || 1;
            worldPos.z *= targetObj.scale[2] || 1;
            worldPos.add(new THREE.Vector3(...targetObj.position));
          }
        }

        const isCurrent = currentStep?.key === key;

        return (
          <group key={key} position={worldPos}>
            {/* Main Landmark Sphere */}
            <mesh renderOrder={998}>
              <sphereGeometry args={[markerScale * 0.5, 16, 16]} />
              <meshStandardMaterial
                color={isCurrent ? '#38bdf8' : '#10b981'}
                emissive={isCurrent ? '#0284c7' : '#059669'}
                emissiveIntensity={0.8}
                roughness={0.1}
                depthTest={false}
              />
            </mesh>

            {/* Glowing Halo Ring */}
            <mesh renderOrder={998}>
              <ringGeometry args={[markerScale * 0.7, markerScale * 0.95, 24]} />
              <meshBasicMaterial
                color={isCurrent ? '#38bdf8' : '#10b981'}
                side={THREE.DoubleSide}
                depthTest={false}
                transparent
                opacity={0.75}
              />
            </mesh>

            {/* Compact Landmark Tag */}
            <Html position={[0, markerScale * 1.1, 0]} center style={{ pointerEvents: 'none' }}>
              <div
                className={`px-2 py-0.5 rounded-full text-[9px] font-mono whitespace-nowrap shadow-lg select-none backdrop-blur-md transition-all flex items-center gap-1.5 ${
                  isCurrent
                    ? 'bg-cyan-950/95 border border-cyan-400 text-cyan-200 font-bold scale-110 shadow-cyan-900/50'
                    : 'bg-neutral-950/90 border border-emerald-500/60 text-emerald-300'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isCurrent ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400'}`} />
                {landmarkDef.label}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

/**
 * Top Floating HUD Banner for the Facial Rig Setup Wizard.
 */
export function FacialWizardHUD() {
  const facialWizardState = useStore((s) => s.facialWizardState);
  const nextFacialWizardStep = useStore((s) => s.nextFacialWizardStep);
  const prevFacialWizardStep = useStore((s) => s.prevFacialWizardStep);
  const skipFacialWizardStep = useStore((s) => s.skipFacialWizardStep);
  const cancelFacialRigWizard = useStore((s) => s.cancelFacialRigWizard);
  const finishFacialRigWizard = useStore((s) => s.finishFacialRigWizard);
  const toggleFacialWizardSymmetry = useStore((s) => s.toggleFacialWizardSymmetry);

  if (!facialWizardState.active) return null;

  const currentStep = FACIAL_LANDMARKS[facialWizardState.currentStepIndex];
  const placedCount = Object.keys(facialWizardState.placedLandmarks).length;
  const isCurrentPlaced = currentStep && !!facialWizardState.placedLandmarks[currentStep.key];

  return (
    <div className="facial-wizard-hud-container absolute top-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 max-w-xl w-full px-4 select-none animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-auto">
      <div className="bg-bg-panel/95 backdrop-blur-md border border-cyan-500/40 shadow-2xl rounded-2xl p-3.5 w-full flex flex-col gap-2.5">
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
              <Sparkles size={14} />
            </span>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                Facial Rig Setup Wizard
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded font-mono">
                  {facialWizardState.currentStepIndex + 1} / {FACIAL_LANDMARKS.length}
                </span>
              </span>
              <span className="text-[10px] text-text-secondary">
                Point-and-click to place animatable facial control points directly on the model.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Symmetry Toggle */}
            <button
              onClick={toggleFacialWizardSymmetry}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                facialWizardState.symmetryMode
                  ? 'bg-cyan-600/30 border border-cyan-500/60 text-cyan-300 shadow'
                  : 'bg-bg-deep border border-border text-text-secondary hover:text-white'
              }`}
              title="Mirror left/right placements across center X axis"
            >
              <Sliders size={11} />
              Symmetry: {facialWizardState.symmetryMode ? 'ON' : 'OFF'}
            </button>

            {/* Cancel / Exit */}
            <button
              onClick={cancelFacialRigWizard}
              className="p-1 rounded-lg hover:bg-white/10 text-text-secondary hover:text-rose-400 transition-colors cursor-pointer"
              title="Exit Wizard"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Current Step Focus Banner */}
        {currentStep && (
          <div className="bg-cyan-950/40 border border-cyan-500/30 rounded-xl p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
                <Target size={18} className="animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  {currentStep.label}
                  {isCurrentPlaced && (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-mono px-1.5 py-0.2 rounded border border-emerald-500/30 flex items-center gap-0.5">
                      <Check size={10} /> Placed
                    </span>
                  )}
                </span>
                <span className="text-xs text-cyan-200/90 font-sans">{currentStep.hint}</span>
              </div>
            </div>

            {/* Step Action Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={prevFacialWizardStep}
                disabled={facialWizardState.currentStepIndex === 0}
                className="p-1.5 rounded-lg bg-bg-deep border border-border text-text-secondary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                title="Previous Landmark"
              >
                <ChevronLeft size={14} />
              </button>

              <button
                onClick={skipFacialWizardStep}
                className="px-2 py-1 rounded-lg bg-bg-deep border border-border text-text-secondary hover:text-white text-[11px] font-semibold cursor-pointer transition-all"
                title="Skip this point"
              >
                Skip
              </button>

              <button
                onClick={nextFacialWizardStep}
                disabled={facialWizardState.currentStepIndex === FACIAL_LANDMARKS.length - 1}
                className="p-1.5 rounded-lg bg-bg-deep border border-border text-text-secondary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all"
                title="Next Landmark"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Step Progress Dots */}
        <div className="flex items-center justify-between gap-1 px-1">
          <div className="flex items-center gap-1 flex-1">
            {FACIAL_LANDMARKS.map((lm, idx) => {
              const isPlaced = !!facialWizardState.placedLandmarks[lm.key];
              const isCurrent = idx === facialWizardState.currentStepIndex;
              return (
                <div
                  key={lm.key}
                  className={`h-1.5 flex-1 rounded-full transition-all ${
                    isCurrent
                      ? 'bg-cyan-400 shadow-sm shadow-cyan-500/50 scale-y-125'
                      : isPlaced
                      ? 'bg-emerald-500'
                      : 'bg-neutral-800'
                  }`}
                  title={`${lm.label} (${isPlaced ? 'Placed' : 'Unplaced'})`}
                />
              );
            })}
          </div>
          <span className="text-[10px] font-mono text-text-secondary ml-2 shrink-0">
            {placedCount} / {FACIAL_LANDMARKS.length} mapped
          </span>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border/40 pt-2">
          <button
            onClick={cancelFacialRigWizard}
            className="text-[11px] text-text-secondary hover:text-rose-400 transition-colors cursor-pointer px-2 py-1"
          >
            Cancel
          </button>

          <button
            onClick={finishFacialRigWizard}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs px-4 py-1.5 rounded-xl shadow-lg flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Sparkles size={13} />
            Finish & Build Facial Rig
          </button>
        </div>
      </div>
    </div>
  );
}
