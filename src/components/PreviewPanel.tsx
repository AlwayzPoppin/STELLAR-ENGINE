import React, { Suspense, useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { useStore, JointData, getMirrorJointName, getMirrorAxis } from '../store/useStore';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, TransformControls, useGLTF, useFBX, Bvh } from '@react-three/drei';
import { Bone, Clapperboard, Plus, X, Trash2, Eye, Play, Pause, Brush, SlidersHorizontal, Video, Circle, Search, RotateCcw, Download, Upload, GitCompare, Activity } from 'lucide-react';
import * as THREE from 'three';
import { SkeletonUtils } from 'three-stdlib';
import { generateAutoSpine } from '../utils/AutoRigger';
import { useAnimationStore } from '../store/useAnimationStore';
const ANIMATION_CATEGORIES = ['Human Animations'];
const CATEGORY_BADGES: Record<string, string> = {
  'Human Animations': '🏃',
};
import { solveFABRIK } from '../utils/IKUtils';
import { ErrorBoundary } from './ErrorBoundary';

// Maximum vertex count for paint mode — prevents state explosion on very high-poly models
const MAX_PAINT_VERTICES = 500_000;

// Reusable helper: traverse and dispose all GPU resources from a cloned scene graph
function disposeSceneGraph(obj: THREE.Object3D) {
  obj.traverse((child: any) => {
    if (child.isMesh) {
      child.geometry?.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of materials) {
        if (mat) {
          mat.map?.dispose();
          mat.normalMap?.dispose();
          mat.roughnessMap?.dispose();
          mat.metalnessMap?.dispose();
          mat.emissiveMap?.dispose();
          mat.aoMap?.dispose();
          mat.dispose();
        }
      }
    }
  });
}

// Helper to recreate bone hierarchy on clone/root if needed
function ensureBoneHierarchy(clone: THREE.Object3D, joints: JointData[], isSkinBound?: boolean) {
  if (!joints || joints.length === 0) return;

  // If the model already has a native skinned mesh / skeleton, do not inject autorig bones unless we are using a custom skin bound rig
  let hasNative = false;
  clone.traverse((child) => {
    if ((child as any).isSkinnedMesh) {
      hasNative = true;
    }
  });
  if (hasNative && !isSkinBound) return;

  // Check if all joints already exist in the clone's hierarchy
  let allExist = true;
  for (const j of joints) {
    if (!clone.getObjectByName(j.name)) {
      allExist = false;
      break;
    }
  }

  if (allExist) return;

  // Find the correct bones parent to align local coordinate spaces
  let bonesParent: THREE.Object3D = clone;
  clone.traverse((child) => {
    if (bonesParent === clone && ((child as any).isMesh || (child as any).isSkinnedMesh) && child !== clone) {
      if (child.parent && child.parent !== clone) {
        bonesParent = child.parent;
      }
    }
  });

  // Since the hierarchy is incomplete or outdated, clean up any existing bones with matching names first
  for (const j of joints) {
    const existing = clone.getObjectByName(j.name);
    if (existing) {
      if (existing.parent) {
        existing.parent.remove(existing);
      }
    }
  }

  const bonesMap = new Map<string, THREE.Bone>();
  
  // 1. Create all bones
  for (const j of joints) {
    const bone = new THREE.Bone();
    bone.name = j.name;
    bone.uuid = j.id;
    if (j.name === 'root' || j.name === 'AutoRig_Root' || j.name.toLowerCase().includes('root')) {
      bone.scale.set(1, 1, 1);
    }
    if (j.name === 'pelvis' || j.name === 'AutoRig_Waist' || j.name.toLowerCase().includes('hips') || j.name.toLowerCase().includes('pelvis')) {
      bone.matrixAutoUpdate = true;
    }
    bonesMap.set(j.id, bone);
  }

  // 2. Parents & Positions
  for (const j of joints) {
    const bone = bonesMap.get(j.id)!;
    if (j.parentId) {
      const parentBone = bonesMap.get(j.parentId);
      const parentJoint = joints.find(pj => pj.id === j.parentId);
      if (parentBone && parentJoint) {
        parentBone.add(bone);
        bone.position.set(
          j.position[0] - parentJoint.position[0],
          j.position[1] - parentJoint.position[1],
          j.position[2] - parentJoint.position[2]
        );
      }
    } else {
      bonesParent.add(bone);
      bone.position.set(j.position[0], j.position[1], j.position[2]);
    }
    bone.rotation.set(
      THREE.MathUtils.degToRad(j.rotation[0]),
      THREE.MathUtils.degToRad(j.rotation[1]),
      THREE.MathUtils.degToRad(j.rotation[2])
    );
  }
}
// Helper to mirror a matrix across either X=0 or Z=0 plane in local space
function mirrorBoneMatrix(matrix: THREE.Matrix4, axis: 'x' | 'z'): THREE.Matrix4 {
  const reflection = new THREE.Matrix4();
  if (axis === 'z') {
    reflection.makeScale(1, 1, -1);
  } else {
    reflection.makeScale(-1, 1, 1);
  }
  // Symmetric reflection matrix: R * M * R
  return reflection.clone().multiply(matrix).multiply(reflection);
}

function getSkelHash(jointsList: JointData[]) {
  if (!jointsList) return '';
  let hash = '';
  for (let i = 0; i < jointsList.length; i++) {
    const j = jointsList[i];
    hash += `${j.id}:${j.position[0]},${j.position[1]},${j.position[2]}:${j.rotation[0]},${j.rotation[1]},${j.rotation[2]}|`;
  }
  return hash;
}

// Hook to manage FBX animation playback and retargeting
function useModelAnimation(
  cloneOrRef: THREE.Object3D | React.RefObject<THREE.Object3D | null> | null,
  joints: JointData[],
  activeTab: string,
  isSkinBound: boolean,
  gizmoDraggingRef?: React.RefObject<boolean>,
  builtInAnimations?: THREE.AnimationClip[],
  onAnimationRigLoaded?: (joints: JointData[]) => void
) {
  const {
    activeClipId,
    isPlaying,
    playbackSpeed,
    loopMode,
    currentTime,
    setCurrentTime,
    updateClipMeta,
    clips,
    insymmetryEnabled,
    gaitAsymmetry,
    postureBias,
    dynamicVariance,
  } = useAnimationStore();

  const [retargetedClip, setRetargetedClip] = useState<THREE.AnimationClip | null>(null);
  const [isNativeClip, setIsNativeClip] = useState<boolean>(false);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  const boneMapRef = useRef<Map<string, THREE.Object3D>>(new Map());
  const [skeletonHelper, setSkeletonHelper] = useState<THREE.SkeletonHelper | null>(null);

  const getRoot = () => {
    if (!cloneOrRef) return null;
    if ('current' in cloneOrRef) return cloneOrRef.current;
    return cloneOrRef;
  };

  const root = getRoot();

  const hasNative = useMemo(() => {
    if (!root) return false;
    let found = false;
    root.traverse((child) => {
      if ((child as any).isSkinnedMesh) {
        found = true;
      }
    });
    return found;
  }, [root]);

  // 1. Re-build bone object references cache whenever root or joints change
  useEffect(() => {
    boneMapRef.current.clear();
    if (!root || !joints) return;
    
    // Ensure bone hierarchy exists in the root
    ensureBoneHierarchy(root, joints, isSkinBound);

    const jointNames = new Set(joints.map((j) => j.name));
    root.traverse((child) => {
      if ((child as any).isBone || child.name.startsWith('AutoRig_') || child.name.startsWith('Joint_') || jointNames.has(child.name)) {
        boneMapRef.current.set(child.name, child);
      }
    });
  }, [root, joints, isSkinBound]);

  // 2. Manage SkeletonHelper lifecycle
  useEffect(() => {
    if (!root || activeTab !== 'animation') {
      setSkeletonHelper(null);
      return;
    }
    
    ensureBoneHierarchy(root, joints, isSkinBound);
    const helper = new THREE.SkeletonHelper(root);
    setSkeletonHelper(helper);

    return () => {
      helper.dispose();
    };
  }, [root, activeTab, joints, isSkinBound]);

  // 3. Reset bone transforms when switching away from animations tab
  // IMPORTANT: Skip during active gizmo drags to prevent overwriting live scene-graph positions
  useEffect(() => {
    if (gizmoDraggingRef?.current) return;
    if (activeTab !== 'animation') {
      if (actionRef.current) {
        actionRef.current.stop();
      }
      if (root && joints) {
        for (const j of joints) {
          const bone = boneMapRef.current.get(j.name);
          if (bone) {
            if (j.parentId) {
              const parentJoint = joints.find(pj => pj.id === j.parentId);
              if (parentJoint) {
                bone.position.set(
                  j.position[0] - parentJoint.position[0],
                  j.position[1] - parentJoint.position[1],
                  j.position[2] - parentJoint.position[2]
                );
              }
            } else {
              bone.position.set(j.position[0], j.position[1], j.position[2]);
            }
            bone.rotation.set(
              THREE.MathUtils.degToRad(j.rotation[0]),
              THREE.MathUtils.degToRad(j.rotation[1]),
              THREE.MathUtils.degToRad(j.rotation[2])
            );
          }
        }
      }
    }
  }, [activeTab, root, joints]);

  // 4. Load & Retarget clip on clip ID change, or fallback to built-in animations
  useEffect(() => {
    if (!root || activeTab !== 'animation') {
      if (actionRef.current) {
        actionRef.current.stop();
        actionRef.current = null;
      }
      setRetargetedClip(null);
      setIsNativeClip(false);
      onAnimationRigLoaded?.([]);
      return;
    }

    if (!activeClipId) {
      if (builtInAnimations && builtInAnimations.length > 0) {
        setRetargetedClip(builtInAnimations[0]);
        setIsNativeClip(hasNative && !isSkinBound);
      } else {
        if (actionRef.current) {
          actionRef.current.stop();
          actionRef.current = null;
        }
        setRetargetedClip(null);
        setIsNativeClip(false);
      }
      onAnimationRigLoaded?.([]);
      return;
    }

    const clipMeta = clips.find((c) => c.id === activeClipId);
    if (!clipMeta) return;

    let active = true;
    ensureBoneHierarchy(root, joints, isSkinBound);

    import('../utils/AnimationExtractor').then(async ({ extractAnimationClips }) => {
      try {
        const result = await extractAnimationClips(clipMeta.sourceUrl);
        if (!active) return;

        const clipIdx = clipMeta.clipIndex ?? 0;
        if (result.clips.length > clipIdx) {
          const extracted = result.clips[clipIdx];
          
          if (clipMeta.duration === 0) {
            updateClipMeta(activeClipId, {
              duration: extracted.duration,
              trackCount: extracted.trackCount,
            });
          }

          let hasAutoRigBones = false;
          root.traverse((c) => {
            if (c.name.includes('AutoRig_') || c.name === 'root' || c.name === 'pelvis' || c.name === 'spine_01') {
              hasAutoRigBones = true;
            }
          });

          const hasAnimJoints = !!((result as any).joints && (result as any).joints.length > 0);

          // Use raw ONLY if it's a completely 3rd-party skeleton. 
          // If it has AutoRig bones, WE MUST use the retargeted clip so the tracks match!
          const useRaw = !hasAutoRigBones && (hasNative && !isSkinBound);

          setRetargetedClip(useRaw ? extracted.rawClip : extracted.retargetedClip);
          setIsNativeClip(hasNative && !isSkinBound);

          // Prevent the animation file from overwriting the model's skeleton if the model already has one
          if (hasAnimJoints && !hasNative && !hasAutoRigBones) {
            onAnimationRigLoaded?.((result as any).joints!);
          }
        }
      } catch (err) {
        console.error("Failed to load animation clip:", err);
      }
    });

    return () => {
      active = false;
    };
  }, [activeClipId, root, joints, clips, updateClipMeta, activeTab, builtInAnimations, hasNative, isSkinBound, onAnimationRigLoaded]);

  // 5. Play clip when loaded
  useEffect(() => {
    if (!root || !retargetedClip || activeTab !== 'animation') {
      if (actionRef.current) {
        actionRef.current.stop();
        actionRef.current = null;
      }
      return;
    }

    ensureBoneHierarchy(root, joints, isSkinBound);

    if (!mixerRef.current) {
      mixerRef.current = new THREE.AnimationMixer(root);
    } else if (mixerRef.current.getRoot() !== root) {
      mixerRef.current.stopAllAction();
      mixerRef.current = new THREE.AnimationMixer(root);
    }

    mixerRef.current.stopAllAction();
    const action = mixerRef.current.clipAction(retargetedClip);
    actionRef.current = action;

    if (loopMode === 'once') {
      action.loop = THREE.LoopOnce;
      action.clampWhenFinished = true;
    } else if (loopMode === 'loop') {
      action.loop = THREE.LoopRepeat;
    } else if (loopMode === 'pingpong') {
      action.loop = THREE.LoopPingPong;
    }

    // Force scale reset on root bone and matrixAutoUpdate on pelvis/hips bone
    root.traverse((child) => {
      if ((child as any).isBone) {
        if (child.name === 'root' || child.name === 'AutoRig_Root' || child.name.toLowerCase().includes('root')) {
          child.scale.set(1, 1, 1);
        }
        if (child.name === 'pelvis' || child.name === 'AutoRig_Waist' || child.name.toLowerCase().includes('hips') || child.name.toLowerCase().includes('pelvis')) {
          child.matrixAutoUpdate = true;
        }
      }
    });

    action.play();
    action.paused = !isPlaying;
  }, [retargetedClip, root, loopMode, activeTab, joints, isSkinBound]);

  // 6. Sync playing / paused state
  useEffect(() => {
    if (actionRef.current) {
      actionRef.current.paused = !isPlaying;
      if (isPlaying && actionRef.current.time >= retargetedClip?.duration!) {
        actionRef.current.reset();
        actionRef.current.play();
      }
    }
  }, [isPlaying, retargetedClip]);

  // 7. Sync playback speed
  useEffect(() => {
    if (mixerRef.current) {
      mixerRef.current.timeScale = playbackSpeed;
    }
  }, [playbackSpeed]);

  const isAnimationActive = activeTab === 'animation' && !!retargetedClip;

  return {
    isAnimationActive,
    skeletonHelper,
    mixerRef,
    actionRef,
    boneMap: boneMapRef.current,
    currentTime,
    isPlaying,
    setCurrentTime,
    retargetedClip,
    isNativeClip,
    insymmetryEnabled,
    gaitAsymmetry,
    postureBias,
    dynamicVariance,
  };
}

// Lightweight GLTF loader with dynamic X-Ray material overlay, root local coordinate transformation, point cloud overlays, 3D brush cursor rendering, and pointer events for interactive physics paint mode
function MiniGltfModel({
  url,
  xRay,
  activeTab,
  brushPhysicsType,
  brushRadius,
  brushStrength,
  asset,
  updateObject,
  animTime,
  hairFrequency,
  hairStiffness,
  jiggleElasticity,
  jiggleDamping,
  clothGravity,
  clothDrag,
  testPose,
  enableWind,
  modelRef,
  joints,
  animatedJoints,
  isSkinBound,
  gizmoDraggingRef,
  onSkeletonDetected,
  onAnimationRigLoaded,
}: {
  url: string;
  xRay: boolean;
  activeTab: string;
  brushPhysicsType: 'rigid' | 'hair' | 'jiggle' | 'cloth';
  brushRadius: number;
  brushStrength: number;
  asset: any;
  updateObject: (id: string, updates: Partial<any>) => void;
  animTime: number;
  hairFrequency: number;
  hairStiffness: number;
  jiggleElasticity: number;
  jiggleDamping: number;
  clothGravity: number;
  clothDrag: number;
  testPose: boolean;
  enableWind: boolean;
  modelRef?: React.RefObject<THREE.Object3D | null>;
  joints: JointData[];
  animatedJoints: JointData[];
  isSkinBound: boolean;
  gizmoDraggingRef?: React.RefObject<boolean>;
  onSkeletonDetected?: (detected: boolean) => void;
  onAnimationRigLoaded?: (joints: JointData[]) => void;
}) {
  const { scene, animations } = useGLTF(url);
  const invScaleFactor = useMemo(() => {
    const s = asset?.scale || [1, 1, 1];
    return 1 / s[0];
  }, [asset?.scale]);

  const clone = useMemo(() => {
    const cl = SkeletonUtils.clone(scene);
    cl.updateMatrixWorld(true);

    // Compute combined bounding box of all meshes in local space of clone root
    const box = new THREE.Box3();
    let hasMeshes = false;
    cl.traverse((child: any) => {
      if (child.isMesh || child.isSkinnedMesh) {
        if (child.geometry) {
          child.geometry.computeBoundingBox();
          const childBox = child.geometry.boundingBox.clone();
          childBox.applyMatrix4(child.matrixWorld);
          box.union(childBox);
          hasMeshes = true;
        }
      }
    });

    if (hasMeshes) {
      const height = box.max.y - box.min.y;
      // If the model is tiny (height < 0.5) or extremely large (height > 3.0)
      if (height > 0 && (height < 0.5 || height > 3.0)) {
        const targetHeight = 1.75; // Standard human height in meters
        const scaleFactor = targetHeight / height;
        console.log(`[Auto-Scale GLTF] Normalizing model height from ${height.toFixed(3)}m to ${targetHeight}m (scaleFactor: ${scaleFactor.toFixed(3)})`);
        
        cl.traverse((child: any) => {
          if ((child.isMesh || child.isSkinnedMesh) && child.geometry) {
            child.geometry = child.geometry.clone();
            child.geometry.scale(scaleFactor, scaleFactor, scaleFactor);
            child.geometry.computeBoundingBox();
          }
          if (child !== cl) {
            child.position.multiplyScalar(scaleFactor);
          }
        });
        cl.updateMatrixWorld(true);
      }
    }

    cl.traverse((child: any) => {
      if (child.isMesh || child.isSkinnedMesh) {
        child.frustumCulled = false;
      }
      if (child.isBone) {
        if (child.name === 'root' || child.name === 'AutoRig_Root' || child.name.toLowerCase().includes('root')) {
          child.scale.set(1, 1, 1);
        }
        if (child.name === 'pelvis' || child.name === 'AutoRig_Waist' || child.name.toLowerCase().includes('hips') || child.name.toLowerCase().includes('pelvis')) {
          child.matrixAutoUpdate = true;
        }
      }
    });
    return cl;
  }, [scene, url]);

  // Dynamically apply X-Ray material properties on the existing clone
  useEffect(() => {
    if (!clone) return;
    clone.traverse((child: any) => {
      if (child.isMesh || child.isSkinnedMesh) {
        child.castShadow = !xRay;
        child.receiveShadow = !xRay;
        
        if (xRay) {
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = child.material;
          }
          child.material = child.userData.originalMaterial.clone();
          child.material.transparent = true;
          child.material.opacity = 0.25;
          child.material.depthWrite = false;
          child.material.wireframe = true;
        } else {
          if (child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial;
          }
        }
      }
    });
  }, [clone, xRay]);

  // Detect if there is a skinned mesh (skeleton) in the loaded GLTF model
  useEffect(() => {
    let hasSkinned = false;
    clone.traverse((child) => {
      if ((child as any).isSkinnedMesh) {
        hasSkinned = true;
      }
    });
    onSkeletonDetected?.(hasSkinned);
  }, [clone, onSkeletonDetected]);

  // Dispose old cloned GPU resources when clone is recreated or component unmounts
  useEffect(() => {
    return () => {
      disposeSceneGraph(clone);
    };
  }, [clone]);

  useEffect(() => {
    if (modelRef) {
      modelRef.current = clone;
    }
    return () => {
      if (modelRef && modelRef.current === clone) {
        modelRef.current = null;
      }
    };
  }, [clone, modelRef]);

  const groupRef = useRef<THREE.Group>(null);
  const brushCursorRef = useRef<THREE.Mesh>(null);
  const localPaintedPhysicsRef = useRef<Record<number, string>>({});
  const isDraggingRef = useRef(false);
  const colorAttribRef = useRef<THREE.BufferAttribute>(null);
  const lastPaintTimeRef = useRef<number>(0);
  const cachedInverseMatrixRef = useRef<THREE.Matrix4>(new THREE.Matrix4());
  const pointCloudGeoRef = useRef<THREE.BufferGeometry>(null);
  const rafPendingRef = useRef(false);
  const pendingPointerEventRef = useRef<any>(null);

  const {
    isAnimationActive,
    skeletonHelper,
    mixerRef,
    actionRef,
    boneMap,
    currentTime: storeTime,
    isPlaying: storeIsPlaying,
    setCurrentTime,
    isNativeClip,
    insymmetryEnabled,
    gaitAsymmetry,
    postureBias,
    dynamicVariance,
  } = useModelAnimation(clone, joints, activeTab, isSkinBound, gizmoDraggingRef, animations, onAnimationRigLoaded);

  const insymmetryBones = useMemo(() => {
    if (!boneMap) return null;
    
    const find = (names: string[]) => {
      for (const name of names) {
        if (boneMap.has(name)) return boneMap.get(name);
        for (const [key, val] of boneMap.entries()) {
          if (key.toLowerCase() === name.toLowerCase() || key.toLowerCase().includes(name.toLowerCase())) {
            return val;
          }
        }
      }
      return undefined;
    };

    return {
      pelvis: find(['AutoRig_Waist', 'hips', 'pelvis', 'mixamorigHips']),
      spine: find(['AutoRig_Spine', 'spine', 'mixamorigSpine']),
      chest: find(['AutoRig_Chest', 'chest', 'mixamorigChest', 'mixamorigSpine1', 'mixamorigSpine2']),
      head: find(['AutoRig_Head', 'head', 'mixamorigHead']),
      leftShoulder: find(['AutoRig_L_Shoulder', 'leftShoulder', 'mixamorigLeftShoulder']),
      rightShoulder: find(['AutoRig_R_Shoulder', 'rightShoulder', 'mixamorigRightShoulder']),
      rightHip: find(['AutoRig_R_Hip', 'rightUpLeg', 'mixamorigRightUpLeg']),
      rightKnee: find(['AutoRig_R_Knee', 'rightLeg', 'mixamorigRightLeg']),
    };
  }, [boneMap]);

  // Dispose point cloud geometry on unmount to prevent GPU leak
  useEffect(() => {
    return () => {
      pointCloudGeoRef.current?.dispose();
    };
  }, []);

  // Reset first frame tracking when url changes
  useEffect(() => {
    firstFrameRef.current = true;
  }, [url]);

  useEffect(() => {
    if (!isDraggingRef.current) {
      localPaintedPhysicsRef.current = { ...(asset.paintedPhysics || {}) };
    }
  }, [asset.paintedPhysics]);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        updateObject(asset.id, { paintedPhysics: { ...localPaintedPhysicsRef.current } });
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, [asset.id, updateObject]);

  // Extract all vertex positions in local space of clone root and build a 3D spatial hash grid
  const { allPositions, spatialHash, cellSize, bounds } = useMemo(() => {
    const positions: number[] = [];
    clone.updateMatrixWorld(true);
    
    let bonesParent: THREE.Object3D = clone;
    clone.traverse((child) => {
      if (bonesParent === clone && ((child as any).isMesh || (child as any).isSkinnedMesh) && child !== clone) {
        if (child.parent && child.parent !== clone) {
          bonesParent = child.parent;
        }
      }
    });

    const inverseRootMatrix = bonesParent.matrixWorld.clone().invert();

    clone.traverse((child: any) => {
      if (child.isMesh) {
        const geo = child.geometry;
        const posAttr = geo.getAttribute('position');
        if (posAttr) {
          const localToRoot = child.matrixWorld.clone().premultiply(inverseRootMatrix);
          const v = new THREE.Vector3();
          for (let i = 0; i < posAttr.count; i++) {
            v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
            v.applyMatrix4(localToRoot);
            positions.push(v.x, v.y, v.z);
          }
        }
      }
    });

    const posArray = new Float32Array(positions);
    const count = posArray.length / 3;
    const cellSize = 0.2;
    const grid = new Map<number, number[]>();

    let minCx = Infinity, maxCx = -Infinity;
    let minCy = Infinity, maxCy = -Infinity;
    let minCz = Infinity, maxCz = -Infinity;

    for (let i = 0; i < count; i++) {
      const px = posArray[i * 3];
      const py = posArray[i * 3 + 1];
      const pz = posArray[i * 3 + 2];

      const cx = Math.floor(px / cellSize);
      const cy = Math.floor(py / cellSize);
      const cz = Math.floor(pz / cellSize);

      if (cx < minCx) minCx = cx;
      if (cx > maxCx) maxCx = cx;
      if (cy < minCy) minCy = cy;
      if (cy > maxCy) maxCy = cy;
      if (cz < minCz) minCz = cz;
      if (cz > maxCz) maxCz = cz;

      const key = ((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) >>> 0;
      let cell = grid.get(key);
      if (!cell) {
        cell = [];
        grid.set(key, cell);
      }
      cell.push(i);
    }

    return {
      allPositions: posArray,
      spatialHash: grid,
      cellSize,
      bounds: { minCx, maxCx, minCy, maxCy, minCz, maxCz },
    };
  }, [clone]);

  // Compute bind poses (joint positions when bind pose is defined)
  const bindPoses = useMemo(() => {
    return joints.map((j) => ({
      id: j.id,
      position: new THREE.Vector3(...j.position),
    }));
  }, [joints]);

  const cachedSkinningInfluencesRef = useRef<any[] | null>(null);
  const cachedSkelHashRef = useRef<string>('');

  useEffect(() => {
    if (!isSkinBound) {
      cachedSkinningInfluencesRef.current = null;
      cachedSkelHashRef.current = '';
    }
  }, [isSkinBound]);

  // Precompute nearest joint influences and weights for linear blend skinning once
  const skinningInfluences = useMemo(() => {
    const skelHash = joints.map(j => `${j.id}:${j.position.join(',')}`).join('|');
    if (isSkinBound && cachedSkinningInfluencesRef.current && skelHash === cachedSkelHashRef.current) {
      return cachedSkinningInfluencesRef.current;
    }

    const influences: Array<{
      j0Id: string;
      j1Id: string;
      w0: number;
      w1: number;
      bindPos0: THREE.Vector3;
      bindPos1: THREE.Vector3;
    }> = [];

    const hasSkel = !isNativeClip && isSkinBound && joints && joints.length > 0 && bindPoses.length > 0;
    if (!hasSkel) return influences;

    const tempV = new THREE.Vector3();
    const count = allPositions.length / 3;

    for (let i = 0; i < count; i++) {
      tempV.set(
        allPositions[i * 3],
        allPositions[i * 3 + 1],
        allPositions[i * 3 + 2]
      );

      // Find closest 2 joints in bind pose
      let firstJoint = bindPoses[0];
      let firstDistSq = firstJoint.position.distanceToSquared(tempV);
      let secondJoint = bindPoses[1] || bindPoses[0];
      let secondDistSq = bindPoses[1] ? secondJoint.position.distanceToSquared(tempV) : firstDistSq;

      if (firstDistSq > secondDistSq) {
        const tmpJ = firstJoint; firstJoint = secondJoint; secondJoint = tmpJ;
        const tmpDSq = firstDistSq; firstDistSq = secondDistSq; secondDistSq = tmpDSq;
      }

      for (let j = 2; j < bindPoses.length; j++) {
        const bp = bindPoses[j];
        const distSq = bp.position.distanceToSquared(tempV);
        if (distSq < firstDistSq) {
          secondJoint = firstJoint;
          secondDistSq = firstDistSq;
          firstJoint = bp;
          firstDistSq = distSq;
        } else if (distSq < secondDistSq) {
          secondJoint = bp;
          secondDistSq = distSq;
        }
      }

      const firstDist = Math.sqrt(firstDistSq);
      const secondDist = Math.sqrt(secondDistSq);
      const totalDist = firstDist + secondDist;
      const w0 = totalDist > 0 ? 1 - firstDist / totalDist : 1.0;
      const w1 = 1.0 - w0;

      influences.push({
        j0Id: firstJoint.id,
        j1Id: secondJoint.id,
        w0,
        w1,
        bindPos0: firstJoint.position,
        bindPos1: secondJoint.position,
      });
    }

    cachedSkinningInfluencesRef.current = influences;
    cachedSkelHashRef.current = skelHash;
    return influences;
  }, [allPositions, bindPoses, joints, isSkinBound]);

  // Precalculate proper Inverse Bind Matrices to prevent mesh crumpling
  const inverseBindMatrices = useMemo(() => {
    const map = new Map<string, THREE.Matrix4>();
    if (!isSkinBound || joints.length === 0 || !clone) return map;

    // 1. Get the actual bone objects in the scene graph corresponding to joints
    const bonesWithIds = joints.map(j => {
      const bone = boneMap.get(j.name);
      return { id: j.id, bone };
    }).filter((x): x is { id: string; bone: THREE.Object3D } => x.bone !== undefined);

    if (bonesWithIds.length === 0) return map;

    // 2. Find bonesParent (the parent space of the bones and meshes)
    let bonesParent: THREE.Object3D = clone;
    clone.traverse((child) => {
      if (bonesParent === clone && ((child as any).isMesh || (child as any).isSkinnedMesh) && child !== clone) {
        if (child.parent && child.parent !== clone) {
          bonesParent = child.parent;
        }
      }
    });

    // 3. Save current dynamic posing rotations
    const savedRotations = bonesWithIds.map(x => x.bone.rotation.clone());

    // 4. Force rest pose identity (0, 0, 0)
    bonesWithIds.forEach(x => {
      x.bone.rotation.set(0, 0, 0);
    });

    // 5. Update the scene graph matrices hierarchically from the root
    clone.updateMatrixWorld(true);

    // 6. Compute clean inverse bind matrices relative to bonesParent
    const parentInv = new THREE.Matrix4().copy(bonesParent.matrixWorld).invert();
    bonesWithIds.forEach(x => {
      const relativeMatrix = parentInv.clone().multiply(x.bone.matrixWorld);
      map.set(x.id, relativeMatrix.invert());
    });

    // 7. Restore dynamic posed rotations
    bonesWithIds.forEach((x, index) => {
      x.bone.rotation.copy(savedRotations[index]);
    });

    // 8. Re-update matrix world to restore posed state for rendering
    clone.updateMatrixWorld(true);

    return map;
  }, [clone, joints, isSkinBound, boneMap]);

  // Map painted physics type to vertex point colors
  const pointColors = useMemo(() => {
    const colors = new Float32Array(allPositions.length);
    const painted = asset.paintedPhysics || {};
    for (let i = 0; i < allPositions.length / 3; i++) {
      const type = painted[i] || 'rigid';
      let r = 0.2, g = 0.6, b = 1.0; // Rigid default blue
      if (type === 'hair') {
        r = 1.0; g = 0.1; b = 0.8; // Magenta hair
      } else if (type === 'jiggle') {
        r = 1.0; g = 0.7; b = 0.0; // Amber jiggle
      } else if (type === 'cloth') {
        r = 0.1; g = 0.8; b = 0.4; // Emerald cloth
      }
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    return colors;
  }, [asset.paintedPhysics, allPositions]);

  const paintAtPoint = useCallback((intersectPoint: THREE.Vector3) => {
    if (!asset || !intersectPoint) return;

    const localIntersectPoint = intersectPoint.clone().applyMatrix4(cachedInverseMatrixRef.current);
    const localBrushRadius = brushRadius * invScaleFactor;
    const localBrushRadiusSq = localBrushRadius * localBrushRadius;
    const count = allPositions.length / 3;

    // Determine the range of cell coordinates overlapping the brush sphere, clamped to model boundaries
    const startCx = Math.max(bounds.minCx, Math.floor((localIntersectPoint.x - localBrushRadius) / cellSize));
    const endCx = Math.min(bounds.maxCx, Math.floor((localIntersectPoint.x + localBrushRadius) / cellSize));
    const startCy = Math.max(bounds.minCy, Math.floor((localIntersectPoint.y - localBrushRadius) / cellSize));
    const endCy = Math.min(bounds.maxCy, Math.floor((localIntersectPoint.y + localBrushRadius) / cellSize));
    const startCz = Math.max(bounds.minCz, Math.floor((localIntersectPoint.z - localBrushRadius) / cellSize));
    const endCz = Math.min(bounds.maxCz, Math.floor((localIntersectPoint.z + localBrushRadius) / cellSize));

    let changed = false;

    // Safety check: if the grid search volume is too large, fallback to a fast linear array scan.
    const rangeX = (endCx - startCx + 1);
    const rangeY = (endCy - startCy + 1);
    const rangeZ = (endCz - startCz + 1);
    const volume = (rangeX > 0 ? rangeX : 0) * (rangeY > 0 ? rangeY : 0) * (rangeZ > 0 ? rangeZ : 0);

    if (volume === 0) return;

    if (volume > count) {
      // Linear scan fallback
      for (let i = 0; i < count; i++) {
        const px = allPositions[i * 3];
        const py = allPositions[i * 3 + 1];
        const pz = allPositions[i * 3 + 2];

        const dx = px - localIntersectPoint.x;
        const dy = py - localIntersectPoint.y;
        const dz = pz - localIntersectPoint.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq <= localBrushRadiusSq) {
          const currentType = localPaintedPhysicsRef.current[i] || 'rigid';
          if (currentType !== brushPhysicsType) {
            localPaintedPhysicsRef.current[i] = brushPhysicsType;
            changed = true;

            if (colorAttribRef.current) {
              const colorsArray = colorAttribRef.current.array as Float32Array;
              let r = 0.2, g = 0.6, b = 1.0;
              if (brushPhysicsType === 'hair') {
                r = 1.0; g = 0.1; b = 0.8;
              } else if (brushPhysicsType === 'jiggle') {
                r = 1.0; g = 0.7; b = 0.0;
              } else if (brushPhysicsType === 'cloth') {
                r = 0.1; g = 0.8; b = 0.4;
              }
              colorsArray[i * 3] = r;
              colorsArray[i * 3 + 1] = g;
              colorsArray[i * 3 + 2] = b;
            }
          }
        }
      }
    } else {
      // Spatial hash lookup
      for (let cx = startCx; cx <= endCx; cx++) {
        for (let cy = startCy; cy <= endCy; cy++) {
          for (let cz = startCz; cz <= endCz; cz++) {
            const key = ((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) >>> 0;
            const cellIndices = spatialHash.get(key);
            if (cellIndices) {
              for (let k = 0; k < cellIndices.length; k++) {
                const i = cellIndices[k];
                const px = allPositions[i * 3];
                const py = allPositions[i * 3 + 1];
                const pz = allPositions[i * 3 + 2];

                const dx = px - localIntersectPoint.x;
                const dy = py - localIntersectPoint.y;
                const dz = pz - localIntersectPoint.z;
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq <= localBrushRadiusSq) {
                  const currentType = localPaintedPhysicsRef.current[i] || 'rigid';
                  if (currentType !== brushPhysicsType) {
                    localPaintedPhysicsRef.current[i] = brushPhysicsType;
                    changed = true;

                    if (colorAttribRef.current) {
                      const colorsArray = colorAttribRef.current.array as Float32Array;
                      let r = 0.2, g = 0.6, b = 1.0;
                      if (brushPhysicsType === 'hair') {
                        r = 1.0; g = 0.1; b = 0.8;
                      } else if (brushPhysicsType === 'jiggle') {
                        r = 1.0; g = 0.7; b = 0.0;
                      } else if (brushPhysicsType === 'cloth') {
                        r = 0.1; g = 0.8; b = 0.4;
                      }
                      colorsArray[i * 3] = r;
                      colorsArray[i * 3 + 1] = g;
                      colorsArray[i * 3 + 2] = b;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    if (changed && colorAttribRef.current) {
      colorAttribRef.current.needsUpdate = true;
    }
  }, [asset, brushRadius, invScaleFactor, bounds, cellSize, spatialHash, brushPhysicsType, allPositions]);

  const handlePointerDown = (e: any) => {
    if (activeTab !== 'physics_paint' || !asset || !e.point) return;
    e.stopPropagation();
    isDraggingRef.current = true;

    // Cache matrix once on pointer down
    clone.updateMatrixWorld(true);
    cachedInverseMatrixRef.current.copy(clone.matrixWorld).invert();

    paintAtPoint(e.point);
  };

  const processPointerMove = useCallback((e: any) => {
    rafPendingRef.current = false;
    if (!e || !e.point || !groupRef.current) return;

    groupRef.current.updateMatrixWorld(true);
    const inverseGroupMatrix = new THREE.Matrix4().copy(groupRef.current.matrixWorld).invert();

    if (brushCursorRef.current) {
      const localPoint = e.point.clone().applyMatrix4(inverseGroupMatrix);
      brushCursorRef.current.position.copy(localPoint);

      if (e.face && e.object) {
        const worldNormal = e.face.normal.clone().transformDirection(e.object.matrixWorld);
        const worldQuat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          worldNormal
        );
        const parentWorldQuat = new THREE.Quaternion();
        groupRef.current.getWorldQuaternion(parentWorldQuat);
        brushCursorRef.current.quaternion.copy(worldQuat).premultiply(parentWorldQuat.invert());
      }
    }

    if (e.buttons === 1 && isDraggingRef.current) {
      const now = performance.now();
      if (now - lastPaintTimeRef.current > 16) {
        paintAtPoint(e.point);
        lastPaintTimeRef.current = now;
      }
    }
  }, [paintAtPoint]);

  const handlePointerMove = (e: any) => {
    if (activeTab !== 'physics_paint' || !asset || !e.point) return;
    e.stopPropagation();

    // Safely extract event parameters synchronously to avoid issues with pooled React/R3F events inside RAF
    const point = e.point ? e.point.clone() : null;
    const buttons = e.buttons;
    const face = e.face ? { normal: e.face.normal.clone() } : null;
    const object = e.object;

    pendingPointerEventRef.current = { point, buttons, face, object };
    if (!rafPendingRef.current) {
      rafPendingRef.current = true;
      requestAnimationFrame(() => processPointerMove(pendingPointerEventRef.current));
    }
  };

  const handlePointerOut = () => {
    if (brushCursorRef.current) brushCursorRef.current.visible = false;
  };

  const handlePointerOver = () => {
    if (brushCursorRef.current && activeTab === 'physics_paint') {
      clone.updateMatrixWorld(true);
      cachedInverseMatrixRef.current.copy(clone.matrixWorld).invert();
      brushCursorRef.current.visible = true;
    }
  };

  // Preallocate reusable math structures for useFrame to achieve 0 allocations per frame
  const frameV = useMemo(() => new THREE.Vector3(), []);
  const frameDeformed = useMemo(() => new THREE.Vector3(), []);
  const frameVOffset0 = useMemo(() => new THREE.Vector3(), []);
  const frameVOffset1 = useMemo(() => new THREE.Vector3(), []);
  const frameP0 = useMemo(() => new THREE.Vector3(), []);
  const frameP1 = useMemo(() => new THREE.Vector3(), []);
  const curWorldPos = useMemo(() => new THREE.Vector3(), []);
  const worldDelta = useMemo(() => new THREE.Vector3(), []);
  const localDelta = useMemo(() => new THREE.Vector3(), []);

  // Preallocate active joints map cache to avoid per-vertex searches
  const jointMatrices = useMemo(() => new Map<string, THREE.Matrix4>(), []);
  const tempEuler = useMemo(() => new THREE.Euler(), []);

  // Root to child space transformations
  const frameRootToLocal = useMemo(() => new THREE.Matrix4(), []);
  const frameCloneInv = useMemo(() => new THREE.Matrix4(), []);
  const frameLocalToRoot = useMemo(() => new THREE.Matrix4(), []);

  // Physics simulation: apply hair/jiggle/cloth displacement to GLB meshes via recursive traversal
  // Store original per-child-mesh positions so we can write absolute values (original + offset) each frame
  const origChildPositionsRef = useRef<Map<THREE.BufferGeometry, Float32Array>>(new Map());
  const childVelocitiesRef = useRef<Map<THREE.BufferGeometry, Float32Array>>(new Map());
  const childDisplacementsRef = useRef<Map<THREE.BufferGeometry, Float32Array>>(new Map());
  const prevWorldPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const firstFrameRef = useRef<boolean>(true);
  const lastSkelHashRef = useRef('');
  const lastSkinBoundRef = useRef(false);
  const lastInsymmetryEnabledRef = useRef(false);
  const lastGaitAsymmetryRef = useRef(0);
  const lastPostureBiasRef = useRef(0);
  const lastDynamicVarianceRef = useRef(0);

  useFrame((state, delta) => {
    if (!clone) return;

    // Fallback: if no skeleton bone joints are defined, we just use bind original positions
    const hasSkel = !isNativeClip && isSkinBound && joints && joints.length > 0 && animatedJoints.length > 0 && skinningInfluences.length > 0;

    let hasPaintedPhysics = false;
    if (localPaintedPhysicsRef.current) {
      for (const _ in localPaintedPhysicsRef.current) {
        hasPaintedPhysics = true;
        break;
      }
    }
    // Allow animation mixer to run even without a skin-bound skeleton
    if (!hasSkel && !hasPaintedPhysics && !isAnimationActive) return;

    // Calculate world position changes (for inertia tracking)
    clone.getWorldPosition(curWorldPos);

    worldDelta.set(0, 0, 0);
    if (!firstFrameRef.current) {
      worldDelta.copy(curWorldPos).sub(prevWorldPosRef.current);
    }
    const worldPosChanged = worldDelta.lengthSq() > 0.00001;

    // Change detection for early exit
    const skelHash = getSkelHash(joints);
    const skelChanged = skelHash !== lastSkelHashRef.current;
    const skinBoundChanged = isSkinBound !== lastSkinBoundRef.current;

    const insymmetryChanged = insymmetryEnabled !== lastInsymmetryEnabledRef.current ||
      gaitAsymmetry !== lastGaitAsymmetryRef.current ||
      postureBias !== lastPostureBiasRef.current ||
      dynamicVariance !== lastDynamicVarianceRef.current;

    lastInsymmetryEnabledRef.current = insymmetryEnabled;
    lastGaitAsymmetryRef.current = gaitAsymmetry;
    lastPostureBiasRef.current = postureBias;
    lastDynamicVarianceRef.current = dynamicVariance;

    const needsUpdate = testPose || isAnimationActive || skelChanged || skinBoundChanged || worldPosChanged || insymmetryChanged || firstFrameRef.current;

    if (!needsUpdate) {
      prevWorldPosRef.current.copy(curWorldPos);
      lastSkelHashRef.current = skelHash;
      lastSkinBoundRef.current = isSkinBound;
      return;
    }

    if (firstFrameRef.current) {
      firstFrameRef.current = false;
    }
    prevWorldPosRef.current.copy(curWorldPos);
    lastSkelHashRef.current = skelHash;
    lastSkinBoundRef.current = isSkinBound;

    // Calculate time step
    const dt = Math.max(0.001, Math.min(delta, 0.03));

    // Update animation mixer if active
    if (isAnimationActive && mixerRef.current && actionRef.current) {
      if (!isNativeClip) {
        ensureBoneHierarchy(clone, joints, isSkinBound);
      }
      const mixer = mixerRef.current;
      const action = actionRef.current;

      // Reset rotations of these bones to their base store rotations
      // to prevent stale offsets from persisting (e.g. on non-animated channels)
      if (insymmetryBones) {
        const { pelvis, spine, chest, head, leftShoulder, rightShoulder, rightHip, rightKnee } = insymmetryBones;
        const affectedBones = [pelvis, spine, chest, head, leftShoulder, rightShoulder, rightHip, rightKnee];
        for (const bone of affectedBones) {
          if (bone) {
            const joint = joints.find(j => j.name === bone.name);
            if (joint) {
              bone.rotation.set(
                THREE.MathUtils.degToRad(joint.rotation[0]),
                THREE.MathUtils.degToRad(joint.rotation[1]),
                THREE.MathUtils.degToRad(joint.rotation[2])
              );
            } else {
              bone.rotation.set(0, 0, 0);
            }
          }
        }
      }

      if (storeIsPlaying && !action.paused) {
        mixer.update(dt);
        setCurrentTime(action.time);
      } else {
        action.time = storeTime;
        mixer.update(0);
      }

      if (insymmetryEnabled && insymmetryBones) {
        const { pelvis, spine, chest, head, leftShoulder, rightShoulder, rightHip, rightKnee } = insymmetryBones;

        if (gaitAsymmetry > 0) {
          const limpScale = 1.0 - gaitAsymmetry * 0.6;
          if (rightKnee) rightKnee.rotation.x *= limpScale;
          if (rightHip) rightHip.rotation.x *= limpScale;
        }

        if (Math.abs(postureBias) > 0.01) {
          const leanAngle = postureBias * 0.15;
          if (pelvis) pelvis.rotation.z += leanAngle * 0.4;
          if (spine) spine.rotation.z += leanAngle * 0.7;
          if (chest) chest.rotation.z += leanAngle * 0.5;
          if (leftShoulder) leftShoulder.rotation.z += leanAngle * 0.4;
          if (rightShoulder) rightShoulder.rotation.z += leanAngle * 0.4;
        }

        if (dynamicVariance > 0.01) {
          const tVal = action.time;
          const swaggerScale = dynamicVariance * 0.12;
          const noiseX = Math.sin(tVal * 1.5) * 0.6 + Math.sin(tVal * 0.7) * 0.4;
          const noiseY = Math.cos(tVal * 1.2) * 0.6 + Math.cos(tVal * 0.5) * 0.4;
          const noiseZ = Math.sin(tVal * 0.9) * 0.6 + Math.cos(tVal * 0.4) * 0.4;

          if (pelvis) {
            pelvis.rotation.x += noiseX * swaggerScale;
            pelvis.rotation.y += noiseY * swaggerScale * 1.2;
            pelvis.rotation.z += noiseZ * swaggerScale * 0.8;
          }
          if (head) {
            head.rotation.x += noiseZ * swaggerScale * 0.5;
            head.rotation.y += noiseX * swaggerScale * 0.9;
            head.rotation.z += noiseY * swaggerScale * 0.4;
          }
        }
      }

      clone.updateMatrixWorld(true);
    }

    // Bypass CPU vertex deformation if native clip playback is active and no physics is painted
    if (isNativeClip && !hasPaintedPhysics) {
      return;
    }

    let bonesParent: THREE.Object3D = clone;
    clone.traverse((child) => {
      if (bonesParent === clone && ((child as any).isMesh || (child as any).isSkinnedMesh) && child !== clone) {
        if (child.parent && child.parent !== clone) {
          bonesParent = child.parent;
        }
      }
    });

    frameCloneInv.copy(bonesParent.matrixWorld).invert();

    localDelta.set(0, 0, 0);
    if (worldDelta.lengthSq() > 0.00001) {
      localDelta.copy(worldDelta).transformDirection(frameCloneInv);
    }

    // 1. Precalculate current joint matrices once per frame
    if (hasSkel) {
      jointMatrices.clear();
      for (let k = 0; k < animatedJoints.length; k++) {
        const cur = animatedJoints[k];
        let mat = jointMatrices.get(cur.id);
        if (!mat) {
          mat = new THREE.Matrix4();
          jointMatrices.set(cur.id, mat);
        }

        const bone = boneMap.get(cur.name);
        if (bone) {
          bone.updateMatrixWorld(true);
          mat.copy(frameCloneInv).multiply(bone.matrixWorld);
        } else {
          mat.identity();
        }
      }
    }

    // Walk through child meshes and apply deforms
    let globalIdx = 0;
    clone.traverse((child: any) => {
      if (!(child.isMesh || child.isSkinnedMesh)) return;
      const geo = child.geometry;
      const posAttr = geo?.getAttribute('position');
      if (!posAttr) return;

      // Snapshot original child-local positions on first encounter
      if (!origChildPositionsRef.current.has(geo)) {
        origChildPositionsRef.current.set(geo, new Float32Array(posAttr.array));
      }
      if (!childVelocitiesRef.current.has(geo)) {
        childVelocitiesRef.current.set(geo, new Float32Array(posAttr.count * 3));
      }
      if (!childDisplacementsRef.current.has(geo)) {
        childDisplacementsRef.current.set(geo, new Float32Array(posAttr.count * 3));
      }

      const origArr = origChildPositionsRef.current.get(geo)!;
      const vels = childVelocitiesRef.current.get(geo)!;
      const disps = childDisplacementsRef.current.get(geo)!;
      const arr = posAttr.array as Float32Array;
      let changed = false;

      // Compute inverse child-local to clone-root matrix mapping
      child.updateMatrixWorld(true);
      frameLocalToRoot.copy(child.matrixWorld).premultiply(frameCloneInv);
      frameRootToLocal.copy(frameLocalToRoot).invert();

      for (let i = 0; i < posAttr.count; i++) {
        const gi = globalIdx + i;
        const type = (localPaintedPhysicsRef.current && localPaintedPhysicsRef.current[gi]) || 'rigid';

        // OPTIMIZATION: Skip rigid static vertices completely to avoid CPU freeze
        if (!hasSkel && type === 'rigid') {
          continue;
        }

        const origX = allPositions[gi * 3];
        const origY = allPositions[gi * 3 + 1];
        const origZ = allPositions[gi * 3 + 2];
        frameV.set(origX, origY, origZ);

        // Calculate base position (skinned to skeleton or static bind)
        if (hasSkel) {
          const influence = skinningInfluences[gi];
          if (influence) {
            const m0 = jointMatrices.get(influence.j0Id);
            const m1 = jointMatrices.get(influence.j1Id);
            const inv0 = inverseBindMatrices.get(influence.j0Id);
            const inv1 = inverseBindMatrices.get(influence.j1Id);

            if (m0 && m1 && inv0 && inv1) {
              // Joint 0 contribution: Model Space -> Bone Local Space -> Animated World Space
              frameVOffset0.copy(frameV).applyMatrix4(inv0).applyMatrix4(m0);
              
              // Joint 1 contribution
              frameVOffset1.copy(frameV).applyMatrix4(inv1).applyMatrix4(m1);

              frameDeformed.set(0, 0, 0);
              frameDeformed.addScaledVector(frameVOffset0, influence.w0);
              frameDeformed.addScaledVector(frameVOffset1, influence.w1);
            } else {
              frameDeformed.copy(frameV);
            }
          } else {
            frameDeformed.copy(frameV);
          }
        } else {
          frameDeformed.copy(frameV);
        }

        const ox = origArr[i * 3];
        const oy = origArr[i * 3 + 1];
        const oz = origArr[i * 3 + 2];

        if (!testPose || type === 'rigid') {
          disps[i * 3] = 0;
          disps[i * 3 + 1] = 0;
          disps[i * 3 + 2] = 0;
          vels[i * 3] = 0;
          vels[i * 3 + 1] = 0;
          vels[i * 3 + 2] = 0;

          // Convert deformed (root-local) to child-local coordinate space
          frameDeformed.applyMatrix4(frameRootToLocal);

          if (arr[i * 3] !== frameDeformed.x || arr[i * 3 + 1] !== frameDeformed.y || arr[i * 3 + 2] !== frameDeformed.z) {
            arr[i * 3] = frameDeformed.x;
            arr[i * 3 + 1] = frameDeformed.y;
            arr[i * 3 + 2] = frameDeformed.z;
            changed = true;
          }
          continue;
        }

        // Retrieve current displacement & velocity
        let dx = disps[i * 3];
        let dy = disps[i * 3 + 1];
        let dz = disps[i * 3 + 2];

        let vx = vels[i * 3];
        let vy = vels[i * 3 + 1];
        let vz = vels[i * 3 + 2];

        let offX = 0, offY = 0, offZ = 0;

        if (type === 'hair') {
          if (enableWind) {
            // Trigonometric Wind Sway + Inertia
            const t = animTime * hairFrequency;
            const amplitude = (1.0 - hairStiffness) * 0.1 * brushStrength;
            offX = Math.sin(t + frameDeformed.y * 3.0) * amplitude;
            offZ = Math.cos(t + frameDeformed.y * 3.0) * amplitude;

            dx -= localDelta.x * 2.0 * brushStrength;
            dy -= localDelta.y * 2.0 * brushStrength;
            dz -= localDelta.z * 2.0 * brushStrength;

            dx += (offX - dx) * dt * 5.0;
            dy += (offY - dy) * dt * 5.0;
            dz += (offZ - dz) * dt * 5.0;

            disps[i * 3] = dx;
            disps[i * 3 + 1] = dy;
            disps[i * 3 + 2] = dz;
          } else {
            // Plain physics (no wind) - React to movement inertia only
            dx -= localDelta.x * 4.0 * brushStrength;
            dy -= localDelta.y * 4.0 * brushStrength;
            dz -= localDelta.z * 4.0 * brushStrength;

            vx += (-20.0 * hairStiffness * dx - 4.0 * vx) * dt;
            vy += (-20.0 * hairStiffness * dy - 4.0 * vy) * dt;
            vz += (-20.0 * hairStiffness * dz - 4.0 * vz) * dt;

            dx += vx * dt;
            dy += vy * dt;
            dz += vz * dt;

            const maxHair = 0.15 * brushStrength;
            const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (len > maxHair && len > 0) {
              dx = (dx / len) * maxHair;
              dy = (dy / len) * maxHair;
              dz = (dz / len) * maxHair;
              vx *= -0.2;
              vy *= -0.2;
              vz *= -0.2;
            }

            disps[i * 3] = dx;
            disps[i * 3 + 1] = dy;
            disps[i * 3 + 2] = dz;
            vels[i * 3] = vx;
            vels[i * 3 + 1] = vy;
            vels[i * 3 + 2] = vz;

            offX = dx;
            offY = dy;
            offZ = dz;
          }
        } else if (type === 'jiggle') {
          // Spring-Damping (Hooke's Law)
          dx -= localDelta.x * 5.0 * brushStrength;
          dy -= localDelta.y * 5.0 * brushStrength;
          dz -= localDelta.z * 5.0 * brushStrength;

          let fExtX = 0, fExtY = 0, fExtZ = 0;
          if (testPose) {
            const t = animTime * 12.0;
            fExtX = Math.sin(t) * 0.2 * brushStrength;
            fExtY = Math.cos(t * 1.5) * 0.1 * brushStrength;
          }

          const ax = -jiggleElasticity * dx - jiggleDamping * vx + fExtX;
          const ay = -jiggleElasticity * dy - jiggleDamping * vy + fExtY;
          const az = -jiggleElasticity * dz - jiggleDamping * vz + fExtZ;

          vx += ax * dt;
          vy += ay * dt;
          vz += az * dt;

          dx += vx * dt;
          dy += vy * dt;
          dz += vz * dt;

          const maxJiggle = 0.2 * brushStrength;
          const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (len > maxJiggle && len > 0) {
            dx = (dx / len) * maxJiggle;
            dy = (dy / len) * maxJiggle;
            dz = (dz / len) * maxJiggle;
            vx *= -0.2;
            vy *= -0.2;
            vz *= -0.2;
          }

          disps[i * 3] = dx;
          disps[i * 3 + 1] = dy;
          disps[i * 3 + 2] = dz;
          vels[i * 3] = vx;
          vels[i * 3 + 1] = vy;
          vels[i * 3 + 2] = vz;

          offX = dx;
          offY = dy;
          offZ = dz;
        } else if (type === 'cloth') {
          // Cloth sag and wind simulation
          const tensionK = 25.0;
          const gravityY = -9.8 * clothGravity * brushStrength;

          // Apply local inertia delta
          dx -= localDelta.x * 2.0 * brushStrength;
          dy -= localDelta.y * 2.0 * brushStrength;
          dz -= localDelta.z * 2.0 * brushStrength;

          let windX = 0, windZ = 0;
          if (testPose && enableWind) {
            const t = animTime * 5.0;
            windX = Math.sin(t + frameDeformed.y * 2.0) * 1.0 * brushStrength;
            windZ = Math.cos(t * 0.8) * 0.8 * brushStrength;
          }

          const ax = -tensionK * dx - clothDrag * vx + windX;
          const ay = -tensionK * dy - clothDrag * vy + gravityY;
          const az = -tensionK * dz - clothDrag * vz + windZ;

          vx += ax * dt;
          vy += ay * dt;
          vz += az * dt;

          dx += vx * dt;
          dy += vy * dt;
          dz += vz * dt;

          const maxCloth = 0.35 * brushStrength;
          const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (len > maxCloth && len > 0) {
            dx = (dx / len) * maxCloth;
            dy = (dy / len) * maxCloth;
            dz = (dz / len) * maxCloth;
            vx *= -0.1;
            vy *= -0.1;
            vz *= -0.1;
          }

          disps[i * 3] = dx;
          disps[i * 3 + 1] = dy;
          disps[i * 3 + 2] = dz;
          vels[i * 3] = vx;
          vels[i * 3 + 1] = vy;
          vels[i * 3 + 2] = vz;

          offX = dx;
          offY = dy;
          offZ = dz;
        }

        // Apply deformation and displacement
        frameDeformed.x += offX;
        frameDeformed.y += offY;
        frameDeformed.z += offZ;

        // Convert deformed (root-local) to child-local coordinate space
        frameDeformed.applyMatrix4(frameRootToLocal);

        arr[i * 3] = frameDeformed.x;
        arr[i * 3 + 1] = frameDeformed.y;
        arr[i * 3 + 2] = frameDeformed.z;
        changed = true;
      }

      if (changed || hasSkel) {
        posAttr.needsUpdate = true;
        geo.computeVertexNormals();
      }
      globalIdx += posAttr.count;
    });
  });

  return (
    <Bvh firstHitOnly>
      <group
        ref={groupRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onPointerOver={handlePointerOver}
      >
        <primitive object={clone} />
        {skeletonHelper && <primitive object={skeletonHelper} />}

        {/* Visual Weight Color Overlay Point Cloud Overlay */}
        {activeTab === 'physics_paint' && allPositions.length > 0 && allPositions.length / 3 <= MAX_PAINT_VERTICES && (
          <points raycast={() => null}>
            <bufferGeometry ref={pointCloudGeoRef}>
              <bufferAttribute
                attach="attributes-position"
                count={allPositions.length / 3}
                array={allPositions}
                itemSize={3}
              />
              <bufferAttribute
                ref={colorAttribRef}
                attach="attributes-color"
                count={pointColors.length / 3}
                array={pointColors}
                itemSize={3}
              />
            </bufferGeometry>
            <pointsMaterial size={0.008} vertexColors sizeAttenuation depthTest={true} depthWrite={true} />
          </points>
        )}

        {/* 3D Brush Cursor Ring */}
        {activeTab === 'physics_paint' && (
          <mesh ref={brushCursorRef} visible={false} raycast={() => null}>
            <ringGeometry args={[(brushRadius - 0.015) * invScaleFactor, brushRadius * invScaleFactor, 32]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} side={THREE.DoubleSide} depthTest={false} />
          </mesh>
        )}
      </group>
    </Bvh>
  );
}

// Lightweight FBX loader with dynamic X-Ray material overlay, root local coordinate transformation, point cloud overlays, 3D brush cursor rendering, and pointer events for interactive physics paint mode
function MiniFbxModel({
  url,
  xRay,
  activeTab,
  brushPhysicsType,
  brushRadius,
  brushStrength,
  asset,
  updateObject,
  animTime,
  testPose,
  hairFrequency,
  hairStiffness,
  jiggleElasticity,
  jiggleDamping,
  clothGravity,
  clothDrag,
  enableWind,
  modelRef,
  joints,
  animatedJoints,
  isSkinBound,
  gizmoDraggingRef,
  onSkeletonDetected,
  onAnimationRigLoaded,
}: {
  url: string;
  xRay: boolean;
  activeTab: string;
  brushPhysicsType: 'rigid' | 'hair' | 'jiggle' | 'cloth';
  brushRadius: number;
  brushStrength: number;
  asset: any;
  updateObject: (id: string, updates: Partial<any>) => void;
  animTime: number;
  testPose: boolean;
  hairFrequency: number;
  hairStiffness: number;
  jiggleElasticity: number;
  jiggleDamping: number;
  clothGravity: number;
  clothDrag: number;
  enableWind: boolean;
  modelRef?: React.RefObject<THREE.Object3D | null>;
  joints: JointData[];
  animatedJoints: JointData[];
  isSkinBound: boolean;
  gizmoDraggingRef?: React.RefObject<boolean>;
  onSkeletonDetected?: (detected: boolean) => void;
  onAnimationRigLoaded?: (joints: JointData[]) => void;
}) {
  const fbx = useFBX(url);
  const invScaleFactor = useMemo(() => {
    const s = asset?.scale || [1, 1, 1];
    return 1 / s[0];
  }, [asset?.scale]);

  const clone = useMemo(() => {
    const cl = SkeletonUtils.clone(fbx);
    cl.updateMatrixWorld(true);

    // Compute combined bounding box of all meshes in local space of clone root
    const box = new THREE.Box3();
    let hasMeshes = false;
    cl.traverse((child: any) => {
      if (child.isMesh || child.isSkinnedMesh) {
        if (child.geometry) {
          child.geometry.computeBoundingBox();
          const childBox = child.geometry.boundingBox.clone();
          childBox.applyMatrix4(child.matrixWorld);
          box.union(childBox);
          hasMeshes = true;
        }
      }
    });

    if (hasMeshes) {
      const height = box.max.y - box.min.y;
      // If the model is tiny (height < 0.5) or extremely large (height > 3.0)
      if (height > 0 && (height < 0.5 || height > 3.0)) {
        const targetHeight = 1.75; // Standard human height in meters
        const scaleFactor = targetHeight / height;
        console.log(`[Auto-Scale FBX] Normalizing model height from ${height.toFixed(3)}m to ${targetHeight}m (scaleFactor: ${scaleFactor.toFixed(3)})`);
        
        cl.traverse((child: any) => {
          if ((child.isMesh || child.isSkinnedMesh) && child.geometry) {
            child.geometry = child.geometry.clone();
            child.geometry.scale(scaleFactor, scaleFactor, scaleFactor);
            child.geometry.computeBoundingBox();
          }
          if (child !== cl) {
            child.position.multiplyScalar(scaleFactor);
          }
        });
        cl.updateMatrixWorld(true);
      }
    }

    cl.traverse((child: any) => {
      if (child.isMesh || child.isSkinnedMesh) {
        child.frustumCulled = false;
      }
      if (child.isBone) {
        if (child.name === 'root' || child.name === 'AutoRig_Root' || child.name.toLowerCase().includes('root')) {
          child.scale.set(1, 1, 1);
        }
        if (child.name === 'pelvis' || child.name === 'AutoRig_Waist' || child.name.toLowerCase().includes('hips') || child.name.toLowerCase().includes('pelvis')) {
          child.matrixAutoUpdate = true;
        }
      }
    });
    return cl;
  }, [fbx, url]);

  // Dynamically apply X-Ray material properties on the existing clone
  useEffect(() => {
    if (!clone) return;
    clone.traverse((child: any) => {
      if (child.isMesh || child.isSkinnedMesh) {
        child.castShadow = !xRay;
        child.receiveShadow = !xRay;
        
        if (xRay) {
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = child.material;
          }
          child.material = child.userData.originalMaterial.clone();
          child.material.transparent = true;
          child.material.opacity = 0.25;
          child.material.depthWrite = false;
          child.material.wireframe = true;
        } else {
          if (child.userData.originalMaterial) {
            child.material = child.userData.originalMaterial;
          }
        }
      }
    });
  }, [clone, xRay]);

  // Detect if there is a skinned mesh (skeleton) in the loaded FBX model
  useEffect(() => {
    let hasSkinned = false;
    clone.traverse((child) => {
      if ((child as any).isSkinnedMesh) {
        hasSkinned = true;
      }
    });
    onSkeletonDetected?.(hasSkinned);
  }, [clone, onSkeletonDetected]);

  // Dispose old cloned GPU resources when clone is recreated or component unmounts
  useEffect(() => {
    return () => {
      disposeSceneGraph(clone);
    };
  }, [clone]);

  useEffect(() => {
    if (modelRef) {
      modelRef.current = clone;
    }
    return () => {
      if (modelRef && modelRef.current === clone) {
        modelRef.current = null;
      }
    };
  }, [clone, modelRef]);

  const {
    isAnimationActive,
    skeletonHelper,
    mixerRef,
    actionRef,
    boneMap,
    currentTime: storeTime,
    isPlaying: storeIsPlaying,
    setCurrentTime,
    isNativeClip,
    insymmetryEnabled,
    gaitAsymmetry,
    postureBias,
    dynamicVariance,
  } = useModelAnimation(clone, joints, activeTab, isSkinBound, gizmoDraggingRef, fbx.animations, onAnimationRigLoaded);

  const insymmetryBones = useMemo(() => {
    if (!boneMap) return null;
    
    const find = (names: string[]) => {
      for (const name of names) {
        if (boneMap.has(name)) return boneMap.get(name);
        for (const [key, val] of boneMap.entries()) {
          if (key.toLowerCase() === name.toLowerCase() || key.toLowerCase().includes(name.toLowerCase())) {
            return val;
          }
        }
      }
      return undefined;
    };

    return {
      pelvis: find(['AutoRig_Waist', 'hips', 'pelvis', 'mixamorigHips']),
      spine: find(['AutoRig_Spine', 'spine', 'mixamorigSpine']),
      chest: find(['AutoRig_Chest', 'chest', 'mixamorigChest', 'mixamorigSpine1', 'mixamorigSpine2']),
      head: find(['AutoRig_Head', 'head', 'mixamorigHead']),
      leftShoulder: find(['AutoRig_L_Shoulder', 'leftShoulder', 'mixamorigLeftShoulder']),
      rightShoulder: find(['AutoRig_R_Shoulder', 'rightShoulder', 'mixamorigRightShoulder']),
      rightHip: find(['AutoRig_R_Hip', 'rightUpLeg', 'mixamorigRightUpLeg']),
      rightKnee: find(['AutoRig_R_Knee', 'rightLeg', 'mixamorigRightLeg']),
    };
  }, [boneMap]);

  const groupRef = useRef<THREE.Group>(null);
  const brushCursorRef = useRef<THREE.Mesh>(null);
  const localPaintedPhysicsRef = useRef<Record<number, string>>({});
  const isDraggingRef = useRef(false);
  const colorAttribRef = useRef<THREE.BufferAttribute>(null);
  const lastPaintTimeRef = useRef<number>(0);
  const cachedInverseMatrixRef = useRef<THREE.Matrix4>(new THREE.Matrix4());
  const pointCloudGeoRef = useRef<THREE.BufferGeometry>(null);
  const rafPendingRef = useRef(false);
  const pendingPointerEventRef = useRef<any>(null);

  // Dispose point cloud geometry on unmount to prevent GPU leak
  useEffect(() => {
    return () => {
      pointCloudGeoRef.current?.dispose();
    };
  }, []);

  // Reset first frame tracking when url changes
  useEffect(() => {
    firstFrameRef.current = true;
  }, [url]);

  useEffect(() => {
    if (!isDraggingRef.current) {
      localPaintedPhysicsRef.current = { ...(asset.paintedPhysics || {}) };
    }
  }, [asset.paintedPhysics]);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        updateObject(asset.id, { paintedPhysics: { ...localPaintedPhysicsRef.current } });
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, [asset.id, updateObject]);

  // Extract all vertex positions in local space of clone root and build a 3D spatial hash grid
  const { allPositions, spatialHash, cellSize, bounds } = useMemo(() => {
    const positions: number[] = [];
    clone.updateMatrixWorld(true);
    
    let bonesParent: THREE.Object3D = clone;
    clone.traverse((child) => {
      if (bonesParent === clone && ((child as any).isMesh || (child as any).isSkinnedMesh) && child !== clone) {
        if (child.parent && child.parent !== clone) {
          bonesParent = child.parent;
        }
      }
    });

    const inverseRootMatrix = bonesParent.matrixWorld.clone().invert();

    clone.traverse((child: any) => {
      if (child.isMesh) {
        const geo = child.geometry;
        const posAttr = geo.getAttribute('position');
        if (posAttr) {
          const localToRoot = child.matrixWorld.clone().premultiply(inverseRootMatrix);
          const v = new THREE.Vector3();
          for (let i = 0; i < posAttr.count; i++) {
            v.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i));
            v.applyMatrix4(localToRoot);
            positions.push(v.x, v.y, v.z);
          }
        }
      }
    });

    const posArray = new Float32Array(positions);
    const count = posArray.length / 3;
    const cellSize = 0.2;
    const grid = new Map<number, number[]>();

    let minCx = Infinity, maxCx = -Infinity;
    let minCy = Infinity, maxCy = -Infinity;
    let minCz = Infinity, maxCz = -Infinity;

    for (let i = 0; i < count; i++) {
      const px = posArray[i * 3];
      const py = posArray[i * 3 + 1];
      const pz = posArray[i * 3 + 2];

      const cx = Math.floor(px / cellSize);
      const cy = Math.floor(py / cellSize);
      const cz = Math.floor(pz / cellSize);

      if (cx < minCx) minCx = cx;
      if (cx > maxCx) maxCx = cx;
      if (cy < minCy) minCy = cy;
      if (cy > maxCy) maxCy = cy;
      if (cz < minCz) minCz = cz;
      if (cz > maxCz) maxCz = cz;

      const key = ((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) >>> 0;
      let cell = grid.get(key);
      if (!cell) {
        cell = [];
        grid.set(key, cell);
      }
      cell.push(i);
    }

    return {
      allPositions: posArray,
      spatialHash: grid,
      cellSize,
      bounds: { minCx, maxCx, minCy, maxCy, minCz, maxCz },
    };
  }, [clone]);

  // Compute bind poses (joint positions when bind pose is defined)
  const bindPoses = useMemo(() => {
    return joints.map((j) => ({
      id: j.id,
      position: new THREE.Vector3(...j.position),
    }));
  }, [joints]);

  const cachedSkinningInfluencesRef = useRef<any[] | null>(null);
  const cachedSkelHashRef = useRef<string>('');

  useEffect(() => {
    if (!isSkinBound) {
      cachedSkinningInfluencesRef.current = null;
      cachedSkelHashRef.current = '';
    }
  }, [isSkinBound]);

  // Precompute nearest joint influences and weights for linear blend skinning once
  const skinningInfluences = useMemo(() => {
    const skelHash = joints.map(j => `${j.id}:${j.position.join(',')}`).join('|');
    if (isSkinBound && cachedSkinningInfluencesRef.current && skelHash === cachedSkelHashRef.current) {
      return cachedSkinningInfluencesRef.current;
    }

    const influences: Array<{
      j0Id: string;
      j1Id: string;
      w0: number;
      w1: number;
      bindPos0: THREE.Vector3;
      bindPos1: THREE.Vector3;
    }> = [];

    const hasSkel = !isNativeClip && isSkinBound && joints && joints.length > 0 && bindPoses.length > 0;
    if (!hasSkel) return influences;

    const tempV = new THREE.Vector3();
    const count = allPositions.length / 3;

    for (let i = 0; i < count; i++) {
      tempV.set(
        allPositions[i * 3],
        allPositions[i * 3 + 1],
        allPositions[i * 3 + 2]
      );

      // Find closest 2 joints in bind pose
      let firstJoint = bindPoses[0];
      let firstDistSq = firstJoint.position.distanceToSquared(tempV);
      let secondJoint = bindPoses[1] || bindPoses[0];
      let secondDistSq = bindPoses[1] ? secondJoint.position.distanceToSquared(tempV) : firstDistSq;

      if (firstDistSq > secondDistSq) {
        const tmpJ = firstJoint; firstJoint = secondJoint; secondJoint = tmpJ;
        const tmpDSq = firstDistSq; firstDistSq = secondDistSq; secondDistSq = tmpDSq;
      }

      for (let j = 2; j < bindPoses.length; j++) {
        const bp = bindPoses[j];
        const distSq = bp.position.distanceToSquared(tempV);
        if (distSq < firstDistSq) {
          secondJoint = firstJoint;
          secondDistSq = firstDistSq;
          firstJoint = bp;
          firstDistSq = distSq;
        } else if (distSq < secondDistSq) {
          secondJoint = bp;
          secondDistSq = distSq;
        }
      }

      const firstDist = Math.sqrt(firstDistSq);
      const secondDist = Math.sqrt(secondDistSq);
      const totalDist = firstDist + secondDist;
      const w0 = totalDist > 0 ? 1 - firstDist / totalDist : 1.0;
      const w1 = 1.0 - w0;

      influences.push({
        j0Id: firstJoint.id,
        j1Id: secondJoint.id,
        w0,
        w1,
        bindPos0: firstJoint.position,
        bindPos1: secondJoint.position,
      });
    }

    cachedSkinningInfluencesRef.current = influences;
    cachedSkelHashRef.current = skelHash;
    return influences;
  }, [allPositions, bindPoses, joints, isSkinBound]);

  // Precalculate proper Inverse Bind Matrices to prevent mesh crumpling
  const inverseBindMatrices = useMemo(() => {
    const map = new Map<string, THREE.Matrix4>();
    if (!isSkinBound || joints.length === 0 || !clone) return map;

    // 1. Get the actual bone objects in the scene graph corresponding to joints
    const bonesWithIds = joints.map(j => {
      const bone = boneMap.get(j.name);
      return { id: j.id, bone };
    }).filter((x): x is { id: string; bone: THREE.Object3D } => x.bone !== undefined);

    if (bonesWithIds.length === 0) return map;

    // 2. Find bonesParent (the parent space of the bones and meshes)
    let bonesParent: THREE.Object3D = clone;
    clone.traverse((child) => {
      if (bonesParent === clone && ((child as any).isMesh || (child as any).isSkinnedMesh) && child !== clone) {
        if (child.parent && child.parent !== clone) {
          bonesParent = child.parent;
        }
      }
    });

    // 3. Save current dynamic posing rotations
    const savedRotations = bonesWithIds.map(x => x.bone.rotation.clone());

    // 4. Force rest pose identity (0, 0, 0)
    bonesWithIds.forEach(x => {
      x.bone.rotation.set(0, 0, 0);
    });

    // 5. Update the scene graph matrices hierarchically from the root
    clone.updateMatrixWorld(true);

    // 6. Compute clean inverse bind matrices relative to bonesParent
    const parentInv = new THREE.Matrix4().copy(bonesParent.matrixWorld).invert();
    bonesWithIds.forEach(x => {
      const relativeMatrix = parentInv.clone().multiply(x.bone.matrixWorld);
      map.set(x.id, relativeMatrix.invert());
    });

    // 7. Restore dynamic posed rotations
    bonesWithIds.forEach((x, index) => {
      x.bone.rotation.copy(savedRotations[index]);
    });

    // 8. Re-update matrix world to restore posed state for rendering
    clone.updateMatrixWorld(true);

    return map;
  }, [clone, joints, isSkinBound, boneMap]);

  // Map painted physics type to vertex point colors
  const pointColors = useMemo(() => {
    const colors = new Float32Array(allPositions.length);
    const painted = asset.paintedPhysics || {};
    for (let i = 0; i < allPositions.length / 3; i++) {
      const type = painted[i] || 'rigid';
      let r = 0.2, g = 0.6, b = 1.0; // Rigid default blue
      if (type === 'hair') {
        r = 1.0; g = 0.1; b = 0.8; // Magenta hair
      } else if (type === 'jiggle') {
        r = 1.0; g = 0.7; b = 0.0; // Amber jiggle
      } else if (type === 'cloth') {
        r = 0.1; g = 0.8; b = 0.4; // Emerald cloth
      }
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    return colors;
  }, [asset.paintedPhysics, allPositions]);

  const paintAtPoint = useCallback((intersectPoint: THREE.Vector3) => {
    if (!asset || !intersectPoint) return;

    const localIntersectPoint = intersectPoint.clone().applyMatrix4(cachedInverseMatrixRef.current);
    const localBrushRadius = brushRadius * invScaleFactor;
    const localBrushRadiusSq = localBrushRadius * localBrushRadius;
    const count = allPositions.length / 3;

    // Determine the range of cell coordinates overlapping the brush sphere, clamped to model boundaries
    const startCx = Math.max(bounds.minCx, Math.floor((localIntersectPoint.x - localBrushRadius) / cellSize));
    const endCx = Math.min(bounds.maxCx, Math.floor((localIntersectPoint.x + localBrushRadius) / cellSize));
    const startCy = Math.max(bounds.minCy, Math.floor((localIntersectPoint.y - localBrushRadius) / cellSize));
    const endCy = Math.min(bounds.maxCy, Math.floor((localIntersectPoint.y + localBrushRadius) / cellSize));
    const startCz = Math.max(bounds.minCz, Math.floor((localIntersectPoint.z - localBrushRadius) / cellSize));
    const endCz = Math.min(bounds.maxCz, Math.floor((localIntersectPoint.z + localBrushRadius) / cellSize));

    let changed = false;

    // Safety check: if the grid search volume is too large, fallback to a fast linear array scan.
    const rangeX = (endCx - startCx + 1);
    const rangeY = (endCy - startCy + 1);
    const rangeZ = (endCz - startCz + 1);
    const volume = (rangeX > 0 ? rangeX : 0) * (rangeY > 0 ? rangeY : 0) * (rangeZ > 0 ? rangeZ : 0);

    if (volume === 0) return;

    if (volume > count) {
      // Linear scan fallback
      for (let i = 0; i < count; i++) {
        const px = allPositions[i * 3];
        const py = allPositions[i * 3 + 1];
        const pz = allPositions[i * 3 + 2];

        const dx = px - localIntersectPoint.x;
        const dy = py - localIntersectPoint.y;
        const dz = pz - localIntersectPoint.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq <= localBrushRadiusSq) {
          const currentType = localPaintedPhysicsRef.current[i] || 'rigid';
          if (currentType !== brushPhysicsType) {
            localPaintedPhysicsRef.current[i] = brushPhysicsType;
            changed = true;

            if (colorAttribRef.current) {
              const colorsArray = colorAttribRef.current.array as Float32Array;
              let r = 0.2, g = 0.6, b = 1.0;
              if (brushPhysicsType === 'hair') {
                r = 1.0; g = 0.1; b = 0.8;
              } else if (brushPhysicsType === 'jiggle') {
                r = 1.0; g = 0.7; b = 0.0;
              } else if (brushPhysicsType === 'cloth') {
                r = 0.1; g = 0.8; b = 0.4;
              }
              colorsArray[i * 3] = r;
              colorsArray[i * 3 + 1] = g;
              colorsArray[i * 3 + 2] = b;
            }
          }
        }
      }
    } else {
      // Spatial hash lookup
      for (let cx = startCx; cx <= endCx; cx++) {
        for (let cy = startCy; cy <= endCy; cy++) {
          for (let cz = startCz; cz <= endCz; cz++) {
            const key = ((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) >>> 0;
            const cellIndices = spatialHash.get(key);
            if (cellIndices) {
              for (let k = 0; k < cellIndices.length; k++) {
                const i = cellIndices[k];
                const px = allPositions[i * 3];
                const py = allPositions[i * 3 + 1];
                const pz = allPositions[i * 3 + 2];

                const dx = px - localIntersectPoint.x;
                const dy = py - localIntersectPoint.y;
                const dz = pz - localIntersectPoint.z;
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq <= localBrushRadiusSq) {
                  const currentType = localPaintedPhysicsRef.current[i] || 'rigid';
                  if (currentType !== brushPhysicsType) {
                    localPaintedPhysicsRef.current[i] = brushPhysicsType;
                    changed = true;

                    if (colorAttribRef.current) {
                      const colorsArray = colorAttribRef.current.array as Float32Array;
                      let r = 0.2, g = 0.6, b = 1.0;
                      if (brushPhysicsType === 'hair') {
                        r = 1.0; g = 0.1; b = 0.8;
                      } else if (brushPhysicsType === 'jiggle') {
                        r = 1.0; g = 0.7; b = 0.0;
                      } else if (brushPhysicsType === 'cloth') {
                        r = 0.1; g = 0.8; b = 0.4;
                      }
                      colorsArray[i * 3] = r;
                      colorsArray[i * 3 + 1] = g;
                      colorsArray[i * 3 + 2] = b;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    if (changed && colorAttribRef.current) {
      colorAttribRef.current.needsUpdate = true;
    }
  }, [asset, brushRadius, invScaleFactor, bounds, cellSize, spatialHash, brushPhysicsType, allPositions]);

  const handlePointerDown = (e: any) => {
    if (activeTab !== 'physics_paint' || !asset || !e.point) return;
    e.stopPropagation();
    isDraggingRef.current = true;

    // Cache matrix once on pointer down
    clone.updateMatrixWorld(true);
    cachedInverseMatrixRef.current.copy(clone.matrixWorld).invert();

    paintAtPoint(e.point);
  };

  const processPointerMove = useCallback((e: any) => {
    rafPendingRef.current = false;
    if (!e || !e.point || !groupRef.current) return;

    groupRef.current.updateMatrixWorld(true);
    const inverseGroupMatrix = new THREE.Matrix4().copy(groupRef.current.matrixWorld).invert();

    if (brushCursorRef.current) {
      const localPoint = e.point.clone().applyMatrix4(inverseGroupMatrix);
      brushCursorRef.current.position.copy(localPoint);

      if (e.face && e.object) {
        const worldNormal = e.face.normal.clone().transformDirection(e.object.matrixWorld);
        const worldQuat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          worldNormal
        );
        const parentWorldQuat = new THREE.Quaternion();
        groupRef.current.getWorldQuaternion(parentWorldQuat);
        brushCursorRef.current.quaternion.copy(worldQuat).premultiply(parentWorldQuat.invert());
      }
    }

    if (e.buttons === 1 && isDraggingRef.current) {
      const now = performance.now();
      if (now - lastPaintTimeRef.current > 16) {
        paintAtPoint(e.point);
        lastPaintTimeRef.current = now;
      }
    }
  }, [paintAtPoint]);

  const handlePointerMove = (e: any) => {
    if (activeTab !== 'physics_paint' || !asset || !e.point) return;
    e.stopPropagation();

    // Safely extract event parameters synchronously to avoid issues with pooled React/R3F events inside RAF
    const point = e.point ? e.point.clone() : null;
    const buttons = e.buttons;
    const face = e.face ? { normal: e.face.normal.clone() } : null;
    const object = e.object;

    pendingPointerEventRef.current = { point, buttons, face, object };
    if (!rafPendingRef.current) {
      rafPendingRef.current = true;
      requestAnimationFrame(() => processPointerMove(pendingPointerEventRef.current));
    }
  };

  const handlePointerOut = () => {
    if (brushCursorRef.current) brushCursorRef.current.visible = false;
  };

  const handlePointerOver = () => {
    if (brushCursorRef.current && activeTab === 'physics_paint') {
      clone.updateMatrixWorld(true);
      cachedInverseMatrixRef.current.copy(clone.matrixWorld).invert();
      brushCursorRef.current.visible = true;
    }
  };

  // Preallocate reusable math structures for useFrame to achieve 0 allocations per frame
  const frameV = useMemo(() => new THREE.Vector3(), []);
  const frameDeformed = useMemo(() => new THREE.Vector3(), []);
  const frameVOffset0 = useMemo(() => new THREE.Vector3(), []);
  const frameVOffset1 = useMemo(() => new THREE.Vector3(), []);
  const frameP0 = useMemo(() => new THREE.Vector3(), []);
  const frameP1 = useMemo(() => new THREE.Vector3(), []);
  const curWorldPos = useMemo(() => new THREE.Vector3(), []);
  const worldDelta = useMemo(() => new THREE.Vector3(), []);
  const localDelta = useMemo(() => new THREE.Vector3(), []);

  // Preallocate active joints map cache to avoid per-vertex searches
  const jointMatrices = useMemo(() => new Map<string, THREE.Matrix4>(), []);
  const tempEuler = useMemo(() => new THREE.Euler(), []);

  // Root to child space transformations
  const frameRootToLocal = useMemo(() => new THREE.Matrix4(), []);
  const frameCloneInv = useMemo(() => new THREE.Matrix4(), []);
  const frameLocalToRoot = useMemo(() => new THREE.Matrix4(), []);

  // Physics simulation: apply hair/jiggle/cloth displacement to FBX meshes via recursive traversal
  // Store original per-child-mesh positions so we can write absolute values (original + offset) each frame
  const origChildPositionsRef = useRef<Map<THREE.BufferGeometry, Float32Array>>(new Map());
  const childVelocitiesRef = useRef<Map<THREE.BufferGeometry, Float32Array>>(new Map());
  const childDisplacementsRef = useRef<Map<THREE.BufferGeometry, Float32Array>>(new Map());
  const prevWorldPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const firstFrameRef = useRef<boolean>(true);
  const lastSkelHashRef = useRef('');
  const lastSkinBoundRef = useRef(false);
  const lastInsymmetryEnabledRef = useRef(false);
  const lastGaitAsymmetryRef = useRef(0);
  const lastPostureBiasRef = useRef(0);
  const lastDynamicVarianceRef = useRef(0);

  useFrame((state, delta) => {
    if (!clone) return;

    // Fallback: if no skeleton bone joints are defined, we just use bind original positions
    const hasSkel = !isNativeClip && isSkinBound && joints && joints.length > 0 && animatedJoints.length > 0 && skinningInfluences.length > 0;

    let hasPaintedPhysics = false;
    if (localPaintedPhysicsRef.current) {
      for (const _ in localPaintedPhysicsRef.current) {
        hasPaintedPhysics = true;
        break;
      }
    }
    // Allow animation mixer to run even without a skin-bound skeleton
    if (!hasSkel && !hasPaintedPhysics && !isAnimationActive) return;

    // Calculate world position changes (for inertia tracking)
    clone.getWorldPosition(curWorldPos);

    worldDelta.set(0, 0, 0);
    if (!firstFrameRef.current) {
      worldDelta.copy(curWorldPos).sub(prevWorldPosRef.current);
    }
    const worldPosChanged = worldDelta.lengthSq() > 0.00001;

    // Change detection for early exit
    const skelHash = getSkelHash(joints);
    const skelChanged = skelHash !== lastSkelHashRef.current;
    const skinBoundChanged = isSkinBound !== lastSkinBoundRef.current;

    const insymmetryChanged = insymmetryEnabled !== lastInsymmetryEnabledRef.current ||
      gaitAsymmetry !== lastGaitAsymmetryRef.current ||
      postureBias !== lastPostureBiasRef.current ||
      dynamicVariance !== lastDynamicVarianceRef.current;

    lastInsymmetryEnabledRef.current = insymmetryEnabled;
    lastGaitAsymmetryRef.current = gaitAsymmetry;
    lastPostureBiasRef.current = postureBias;
    lastDynamicVarianceRef.current = dynamicVariance;

    const needsUpdate = testPose || isAnimationActive || skelChanged || skinBoundChanged || worldPosChanged || insymmetryChanged || firstFrameRef.current;

    if (!needsUpdate) {
      prevWorldPosRef.current.copy(curWorldPos);
      lastSkelHashRef.current = skelHash;
      lastSkinBoundRef.current = isSkinBound;
      return;
    }

    if (firstFrameRef.current) {
      firstFrameRef.current = false;
    }
    prevWorldPosRef.current.copy(curWorldPos);
    lastSkelHashRef.current = skelHash;
    lastSkinBoundRef.current = isSkinBound;

    // Calculate time step
    const dt = Math.max(0.001, Math.min(delta, 0.03));

    // Update animation mixer if active
    if (isAnimationActive && mixerRef.current && actionRef.current) {
      if (!isNativeClip) {
        ensureBoneHierarchy(clone, joints, isSkinBound);
      }
      const mixer = mixerRef.current;
      const action = actionRef.current;

      // Reset rotations of these bones to their base store rotations
      // to prevent stale offsets from persisting (e.g. on non-animated channels)
      if (insymmetryBones) {
        const { pelvis, spine, chest, head, leftShoulder, rightShoulder, rightHip, rightKnee } = insymmetryBones;
        const affectedBones = [pelvis, spine, chest, head, leftShoulder, rightShoulder, rightHip, rightKnee];
        for (const bone of affectedBones) {
          if (bone) {
            const joint = joints.find(j => j.name === bone.name);
            if (joint) {
              bone.rotation.set(
                THREE.MathUtils.degToRad(joint.rotation[0]),
                THREE.MathUtils.degToRad(joint.rotation[1]),
                THREE.MathUtils.degToRad(joint.rotation[2])
              );
            } else {
              bone.rotation.set(0, 0, 0);
            }
          }
        }
      }

      if (storeIsPlaying && !action.paused) {
        mixer.update(dt);
        setCurrentTime(action.time);
      } else {
        action.time = storeTime;
        mixer.update(0);
      }

      if (insymmetryEnabled && insymmetryBones) {
        const { pelvis, spine, chest, head, leftShoulder, rightShoulder, rightHip, rightKnee } = insymmetryBones;

        if (gaitAsymmetry > 0) {
          const limpScale = 1.0 - gaitAsymmetry * 0.6;
          if (rightKnee) rightKnee.rotation.x *= limpScale;
          if (rightHip) rightHip.rotation.x *= limpScale;
        }

        if (Math.abs(postureBias) > 0.01) {
          const leanAngle = postureBias * 0.15;
          if (pelvis) pelvis.rotation.z += leanAngle * 0.4;
          if (spine) spine.rotation.z += leanAngle * 0.7;
          if (chest) chest.rotation.z += leanAngle * 0.5;
          if (leftShoulder) leftShoulder.rotation.z += leanAngle * 0.4;
          if (rightShoulder) rightShoulder.rotation.z += leanAngle * 0.4;
        }

        if (dynamicVariance > 0.01) {
          const tVal = action.time;
          const swaggerScale = dynamicVariance * 0.12;
          const noiseX = Math.sin(tVal * 1.5) * 0.6 + Math.sin(tVal * 0.7) * 0.4;
          const noiseY = Math.cos(tVal * 1.2) * 0.6 + Math.cos(tVal * 0.5) * 0.4;
          const noiseZ = Math.sin(tVal * 0.9) * 0.6 + Math.cos(tVal * 0.4) * 0.4;

          if (pelvis) {
            pelvis.rotation.x += noiseX * swaggerScale;
            pelvis.rotation.y += noiseY * swaggerScale * 1.2;
            pelvis.rotation.z += noiseZ * swaggerScale * 0.8;
          }
          if (head) {
            head.rotation.x += noiseZ * swaggerScale * 0.5;
            head.rotation.y += noiseX * swaggerScale * 0.9;
            head.rotation.z += noiseY * swaggerScale * 0.4;
          }
        }
      }

      clone.updateMatrixWorld(true);
    }

    // Bypass CPU vertex deformation if native clip playback is active and no physics is painted
    if (isNativeClip && !hasPaintedPhysics) {
      return;
    }

    let bonesParent: THREE.Object3D = clone;
    clone.traverse((child) => {
      if (bonesParent === clone && ((child as any).isMesh || (child as any).isSkinnedMesh) && child !== clone) {
        if (child.parent && child.parent !== clone) {
          bonesParent = child.parent;
        }
      }
    });

    frameCloneInv.copy(bonesParent.matrixWorld).invert();

    localDelta.set(0, 0, 0);
    if (worldDelta.lengthSq() > 0.00001) {
      localDelta.copy(worldDelta).transformDirection(frameCloneInv);
    }

    // 1. Precalculate current joint matrices once per frame
    if (hasSkel) {
      jointMatrices.clear();
      for (let k = 0; k < animatedJoints.length; k++) {
        const cur = animatedJoints[k];
        let mat = jointMatrices.get(cur.id);
        if (!mat) {
          mat = new THREE.Matrix4();
          jointMatrices.set(cur.id, mat);
        }

        const bone = boneMap.get(cur.name);
        if (bone) {
          bone.updateMatrixWorld(true);
          mat.copy(frameCloneInv).multiply(bone.matrixWorld);
        } else {
          mat.identity();
        }
      }
    }

    // Walk through child meshes and apply deforms
    let globalIdx = 0;
    clone.traverse((child: any) => {
      if (!(child.isMesh || child.isSkinnedMesh)) return;
      const geo = child.geometry;
      const posAttr = geo?.getAttribute('position');
      if (!posAttr) return;

      // Snapshot original child-local positions on first encounter
      if (!origChildPositionsRef.current.has(geo)) {
        origChildPositionsRef.current.set(geo, new Float32Array(posAttr.array));
      }
      if (!childVelocitiesRef.current.has(geo)) {
        childVelocitiesRef.current.set(geo, new Float32Array(posAttr.count * 3));
      }
      if (!childDisplacementsRef.current.has(geo)) {
        childDisplacementsRef.current.set(geo, new Float32Array(posAttr.count * 3));
      }

      const origArr = origChildPositionsRef.current.get(geo)!;
      const vels = childVelocitiesRef.current.get(geo)!;
      const disps = childDisplacementsRef.current.get(geo)!;
      const arr = posAttr.array as Float32Array;
      let changed = false;

      // Compute inverse child-local to clone-root matrix mapping
      child.updateMatrixWorld(true);
      frameLocalToRoot.copy(child.matrixWorld).premultiply(frameCloneInv);
      frameRootToLocal.copy(frameLocalToRoot).invert();

      for (let i = 0; i < posAttr.count; i++) {
        const gi = globalIdx + i;
        const type = (localPaintedPhysicsRef.current && localPaintedPhysicsRef.current[gi]) || 'rigid';

        // OPTIMIZATION: Skip rigid static vertices completely to avoid CPU freeze
        if (!hasSkel && type === 'rigid') {
          continue;
        }

        const origX = allPositions[gi * 3];
        const origY = allPositions[gi * 3 + 1];
        const origZ = allPositions[gi * 3 + 2];
        frameV.set(origX, origY, origZ);

        // Calculate base position (skinned to skeleton or static bind)
        if (hasSkel) {
          const influence = skinningInfluences[gi];
          if (influence) {
            const m0 = jointMatrices.get(influence.j0Id);
            const m1 = jointMatrices.get(influence.j1Id);
            const inv0 = inverseBindMatrices.get(influence.j0Id);
            const inv1 = inverseBindMatrices.get(influence.j1Id);

            if (m0 && m1 && inv0 && inv1) {
              // Joint 0 contribution: Model Space -> Bone Local Space -> Animated World Space
              frameVOffset0.copy(frameV).applyMatrix4(inv0).applyMatrix4(m0);
              
              // Joint 1 contribution
              frameVOffset1.copy(frameV).applyMatrix4(inv1).applyMatrix4(m1);

              frameDeformed.set(0, 0, 0);
              frameDeformed.addScaledVector(frameVOffset0, influence.w0);
              frameDeformed.addScaledVector(frameVOffset1, influence.w1);
            } else {
              frameDeformed.copy(frameV);
            }
          } else {
            frameDeformed.copy(frameV);
          }
        } else {
          frameDeformed.copy(frameV);
        }

        const ox = origArr[i * 3];
        const oy = origArr[i * 3 + 1];
        const oz = origArr[i * 3 + 2];

        if (!testPose || type === 'rigid') {
          disps[i * 3] = 0;
          disps[i * 3 + 1] = 0;
          disps[i * 3 + 2] = 0;
          vels[i * 3] = 0;
          vels[i * 3 + 1] = 0;
          vels[i * 3 + 2] = 0;

          // Convert deformed (root-local) to child-local coordinate space
          frameDeformed.applyMatrix4(frameRootToLocal);

          if (arr[i * 3] !== frameDeformed.x || arr[i * 3 + 1] !== frameDeformed.y || arr[i * 3 + 2] !== frameDeformed.z) {
            arr[i * 3] = frameDeformed.x;
            arr[i * 3 + 1] = frameDeformed.y;
            arr[i * 3 + 2] = frameDeformed.z;
            changed = true;
          }
          continue;
        }

        // Retrieve current displacement & velocity
        let dx = disps[i * 3];
        let dy = disps[i * 3 + 1];
        let dz = disps[i * 3 + 2];

        let vx = vels[i * 3];
        let vy = vels[i * 3 + 1];
        let vz = vels[i * 3 + 2];

        let offX = 0, offY = 0, offZ = 0;

        if (type === 'hair') {
          if (enableWind) {
            // Trigonometric Wind Sway + Inertia
            const t = animTime * hairFrequency;
            const amplitude = (1.0 - hairStiffness) * 0.1 * brushStrength;
            offX = Math.sin(t + frameDeformed.y * 3.0) * amplitude;
            offZ = Math.cos(t + frameDeformed.y * 3.0) * amplitude;

            dx -= localDelta.x * 2.0 * brushStrength;
            dy -= localDelta.y * 2.0 * brushStrength;
            dz -= localDelta.z * 2.0 * brushStrength;

            dx += (offX - dx) * dt * 5.0;
            dy += (offY - dy) * dt * 5.0;
            dz += (offZ - dz) * dt * 5.0;

            disps[i * 3] = dx;
            disps[i * 3 + 1] = dy;
            disps[i * 3 + 2] = dz;
          } else {
            // Plain physics (no wind) - React to movement inertia only
            dx -= localDelta.x * 4.0 * brushStrength;
            dy -= localDelta.y * 4.0 * brushStrength;
            dz -= localDelta.z * 4.0 * brushStrength;

            vx += (-20.0 * hairStiffness * dx - 4.0 * vx) * dt;
            vy += (-20.0 * hairStiffness * dy - 4.0 * vy) * dt;
            vz += (-20.0 * hairStiffness * dz - 4.0 * vz) * dt;

            dx += vx * dt;
            dy += vy * dt;
            dz += vz * dt;

            const maxHair = 0.15 * brushStrength;
            const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (len > maxHair && len > 0) {
              dx = (dx / len) * maxHair;
              dy = (dy / len) * maxHair;
              dz = (dz / len) * maxHair;
              vx *= -0.2;
              vy *= -0.2;
              vz *= -0.2;
            }

            disps[i * 3] = dx;
            disps[i * 3 + 1] = dy;
            disps[i * 3 + 2] = dz;
            vels[i * 3] = vx;
            vels[i * 3 + 1] = vy;
            vels[i * 3 + 2] = vz;

            offX = dx;
            offY = dy;
            offZ = dz;
          }
        } else if (type === 'jiggle') {
          // Spring-Damping (Hooke's Law)
          dx -= localDelta.x * 5.0 * brushStrength;
          dy -= localDelta.y * 5.0 * brushStrength;
          dz -= localDelta.z * 5.0 * brushStrength;

          let fExtX = 0, fExtY = 0, fExtZ = 0;
          if (testPose) {
            const t = animTime * 12.0;
            fExtX = Math.sin(t) * 0.2 * brushStrength;
            fExtY = Math.cos(t * 1.5) * 0.1 * brushStrength;
          }

          const ax = -jiggleElasticity * dx - jiggleDamping * vx + fExtX;
          const ay = -jiggleElasticity * dy - jiggleDamping * vy + fExtY;
          const az = -jiggleElasticity * dz - jiggleDamping * vz + fExtZ;

          vx += ax * dt;
          vy += ay * dt;
          vz += az * dt;

          dx += vx * dt;
          dy += vy * dt;
          dz += vz * dt;

          const maxJiggle = 0.2 * brushStrength;
          const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (len > maxJiggle && len > 0) {
            dx = (dx / len) * maxJiggle;
            dy = (dy / len) * maxJiggle;
            dz = (dz / len) * maxJiggle;
            vx *= -0.2;
            vy *= -0.2;
            vz *= -0.2;
          }

          disps[i * 3] = dx;
          disps[i * 3 + 1] = dy;
          disps[i * 3 + 2] = dz;
          vels[i * 3] = vx;
          vels[i * 3 + 1] = vy;
          vels[i * 3 + 2] = vz;

          offX = dx;
          offY = dy;
          offZ = dz;
        } else if (type === 'cloth') {
          // Cloth sag and wind simulation
          const tensionK = 25.0;
          const gravityY = -9.8 * clothGravity * brushStrength;

          // Apply local inertia delta
          dx -= localDelta.x * 2.0 * brushStrength;
          dy -= localDelta.y * 2.0 * brushStrength;
          dz -= localDelta.z * 2.0 * brushStrength;

          let windX = 0, windZ = 0;
          if (testPose && enableWind) {
            const t = animTime * 5.0;
            windX = Math.sin(t + frameDeformed.y * 2.0) * 1.0 * brushStrength;
            windZ = Math.cos(t * 0.8) * 0.8 * brushStrength;
          }

          const ax = -tensionK * dx - clothDrag * vx + windX;
          const ay = -tensionK * dy - clothDrag * vy + gravityY;
          const az = -tensionK * dz - clothDrag * vz + windZ;

          vx += ax * dt;
          vy += ay * dt;
          vz += az * dt;

          dx += vx * dt;
          dy += vy * dt;
          dz += vz * dt;

          const maxCloth = 0.35 * brushStrength;
          const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (len > maxCloth && len > 0) {
            dx = (dx / len) * maxCloth;
            dy = (dy / len) * maxCloth;
            dz = (dz / len) * maxCloth;
            vx *= -0.1;
            vy *= -0.1;
            vz *= -0.1;
          }

          disps[i * 3] = dx;
          disps[i * 3 + 1] = dy;
          disps[i * 3 + 2] = dz;
          vels[i * 3] = vx;
          vels[i * 3 + 1] = vy;
          vels[i * 3 + 2] = vz;

          offX = dx;
          offY = dy;
          offZ = dz;
        }

        // Apply deformation and displacement
        frameDeformed.x += offX;
        frameDeformed.y += offY;
        frameDeformed.z += offZ;

        // Convert deformed (root-local) to child-local coordinate space
        frameDeformed.applyMatrix4(frameRootToLocal);

        arr[i * 3] = frameDeformed.x;
        arr[i * 3 + 1] = frameDeformed.y;
        arr[i * 3 + 2] = frameDeformed.z;
        changed = true;
      }

      if (changed || hasSkel) {
        posAttr.needsUpdate = true;
        geo.computeVertexNormals();
      }
      globalIdx += posAttr.count;
    });
  });

  return (
    <Bvh firstHitOnly>
      <group
        ref={groupRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onPointerOver={handlePointerOver}
      >
        <primitive object={clone} />
        {skeletonHelper && <primitive object={skeletonHelper} />}

        {/* Visual Weight Color Overlay Point Cloud Overlay */}
        {activeTab === 'physics_paint' && allPositions.length > 0 && allPositions.length / 3 <= MAX_PAINT_VERTICES && (
          <points raycast={() => null}>
            <bufferGeometry ref={pointCloudGeoRef}>
              <bufferAttribute
                attach="attributes-position"
                count={allPositions.length / 3}
                array={allPositions}
                itemSize={3}
              />
              <bufferAttribute
                ref={colorAttribRef}
                attach="attributes-color"
                count={pointColors.length / 3}
                array={pointColors}
                itemSize={3}
              />
            </bufferGeometry>
            <pointsMaterial size={0.008} vertexColors sizeAttenuation depthTest={true} depthWrite={true} />
          </points>
        )}

        {/* 3D Brush Cursor Ring */}
        {activeTab === 'physics_paint' && (
          <mesh ref={brushCursorRef} visible={false} raycast={() => null}>
            <ringGeometry args={[(brushRadius - 0.015) * invScaleFactor, brushRadius * invScaleFactor, 32]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} side={THREE.DoubleSide} depthTest={false} />
          </mesh>
        )}
      </group>
    </Bvh>
  );
}

// Lightweight solid shapes rendering with dynamic X-Ray material overlay, linear blend skinning, and interactive physics weight painting support
function MiniMeshModel({
  geometry,
  material,
  xRay,
  joints,
  animatedJoints,
  activeTab,
  brushPhysicsType,
  brushRadius,
  brushStrength,
  asset,
  updateObject,
  testPose,
  animTime,
  hairFrequency,
  hairStiffness,
  jiggleElasticity,
  jiggleDamping,
  clothGravity,
  clothDrag,
  enableWind,
  modelRef,
  isSkinBound,
  gizmoDraggingRef,
  onSkeletonDetected,
  onAnimationRigLoaded,
}: {
  geometry?: string;
  material?: any;
  xRay: boolean;
  joints: JointData[];
  animatedJoints: JointData[];
  activeTab: string;
  brushPhysicsType: 'rigid' | 'hair' | 'jiggle' | 'cloth';
  brushRadius: number;
  brushStrength: number;
  asset: any;
  updateObject: (id: string, updates: Partial<any>) => void;
  testPose: boolean;
  animTime: number;
  hairFrequency: number;
  hairStiffness: number;
  jiggleElasticity: number;
  jiggleDamping: number;
  clothGravity: number;
  clothDrag: number;
  enableWind: boolean;
  modelRef?: React.RefObject<THREE.Object3D | null>;
  isSkinBound: boolean;
  gizmoDraggingRef?: React.RefObject<boolean>;
  onSkeletonDetected?: (detected: boolean) => void;
  onAnimationRigLoaded?: (joints: JointData[]) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const {
    isAnimationActive,
    skeletonHelper,
    mixerRef,
    actionRef,
    boneMap,
    currentTime: storeTime,
    isPlaying: storeIsPlaying,
    setCurrentTime,
    isNativeClip,
    insymmetryEnabled,
    gaitAsymmetry,
    postureBias,
    dynamicVariance,
  } = useModelAnimation(meshRef, joints, activeTab, isSkinBound, gizmoDraggingRef, undefined, onAnimationRigLoaded);

  const insymmetryBones = useMemo(() => {
    if (!boneMap) return null;
    
    const find = (names: string[]) => {
      for (const name of names) {
        if (boneMap.has(name)) return boneMap.get(name);
        for (const [key, val] of boneMap.entries()) {
          if (key.toLowerCase() === name.toLowerCase() || key.toLowerCase().includes(name.toLowerCase())) {
            return val;
          }
        }
      }
      return undefined;
    };

    return {
      pelvis: find(['AutoRig_Waist', 'hips', 'pelvis', 'mixamorigHips']),
      spine: find(['AutoRig_Spine', 'spine', 'mixamorigSpine']),
      chest: find(['AutoRig_Chest', 'chest', 'mixamorigChest', 'mixamorigSpine1', 'mixamorigSpine2']),
      head: find(['AutoRig_Head', 'head', 'mixamorigHead']),
      leftShoulder: find(['AutoRig_L_Shoulder', 'leftShoulder', 'mixamorigLeftShoulder']),
      rightShoulder: find(['AutoRig_R_Shoulder', 'rightShoulder', 'mixamorigRightShoulder']),
      rightHip: find(['AutoRig_R_Hip', 'rightUpLeg', 'mixamorigRightUpLeg']),
      rightKnee: find(['AutoRig_R_Knee', 'rightLeg', 'mixamorigRightLeg']),
    };
  }, [boneMap]);

  // MiniMeshModel has no native skeleton
  useEffect(() => {
    onSkeletonDetected?.(false);
  }, [geometry, onSkeletonDetected]);

  // Store the original/bind pose vertex positions and build a 3D spatial hash grid
  const { originalPositions, spatialHash, cellSize, bounds } = useMemo(() => {
    let tempGeo: THREE.BufferGeometry;
    if (geometry === 'sphere') tempGeo = new THREE.SphereGeometry(0.6, 32, 32);
    else if (geometry === 'plane') tempGeo = new THREE.PlaneGeometry(1.2, 1.2);
    else if (geometry === 'cylinder') tempGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.2, 32);
    else if (geometry === 'cone') tempGeo = new THREE.ConeGeometry(0.5, 1.0, 32);
    else tempGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);

    const posAttr = tempGeo.getAttribute('position');
    const arr = new Float32Array(posAttr.array);
    tempGeo.dispose();

    const count = arr.length / 3;
    const cellSize = 0.2;
    const grid = new Map<number, number[]>();

    let minCx = Infinity, maxCx = -Infinity;
    let minCy = Infinity, maxCy = -Infinity;
    let minCz = Infinity, maxCz = -Infinity;

    for (let i = 0; i < count; i++) {
      const px = arr[i * 3];
      const py = arr[i * 3 + 1];
      const pz = arr[i * 3 + 2];

      const cx = Math.floor(px / cellSize);
      const cy = Math.floor(py / cellSize);
      const cz = Math.floor(pz / cellSize);

      if (cx < minCx) minCx = cx;
      if (cx > maxCx) maxCx = cx;
      if (cy < minCy) minCy = cy;
      if (cy > maxCy) maxCy = cy;
      if (cz < minCz) minCz = cz;
      if (cz > maxCz) maxCz = cz;

      const key = ((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) >>> 0;
      let cell = grid.get(key);
      if (!cell) {
        cell = [];
        grid.set(key, cell);
      }
      cell.push(i);
    }

    return {
      originalPositions: arr,
      spatialHash: grid,
      cellSize,
      bounds: { minCx, maxCx, minCy, maxCy, minCz, maxCz },
    };
  }, [geometry]);

  // Compute bind poses (joint positions when bind pose is defined)
  const bindPoses = useMemo(() => {
    return joints.map((j) => ({
      id: j.id,
      position: new THREE.Vector3(...j.position),
    }));
  }, [joints]);

  const cachedSkinningInfluencesRef = useRef<any[] | null>(null);
  const cachedJointsCountRef = useRef<number>(0);

  useEffect(() => {
    if (!isSkinBound) {
      cachedSkinningInfluencesRef.current = null;
      cachedJointsCountRef.current = 0;
    }
  }, [isSkinBound]);

  // Precompute nearest joint influences and weights for linear blend skinning once
  const skinningInfluences = useMemo(() => {
    if (isSkinBound && cachedSkinningInfluencesRef.current && joints.length === cachedJointsCountRef.current) {
      return cachedSkinningInfluencesRef.current;
    }

    const influences: Array<{
      j0Id: string;
      j1Id: string;
      w0: number;
      w1: number;
      bindPos0: THREE.Vector3;
      bindPos1: THREE.Vector3;
    }> = [];

    const hasSkel = !isNativeClip && isSkinBound && joints && joints.length > 0 && bindPoses.length > 0;
    if (!hasSkel) return influences;

    const tempV = new THREE.Vector3();
    const count = originalPositions.length / 3;

    for (let i = 0; i < count; i++) {
      tempV.set(
        originalPositions[i * 3],
        originalPositions[i * 3 + 1],
        originalPositions[i * 3 + 2]
      );

      // Find closest 2 joints in bind pose
      let firstJoint = bindPoses[0];
      let firstDistSq = firstJoint.position.distanceToSquared(tempV);
      let secondJoint = bindPoses[1] || bindPoses[0];
      let secondDistSq = bindPoses[1] ? secondJoint.position.distanceToSquared(tempV) : firstDistSq;

      if (firstDistSq > secondDistSq) {
        const tmpJ = firstJoint; firstJoint = secondJoint; secondJoint = tmpJ;
        const tmpDSq = firstDistSq; firstDistSq = secondDistSq; secondDistSq = tmpDSq;
      }

      for (let j = 2; j < bindPoses.length; j++) {
        const bp = bindPoses[j];
        const distSq = bp.position.distanceToSquared(tempV);
        if (distSq < firstDistSq) {
          secondJoint = firstJoint;
          secondDistSq = firstDistSq;
          firstJoint = bp;
          firstDistSq = distSq;
        } else if (distSq < secondDistSq) {
          secondJoint = bp;
          secondDistSq = distSq;
        }
      }

      const firstDist = Math.sqrt(firstDistSq);
      const secondDist = Math.sqrt(secondDistSq);
      const totalDist = firstDist + secondDist;
      const w0 = totalDist > 0 ? 1 - firstDist / totalDist : 1.0;
      const w1 = 1.0 - w0;

      influences.push({
        j0Id: firstJoint.id,
        j1Id: secondJoint.id,
        w0,
        w1,
        bindPos0: firstJoint.position,
        bindPos1: secondJoint.position,
      });
    }

    cachedSkinningInfluencesRef.current = influences;
    cachedJointsCountRef.current = joints.length;
    return influences;
  }, [originalPositions, bindPoses, joints, isSkinBound]);

  const groupRef = useRef<THREE.Group>(null);
  const localPaintedPhysicsRef = useRef<Record<number, string>>({});
  const isDraggingRef = useRef(false);
  const colorAttribRef = useRef<THREE.BufferAttribute>(null);
  const lastPaintTimeRef = useRef<number>(0);
  const cachedInverseMatrixRef = useRef<THREE.Matrix4>(new THREE.Matrix4());
  const rafPendingRef = useRef(false);
  const pendingPointerEventRef = useRef<any>(null);
  const pointCloudGeoRef = useRef<THREE.BufferGeometry>(null);

  // Dispose point cloud geometry on unmount to prevent GPU leak
  useEffect(() => {
    return () => {
      pointCloudGeoRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (modelRef) {
      modelRef.current = meshRef.current;
    }
    return () => {
      if (modelRef && modelRef.current === meshRef.current) {
        modelRef.current = null;
      }
    };
  }, [meshRef.current, modelRef]);

  useEffect(() => {
    if (!isDraggingRef.current) {
      localPaintedPhysicsRef.current = { ...(asset.paintedPhysics || {}) };
    }
  }, [asset.paintedPhysics]);

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        updateObject(asset.id, { paintedPhysics: { ...localPaintedPhysicsRef.current } });
      }
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, [asset.id, updateObject]);

  // Visual weight color overlay mapping (Rigid=Blue, Hair=Magenta, Jiggle=Amber, Cloth=Emerald)
  const pointColors = useMemo(() => {
    const colors = new Float32Array(originalPositions.length);
    const painted = asset.paintedPhysics || {};
    for (let i = 0; i < originalPositions.length / 3; i++) {
      const type = painted[i] || 'rigid';
      let r = 0.2, g = 0.6, b = 1.0; // Rigid default blue
      if (type === 'hair') {
        r = 1.0; g = 0.1; b = 0.8; // Magenta hair
      } else if (type === 'jiggle') {
        r = 1.0; g = 0.7; b = 0.0; // Amber jiggle
      } else if (type === 'cloth') {
        r = 0.1; g = 0.8; b = 0.4; // Emerald cloth
      }

      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }
    return colors;
  }, [asset.paintedPhysics, originalPositions]);

  const invScaleFactor = useMemo(() => {
    const s = asset?.scale || [1, 1, 1];
    return 1 / s[0];
  }, [asset?.scale]);

  const brushCursorRef = useRef<THREE.Mesh>(null);

  const paintAtPoint = useCallback((intersectPoint: THREE.Vector3) => {
    if (!meshRef.current || !asset || !intersectPoint) return;

    const geo = meshRef.current.geometry;
    const posAttr = geo.getAttribute('position');
    const localIntersectPoint = intersectPoint.clone().applyMatrix4(cachedInverseMatrixRef.current);
    const localBrushRadius = brushRadius * invScaleFactor;
    const localBrushRadiusSq = localBrushRadius * localBrushRadius;
    const count = originalPositions.length / 3;

    // Determine the range of cell coordinates overlapping the brush sphere, clamped to model boundaries
    const startCx = Math.max(bounds.minCx, Math.floor((localIntersectPoint.x - localBrushRadius) / cellSize));
    const endCx = Math.min(bounds.maxCx, Math.floor((localIntersectPoint.x + localBrushRadius) / cellSize));
    const startCy = Math.max(bounds.minCy, Math.floor((localIntersectPoint.y - localBrushRadius) / cellSize));
    const endCy = Math.min(bounds.maxCy, Math.floor((localIntersectPoint.y + localBrushRadius) / cellSize));
    const startCz = Math.max(bounds.minCz, Math.floor((localIntersectPoint.z - localBrushRadius) / cellSize));
    const endCz = Math.min(bounds.maxCz, Math.floor((localIntersectPoint.z + localBrushRadius) / cellSize));

    let changed = false;

    // Safety check: if the grid search volume is too large, fallback to a fast linear array scan.
    const rangeX = (endCx - startCx + 1);
    const rangeY = (endCy - startCy + 1);
    const rangeZ = (endCz - startCz + 1);
    const volume = (rangeX > 0 ? rangeX : 0) * (rangeY > 0 ? rangeY : 0) * (rangeZ > 0 ? rangeZ : 0);

    if (volume === 0) return;

    if (volume > count) {
      // Linear scan fallback
      for (let i = 0; i < count; i++) {
        const px = originalPositions[i * 3];
        const py = originalPositions[i * 3 + 1];
        const pz = originalPositions[i * 3 + 2];

        const dx = px - localIntersectPoint.x;
        const dy = py - localIntersectPoint.y;
        const dz = pz - localIntersectPoint.z;
        const distSq = dx * dx + dy * dy + dz * dz;

        if (distSq <= localBrushRadiusSq) {
          const currentType = localPaintedPhysicsRef.current[i] || 'rigid';
          if (currentType !== brushPhysicsType) {
            localPaintedPhysicsRef.current[i] = brushPhysicsType;
            changed = true;

            if (colorAttribRef.current) {
              const colorsArray = colorAttribRef.current.array as Float32Array;
              let r = 0.2, g = 0.6, b = 1.0;
              if (brushPhysicsType === 'hair') {
                r = 1.0; g = 0.1; b = 0.8;
              } else if (brushPhysicsType === 'jiggle') {
                r = 1.0; g = 0.7; b = 0.0;
              } else if (brushPhysicsType === 'cloth') {
                r = 0.1; g = 0.8; b = 0.4;
              }
              colorsArray[i * 3] = r;
              colorsArray[i * 3 + 1] = g;
              colorsArray[i * 3 + 2] = b;
            }
          }
        }
      }
    } else {
      // Spatial hash lookup
      for (let cx = startCx; cx <= endCx; cx++) {
        for (let cy = startCy; cy <= endCy; cy++) {
          for (let cz = startCz; cz <= endCz; cz++) {
            const key = ((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) >>> 0;
            const cellIndices = spatialHash.get(key);
            if (cellIndices) {
              for (let k = 0; k < cellIndices.length; k++) {
                const i = cellIndices[k];
                const px = originalPositions[i * 3];
                const py = originalPositions[i * 3 + 1];
                const pz = originalPositions[i * 3 + 2];

                const dx = px - localIntersectPoint.x;
                const dy = py - localIntersectPoint.y;
                const dz = pz - localIntersectPoint.z;
                const distSq = dx * dx + dy * dy + dz * dz;

                if (distSq <= localBrushRadiusSq) {
                  const currentType = localPaintedPhysicsRef.current[i] || 'rigid';
                  if (currentType !== brushPhysicsType) {
                    localPaintedPhysicsRef.current[i] = brushPhysicsType;
                    changed = true;

                    if (colorAttribRef.current) {
                      const colorsArray = colorAttribRef.current.array as Float32Array;
                      let r = 0.2, g = 0.6, b = 1.0;
                      if (brushPhysicsType === 'hair') {
                        r = 1.0; g = 0.1; b = 0.8;
                      } else if (brushPhysicsType === 'jiggle') {
                        r = 1.0; g = 0.7; b = 0.0;
                      } else if (brushPhysicsType === 'cloth') {
                        r = 0.1; g = 0.8; b = 0.4;
                      }
                      colorsArray[i * 3] = r;
                      colorsArray[i * 3 + 1] = g;
                      colorsArray[i * 3 + 2] = b;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    if (changed && colorAttribRef.current) {
      colorAttribRef.current.needsUpdate = true;
    }
  }, [asset, brushRadius, invScaleFactor, bounds, cellSize, spatialHash, brushPhysicsType, originalPositions]);

  const handlePointerDown = (e: any) => {
    if (activeTab !== 'physics_paint' || !meshRef.current || !asset || !e.point) return;
    e.stopPropagation();
    isDraggingRef.current = true;

    // Cache matrix once on pointer down
    meshRef.current.updateMatrixWorld(true);
    cachedInverseMatrixRef.current.copy(meshRef.current.matrixWorld).invert();

    paintAtPoint(e.point);
  };

  // Handle vertex weight brush painting via raycasting intersection
  const processPointerMove = useCallback((e: any) => {
    rafPendingRef.current = false;
    if (!e || !e.point || !meshRef.current || !groupRef.current) return;

    groupRef.current.updateMatrixWorld(true);
    const inverseGroupMatrix = new THREE.Matrix4().copy(groupRef.current.matrixWorld).invert();

    // Update brush cursor visual
    if (brushCursorRef.current) {
      const localPoint = e.point.clone().applyMatrix4(inverseGroupMatrix);
      brushCursorRef.current.position.copy(localPoint);

      if (e.face && e.object) {
        const worldNormal = e.face.normal.clone().transformDirection(e.object.matrixWorld);
        const worldQuat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          worldNormal
        );
        const parentWorldQuat = new THREE.Quaternion();
        groupRef.current.getWorldQuaternion(parentWorldQuat);
        brushCursorRef.current.quaternion.copy(worldQuat).premultiply(parentWorldQuat.invert());
      }
    }

    if (e.buttons === 1 && isDraggingRef.current) {
      const now = performance.now();
      if (now - lastPaintTimeRef.current > 16) {
        paintAtPoint(e.point);
        lastPaintTimeRef.current = now;
      }
    }
  }, [paintAtPoint]);

  const handlePointerMove = (e: any) => {
    if (activeTab !== 'physics_paint' || !meshRef.current || !asset || !e.point) return;

    // Stop OrbitControls zoom/orbit while dragging paint brush
    e.stopPropagation();

    // Safely extract event parameters synchronously to avoid issues with pooled React/R3F events inside RAF
    const point = e.point ? e.point.clone() : null;
    const buttons = e.buttons;
    const face = e.face ? { normal: e.face.normal.clone() } : null;
    const object = e.object;

    pendingPointerEventRef.current = { point, buttons, face, object };
    if (!rafPendingRef.current) {
      rafPendingRef.current = true;
      requestAnimationFrame(() => processPointerMove(pendingPointerEventRef.current));
    }
  };

  const handlePointerOut = () => {
    if (brushCursorRef.current) brushCursorRef.current.visible = false;
  };

  const handlePointerOver = () => {
    if (brushCursorRef.current && activeTab === 'physics_paint') {
      if (meshRef.current) {
        meshRef.current.updateMatrixWorld(true);
        cachedInverseMatrixRef.current.copy(meshRef.current.matrixWorld).invert();
      }
      brushCursorRef.current.visible = true;
    }
  };

  // Preallocate reusable math structures for useFrame to achieve 0 allocations per frame
  const frameV = useMemo(() => new THREE.Vector3(), []);
  const frameDeformed = useMemo(() => new THREE.Vector3(), []);
  const framePhysicsOffset = useMemo(() => new THREE.Vector3(), []);
  const frameVOffset0 = useMemo(() => new THREE.Vector3(), []);
  const frameVOffset1 = useMemo(() => new THREE.Vector3(), []);
  const frameP0 = useMemo(() => new THREE.Vector3(), []);
  const frameP1 = useMemo(() => new THREE.Vector3(), []);
  const frameCloneInv = useMemo(() => new THREE.Matrix4(), []);
  const curWorldPos = useMemo(() => new THREE.Vector3(), []);
  const worldDelta = useMemo(() => new THREE.Vector3(), []);
  const localDelta = useMemo(() => new THREE.Vector3(), []);

  // Preallocate active joints map cache to avoid per-vertex searches
  const jointMatrices = useMemo(() => new Map<string, THREE.Matrix4>(), []);
  const tempEuler = useMemo(() => new THREE.Euler(), []);

  // Dynamic vertex physics simulation tracking refs
  const velocitiesRef = useRef<Float32Array | null>(null);
  const displacementsRef = useRef<Float32Array | null>(null);
  const prevWorldPosRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const firstFrameRef = useRef<boolean>(true);
  const lastSkelHashRef = useRef('');
  const lastSkinBoundRef = useRef(false);
  const lastInsymmetryEnabledRef = useRef(false);
  const lastGaitAsymmetryRef = useRef(0);
  const lastPostureBiasRef = useRef(0);
  const lastDynamicVarianceRef = useRef(0);

  // Reset first frame tracking and physics buffers when geometry changes
  useEffect(() => {
    firstFrameRef.current = true;
    velocitiesRef.current = null;
    displacementsRef.current = null;
  }, [geometry]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    const geo = meshRef.current.geometry;
    const posAttr = geo.getAttribute('position');
    const arr = posAttr.array as Float32Array;

    // Fallback: if no skeleton bone joints are defined, we just use bind original positions
    const hasSkel = !isNativeClip && isSkinBound && joints && joints.length > 0 && animatedJoints.length > 0 && skinningInfluences.length > 0;

    let hasPaintedPhysics = false;
    if (localPaintedPhysicsRef.current) {
      for (const _ in localPaintedPhysicsRef.current) {
        hasPaintedPhysics = true;
        break;
      }
    }
    // Allow animation mixer to run even without a skin-bound skeleton
    if (!hasSkel && !hasPaintedPhysics && !isAnimationActive) return;

    // Calculate world position changes (for inertia tracking)
    meshRef.current.getWorldPosition(curWorldPos);

    worldDelta.set(0, 0, 0);
    if (!firstFrameRef.current) {
      worldDelta.copy(curWorldPos).sub(prevWorldPosRef.current);
    }
    const worldPosChanged = worldDelta.lengthSq() > 0.00001;

    // Change detection for early exit
    const skelHash = getSkelHash(joints);
    const skelChanged = skelHash !== lastSkelHashRef.current;
    const skinBoundChanged = isSkinBound !== lastSkinBoundRef.current;

    const insymmetryChanged = insymmetryEnabled !== lastInsymmetryEnabledRef.current ||
      gaitAsymmetry !== lastGaitAsymmetryRef.current ||
      postureBias !== lastPostureBiasRef.current ||
      dynamicVariance !== lastDynamicVarianceRef.current;

    lastInsymmetryEnabledRef.current = insymmetryEnabled;
    lastGaitAsymmetryRef.current = gaitAsymmetry;
    lastPostureBiasRef.current = postureBias;
    lastDynamicVarianceRef.current = dynamicVariance;

    const needsUpdate = testPose || isAnimationActive || skelChanged || skinBoundChanged || worldPosChanged || insymmetryChanged || firstFrameRef.current;

    if (!needsUpdate) {
      prevWorldPosRef.current.copy(curWorldPos);
      lastSkelHashRef.current = skelHash;
      lastSkinBoundRef.current = isSkinBound;
      return;
    }

    if (firstFrameRef.current) {
      firstFrameRef.current = false;
    }
    prevWorldPosRef.current.copy(curWorldPos);
    lastSkelHashRef.current = skelHash;
    lastSkinBoundRef.current = isSkinBound;

    // Calculate time step
    const dt = Math.max(0.001, Math.min(delta, 0.03));

    // Update animation mixer if active
    if (isAnimationActive && mixerRef.current && actionRef.current) {
      if (!isNativeClip) {
        ensureBoneHierarchy(meshRef.current, joints, isSkinBound);
      }
      const mixer = mixerRef.current;
      const action = actionRef.current;

      // Reset rotations of these bones to their base store rotations
      // to prevent stale offsets from persisting (e.g. on non-animated channels)
      if (insymmetryBones) {
        const { pelvis, spine, chest, head, leftShoulder, rightShoulder, rightHip, rightKnee } = insymmetryBones;
        const affectedBones = [pelvis, spine, chest, head, leftShoulder, rightShoulder, rightHip, rightKnee];
        for (const bone of affectedBones) {
          if (bone) {
            const joint = joints.find(j => j.name === bone.name);
            if (joint) {
              bone.rotation.set(
                THREE.MathUtils.degToRad(joint.rotation[0]),
                THREE.MathUtils.degToRad(joint.rotation[1]),
                THREE.MathUtils.degToRad(joint.rotation[2])
              );
            } else {
              bone.rotation.set(0, 0, 0);
            }
          }
        }
      }

      if (storeIsPlaying && !action.paused) {
        mixer.update(dt);
        setCurrentTime(action.time);
      } else {
        action.time = storeTime;
        mixer.update(0);
      }

      if (insymmetryEnabled && insymmetryBones && meshRef.current) {
        const { pelvis, spine, chest, head, leftShoulder, rightShoulder, rightHip, rightKnee } = insymmetryBones;

        if (gaitAsymmetry > 0) {
          const limpScale = 1.0 - gaitAsymmetry * 0.6;
          if (rightKnee) rightKnee.rotation.x *= limpScale;
          if (rightHip) rightHip.rotation.x *= limpScale;
        }

        if (Math.abs(postureBias) > 0.01) {
          const leanAngle = postureBias * 0.15;
          if (pelvis) pelvis.rotation.z += leanAngle * 0.4;
          if (spine) spine.rotation.z += leanAngle * 0.7;
          if (chest) chest.rotation.z += leanAngle * 0.5;
          if (leftShoulder) leftShoulder.rotation.z += leanAngle * 0.4;
          if (rightShoulder) rightShoulder.rotation.z += leanAngle * 0.4;
        }

        if (dynamicVariance > 0.01) {
          const tVal = action.time;
          const swaggerScale = dynamicVariance * 0.12;
          const noiseX = Math.sin(tVal * 1.5) * 0.6 + Math.sin(tVal * 0.7) * 0.4;
          const noiseY = Math.cos(tVal * 1.2) * 0.6 + Math.cos(tVal * 0.5) * 0.4;
          const noiseZ = Math.sin(tVal * 0.9) * 0.6 + Math.cos(tVal * 0.4) * 0.4;

          if (pelvis) {
            pelvis.rotation.x += noiseX * swaggerScale;
            pelvis.rotation.y += noiseY * swaggerScale * 1.2;
            pelvis.rotation.z += noiseZ * swaggerScale * 0.8;
          }
          if (head) {
            head.rotation.x += noiseZ * swaggerScale * 0.5;
            head.rotation.y += noiseX * swaggerScale * 0.9;
            head.rotation.z += noiseY * swaggerScale * 0.4;
          }
        }
      }

      if (meshRef.current) {
        meshRef.current.updateMatrixWorld(true);
      }
    }

    // Bypass CPU vertex deformation if native clip playback is active and no physics is painted
    if (isNativeClip && !hasPaintedPhysics) {
      return;
    }

    frameCloneInv.copy(meshRef.current.matrixWorld).invert();

    localDelta.set(0, 0, 0);
    if (worldDelta.lengthSq() > 0.00001) {
      localDelta.copy(worldDelta).transformDirection(frameCloneInv);
    }

    if (!velocitiesRef.current) {
      velocitiesRef.current = new Float32Array(posAttr.count * 3);
    }
    if (!displacementsRef.current) {
      displacementsRef.current = new Float32Array(posAttr.count * 3);
    }

    const vels = velocitiesRef.current;
    const disps = displacementsRef.current;

    // 1. Precalculate current joint matrices once per frame
    if (hasSkel) {
      jointMatrices.clear();
      for (let k = 0; k < animatedJoints.length; k++) {
        const cur = animatedJoints[k];
        let mat = jointMatrices.get(cur.id);
        if (!mat) {
          mat = new THREE.Matrix4();
          jointMatrices.set(cur.id, mat);
        }

        if (isAnimationActive) {
          const bone = boneMap.get(cur.name);
          if (bone) {
            bone.updateMatrixWorld(true);
            mat.copy(frameCloneInv).multiply(bone.matrixWorld);
          } else {
            mat.makeRotationFromEuler(tempEuler.set(
              THREE.MathUtils.degToRad(cur.rotation[0]),
              THREE.MathUtils.degToRad(cur.rotation[1]),
              THREE.MathUtils.degToRad(cur.rotation[2])
            )).setPosition(cur.position[0], cur.position[1], cur.position[2]);
          }
        } else {
          mat.makeRotationFromEuler(tempEuler.set(
            THREE.MathUtils.degToRad(cur.rotation[0]),
            THREE.MathUtils.degToRad(cur.rotation[1]),
            THREE.MathUtils.degToRad(cur.rotation[2])
          )).setPosition(cur.position[0], cur.position[1], cur.position[2]);
        }
      }
    }

    let changed = false;

    for (let i = 0; i < posAttr.count; i++) {
      const type = (localPaintedPhysicsRef.current && localPaintedPhysicsRef.current[i]) || 'rigid';

      // OPTIMIZATION: Skip rigid static vertices completely to avoid CPU freeze
      if (!hasSkel && type === 'rigid') {
        continue;
      }

      const origX = originalPositions[i * 3];
      const origY = originalPositions[i * 3 + 1];
      const origZ = originalPositions[i * 3 + 2];
      frameV.set(origX, origY, origZ);

      // Calculate base position (skinned to skeleton or static bind)
      if (hasSkel) {
        const influence = skinningInfluences[i];
        if (influence) {
          const m0 = jointMatrices.get(influence.j0Id);
          const m1 = jointMatrices.get(influence.j1Id);

          if (m0 && m1) {
            // Joint 0 contribution
            frameVOffset0.copy(frameV).sub(influence.bindPos0).applyMatrix4(m0);

            // Joint 1 contribution
            frameVOffset1.copy(frameV).sub(influence.bindPos1).applyMatrix4(m1);

            frameDeformed.set(0, 0, 0);
            frameDeformed.addScaledVector(frameVOffset0, influence.w0);
            frameDeformed.addScaledVector(frameVOffset1, influence.w1);
          } else {
            frameDeformed.copy(frameV);
          }
        } else {
          frameDeformed.copy(frameV);
        }
      } else {
        frameDeformed.copy(frameV);
      }

      if (!testPose || type === 'rigid') {
        disps[i * 3] = 0;
        disps[i * 3 + 1] = 0;
        disps[i * 3 + 2] = 0;
        vels[i * 3] = 0;
        vels[i * 3 + 1] = 0;
        vels[i * 3 + 2] = 0;

        if (arr[i * 3] !== frameDeformed.x || arr[i * 3 + 1] !== frameDeformed.y || arr[i * 3 + 2] !== frameDeformed.z) {
          arr[i * 3] = frameDeformed.x;
          arr[i * 3 + 1] = frameDeformed.y;
          arr[i * 3 + 2] = frameDeformed.z;
          changed = true;
        }
        continue;
      }

      // Retrieve current displacement & velocity
      let dx = disps[i * 3];
      let dy = disps[i * 3 + 1];
      let dz = disps[i * 3 + 2];

      let vx = vels[i * 3];
      let vy = vels[i * 3 + 1];
      let vz = vels[i * 3 + 2];

      let offX = 0, offY = 0, offZ = 0;

      if (type === 'hair') {
        if (enableWind) {
          // Trigonometric Wind Sway + Inertia
          const t = animTime * hairFrequency;
          const amplitude = (1.0 - hairStiffness) * 0.1 * brushStrength;
          offX = Math.sin(t + frameDeformed.y * 3.0) * amplitude;
          offZ = Math.cos(t + frameDeformed.y * 3.0) * amplitude;

          dx -= localDelta.x * 2.0 * brushStrength;
          dy -= localDelta.y * 2.0 * brushStrength;
          dz -= localDelta.z * 2.0 * brushStrength;

          dx += (offX - dx) * dt * 5.0;
          dy += (offY - dy) * dt * 5.0;
          dz += (offZ - dz) * dt * 5.0;

          disps[i * 3] = dx;
          disps[i * 3 + 1] = dy;
          disps[i * 3 + 2] = dz;
        } else {
          // Plain physics (no wind) - React to movement inertia only
          dx -= localDelta.x * 4.0 * brushStrength;
          dy -= localDelta.y * 4.0 * brushStrength;
          dz -= localDelta.z * 4.0 * brushStrength;

          vx += (-20.0 * hairStiffness * dx - 4.0 * vx) * dt;
          vy += (-20.0 * hairStiffness * dy - 4.0 * vy) * dt;
          vz += (-20.0 * hairStiffness * dz - 4.0 * vz) * dt;

          dx += vx * dt;
          dy += vy * dt;
          dz += vz * dt;

          const maxHair = 0.15 * brushStrength;
          const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (len > maxHair && len > 0) {
            dx = (dx / len) * maxHair;
            dy = (dy / len) * maxHair;
            dz = (dz / len) * maxHair;
            vx *= -0.2;
            vy *= -0.2;
            vz *= -0.2;
          }

          disps[i * 3] = dx;
          disps[i * 3 + 1] = dy;
          disps[i * 3 + 2] = dz;
          vels[i * 3] = vx;
          vels[i * 3 + 1] = vy;
          vels[i * 3 + 2] = vz;

          offX = dx;
          offY = dy;
          offZ = dz;
        }
      } else if (type === 'jiggle') {
        // Spring-Damping (Hooke's Law)
        dx -= localDelta.x * 5.0 * brushStrength;
        dy -= localDelta.y * 5.0 * brushStrength;
        dz -= localDelta.z * 5.0 * brushStrength;

        let fExtX = 0, fExtY = 0, fExtZ = 0;
        if (testPose) {
          const t = animTime * 12.0;
          fExtX = Math.sin(t) * 0.2 * brushStrength;
          fExtY = Math.cos(t * 1.5) * 0.1 * brushStrength;
        }

        const ax = -jiggleElasticity * dx - jiggleDamping * vx + fExtX;
        const ay = -jiggleElasticity * dy - jiggleDamping * vy + fExtY;
        const az = -jiggleElasticity * dz - jiggleDamping * vz + fExtZ;

        vx += ax * dt;
        vy += ay * dt;
        vz += az * dt;

        dx += vx * dt;
        dy += vy * dt;
        dz += vz * dt;

        const maxJiggle = 0.2 * brushStrength;
        const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (len > maxJiggle && len > 0) {
          dx = (dx / len) * maxJiggle;
          dy = (dy / len) * maxJiggle;
          dz = (dz / len) * maxJiggle;
          vx *= -0.2;
          vy *= -0.2;
          vz *= -0.2;
        }

        disps[i * 3] = dx;
        disps[i * 3 + 1] = dy;
        disps[i * 3 + 2] = dz;
        vels[i * 3] = vx;
        vels[i * 3 + 1] = vy;
        vels[i * 3 + 2] = vz;

        offX = dx;
        offY = dy;
        offZ = dz;
      } else if (type === 'cloth') {
        // Cloth sag and wind simulation
        const tensionK = 25.0;
        const gravityY = -9.8 * clothGravity * brushStrength;

        // Apply local inertia delta
        dx -= localDelta.x * 2.0 * brushStrength;
        dy -= localDelta.y * 2.0 * brushStrength;
        dz -= localDelta.z * 2.0 * brushStrength;

        let windX = 0, windZ = 0;
        if (testPose && enableWind) {
          const t = animTime * 5.0;
          windX = Math.sin(t + frameDeformed.y * 2.0) * 1.0 * brushStrength;
          windZ = Math.cos(t * 0.8) * 0.8 * brushStrength;
        }

        const ax = -tensionK * dx - clothDrag * vx + windX;
        const ay = -tensionK * dy - clothDrag * vy + gravityY;
        const az = -tensionK * dz - clothDrag * vz + windZ;

        vx += ax * dt;
        vy += ay * dt;
        vz += az * dt;

        dx += vx * dt;
        dy += vy * dt;
        dz += vz * dt;

        const maxCloth = 0.35 * brushStrength;
        const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (len > maxCloth && len > 0) {
          dx = (dx / len) * maxCloth;
          dy = (dy / len) * maxCloth;
          dz = (dz / len) * maxCloth;
          vx *= -0.1;
          vy *= -0.1;
          vz *= -0.1;
        }

        disps[i * 3] = dx;
        disps[i * 3 + 1] = dy;
        disps[i * 3 + 2] = dz;
        vels[i * 3] = vx;
        vels[i * 3 + 1] = vy;
        vels[i * 3 + 2] = vz;

        offX = dx;
        offY = dy;
        offZ = dz;
      }

      arr[i * 3] = frameDeformed.x + offX;
      arr[i * 3 + 1] = frameDeformed.y + offY;
      arr[i * 3 + 2] = frameDeformed.z + offZ;
      changed = true;
    }

    if (changed || hasSkel) {
      posAttr.needsUpdate = true;
      geo.computeVertexNormals();
    }

    // Deform visual point clouds in exact sync with mesh
    if (pointsRef.current) {
      const pointsGeo = pointsRef.current.geometry;
      const pointsPosAttr = pointsGeo.getAttribute('position');
      const pointsArr = pointsPosAttr.array as Float32Array;
      pointsArr.set(arr);
      pointsPosAttr.needsUpdate = true;
    }
  });

  return (
    <Bvh firstHitOnly>
      <group ref={groupRef}>
        <mesh
          ref={meshRef}
          castShadow
          receiveShadow
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerOut={handlePointerOut}
          onPointerOver={handlePointerOver}
        >
          {geometry === 'sphere' && <sphereGeometry args={[0.6, 32, 32]} />}
          {geometry === 'plane' && <planeGeometry args={[1.2, 1.2]} />}
          {geometry === 'cylinder' && <cylinderGeometry args={[0.4, 0.4, 1.2, 32]} />}
          {geometry === 'cone' && <coneGeometry args={[0.5, 1.0, 32]} />}
          {(!geometry || geometry === 'box') && <boxGeometry args={[0.8, 0.8, 0.8]} />}
          <meshStandardMaterial
            color={material?.color || '#3b82f6'}
            roughness={material?.roughness ?? 0.4}
            metalness={material?.metalness ?? 0.2}
            transparent={xRay}
            opacity={xRay ? 0.25 : 1.0}
            wireframe={xRay && activeTab !== 'physics_paint'}
            depthWrite={!xRay}
          />
        </mesh>

        {/* Visual Weight Color Overlay Point Cloud Overlay */}
        {activeTab === 'physics_paint' && originalPositions.length / 3 <= MAX_PAINT_VERTICES && (
          <points ref={pointsRef} raycast={() => null}>
            <bufferGeometry ref={pointCloudGeoRef}>
              <bufferAttribute
                attach="attributes-position"
                count={originalPositions.length / 3}
                array={originalPositions.slice()}
                itemSize={3}
              />
              <bufferAttribute
                ref={colorAttribRef}
                attach="attributes-color"
                count={pointColors.length / 3}
                array={pointColors}
                itemSize={3}
              />
            </bufferGeometry>
            <pointsMaterial size={0.008} vertexColors sizeAttenuation depthTest={true} depthWrite={true} />
          </points>
        )}

        {/* 3D Brush Cursor Ring */}
        {activeTab === 'physics_paint' && (
          <mesh ref={brushCursorRef} visible={false} raycast={() => null}>
            <ringGeometry args={[(brushRadius - 0.015) * invScaleFactor, brushRadius * invScaleFactor, 32]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} side={THREE.DoubleSide} depthTest={false} />
          </mesh>
        )}
      </group>
    </Bvh>
  );
}

// Lightweight line using native THREE.Line + LineBasicMaterial (no fat-line shader / LineMaterial).
// drei's Line component creates a LineMaterial with a custom shader on every mount.
// During rigging, joint positions update constantly, causing rapid re-mounts that leak
// LineMaterial shaders until WebGL context is exhausted and the screen goes black.
function SimpleLine({
  start,
  end,
  color,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
}) {
  const geoRef = useRef<THREE.BufferGeometry>(null);

  useEffect(() => {
    if (geoRef.current) {
      const positions = new Float32Array([
        start[0], start[1], start[2],
        end[0], end[1], end[2],
      ]);
      geoRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    }
  }, [start, end]);

  // Dispose geometry on unmount
  useEffect(() => {
    return () => {
      geoRef.current?.dispose();
    };
  }, []);

  return (
    <line>
      <bufferGeometry ref={geoRef} />
      <lineBasicMaterial color={color} depthTest={false} transparent opacity={0.8} />
    </line>
  );
}

// Blender-style 3D octahedron bone visual chain connecting parent to child
function BoneVisual({
  start,
  end,
  invScaleFactor,
}: {
  start: [number, number, number];
  end: [number, number, number];
  invScaleFactor: number;
}) {
  const startVec = useMemo(() => new THREE.Vector3(...start), [start]);
  const endVec = useMemo(() => new THREE.Vector3(...end), [end]);

  const distance = useMemo(() => startVec.distanceTo(endVec), [startVec, endVec]);
  const midpoint = useMemo(() => new THREE.Vector3().addVectors(startVec, endVec).multiplyScalar(0.5), [startVec, endVec]);

  const quaternion = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(endVec, startVec).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    return new THREE.Quaternion().setFromUnitVectors(up, dir);
  }, [startVec, endVec]);

  if (distance < 0.05) return null;

  return (
    <group position={midpoint} quaternion={quaternion}>
      {/* 3D diamond/octahedron bone mesh */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.002 * invScaleFactor, 0.03 * invScaleFactor, distance * 0.9, 4]} />
        <meshStandardMaterial
          color="#fbbf24"
          roughness={0.1}
          metalness={0.8}
          emissive="#fbbf24"
          emissiveIntensity={0.2}
        />
      </mesh>
    </group>
  );
}

// Interactive Joint Component with TransformControls and Viewport Picking
function RiggingJoint({
  joint,
  objectId,
  updateJoint,
  selectedJointId,
  setSelectedJointId,
  testPose,
  gizmoMode,
  invScaleFactor,
}: {
  joint: JointData;
  objectId: string;
  updateJoint: (objectId: string, jointId: string, updates: Partial<JointData>, skipSymmetry?: boolean) => void;
  selectedJointId: string | null;
  setSelectedJointId: (id: string | null) => void;
  testPose: boolean;
  gizmoMode: 'translate' | 'rotate';
  invScaleFactor: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const isSelected = selectedJointId === joint.id;

  return (
    <group>
      <mesh
        ref={meshRef}
        position={joint.position}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedJointId(joint.id);
        }}
        scale={[invScaleFactor, invScaleFactor, invScaleFactor]}
      >
        <sphereGeometry args={[0.032, 16, 16]} />
        <meshBasicMaterial
          color={isSelected ? '#f59e0b' : '#38bdf8'}
          depthTest={false}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}

export default function PreviewPanel() {
  const {
    previewedAssetId,
    setPreviewedAsset,
    objects,
    selectedIds,
    addJoint,
    updateJoint,
    deleteJoint,
    selectedJointId,
    setSelectedJointId,
    activeTool,
    setActiveTool,
    updateObject,
    symmetryEnabled,
    toggleSymmetry,
    panelWidth,
    setPanelWidth,
  } = useStore();

  // Phase 5: Dynamic GLB Animation States
  const {
    clips,
    setClips,
    activeClipId,
    setActiveClip,
    isPlaying,
    setPlaying,
    currentTime,
    setCurrentTime,
    playbackSpeed,
    setPlaybackSpeed,
    loopMode,
    setLoopMode,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    insymmetryEnabled,
    setInsymmetryEnabled,
    gaitAsymmetry,
    setGaitAsymmetry,
    postureBias,
    setPostureBias,
    dynamicVariance,
    setDynamicVariance,
  } = useAnimationStore();

  const [isCatalogOpen, setIsCatalogOpen] = useState<boolean>(false);

  useEffect(() => {
    if (clips.length > 0) return;
    let active = true;
    import('../utils/AnimationExtractor').then(async ({ extractAnimationClips }) => {
      try {
        const result = await extractAnimationClips('/human_animations.glb');
        if (!active) return;
        if (result.clips && result.clips.length > 0) {
          const mappedClips = result.clips.map((clip, index) => ({
            id: `human_anim_${index}_${clip.rawClip.name.replace(/\s+/g, '_')}`,
            name: clip.rawClip.name || `Animation ${index + 1}`,
            category: 'Human Animations',
            sourceUrl: '/human_animations.glb',
            skeletonType: 'native' as const,
            duration: clip.duration,
            trackCount: clip.trackCount,
            clipIndex: index,
          }));
          setClips(mappedClips);
        } else {
          setClips([]);
        }
      } catch (err) {
        console.error("Failed to dynamically load human animations GLB catalog:", err);
        if (active) {
          setClips([]);
        }
      }
    });
    return () => {
      active = false;
    };
  }, [clips.length, setClips]);

  const modelRef = useRef<THREE.Object3D | null>(null);
  const gizmoProxyRef = useRef<THREE.Group>(null);
  const isDraggingGizmoRef = useRef(false);

  // 1. Dynamic Width State (Default 400px)
  const isResizing = useRef(false);
  const wasSidebarVisible = useRef<boolean>(true);
  const wasInspectorVisible = useRef<boolean>(true);

  // 2. Mouse Handlers
  const startResizing = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none'; // Prevent text selection while dragging
  }, []);

  const stopResizing = useCallback(() => {
    if (isResizing.current) {
      isResizing.current = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    }
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing.current) {
      // Calculate new width based on mouse distance from the right edge of the screen
      const newWidth = window.innerWidth - e.clientX;
      // Constrain width between 320px (min) and 80% of screen width (max)
      setPanelWidth(Math.max(320, Math.min(newWidth, window.innerWidth * 0.8)));
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  const [activeTab, setActiveTab] = useState<'rigging' | 'physics_paint' | 'cinematics' | 'animation'>('rigging');
  const [xRay, setXRay] = useState<boolean>(true);
  const [testPose, setTestPose] = useState<boolean>(false);
  const [animTime, setAnimTime] = useState<number>(0);
  const [gizmoMode, setGizmoMode] = useState<'translate' | 'rotate'>('translate');
  const [isSkinBound, setIsSkinBound] = useState<boolean>(false);
  const [hasNativeSkin, setHasNativeSkin] = useState<boolean>(false);
  const [animationRigJoints, setAnimationRigJoints] = useState<JointData[]>([]);

  // Reset hasNativeSkin and animationRigJoints when previewedAssetId changes
  useEffect(() => {
    setHasNativeSkin(false);
    setAnimationRigJoints([]);
  }, [previewedAssetId]);

  // Brush options for Material Physics painting
  const [brushPhysicsType, setBrushPhysicsType] = useState<'rigid' | 'hair' | 'jiggle' | 'cloth'>('hair');
  const [brushRadius, setBrushRadius] = useState<number>(0.15);
  const [brushStrength, setBrushStrength] = useState<number>(1.0);

  // Dynamic physics solver parameters
  const [hairFrequency, setHairFrequency] = useState<number>(4.0);
  const [hairStiffness, setHairStiffness] = useState<number>(0.3);
  const [jiggleElasticity, setJiggleElasticity] = useState<number>(15.0);
  const [jiggleDamping, setJiggleDamping] = useState<number>(2.0);
  const [clothGravity, setClothGravity] = useState<number>(1.0);
  const [clothDrag, setClothDrag] = useState<number>(0.1);
  const [enableWind, setEnableWind] = useState<boolean>(true);

  // Sync activeTab with activeTool from TopBar
  useEffect(() => {
    if (activeTool === 'physics_brush') {
      setActiveTab('physics_paint');
    } else if (activeTool === 'cinematics_lab') {
      setActiveTab('cinematics');
    } else if (activeTool === 'animations') {
      setActiveTab('animation');
    } else if (activeTool === 'skeleton_rig') {
      setActiveTab('rigging');
    }
  }, [activeTool]);

  // Auto-sync previewedAssetId with selectedIds[0] when in the rigging workspace
  const selectedId = selectedIds[0];
  useEffect(() => {
    if (previewedAssetId && selectedId && selectedId !== previewedAssetId) {
      setPreviewedAsset(selectedId);
    }
  }, [selectedId, previewedAssetId, setPreviewedAsset]);

  // Auto-open rigging workspace when animation/rigging tools are active
  useEffect(() => {
    if ((activeTool === 'animations' || activeTool === 'skeleton_rig') && !previewedAssetId) {
      const targetId = selectedIds[0] || 'obj_player';
      setPreviewedAsset(targetId);
    }
  }, [activeTool, previewedAssetId, selectedIds, setPreviewedAsset]);

  // Reset activeTool to select when rigging workspace is closed
  useEffect(() => {
    if (!previewedAssetId && (activeTool === 'animations' || activeTool === 'skeleton_rig')) {
      setActiveTool('select');
    }
  }, [previewedAssetId, activeTool, setActiveTool]);

  // Auto-set activeTool to skeleton_rig when workspace is opened with select tool
  useEffect(() => {
    if (previewedAssetId && activeTool === 'select') {
      setActiveTool('skeleton_rig');
    }
  }, [previewedAssetId, activeTool, setActiveTool]);

  // Collapse and restore sidebars to maximize workspace space
  useEffect(() => {
    if (previewedAssetId) {
      wasSidebarVisible.current = useStore.getState().sidebarVisible;
      wasInspectorVisible.current = useStore.getState().inspectorVisible;
      useStore.setState({ sidebarVisible: false, inspectorVisible: true });
    } else {
      useStore.setState({
        sidebarVisible: wasSidebarVisible.current,
        inspectorVisible: wasInspectorVisible.current,
      });
    }
  }, [previewedAssetId]);

  const asset = useMemo(() => objects.find((o) => o.id === previewedAssetId), [objects, previewedAssetId]);

  const invScaleFactor = useMemo(() => {
    if (!asset) return 1;
    const s = asset.scale || [1, 1, 1];
    return 1 / s[0];
  }, [asset]);

  // Bind W and E keys to translate and rotate mode switcher
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTagName = document.activeElement?.tagName;
      if (activeTagName === 'INPUT' || activeTagName === 'TEXTAREA') return;

      if (e.key === 'w' || e.key === 'W') {
        setGizmoMode('translate');
      } else if (e.key === 'e' || e.key === 'E') {
        setGizmoMode('rotate');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Tick timer loop for procedural skeletal branch waving in test pose mode
  useEffect(() => {
    let frameId: number;
    const tick = () => {
      if (testPose) {
        setAnimTime((t) => t + 0.04);
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [testPose]);

  const joints = useMemo(() => {
    if (activeTab === 'animation' && animationRigJoints.length > 0) {
      return animationRigJoints;
    }
    return asset?.joints || [];
  }, [asset, activeTab, animationRigJoints]);

  // Computes real-time cascading forward-kinematic branch waving in Test Pose Mode
  const animatedJoints = useMemo(() => {
    if (!joints || joints.length === 0) return [];
    if (!testPose) return joints;

    return joints.map((joint) => {
      if (joint.parentId) {
        const parent = joints.find((j) => j.id === joint.parentId);
        if (parent) {
          // Dynamic offset from parent joint
          const dx = joint.position[0] - parent.position[0];
          const dy = joint.position[1] - parent.position[1];
          const dz = joint.position[2] - parent.position[2];

          // Compute smooth wave rotation angle around parent joint
          const angle = Math.sin(animTime + joint.id.charCodeAt(5) * 0.2) * 0.35;
          const rx = dx * Math.cos(angle) - dz * Math.sin(angle);
          const rz = dx * Math.sin(angle) + dz * Math.cos(angle);

          return {
            ...joint,
            position: [parent.position[0] + rx, parent.position[1] + dy, parent.position[2] + rz] as [number, number, number],
          };
        }
      } else {
        // Root bone gently sways
        const sway = Math.sin(animTime) * 0.15;
        return {
          ...joint,
          position: [joint.position[0] + sway, joint.position[1], joint.position[2]] as [number, number, number],
        };
      }
      return joint;
    });
  }, [joints, testPose, animTime]);

  const selectedJoint = joints.find((j) => j.id === selectedJointId);

  const selectedBone = useMemo(() => {
    if (!modelRef.current || !selectedJointId) return null;
    let found: THREE.Object3D | null = null;
    modelRef.current.traverse((child) => {
      if (child.uuid === selectedJointId || child.name === selectedJoint?.name) {
        found = child;
      }
    });
    return found;
  }, [modelRef.current, selectedJointId, selectedJoint]);

  useEffect(() => {
    if (isDraggingGizmoRef.current) return;
    if (!gizmoProxyRef.current) return;
    if (selectedJoint && selectedJoint.ikEnabled) {
      const targetCoords = selectedJoint.ikTarget || selectedJoint.position;
      if (modelRef.current) {
        modelRef.current.updateMatrixWorld(true);
        const targetPos = new THREE.Vector3(...targetCoords);
        const worldTarget = targetPos.clone().applyMatrix4(modelRef.current.matrixWorld);
        gizmoProxyRef.current.position.copy(worldTarget);
        gizmoProxyRef.current.rotation.set(0, 0, 0);
      }
    } else if (selectedBone) {
      selectedBone.updateMatrixWorld(true);
      const worldPos = new THREE.Vector3();
      selectedBone.getWorldPosition(worldPos);
      gizmoProxyRef.current.position.copy(worldPos);
      gizmoProxyRef.current.rotation.copy(selectedBone.rotation);
    }
  }, [selectedBone, selectedJointId, selectedJoint?.ikEnabled, selectedJoint?.ikTarget, selectedJoint?.position]);

  if (!asset) return null;

  const handleAddBone = () => {
    const parentId = selectedJointId;
    const newId = `joint_${crypto.randomUUID()}`;
    const newName = `Joint_${joints.length + 1}`;

    const parentPos: [number, number, number] = selectedJoint ? selectedJoint.position : [0, 0, 0];
    const position: [number, number, number] = [
      parentPos[0],
      parentPos[1] + 0.3,
      parentPos[2],
    ];

    addJoint(asset.id, {
      id: newId,
      name: newName,
      position,
      rotation: [0, 0, 0],
      parentId,
    });

    setSelectedJointId(newId);
  };

  return (
    <div 
      className="absolute right-0 top-0 h-full bg-neutral-900 border-l-2 border-neutral-700 shadow-[0_0_50px_rgba(0,0,0,0.5)] z-40 flex flex-col"
      style={{ width: `${panelWidth}px` }}
    >
      {/* DRAG HANDLE */}
      <div 
        className="absolute left-0 top-0 h-full w-5 cursor-col-resize group z-[999]"
        style={{ transform: 'translateX(-50%)' }}
        onMouseDown={startResizing}
      >
        {/* Inner visual high-contrast grab line */}
        <div className="mx-auto w-[2px] h-full bg-neutral-700/80 group-hover:bg-sky-500 transition-colors" />
      </div>

      {/* Panel Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-neutral-900/50">
        <div className="flex items-center gap-1.5">
          <Clapperboard size={13} className="text-sky-400" />
          <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-300">Rigging Workspace</span>
        </div>
        <button
          onClick={() => setPreviewedAsset(null)}
          className="text-text-secondary hover:text-text-primary p-0.5 hover:bg-neutral-800 rounded transition-colors cursor-pointer flex items-center justify-center"
        >
          <X size={14} />
        </button>
      </div>

      {/* Context Banners */}
      {activeTab === 'rigging' && (
        <div className="w-full bg-blue-500/20 border-b border-blue-500/50 p-2 text-center shrink-0">
          <span className="text-xs font-bold text-blue-400 tracking-widest uppercase">Rigging Workspace</span>
        </div>
      )}

      {activeTab === 'animation' && (
        <div className="w-full bg-amber-500/20 border-b border-amber-500/50 p-2 text-center shrink-0">
          <span className="text-xs font-bold text-amber-400 tracking-widest uppercase">Animation Studio</span>
        </div>
      )}

      {activeTab === 'cinematics' && ( // "Director's Lab"
        <div className="w-full bg-purple-500/20 border-b border-purple-500/50 p-2 text-center shrink-0">
          <span className="text-xs font-bold text-purple-400 tracking-widest uppercase">Director's Lab: Cinematics</span>
        </div>
      )}

      {activeTab === 'physics_paint' && (
        <div className="w-full bg-emerald-500/20 border-b border-emerald-500/50 p-2 text-center shrink-0">
          <span className="text-xs font-bold text-emerald-400 tracking-widest uppercase">Physics Weight Painting</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border bg-bg-panel/40 px-2 shrink-0 justify-between items-center pr-3">
        <div className="flex">
          <button
            onClick={() => {
              setActiveTab('rigging');
              setActiveTool('skeleton_rig');
            }}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 
            ${activeTab === 'rigging' 
              ? 'border-sky-400 text-white bg-sky-500/10' 
              : 'border-transparent text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800'}`}
          >
            <Bone size={10} /> 3D Viewport
          </button>
          <button
            onClick={() => {
              setActiveTab('physics_paint');
              setActiveTool('physics_brush');
            }}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 
            ${activeTab === 'physics_paint' 
              ? 'border-emerald-400 text-white bg-emerald-500/10' 
              : 'border-transparent text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800'}`}
          >
            <Brush size={10} /> Physics Paint
          </button>
          <button
            onClick={() => {
              setActiveTab('animation');
              setActiveTool('animations');
            }}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 
            ${activeTab === 'animation' 
              ? 'border-amber-400 text-white bg-amber-500/10' 
              : 'border-transparent text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800'}`}
          >
            <Play size={10} /> Animation Studio
          </button>
          <button
            onClick={() => {
              setActiveTab('cinematics');
              setActiveTool('cinematics_lab');
            }}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-all flex items-center gap-2 
            ${activeTab === 'cinematics' 
              ? 'border-purple-400 text-white bg-purple-500/10' 
              : 'border-transparent text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800'}`}
          >
            <Video size={10} /> Director's Lab
          </button>
        </div>

        {/* Dynamic Controls Toggles */}
        {(activeTab === 'rigging' || activeTab === 'physics_paint' || activeTab === 'cinematics' || activeTab === 'animation') && (
          <div className="flex gap-2">
            <button
              onClick={() => setInsymmetryEnabled(!insymmetryEnabled)}
              className={`p-1 rounded transition-colors cursor-pointer flex items-center justify-center ${insymmetryEnabled ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'text-neutral-500 hover:text-neutral-300 border border-transparent'}`}
              title="Toggle Insymmetry (Procedural Asymmetry)"
            >
              <Activity size={12} />
            </button>
            <button
              onClick={() => toggleSymmetry()}
              className={`p-1 rounded transition-colors cursor-pointer flex items-center justify-center ${symmetryEnabled ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-neutral-500 hover:text-neutral-300 border border-transparent'}`}
              title="Toggle Symmetry / Mirror Mode"
            >
              <GitCompare size={12} />
            </button>
            <button
              onClick={() => setXRay(!xRay)}
              className={`p-1 rounded transition-colors cursor-pointer flex items-center justify-center ${xRay ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30' : 'text-neutral-500 hover:text-neutral-300 border border-transparent'}`}
              title="Toggle X-Ray Skeleton Mode"
            >
              <Eye size={12} />
            </button>
            <button
              onClick={() => setTestPose(!testPose)}
              className={`p-1 rounded transition-colors cursor-pointer flex items-center justify-center ${testPose ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-neutral-500 hover:text-neutral-300 border border-transparent'}`}
              title="Toggle Test Pose Branch Waving"
            >
              {testPose ? <Pause size={12} /> : <Play size={12} />}
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Interactive Isolated Rigging Canvas */}
        <div className="flex-1 bg-neutral-950 relative overflow-hidden min-h-0">
          <ErrorBoundary>
            <Canvas
              camera={{ position: [2, 2, 2], fov: 50 }}
              onCreated={({ gl }) => {
                // Patch WebGLRenderer's getContextAttributes
                const originalRendererGetContextAttributes = gl.getContextAttributes.bind(gl);
                gl.getContextAttributes = () => {
                  return originalRendererGetContextAttributes() || {
                    alpha: false,
                    depth: true,
                    stencil: false,
                    antialias: false,
                    premultipliedAlpha: true,
                    preserveDrawingBuffer: false,
                    failIfMajorPerformanceCaveat: false,
                    powerPreference: 'default',
                  };
                };

                // Patch WebGLRenderingContext's getContextAttributes to prevent postprocessing composer crashes on context loss
                const ctx = gl.getContext();
                if (ctx) {
                  const originalCtxGetContextAttributes = ctx.getContextAttributes.bind(ctx);
                  ctx.getContextAttributes = () => {
                    return originalCtxGetContextAttributes() || {
                      alpha: false,
                      depth: true,
                      stencil: false,
                      antialias: false,
                      premultipliedAlpha: true,
                      preserveDrawingBuffer: false,
                      failIfMajorPerformanceCaveat: false,
                      powerPreference: 'default',
                    };
                  };
                }
              }}
            >
            <ambientLight intensity={0.5} />
            <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
            <OrbitControls
              makeDefault
              mouseButtons={{
                LEFT: (activeTab === 'physics_paint' ? 99 : THREE.MOUSE.ROTATE) as any,
                MIDDLE: THREE.MOUSE.DOLLY,
                RIGHT: activeTab === 'physics_paint' ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
              }}
            />

            {/* Grid indicator */}
            <gridHelper args={[10, 10, '#333', '#1f1f23']} position={[0, -0.01, 0]} />

            <Suspense fallback={null}>
              {/* The invisible World-Space Proxy */}
              <group ref={gizmoProxyRef} />

              {selectedJointId && selectedBone && gizmoProxyRef.current && !testPose && !hasNativeSkin && (
                <TransformControls
                  object={gizmoProxyRef.current}
                  mode={selectedJoint?.ikEnabled ? 'translate' : gizmoMode}
                  size={0.65}
                  onMouseDown={() => {
                    isDraggingGizmoRef.current = true;
                  }}
                  onMouseUp={() => {
                    isDraggingGizmoRef.current = false;
                  }}
                  onObjectChange={() => {
                    if (!gizmoProxyRef.current) return;
                    if (selectedJoint && selectedJoint.ikEnabled && modelRef.current) {
                      // 1. Get new target position in model space
                      const worldTargetPos = gizmoProxyRef.current.position.clone();
                      const localTargetPos = modelRef.current.worldToLocal(worldTargetPos.clone());
                      
                      // 2. Solve FABRIK
                      const updates = solveFABRIK(joints, selectedJointId, [
                        localTargetPos.x,
                        localTargetPos.y,
                        localTargetPos.z,
                      ]);
                      
                      // 3. Batch updates to the store
                      updates.forEach((upd) => {
                        updateJoint(asset.id, upd.id, {
                          position: upd.position,
                          rotation: upd.rotation,
                        });
                      });
                      
                      // 4. Update the target itself in the store
                      updateJoint(asset.id, selectedJointId, {
                        ikTarget: [localTargetPos.x, localTargetPos.y, localTargetPos.z],
                      });
                    } else if (selectedBone) {
                      let counterpartBone: THREE.Object3D | null = null;
                      // 1. Update the actual bone in Three.js scene graph for real-time deforms
                      if (selectedBone.parent) {
                        const newWorldPos = gizmoProxyRef.current.position.clone();
                        selectedBone.parent.worldToLocal(newWorldPos);
                        selectedBone.position.copy(newWorldPos);
                        
                        if (gizmoMode === 'rotate') {
                          selectedBone.rotation.copy(gizmoProxyRef.current.rotation);
                        }

                        const currentSymmetry = useStore.getState().symmetryEnabled;
                        if (currentSymmetry && selectedJoint && modelRef.current) {
                          const mirrorName = getMirrorJointName(selectedJoint.name);
                          if (mirrorName !== selectedJoint.name) {
                            modelRef.current.traverse((child) => {
                              if (child.name === mirrorName) counterpartBone = child;
                            });

                            if (counterpartBone && counterpartBone.parent) {
                              // Find the skeletal root bone (highest bone ancestor)
                              let skelRoot: THREE.Object3D = modelRef.current;
                              let curr: THREE.Object3D | null = selectedBone;
                              const jointNames = new Set(joints.map((j) => j.name));
                              while (curr && curr !== modelRef.current) {
                                if ((curr as any).isBone || curr.name.startsWith('AutoRig_') || curr.name.startsWith('Joint_') || jointNames.has(curr.name)) {
                                  skelRoot = curr;
                                }
                                curr = curr.parent;
                              }

                              // Get selected bone's world matrix
                              selectedBone.updateMatrixWorld(true);
                              const selWorldMatrix = selectedBone.matrixWorld.clone();

                              // Convert to skelRoot-local matrix
                              skelRoot.updateMatrixWorld(true);
                              const skelRootInverse = skelRoot.matrixWorld.clone().invert();
                              const selLocalMatrix = selWorldMatrix.premultiply(skelRootInverse);

                              // Mirror the matrix across the sagittal plane in skelRoot space
                              const axis = getMirrorAxis(joints);
                              const mirLocalMatrix = mirrorBoneMatrix(selLocalMatrix, axis);

                              // Convert mirrored matrix back to world matrix
                              const cpWorldMatrix = skelRoot.matrixWorld.clone().multiply(mirLocalMatrix);

                              // Convert to counterpart's parent local space
                              counterpartBone.parent.updateMatrixWorld(true);
                              const cpParentInverse = counterpartBone.parent.matrixWorld.clone().invert();
                              const cpLocalMatrix = cpParentInverse.multiply(cpWorldMatrix);

                              // Decompose cpLocalMatrix to get position, rotation, scale
                              const cpPos = new THREE.Vector3();
                              const cpQuat = new THREE.Quaternion();
                              const cpScale = new THREE.Vector3();
                              cpLocalMatrix.decompose(cpPos, cpQuat, cpScale);

                              // Apply updates based on gizmo mode
                              if (gizmoMode === 'translate') {
                                counterpartBone.position.copy(cpPos);
                              } else if (gizmoMode === 'rotate') {
                                counterpartBone.quaternion.copy(cpQuat);
                              }
                              
                              counterpartBone.updateMatrixWorld(true);
                            }
                          }
                        }
                      }
                      
                      // 2. Update Zustand store coordinates (relative to model space)
                      selectedBone.updateMatrixWorld(true);
                      if (counterpartBone) {
                        counterpartBone.updateMatrixWorld(true);
                      }
                      if (modelRef.current) {
                        modelRef.current.updateMatrixWorld(true);
                      }
                      const worldPos = new THREE.Vector3();
                      selectedBone.getWorldPosition(worldPos);
                      const localPos = modelRef.current!.worldToLocal(worldPos);
                      
                      if (gizmoMode === 'translate') {
                        // Update selected bone
                        updateJoint(asset.id, selectedJointId, {
                          position: [localPos.x, localPos.y, localPos.z],
                        }, true);

                        // Update counterpart bone if symmetry is enabled
                        if (currentSymmetry && counterpartBone) {
                          const cpName = getMirrorJointName(selectedJoint.name);
                          const counterpartJoint = asset.joints?.find((j) => j.name === cpName);
                          if (counterpartJoint) {
                            const cpWorldPos = new THREE.Vector3();
                            counterpartBone.getWorldPosition(cpWorldPos);
                            const cpLocalPos = modelRef.current!.worldToLocal(cpWorldPos);
                            updateJoint(asset.id, counterpartJoint.id, {
                              position: [cpLocalPos.x, cpLocalPos.y, cpLocalPos.z],
                            }, true);
                          }
                        }
                      } else if (gizmoMode === 'rotate') {
                        const rx = THREE.MathUtils.radToDeg(selectedBone.rotation.x);
                        const ry = THREE.MathUtils.radToDeg(selectedBone.rotation.y);
                        const rz = THREE.MathUtils.radToDeg(selectedBone.rotation.z);
                        updateJoint(asset.id, selectedJointId, {
                          rotation: [rx, ry, rz],
                        }, true);

                        // Update counterpart bone rotation if symmetry is enabled
                        if (currentSymmetry && counterpartBone) {
                          const cpName = getMirrorJointName(selectedJoint.name);
                          const counterpartJoint = asset.joints?.find((j) => j.name === cpName);
                          if (counterpartJoint) {
                            const crx = THREE.MathUtils.radToDeg(counterpartBone.rotation.x);
                            const cry = THREE.MathUtils.radToDeg(counterpartBone.rotation.y);
                            const crz = THREE.MathUtils.radToDeg(counterpartBone.rotation.z);
                            updateJoint(asset.id, counterpartJoint.id, {
                              rotation: [crx, cry, crz],
                            }, true);
                          }
                        }
                      }
                    }
                  }}
                />
              )}

              <group rotation={asset.rotation} scale={asset.scale}>
                {/* Asset Geometry */}
                {asset.type === 'gltf' && asset.url ? (
                  <MiniGltfModel
                    key={asset.url}
                    url={asset.url}
                    xRay={xRay}
                    activeTab={activeTab}
                    brushPhysicsType={brushPhysicsType}
                    brushRadius={brushRadius}
                    brushStrength={brushStrength}
                    asset={asset}
                    updateObject={updateObject}
                    animTime={animTime}
                    testPose={testPose}
                    hairFrequency={hairFrequency}
                    hairStiffness={hairStiffness}
                    jiggleElasticity={jiggleElasticity}
                    jiggleDamping={jiggleDamping}
                    clothGravity={clothGravity}
                    clothDrag={clothDrag}
                    enableWind={enableWind}
                    modelRef={modelRef}
                    joints={joints}
                    animatedJoints={animatedJoints}
                    isSkinBound={isSkinBound}
                    gizmoDraggingRef={isDraggingGizmoRef}
                    onSkeletonDetected={setHasNativeSkin}
                    onAnimationRigLoaded={setAnimationRigJoints}
                  />
                ) : (asset.type as string) === 'fbx' && asset.url ? (
                  <MiniFbxModel
                    key={asset.url}
                    url={asset.url}
                    xRay={xRay}
                    activeTab={activeTab}
                    brushPhysicsType={brushPhysicsType}
                    brushRadius={brushRadius}
                    brushStrength={brushStrength}
                    asset={asset}
                    updateObject={updateObject}
                    animTime={animTime}
                    testPose={testPose}
                    hairFrequency={hairFrequency}
                    hairStiffness={hairStiffness}
                    jiggleElasticity={jiggleElasticity}
                    jiggleDamping={jiggleDamping}
                    clothGravity={clothGravity}
                    clothDrag={clothDrag}
                    enableWind={enableWind}
                    modelRef={modelRef}
                    joints={joints}
                    animatedJoints={animatedJoints}
                    isSkinBound={isSkinBound}
                    gizmoDraggingRef={isDraggingGizmoRef}
                    onSkeletonDetected={setHasNativeSkin}
                    onAnimationRigLoaded={setAnimationRigJoints}
                  />
                ) : (
                  <MiniMeshModel
                    key={asset.id}
                    geometry={asset.geometry}
                    material={asset.material}
                    xRay={xRay}
                    joints={joints}
                    animatedJoints={animatedJoints}
                    activeTab={activeTab}
                    brushPhysicsType={brushPhysicsType}
                    brushRadius={brushRadius}
                    brushStrength={brushStrength}
                    asset={asset}
                    updateObject={updateObject}
                    testPose={testPose}
                    animTime={animTime}
                    hairFrequency={hairFrequency}
                    hairStiffness={hairStiffness}
                    jiggleElasticity={jiggleElasticity}
                    jiggleDamping={jiggleDamping}
                    clothGravity={clothGravity}
                    clothDrag={clothDrag}
                    enableWind={enableWind}
                    modelRef={modelRef}
                    isSkinBound={isSkinBound}
                    gizmoDraggingRef={isDraggingGizmoRef}
                    onSkeletonDetected={setHasNativeSkin}
                    onAnimationRigLoaded={setAnimationRigJoints}
                  />
                )}

                {/* Render 3D blender-style octahedron bones connecting nodes */}
                {activeTab === 'rigging' && !hasNativeSkin && animatedJoints.map((joint) => {
                  if (joint.parentId) {
                    const parent = animatedJoints.find((j) => j.id === joint.parentId);
                    if (parent) {
                      return (
                        <BoneVisual
                          key={`bone-vis-${joint.id}`}
                          start={joint.position}
                          end={parent.position}
                          invScaleFactor={invScaleFactor}
                        />
                      );
                    }
                  }
                  return null;
                })}

                {/* Render glowing line skeleton tracks (native THREE.Line to avoid LineMaterial shader leaks) */}
                {activeTab === 'rigging' && !hasNativeSkin && animatedJoints.map((joint) => {
                  if (joint.parentId) {
                    const parent = animatedJoints.find((j) => j.id === joint.parentId);
                    if (parent) {
                      return (
                        <SimpleLine
                          key={`track-${joint.id}`}
                          start={joint.position}
                          end={parent.position}
                          color="#eab308"
                        />
                      );
                    }
                  }
                  return null;
                })}

                {/* Visual Selected Parent Indicator (glowing cyan line to parent bone) */}
                {(() => {
                  if (activeTab !== 'rigging' || !selectedJointId || hasNativeSkin) return null;
                  const activeJoint = animatedJoints.find((j) => j.id === selectedJointId);
                  if (!activeJoint || !activeJoint.parentId) return null;
                  const parentJoint = animatedJoints.find((j) => j.id === activeJoint.parentId);
                  if (!parentJoint) return null;
                  return (
                    <SimpleLine
                      start={activeJoint.position}
                      end={parentJoint.position}
                      color="#22d3ee"
                    />
                  );
                })()}

                {/* Interactive rigging joint spheres */}
                {activeTab === 'rigging' && !hasNativeSkin && animatedJoints.map((joint) => (
                  <RiggingJoint
                    key={joint.id}
                    joint={joint}
                    objectId={asset.id}
                    updateJoint={updateJoint}
                    selectedJointId={selectedJointId}
                    setSelectedJointId={setSelectedJointId}
                    testPose={testPose}
                    gizmoMode={gizmoMode}
                    invScaleFactor={invScaleFactor}
                  />
                ))}

                {/* IK Target Visualizer Handles */}
                {activeTab === 'rigging' && !hasNativeSkin && animatedJoints.map((joint) => {
                  if (joint.ikEnabled) {
                    const targetCoords = joint.ikTarget || joint.position;
                    const isSelected = selectedJointId === joint.id;
                    return (
                      <mesh
                        key={`ik-target-${joint.id}`}
                        position={targetCoords}
                        onClick={(e) => {
                          e.stopPropagation();
                           setSelectedJointId(joint.id);
                        }}
                      >
                        <sphereGeometry args={[0.024, 16, 16]} />
                        <meshBasicMaterial
                          color={isSelected ? '#eab308' : '#ef4444'}
                          wireframe
                          depthTest={false}
                          transparent
                          opacity={0.8}
                        />
                      </mesh>
                    );
                  }
                  return null;
                })}
              </group>
            </Suspense>
          </Canvas>
        </ErrorBoundary>

          {/* Selection HUD overlay */}
          <div className="absolute top-3 left-3 bg-neutral-900/90 border border-border px-2 py-1.5 rounded text-[8px] font-mono text-neutral-400 pointer-events-none space-y-1 shadow-lg z-10">
            <div>Preview Model: <strong className="text-white">{asset.name}</strong></div>
            {activeTab === 'physics_paint' ? (
              <>
                <div>Physics Mode: <strong className="text-pink-400">BRUSH WEIGH PAINT</strong></div>
                <div>Vertices Painted: <strong className="text-sky-400">{Object.keys(asset.paintedPhysics || {}).length}</strong></div>
              </>
            ) : (
              <>
                <div>Joints Count: <strong className="text-sky-400">{joints.length}</strong></div>
                <div>Selected Joint: <strong className="text-amber-400">{selectedJoint ? selectedJoint.name : 'None'}</strong></div>
              </>
            )}
            <div>Viewport Mode: <strong className={testPose ? 'text-emerald-400' : 'text-sky-400'}>{testPose ? 'PHYSICS PREVIEW' : 'EDIT MODE'}</strong></div>
          </div>

          {/* Segmented Gizmo mode toggle overlay */}
          {!testPose && selectedJointId && activeTab !== 'physics_paint' && (
            <div className="absolute top-3 right-3 bg-neutral-900/90 border border-border px-1.5 py-1 rounded flex gap-1 shadow-lg select-none items-center z-10">
              <button
                onClick={() => setGizmoMode('translate')}
                className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded transition-colors cursor-pointer ${gizmoMode === 'translate' ? 'bg-sky-500 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
                title="Translate mode (Press W)"
              >
                Translate [W]
              </button>
              <button
                onClick={() => setGizmoMode('rotate')}
                className={`px-2 py-0.5 text-[8px] font-bold uppercase rounded transition-colors cursor-pointer ${gizmoMode === 'rotate' ? 'bg-sky-500 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800'}`}
                title="Rotate mode (Press E)"
              >
                Rotate [E]
              </button>
            </div>
          )}

          {/* Bone Properties & IK Controller Overlay */}
          {!testPose && selectedJointId && activeTab !== 'physics_paint' && (
            <div className="absolute top-12 right-3 bg-neutral-900/90 border border-border p-2.5 rounded flex flex-col gap-2 shadow-lg select-none z-10 w-40 backdrop-blur-md">
              <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 border-b border-neutral-800 pb-1">
                Bone Properties
              </div>
              <div className="text-[10px] font-bold text-neutral-200 truncate">
                {selectedJoint ? selectedJoint.name : 'Unknown Joint'}
              </div>
              
              <div className="flex flex-col gap-1.5 mt-0.5">
                <button
                  onClick={() => {
                    if (!selectedJoint) return;
                    const nextIk = !selectedJoint.ikEnabled;
                    updateJoint(asset.id, selectedJointId, {
                      ikEnabled: nextIk,
                      ikTarget: nextIk ? selectedJoint.position : undefined,
                    });
                  }}
                  className={`py-1 rounded text-[8px] font-extrabold border uppercase tracking-wider transition-all cursor-pointer ${selectedJoint?.ikEnabled ? 'bg-amber-500/20 border-amber-400 text-amber-400' : 'bg-neutral-950 border-neutral-850 text-neutral-400 hover:text-neutral-200'}`}
                >
                  {selectedJoint?.ikEnabled ? '🟢 IK Solver ON' : '⚫ FK Mode (Manual)'}
                </button>
                
                {selectedJoint?.ikEnabled && (
                  <button
                    onClick={() => {
                      if (!selectedJoint) return;
                      // Reset target position to current joint position
                      updateJoint(asset.id, selectedJointId, {
                        ikTarget: selectedJoint.position,
                      });
                      // If we are currently referencing the proxy, snap it too
                      if (gizmoProxyRef.current && modelRef.current) {
                        modelRef.current.updateMatrixWorld(true);
                        const worldPos = new THREE.Vector3(...selectedJoint.position).applyMatrix4(modelRef.current.matrixWorld);
                        gizmoProxyRef.current.position.copy(worldPos);
                      }
                    }}
                    className="py-1 rounded text-[8px] font-bold border border-neutral-800 text-neutral-400 bg-neutral-950 hover:bg-neutral-900 hover:text-neutral-200 transition-colors cursor-pointer"
                  >
                    Reset IK Target
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Floating Physics Brush HUD Controller */}
          {activeTab === 'physics_paint' && (
            <div className="absolute bottom-3 left-3 right-3 bg-neutral-950/95 border border-neutral-800 p-3 rounded-lg shadow-2xl z-20 flex flex-col gap-2.5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Brush size={12} className="text-amber-400 animate-pulse" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-200">Material Weight Brush</span>
                </div>
                <span className="text-[8px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded">
                  PRESET: {brushPhysicsType.toUpperCase()}
                </span>
              </div>

              {/* Preset Selectors with harmonic color schemes */}
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'hair', name: '💇 Hair', color: 'border-fuchsia-500/50 text-fuchsia-400 bg-fuchsia-500/10' },
                  { id: 'jiggle', name: '💃 Jiggle', color: 'border-amber-500/50 text-amber-400 bg-amber-500/10' },
                  { id: 'cloth', name: '🧥 Cloth', color: 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10' },
                  { id: 'rigid', name: '🧱 Rigid', color: 'border-sky-500/50 text-sky-400 bg-sky-500/10' },
                ].map((pres) => (
                  <button
                    key={pres.id}
                    onClick={() => setBrushPhysicsType(pres.id as any)}
                    className={`py-1.5 rounded text-[8px] font-bold border transition-all cursor-pointer ${brushPhysicsType === pres.id ? pres.color + ' ring-1 ring-white/10 scale-[1.03] shadow-md shadow-black/40' : 'border-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 bg-neutral-950'}`}
                  >
                    {pres.name}
                  </button>
                ))}
              </div>

              {/* Sliders for Radius & Strength */}
              <div className="flex gap-4 items-center mt-1">
                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex justify-between text-[8px] font-mono text-neutral-400">
                    <span>Brush Size</span>
                    <span className="text-white font-bold">{brushRadius.toFixed(2)}m</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.5"
                    step="0.01"
                    value={brushRadius}
                    onChange={(e) => setBrushRadius(parseFloat(e.target.value))}
                    className="w-full h-1 bg-neutral-900 border border-neutral-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>
                <div className="flex-1 flex flex-col gap-1">
                  <div className="flex justify-between text-[8px] font-mono text-neutral-400">
                    <span>Weight Strength</span>
                    <span className="text-white font-bold">{(brushStrength * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.05"
                    value={brushStrength}
                    onChange={(e) => setBrushStrength(parseFloat(e.target.value))}
                    className="w-full h-1 bg-neutral-900 border border-neutral-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                </div>
              </div>

              {/* Choice-Driven Wind Toggle for dynamic presets */}
              {(brushPhysicsType === 'hair' || brushPhysicsType === 'cloth') && (
                <div className="flex items-center gap-2 mt-1 px-2.5 py-1.5 bg-neutral-900/50 rounded border border-neutral-800/40 select-none">
                  <input
                    type="checkbox"
                    id="wind-toggle"
                    checked={enableWind}
                    onChange={(e) => setEnableWind(e.target.checked)}
                    className="w-3 h-3 rounded bg-neutral-950 border border-neutral-800 text-sky-500 focus:ring-0 cursor-pointer accent-sky-500"
                  />
                  <label htmlFor="wind-toggle" className="text-[8px] font-bold uppercase tracking-wider text-neutral-400 cursor-pointer hover:text-neutral-300">
                    Enable Wind Influence
                  </label>
                </div>
              )}

              {/* Preset Specific Solver Parameters */}
              <div className="border-t border-neutral-850 pt-2.5 mt-1 flex flex-col gap-2">
                {brushPhysicsType === 'hair' && (
                  <div className="flex gap-4 items-center">
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex justify-between text-[8px] font-mono text-neutral-400">
                        <span>Sway Frequency</span>
                        <span className="text-fuchsia-400 font-bold">{hairFrequency.toFixed(1)} Hz</span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="10.0"
                        step="0.1"
                        value={hairFrequency}
                        onChange={(e) => setHairFrequency(parseFloat(e.target.value))}
                        className="w-full h-1 bg-neutral-900 border border-neutral-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex justify-between text-[8px] font-mono text-neutral-400">
                        <span>Stiffness</span>
                        <span className="text-fuchsia-400 font-bold">{hairStiffness.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={hairStiffness}
                        onChange={(e) => setHairStiffness(parseFloat(e.target.value))}
                        className="w-full h-1 bg-neutral-900 border border-neutral-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-500"
                      />
                    </div>
                  </div>
                )}

                {brushPhysicsType === 'jiggle' && (
                  <div className="flex gap-4 items-center">
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex justify-between text-[8px] font-mono text-neutral-400">
                        <span>Elasticity (k)</span>
                        <span className="text-amber-400 font-bold">{jiggleElasticity.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min="1.0"
                        max="50.0"
                        step="0.5"
                        value={jiggleElasticity}
                        onChange={(e) => setJiggleElasticity(parseFloat(e.target.value))}
                        className="w-full h-1 bg-neutral-900 border border-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex justify-between text-[8px] font-mono text-neutral-400">
                        <span>Damping (c)</span>
                        <span className="text-amber-400 font-bold">{jiggleDamping.toFixed(1)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="10.0"
                        step="0.1"
                        value={jiggleDamping}
                        onChange={(e) => setJiggleDamping(parseFloat(e.target.value))}
                        className="w-full h-1 bg-neutral-900 border border-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                      />
                    </div>
                  </div>
                )}

                {brushPhysicsType === 'cloth' && (
                  <div className="flex gap-4 items-center">
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex justify-between text-[8px] font-mono text-neutral-400">
                        <span>Gravity Scale</span>
                        <span className="text-emerald-400 font-bold">{clothGravity.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="5.0"
                        step="0.1"
                        value={clothGravity}
                        onChange={(e) => setClothGravity(parseFloat(e.target.value))}
                        className="w-full h-1 bg-neutral-900 border border-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex justify-between text-[8px] font-mono text-neutral-400">
                        <span>Air Drag</span>
                        <span className="text-emerald-400 font-bold">{clothDrag.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="1.0"
                        step="0.05"
                        value={clothDrag}
                        onChange={(e) => setClothDrag(parseFloat(e.target.value))}
                        className="w-full h-1 bg-neutral-900 border border-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                      />
                    </div>
                  </div>
                )}

                {brushPhysicsType === 'rigid' && (
                  <div className="text-[8px] text-center font-bold font-mono text-sky-400 bg-sky-950/20 border border-sky-900/30 rounded py-1.5">
                    🧱 RIGID ANCHOR: 0% deformation. Painted vertices will remain completely locked.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Floating Cinematics Lab HUD Controller */}
          {activeTab === 'cinematics' && (
            <div className="absolute bottom-3 left-3 right-3 bg-neutral-950/95 border border-purple-500/30 p-3 rounded-lg shadow-[0_0_20px_rgba(168,85,247,0.15)] z-20 flex flex-col gap-2.5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Video size={12} className="text-purple-400" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-200">Director's Camera Path Editor</span>
                </div>
                <span className="text-[8px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded">
                  CINEMATICS LAB
                </span>
              </div>

              <div className="flex gap-2 text-xs">
                <button className="flex-1 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20 transition-colors flex justify-center items-center gap-1">
                  <Circle size={10} className="fill-current" /> Record Camera Path
                </button>
                <button className="flex-1 py-1.5 bg-neutral-900 text-neutral-400 border border-neutral-800 rounded hover:text-white transition-colors">
                  Edit Spline Path
                </button>
                <button className="flex-1 py-1.5 bg-neutral-900 text-neutral-400 border border-neutral-800 rounded hover:text-white transition-colors">
                  Time Scale
                </button>
              </div>
            </div>
          )}

          {/* Floating Animation Studio HUD Controller */}
          {activeTab === 'animation' && (
            <div className="absolute bottom-3 left-3 right-3 bg-neutral-950/95 border border-neutral-800 p-3 rounded-lg shadow-2xl z-20 flex flex-col gap-2.5 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Play size={12} className="text-amber-400 animate-pulse" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-neutral-200">Animation Studio</span>
                </div>
                <button
                  onClick={() => setIsCatalogOpen(true)}
                  className="text-[8px] font-mono text-sky-400 bg-sky-950/30 border border-sky-800/40 px-2 py-0.5 rounded hover:bg-sky-900/40 transition-colors cursor-pointer"
                >
                  Browse Catalog ({clips.length} Clips)
                </button>
              </div>

              {/* Active Clip Display */}
              <div className="flex items-center justify-between bg-neutral-900/50 border border-neutral-800/60 rounded px-2.5 py-1.5">
                <div className="flex flex-col text-left">
                  <span className="text-[8px] text-neutral-500 font-mono uppercase tracking-wider">Active Clip</span>
                  <span className="text-[10px] font-bold text-neutral-200">
                    {activeClipId ? clips.find(c => c.id === activeClipId)?.name || 'Loading Clip...' : 'No Clip Selected'}
                  </span>
                </div>
                {activeClipId && (
                  <span className="text-[8px] font-mono text-neutral-400">
                    {currentTime.toFixed(2)}s / {(clips.find(c => c.id === activeClipId)?.duration || 0).toFixed(2)}s
                  </span>
                )}
              </div>

              {/* Timeline Scrubber */}
              {activeClipId && (
                <div className="flex flex-col gap-1">
                  <input
                    type="range"
                    min="0"
                    max={clips.find(c => c.id === activeClipId)?.duration || 1}
                    step="0.01"
                    value={currentTime}
                    onChange={(e) => {
                      const newTime = parseFloat(e.target.value);
                      setCurrentTime(newTime);
                    }}
                    className="w-full h-1 bg-neutral-900 border border-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              )}

              {/* Playback & Loop Transport Controls */}
              <div className="flex gap-2 items-center">
                {/* Play/Pause Button */}
                <button
                  onClick={() => setPlaying(!isPlaying)}
                  disabled={!activeClipId}
                  className={`p-1.5 rounded transition-all cursor-pointer flex items-center justify-center border shadow-sm ${!activeClipId ? 'opacity-45 cursor-not-allowed border-neutral-850 text-neutral-700' : isPlaying ? 'bg-amber-600 hover:bg-amber-500 border-amber-500 text-white' : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-750 text-neutral-200'}`}
                >
                  {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                </button>

                {/* Loop Mode Toggles */}
                <div className="flex bg-neutral-900 border border-neutral-850 rounded p-0.5">
                  {(['loop', 'once', 'pingpong'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setLoopMode(mode)}
                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-all cursor-pointer ${loopMode === mode ? 'bg-neutral-800 text-amber-400 font-extrabold shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                      title={`Loop mode: ${mode}`}
                    >
                      {mode === 'loop' ? '🔁' : mode === 'once' ? '➡️' : '🔀'}
                    </button>
                  ))}
                </div>

                {/* Speed Controls */}
                <div className="flex-1 flex items-center gap-1.5 pl-1.5">
                  <span className="text-[8px] font-mono text-neutral-500 uppercase">Speed</span>
                  <input
                    type="range"
                    min="0.25"
                    max="2.0"
                    step="0.05"
                    value={playbackSpeed}
                    onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                    className="flex-1 h-1 bg-neutral-900 border border-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <span className="text-[8px] font-mono text-neutral-350 w-8 text-right">{playbackSpeed.toFixed(2)}x</span>
                </div>
              </div>

              {insymmetryEnabled && (
                <div className="mt-2 pt-2 border-t border-neutral-900 flex flex-col gap-2 bg-neutral-900/20 p-2 rounded border border-neutral-800/40">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-indigo-400 mb-1 flex items-center gap-1">
                    <Activity size={10} /> Insymmetry Engine Controls
                  </div>
                  {/* Gait Asymmetry (Limp) */}
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-mono text-neutral-400 w-24 text-left uppercase">Gait Asymmetry (Limp)</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={gaitAsymmetry}
                      onChange={(e) => setGaitAsymmetry(parseFloat(e.target.value))}
                      className="flex-1 h-1 bg-neutral-900 border border-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-[8px] font-mono text-neutral-300 w-8 text-right">{(gaitAsymmetry * 100).toFixed(0)}%</span>
                  </div>
                  {/* Posture Bias (Lean) */}
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-mono text-neutral-400 w-24 text-left uppercase">Posture Bias (Lean)</span>
                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.05"
                      value={postureBias}
                      onChange={(e) => setPostureBias(parseFloat(e.target.value))}
                      className="flex-1 h-1 bg-neutral-900 border border-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-[8px] font-mono text-neutral-300 w-8 text-right">
                      {postureBias > 0 ? `R:${(postureBias * 100).toFixed(0)}%` : postureBias < 0 ? `L:${(Math.abs(postureBias) * 100).toFixed(0)}%` : '0%'}
                    </span>
                  </div>
                  {/* Dynamic Variance (Swagger) */}
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] font-mono text-neutral-400 w-24 text-left uppercase">Dynamic Swagger</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={dynamicVariance}
                      onChange={(e) => setDynamicVariance(parseFloat(e.target.value))}
                      className="flex-1 h-1 bg-neutral-900 border border-neutral-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                    <span className="text-[8px] font-mono text-neutral-300 w-8 text-right">{(dynamicVariance * 100).toFixed(0)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Floating Animation Catalog Drawer */}
          {activeTab === 'animation' && isCatalogOpen && (
            <div className="absolute inset-0 bg-neutral-950/95 border-b border-border z-30 flex flex-col p-4 animate-in fade-in zoom-in duration-200">
              <div className="flex items-center justify-between border-b border-neutral-850 pb-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <Search size={12} className="text-sky-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-200">Animation Library ({clips.length} Animations)</span>
                </div>
                <button
                  onClick={() => setIsCatalogOpen(false)}
                  className="text-text-secondary hover:text-text-primary p-0.5 hover:bg-neutral-800 rounded transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative mb-3 shrink-0">
                <input
                  type="text"
                  placeholder="Search animations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-850 rounded px-2.5 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-sky-500 transition-colors pl-8"
                />
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-350 text-[10px] font-bold font-mono"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Category Filter Tags */}
              <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-thin shrink-0 select-none">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase border transition-all cursor-pointer whitespace-nowrap ${selectedCategory === null ? 'bg-sky-500/20 border-sky-400 text-sky-400' : 'bg-neutral-900 border-neutral-850 text-neutral-450 hover:text-neutral-205'}`}
                >
                  All
                </button>
                {ANIMATION_CATEGORIES.map((cat) => {
                  const badge = CATEGORY_BADGES[cat] || '🎬';
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase border transition-all cursor-pointer whitespace-nowrap ${selectedCategory === cat ? 'bg-sky-500/20 border-sky-400 text-sky-400' : 'bg-neutral-900 border-neutral-850 text-neutral-450 hover:text-neutral-205'}`}
                    >
                      {badge} {cat}
                    </button>
                  );
                })}
              </div>

              {/* Clips Scroll Container */}
              <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pr-1 scrollbar-thin">
                {(() => {
                  const filtered = clips.filter((c) => {
                    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesCategory = selectedCategory ? c.category === selectedCategory : true;
                    return matchesSearch && matchesCategory;
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-8 text-neutral-500 font-mono text-[9px] uppercase tracking-wider">
                        No matching clips found
                      </div>
                    );
                  }

                  return filtered.map((clip) => {
                    const isActive = clip.id === activeClipId;
                    const badge = CATEGORY_BADGES[clip.category] || '🎬';
                    return (
                      <div
                        key={clip.id}
                        onClick={() => {
                          setActiveClip(clip.id);
                          setPlaying(true);
                          setIsCatalogOpen(false);
                        }}
                        className={`flex items-center justify-between px-3 py-2 rounded border transition-all cursor-pointer hover:bg-neutral-900 group ${isActive ? 'bg-amber-500/10 border-amber-500/50 text-amber-400' : 'bg-neutral-950 border-neutral-900/60 text-neutral-400 hover:border-neutral-800'}`}
                      >
                        <div className="flex flex-col gap-0.5 text-left">
                          <span className="text-[10px] font-bold text-neutral-200 group-hover:text-white transition-colors">
                            {clip.name}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-mono uppercase tracking-wider bg-neutral-900 px-1 py-0.2 rounded text-neutral-500">
                              {badge} {clip.category}
                            </span>
                            <span className="text-[8px] font-mono text-neutral-500">
                              Convention: {clip.skeletonType.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {clip.duration > 0 && (
                            <span className="text-[8px] font-mono text-neutral-500">
                              {clip.duration.toFixed(1)}s
                            </span>
                          )}
                          <Play size={10} className={`opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'text-amber-400 opacity-100' : 'text-neutral-400'}`} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Action Toolbar */}
        <div className="p-3 border-t border-border bg-bg-panel/60 flex gap-2 shrink-0">
          {activeTab === 'physics_paint' ? (
            <>
              <button
                onClick={() => {
                  updateObject(asset.id, { paintedPhysics: {} });
                }}
                className="flex-1 py-1.5 bg-red-950/40 border border-red-500/30 hover:bg-red-900/30 hover:border-red-500/60 text-red-400 text-[10px] font-bold tracking-wider rounded transition-all flex items-center justify-center gap-1 shadow-md cursor-pointer"
              >
                <Trash2 size={11} /> CLEAR ALL PAINT
              </button>
              <button
                onClick={() => setTestPose(!testPose)}
                className={`flex-1 py-1.5 text-white text-[10px] font-bold tracking-wider rounded transition-all flex items-center justify-center gap-1 shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer ${testPose ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-sky-600 hover:bg-sky-500'}`}
              >
                {testPose ? <Pause size={11} /> : <Play size={11} />}
                {testPose ? 'PAUSE PHYSICS PREVIEW' : 'PREVIEW PHYSICS'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleAddBone}
                className="flex-1 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-[10px] font-bold tracking-wider rounded transition-all flex items-center justify-center gap-1 shadow-md hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              >
                <Plus size={11} /> ADD BONE
              </button>
              <button
                onClick={() => {
                  if (modelRef.current && asset) {
                    // 1. Cleanup old Auto-Rig bones or SkeletonHelpers
                    const toRemove: THREE.Object3D[] = [];
                    modelRef.current.traverse((child) => {
                      if (child.name === 'AutoRig_Waist' || child.name === 'root' || child.name === 'pelvis' || child instanceof THREE.SkeletonHelper) {
                        toRemove.push(child);
                      }
                    });
                    toRemove.forEach((child) => {
                      if (child.parent) {
                        child.parent.remove(child);
                      }
                      // Dispose GPU resources (SkeletonHelper materials + geometry)
                      if (child instanceof THREE.SkeletonHelper) {
                        child.dispose();
                      }
                    });

                    // 2. Phase 1: Build Bones
                    const rigData = generateAutoSpine(modelRef.current, asset.url);
                    console.log("Auto-Rig Spine Generated:", rigData);

                    // 3. Update world matrices so worldToLocal works correctly
                    modelRef.current.updateMatrixWorld(true);

                    // 4. Map generated bones to JointData in model-space absolute local coordinates
                    const newJointsList = rigData.bones.map((b) => {
                      const parentBone = rigData.bones.find((p) => p === b.parent);
                      
                      const worldPos = new THREE.Vector3();
                      b.getWorldPosition(worldPos);
                      const localPos = modelRef.current!.worldToLocal(worldPos);

                      return {
                        id: b.uuid,
                        name: b.name,
                        position: [localPos.x, localPos.y, localPos.z] as [number, number, number],
                        rotation: [0, 0, 0] as [number, number, number],
                        parentId: parentBone ? parentBone.uuid : null,
                      };
                    });

                    // 5. Wire the skeleton bones into Zustand state
                    updateObject(asset.id, { joints: newJointsList });

                    // 6. Select the Waist root bone by default to immediately activate 3D TransformControls
                    if (newJointsList.length > 0) {
                      setSelectedJointId(newJointsList[0].id);
                    }

                    // 7. Visualizer skeleton helper
                    const helper = new THREE.SkeletonHelper(modelRef.current);
                    modelRef.current.add(helper);

                    // 8. Auto-enable skin binding
                    setIsSkinBound(true);

                    console.log("Auto-Rig Hierarchy Generated & Synced!");
                  }
                }}
                className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-indigo-600/20 text-indigo-400 border border-indigo-500/50 hover:bg-indigo-600/40 rounded transition-all cursor-pointer"
              >
                Auto-Rig Spine
              </button>
              <button
                type="button"
                onClick={() => {
                  if (joints && joints.length > 0) {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(joints, null, 2));
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", `${asset?.name || 'character'}_rig_pose.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                  }
                }}
                disabled={joints.length === 0}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border transition-all cursor-pointer flex items-center gap-1 ${
                  joints.length === 0
                    ? 'bg-neutral-800/40 text-neutral-500 border-neutral-700/50 cursor-not-allowed'
                    : 'bg-amber-600/20 text-amber-400 border-amber-500/50 hover:bg-amber-600/40'
                }`}
                title="Export complete joint hierarchy and poses to a JSON file"
              >
                <Download size={11} /> Export Rig
              </button>
              <button
                type="button"
                onClick={() => {
                  const fileInput = document.createElement('input');
                  fileInput.type = 'file';
                  fileInput.accept = '.json';
                  fileInput.onchange = (e: any) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                      try {
                        const parsed = JSON.parse(evt.target?.result as string);
                        if (Array.isArray(parsed)) {
                          // Validate that it looks like JointData
                          const isValid = parsed.every(j => typeof j.id === 'string' && typeof j.name === 'string' && Array.isArray(j.position));
                          if (isValid) {
                            updateObject(asset.id, { joints: parsed });
                            console.log("Joint hierarchy successfully imported!");
                          } else {
                            alert("Invalid rig file structure: missing required joint properties.");
                          }
                        } else {
                          alert("Invalid rig file: expected a JSON array of joints.");
                        }
                      } catch (err) {
                        alert("Failed to parse JSON file.");
                      }
                    };
                    reader.readAsText(file);
                  };
                  fileInput.click();
                }}
                className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider bg-sky-600/20 text-sky-400 border border-sky-500/50 hover:bg-sky-600/40 rounded transition-all cursor-pointer flex items-center gap-1"
                title="Import joint hierarchy and poses from a JSON file"
              >
                <Upload size={11} /> Import Rig
              </button>
              {joints.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsSkinBound(!isSkinBound)}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded border transition-all cursor-pointer ${
                    isSkinBound
                      ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-600/30'
                      : 'bg-indigo-600 text-white border-transparent hover:bg-indigo-500'
                  }`}
                >
                  {isSkinBound ? '🟢 Skin Bound' : 'Bind to Skin'}
                </button>
              )}
              {selectedJointId && (
                <button
                  onClick={() => {
                    deleteJoint(asset.id, selectedJointId);
                    setSelectedJointId(null);
                  }}
                  className="px-3 py-1.5 bg-red-950/40 border border-red-500/30 hover:bg-red-900/30 hover:border-red-500/60 text-red-400 rounded transition-colors flex items-center justify-center cursor-pointer"
                  title="Delete Selected Bone"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
