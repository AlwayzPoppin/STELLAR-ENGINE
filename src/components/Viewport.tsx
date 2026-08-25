import React, { Suspense, useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree, events, useLoader } from '@react-three/fiber';
import {
  OrbitControls,
  Environment,
  Grid,
  ContactShadows,
  TransformControls,
  useGLTF,
  GizmoHelper,
  GizmoViewport,
  PointerLockControls,
  useFBX,
  Sky,
  Stars,
  Stats,
  useTexture,
} from '@react-three/drei';
import { OBJLoader } from 'three-stdlib';
import { Physics, RigidBody, CuboidCollider, BallCollider, useRapier } from '@react-three/rapier';
import { Geometry, Base, Addition, Subtraction, Intersection } from '@react-three/csg';
import { EffectComposer, Bloom, ToneMapping, Vignette, Outline, Selection, Select, GodRays } from '@react-three/postprocessing';
import { useStore, SceneObject, FoliageInstanceData, BoneNode } from '../store/useStore';
import { CollisionEventBroker } from '../physics/CollisionEventBroker';
import { useAssetStore } from '../store/useAssetStore';
import * as THREE from 'three';
import { toast } from '../store/useToastStore';
import { exportSceneWithPipeline } from '../utils/GLTFExportPipeline';
import { Layers, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Play, Pause } from 'lucide-react';
import { BlendFunction, KernelSize } from 'postprocessing';
import { useManagedTexture, TextureManager, PRESET_TEXTURE_URLS } from '../utils/TextureManager';
import {
  PROCEDURAL_FOLIAGE_PRESETS,
  getProceduralFoliageParts,
  computeFoliageInstanceColor,
  applyWindSwayShader,
  ProceduralFoliagePart,
} from '../utils/FoliageGeometryLibrary';
import {
  clusterFoliageInstances,
  writeInstanceTransforms,
  computeInstancedCapacity,
} from '../utils/FoliageClusterManager';
import { AssetStagingManager, StagingProgressEvent } from '../utils/AssetStagingManager';
import { SpatialAudioManager } from '../utils/SpatialAudioManager';
import { MarqueeSelectionController } from './MarqueeSelectionController';



class ModelErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode; assetName?: string },
  { hasError: boolean; errorMessage?: string }
> {
  constructor(props: { children: React.ReactNode; fallback?: React.ReactNode; assetName?: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorMessage: error?.message || 'Failed to load 3D model asset' };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.warn('ModelErrorBoundary caught model loading error:', error, errorInfo);
    const assetTitle = this.props.assetName ? ` "${this.props.assetName}"` : '';
    toast.error(
      'Model Load Error',
      `Failed to load 3D model${assetTitle}. The asset file may be corrupted, missing texture references, or in an unsupported format.`
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshBasicMaterial color="#ef4444" wireframe />
          </mesh>
        )
      );
    }
    return this.props.children;
  }
}

let playerRigidBodyRef: any = null;

export function extractSkeletonFromScene(scene: THREE.Object3D): BoneNode[] {
  if (!scene) return [];

  const boneMap = new Map<string, THREE.Object3D>();
  const skinnedMeshBones = new Set<THREE.Object3D>();

  scene.traverse((child: any) => {
    if (child.isSkinnedMesh && child.skeleton && Array.isArray(child.skeleton.bones)) {
      child.skeleton.bones.forEach((b: THREE.Object3D) => {
        if (b) skinnedMeshBones.add(b);
      });
    }
    if (child.isBone || child instanceof THREE.Bone || child.type === 'Bone') {
      boneMap.set(child.name || child.uuid, child);
    }
  });

  skinnedMeshBones.forEach((b) => {
    boneMap.set(b.name || b.uuid, b);
  });

  if (boneMap.size === 0) return [];

  const rootBones: THREE.Object3D[] = [];
  boneMap.forEach((bone) => {
    let parent = bone.parent;
    let isRoot = true;
    while (parent) {
      if (boneMap.has(parent.name || parent.uuid) || (parent as any).isBone) {
        isRoot = false;
        break;
      }
      parent = parent.parent;
    }
    if (isRoot) {
      rootBones.push(bone);
    }
  });

  const buildBoneNode = (bone: THREE.Object3D): BoneNode => {
    const childrenNodes: BoneNode[] = [];
    const processChildren = (parentObj: THREE.Object3D) => {
      if (!parentObj.children) return;
      parentObj.children.forEach((c) => {
        if (boneMap.has(c.name || c.uuid) || (c as any).isBone) {
          childrenNodes.push(buildBoneNode(c));
        } else {
          processChildren(c);
        }
      });
    };

    processChildren(bone);

    return {
      id: bone.name || bone.uuid,
      name: bone.name || 'Unnamed Bone',
      children: childrenNodes,
    };
  };

  return rootBones.map(buildBoneNode);
}

// Convert color temperature in Kelvin to approximate RGB
function kelvinToColor(kelvin: number): THREE.Color {
  const temp = kelvin / 100;
  let r: number, g: number, b: number;

  if (temp <= 66) {
    r = 255;
    g = Math.max(0, Math.min(255, 99.4708025861 * Math.log(temp) - 161.1195681661));
  } else {
    r = Math.max(0, Math.min(255, 329.698727446 * Math.pow(temp - 60, -0.1332047592)));
    g = Math.max(0, Math.min(255, 288.1221695283 * Math.pow(temp - 60, -0.0755148492)));
  }

  if (temp >= 66) {
    b = 255;
  } else if (temp <= 19) {
    b = 0;
  } else {
    b = Math.max(0, Math.min(255, 138.5177312231 * Math.log(temp - 10) - 305.0447927307));
  }

  return new THREE.Color(r / 255, g / 255, b / 255);
}

// Pre-allocated sky color constants (module-scoped to avoid per-frame GC pressure)
const _skyMidnightTop = new THREE.Color('#0b1d3a');
const _skyMidnightBottom = new THREE.Color('#162a45');
const _skyDawnTop = new THREE.Color('#3a4878');
const _skyDawnBottom = new THREE.Color('#e07a5f');
const _skyNoonTop = new THREE.Color('#1a82e2');
const _skyNoonBottom = new THREE.Color('#a1caff');
const _skyDuskTop = new THREE.Color('#2c3e50');
const _skyDuskBottom = new THREE.Color('#e65c00');
const _skyResultTop = new THREE.Color();
const _skyResultBottom = new THREE.Color();

function DayNightCycle() {
  const isPlaying = useStore((state) => state.isPlaying);
  const environment = useStore((state) => state.environment);
  const objects = useStore((state) => state.objects);
  const { scene } = useThree();
  const sunLightRef = useRef<any>(null);
  const moonLightRef = useRef<any>(null);
  const ambientLightRef = useRef<any>(null);
  const starsGroupRef = useRef<any>(null);

  // Read celestial properties from the store
  const sunObjStore = objects.find((o) => o.id === 'obj_sun');
  const moonObjStore = objects.find((o) => o.id === 'obj_moon');
  const sunCelestial = sunObjStore?.celestialProps ?? {
    colorTemperature: 5600, diskScale: 1.0, volumetricIntensity: 1.0, atmosphericContribution: 1.0,
  };
  const moonCelestial = moonObjStore?.celestialProps ?? {
    colorTemperature: 4000, diskScale: 0.8, volumetricIntensity: 0.5, atmosphericContribution: 0.2,
  };

  const sunColor = useMemo(() => kelvinToColor(sunCelestial.colorTemperature), [sunCelestial.colorTemperature]);
  const moonColor = useMemo(() => kelvinToColor(moonCelestial.colorTemperature), [moonCelestial.colorTemperature]);

  const isPaused = useStore((state) => state.isPaused);
  const startClockTime = useRef(0);
  const startTimeRef = useRef(environment.timeOfDay);
  const prevIsPlaying = useRef(isPlaying);
  const prevIsPaused = useRef(isPaused);
  const pauseStartTime = useRef(0);

  const skyUniforms = useMemo(() => {
    return {
      colorTop: { value: new THREE.Color('#1a82e2') },
      colorBottom: { value: new THREE.Color('#a1caff') },
    };
  }, []);

  useFrame((state) => {
    let currentHour = environment.timeOfDay;

    if (isPlaying) {
      if (!prevIsPlaying.current) {
        startClockTime.current = state.clock.getElapsedTime();
        startTimeRef.current = environment.timeOfDay;
        pauseStartTime.current = 0;
      }

      if (isPaused) {
        if (!prevIsPaused.current) {
          pauseStartTime.current = state.clock.getElapsedTime();
        }
      } else {
        if (prevIsPaused.current && pauseStartTime.current > 0) {
          startClockTime.current += (state.clock.getElapsedTime() - pauseStartTime.current);
        }
        const elapsed = state.clock.getElapsedTime() - startClockTime.current;
        currentHour = (startTimeRef.current + (elapsed / (environment.cycleDuration || 60)) * 24) % 24;
      }
    }

    prevIsPlaying.current = isPlaying;
    prevIsPaused.current = isPaused;

    // Update sky colors using pre-allocated result colors
    getSkyColors(currentHour);
    const skyObj = scene.getObjectByName('SkyDome');
    if (skyObj) {
      const mat = (skyObj as any).material as THREE.ShaderMaterial;
      if (mat && mat.uniforms) {
        mat.uniforms.colorTop.value.copy(_skyResultTop);
        mat.uniforms.colorBottom.value.copy(_skyResultBottom);
      }
    }

    const timeAngle = (currentHour / 24) * Math.PI * 2 - Math.PI / 2;
    const radius = 400;

    const x = Math.cos(timeAngle) * radius;
    const y = Math.sin(timeAngle) * radius;
    const z = 200;

    const sunHeight = y / radius;
    const isDay = sunHeight > 0;

    // Update physical mesh representations directly
    const sunMesh = scene.getObjectByName('Physical Sun');
    const moonMesh = scene.getObjectByName('Physical Moon');

    if (sunMesh) {
      sunMesh.position.set(x, y, z);
      const s = 10 * sunCelestial.diskScale;
      sunMesh.scale.set(s, s, s);
    }
    if (moonMesh) {
      moonMesh.position.set(-x, -y, -z);
      const s = 10 * moonCelestial.diskScale;
      moonMesh.scale.set(s, s, s);
    }

    // Calculate light intensities
    const baseAmbientDay = 0.05 + sunHeight * 0.45;
    const newAmbientInt = isDay
      ? baseAmbientDay * sunCelestial.atmosphericContribution
      : 0.01 + moonCelestial.atmosphericContribution * 0.05;
    const newSunInt = isDay ? sunHeight * 1.5 * sunCelestial.volumetricIntensity : 0;
    const newMoonInt = !isDay ? Math.abs(sunHeight) * 0.4 * moonCelestial.volumetricIntensity : 0;

    const isNimbus = environment.cloudsEnabled && environment.cloudsType === 'nimbus';
    const isSnowOrBlizzard = environment.cloudsEnabled && (environment.cloudsType === 'blizzard');
    const finalAmbient = isNimbus ? newAmbientInt * 0.6 : (isSnowOrBlizzard ? newAmbientInt * 0.85 : newAmbientInt);

    // Direct Three.js light updates via refs (zero React re-renders!)
    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = finalAmbient;
    }
    if (sunLightRef.current) {
      sunLightRef.current.position.set(x, y, z);
      sunLightRef.current.intensity = newSunInt;
      sunLightRef.current.color.copy(sunColor);
    }
    if (moonLightRef.current) {
      moonLightRef.current.position.set(-x, -y, -z);
      moonLightRef.current.intensity = newMoonInt;
      moonLightRef.current.color.copy(moonColor);
    }

    if (starsGroupRef.current) {
      starsGroupRef.current.visible = (currentHour < 5 || currentHour > 19);
    }

    const envIntensity = isDay ? Math.max(0.3, sunHeight) : 0.05;
    scene.environmentIntensity = envIntensity;
  });

  // Calculate sky colors using pre-allocated module-scope constants (zero allocations)
  const getSkyColors = (hour: number) => {
    if (hour < 4) {
      _skyResultTop.copy(_skyMidnightTop);
      _skyResultBottom.copy(_skyMidnightBottom);
    } else if (hour < 6) {
      const t = (hour - 4) / 2;
      _skyResultTop.lerpColors(_skyMidnightTop, _skyDawnTop, t);
      _skyResultBottom.lerpColors(_skyMidnightBottom, _skyDawnBottom, t);
    } else if (hour < 12) {
      const t = (hour - 6) / 6;
      _skyResultTop.lerpColors(_skyDawnTop, _skyNoonTop, t);
      _skyResultBottom.lerpColors(_skyDawnBottom, _skyNoonBottom, t);
    } else if (hour < 16) {
      _skyResultTop.copy(_skyNoonTop);
      _skyResultBottom.copy(_skyNoonBottom);
    } else if (hour < 18) {
      const t = (hour - 16) / 2;
      _skyResultTop.lerpColors(_skyNoonTop, _skyDuskTop, t);
      _skyResultBottom.lerpColors(_skyNoonBottom, _skyDuskBottom, t);
    } else if (hour < 20) {
      const t = (hour - 18) / 2;
      _skyResultTop.lerpColors(_skyDuskTop, _skyMidnightTop, t);
      _skyResultBottom.lerpColors(_skyDuskBottom, _skyMidnightBottom, t);
    } else {
      _skyResultTop.copy(_skyMidnightTop);
      _skyResultBottom.copy(_skyMidnightBottom);
    }
  };

  return (
    <>
      <Environment background frames={Infinity}>
        <mesh name="SkyDome" scale={[100, 100, 100]}>
          <sphereGeometry args={[1, 32, 32]} />
          <shaderMaterial
            side={THREE.BackSide}
            depthWrite={false}
            vertexShader={`
              varying vec3 vWorldPosition;
              void main() {
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vWorldPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              uniform vec3 colorTop;
              uniform vec3 colorBottom;
              varying vec3 vWorldPosition;
              void main() {
                vec3 normalPos = normalize(vWorldPosition);
                float h = normalPos.y * 0.5 + 0.5; // Map -1..1 to 0..1
                gl_FragColor = vec4(mix(colorBottom, colorTop, h), 1.0);
              }
            `}
            uniforms={skyUniforms}
          />
        </mesh>
      </Environment>

      <group ref={starsGroupRef}>
        <Stars radius={300} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
      </group>

      <ambientLight ref={ambientLightRef} intensity={0.2} />

      <directionalLight
        ref={sunLightRef}
        position={[200, 400, 200]}
        intensity={1.5}
        color={sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      <directionalLight
        ref={moonLightRef}
        position={[-200, -400, -200]}
        intensity={0.3}
        color={moonColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <PhysicalClouds currentHour={environment.timeOfDay} />
      <RainParticles />
      <SnowParticles />
    </>
  );
}

// GodRays wrapper — creates a memory-only mesh to avoid scene graph & focus issues
function SunGodRays() {
  const environment = useStore((s) => s.environment);
  const sunObj = useStore((s) => s.objects.find((o) => o.id === 'obj_sun'));
  const sunCelestial = (sunObj?.celestialProps ?? { volumetricIntensity: 1.0 }) as any;

  // Create a mesh purely in memory. It is NOT rendered in the scene graph,
  // so it cannot steal focus or intercept pointer events!
  const ghostSunMesh = useMemo(() => {
    const geom = new THREE.SphereGeometry(15, 16, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: '#ffdd88',
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      toneMapped: false,
    });
    return new THREE.Mesh(geom, mat);
  }, []);

  // Track the actual Physical Sun's position every frame (works in both edit & play mode)
  const { scene } = useThree();
  useFrame(() => {
    const sunNode = scene.getObjectByName('Physical Sun');
    if (sunNode) {
      ghostSunMesh.position.copy(sunNode.position);
      ghostSunMesh.updateMatrixWorld();
    }
  });

  const timeAngle = (environment.timeOfDay / 24) * Math.PI * 2 - Math.PI / 2;
  const y = Math.sin(timeAngle);
  const isDay = y > 0;

  if (!isDay || !sunCelestial.godRaysEnabled) return null;

  return (
    <GodRays
      sun={ghostSunMesh}
      blendFunction={BlendFunction.SCREEN}
      samples={60}
      density={0.97}
      decay={sunCelestial.rayDecay ?? 0.93}
      weight={(sunCelestial.rayWeight ?? 0.6) * sunCelestial.volumetricIntensity}
      exposure={sunCelestial.rayExposure ?? 0.6}
      clampMax={1}
      kernelSize={KernelSize.SMALL}
      blur
    />
  );
}

function GltfModel({ url, isPlayer, objId }: { url: string; isPlayer?: boolean; objId?: string }) {
  const { scene, animations: selfAnimations } = useGLTF(url);
  const clonedScene = useMemo(() => {
    const clone = scene.clone();

    // Always enable shadows for meshes (except the sun)
    clone.traverse((child: any) => {
      if (objId) {
        child.userData = { ...child.userData, id: objId };
      }
      if (child.isMesh) {
        // Override expensive per-triangle raycasting with fast bounding sphere check
        child.raycast = function (raycaster: THREE.Raycaster, intersects: any[]) {
          if (!this.geometry) return;
          if (!this.geometry.boundingSphere) {
            this.geometry.computeBoundingSphere();
          }
          if (!this.geometry.boundingSphere) return;

          const sphere = this.geometry.boundingSphere.clone();
          sphere.applyMatrix4(this.matrixWorld);

          if (raycaster.ray.intersectsSphere(sphere)) {
            intersects.push({
              distance: raycaster.ray.origin.distanceTo(sphere.center),
              point: sphere.center.clone(),
              object: this,
            });
          }
        };

        if (url.includes('_shining_sun')) {
          child.material = new THREE.MeshStandardMaterial({
            color: '#ffaa00',
            emissive: '#ffaa00',
            emissiveIntensity: 10,
            roughness: 0,
            metalness: 0,
          });
          child.castShadow = false;
          child.receiveShadow = false;
        } else if (url.includes('shining_moon_')) {
          child.material = new THREE.MeshStandardMaterial({
            color: '#e0e0ff',
            emissive: '#e0e0ff',
            emissiveIntensity: 2,
            roughness: 0,
            metalness: 0,
          });
          child.castShadow = false;
          child.receiveShadow = false;
        } else {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      }
    });

    if (url.includes('humanoid+robot') || url.includes('humanoid_robot')) {
      clone.rotation.y = Math.PI / 2;
    }

    return clone;
  }, [scene, url]);

  const workspaceMode = useStore((state) => state.workspaceMode);
  const animationTargetId = useStore((state) => state.animationTargetId);

  useEffect(() => {
    if (!clonedScene) return;
    const isTarget = (objId && animationTargetId === objId) || (!animationTargetId && workspaceMode === 'animation');
    if (isTarget || workspaceMode === 'animation') {
      useStore.getState().setActiveClonedScene(clonedScene);
      const skeleton = extractSkeletonFromScene(clonedScene);
      useStore.getState().setActiveSkeleton(skeleton);
      if (objId && !animationTargetId) {
        useStore.getState().setAnimationTargetId(objId);
      }
    }
  }, [clonedScene, objId, animationTargetId, workspaceMode]);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const activeActionNameRef = useRef<string>('');
  const isPlaying = useStore((state) => state.isPlaying);
  const isPaused = useStore((state) => state.isPaused);
  const playerAnimationState = useStore((state) => state.playerAnimationState);

  useEffect(() => {
    if (!clonedScene) return;

    const mixer = new THREE.AnimationMixer(clonedScene);
    mixerRef.current = mixer;

    const clips = selfAnimations;
    const actions: Record<string, THREE.AnimationAction> = {};

    if (clips && clips.length > 0) {
      clips.forEach((clip) => {
        actions[clip.name] = mixer.clipAction(clip);
      });
    }

    actionsRef.current = actions;

    const findClipForState = (stateName: string, animationClips: THREE.AnimationClip[]) => {
      if (!animationClips || animationClips.length === 0) return null;
      const searchTerms: Record<string, string[]> = {
        idle: ['idle'],
        walk: ['walk', 'jog'],
        sprint: ['sprint', 'run'],
        jump: ['jump', 'leap'],
        dash: ['dash', 'roll', 'dodge'],
        climb: ['climb']
      };
      const terms = searchTerms[stateName] || [stateName];
      for (const term of terms) {
        const found = animationClips.find(clip => clip.name.toLowerCase().includes(term.toLowerCase()));
        if (found) return found;
      }
      return null;
    };

    const stateClips: Record<string, string> = {};
    ['idle', 'walk', 'sprint', 'jump', 'dash', 'climb'].forEach(stateName => {
      const match = findClipForState(stateName, clips);
      if (match) {
        stateClips[stateName] = match.name;
      }
    });

    let initialAction: THREE.AnimationAction | null = null;
    if (isPlayer) {
      const clipName = stateClips[playerAnimationState];
      initialAction = clipName ? actions[clipName] : (Object.values(actions)[0] || null);
      activeActionNameRef.current = clipName || (Object.keys(actions)[0] || '');
    } else {
      initialAction = Object.values(actions)[0] || null;
    }

    if (initialAction) {
      initialAction.play();
    }

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(clonedScene);
      mixerRef.current = null;
      actionsRef.current = {};
    };
  }, [clonedScene, isPlayer, selfAnimations]);

  useEffect(() => {
    if (!isPlayer || !mixerRef.current || !actionsRef.current) return;

    const findClipForState = (stateName: string, animationClips: THREE.AnimationClip[]) => {
      if (!animationClips || animationClips.length === 0) return null;
      const searchTerms: Record<string, string[]> = {
        idle: ['idle'],
        walk: ['walk', 'jog'],
        sprint: ['sprint', 'run'],
        jump: ['jump', 'leap'],
        dash: ['dash', 'roll', 'dodge'],
        climb: ['climb']
      };
      const terms = searchTerms[stateName] || [stateName];
      for (const term of terms) {
        const found = animationClips.find(clip => clip.name.toLowerCase().includes(term.toLowerCase()));
        if (found) return found;
      }
      return null;
    };

    const match = findClipForState(playerAnimationState, selfAnimations);
    const nextClipName = match ? match.name : null;
    if (!nextClipName) return;

    const nextAction = actionsRef.current[nextClipName];
    const prevClipName = activeActionNameRef.current;
    const prevAction = prevClipName ? actionsRef.current[prevClipName] : null;

    if (nextAction && nextAction !== prevAction) {
      nextAction.reset();
      nextAction.setEffectiveWeight(1);
      nextAction.setEffectiveTimeScale(1);

      if (prevAction) {
        prevAction.crossFadeTo(nextAction, 0.2, true);
      } else {
        nextAction.fadeIn(0.2);
      }
      nextAction.play();
      activeActionNameRef.current = nextClipName;
    }
  }, [playerAnimationState, isPlayer, selfAnimations]);

  useFrame((_, delta) => {
    if (mixerRef.current && isPlaying && !isPaused) {
      mixerRef.current.update(delta);
    }
  });

  return <primitive object={clonedScene} />;
}

function FbxModel({ url, objId }: { url: string; objId?: string }) {
  const fbx = useFBX(url);
  const clonedScene = useMemo(() => {
    const clone = fbx.clone();
    clone.traverse((child: any) => {
      if (objId) {
        child.userData = { ...child.userData, id: objId };
      }
      if (child.isMesh) {
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [fbx, objId]);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const isPlaying = useStore((state) => state.isPlaying);
  const isPaused = useStore((state) => state.isPaused);

  useEffect(() => {
    if (fbx.animations && fbx.animations.length > 0 && clonedScene) {
      const mixer = new THREE.AnimationMixer(clonedScene);
      mixerRef.current = mixer;
      const action = mixer.clipAction(fbx.animations[0]);
      action.play();
      return () => {
        action.stop();
        mixer.uncacheRoot(clonedScene);
      };
    }
  }, [fbx.animations, clonedScene]);

  useFrame((_, delta) => {
    if (mixerRef.current && isPlaying && !isPaused) {
      mixerRef.current.update(delta);
    }
  });

  return <primitive object={clonedScene} />;
}

function ObjModel({ url, objId }: { url: string; objId?: string }) {
  const obj = useLoader(OBJLoader, url);
  const clonedScene = useMemo(() => {
    const clone = obj.clone();
    clone.traverse((child: any) => {
      if (objId) {
        child.userData = { ...child.userData, id: objId };
      }
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        if (child.geometry && !child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals();
        }

        // Fast bounding sphere raycasting check
        child.raycast = function (raycaster: THREE.Raycaster, intersects: any[]) {
          if (!this.geometry) return;
          if (!this.geometry.boundingSphere) {
            this.geometry.computeBoundingSphere();
          }
          if (!this.geometry.boundingSphere) return;

          const sphere = this.geometry.boundingSphere.clone();
          sphere.applyMatrix4(this.matrixWorld);

          if (raycaster.ray.intersectsSphere(sphere)) {
            intersects.push({
              distance: raycaster.ray.origin.distanceTo(sphere.center),
              point: sphere.center.clone(),
              object: this,
            });
          }
        };

        // Ensure default fallback standard material if none assigned
        if (!child.material || (Array.isArray(child.material) && child.material.length === 0)) {
          child.material = new THREE.MeshStandardMaterial({
            color: '#d4d4d8',
            roughness: 0.5,
            metalness: 0.1,
          });
        }
      }
    });
    return clone;
  }, [obj, objId]);

  return <primitive object={clonedScene} />;
}

export function isObjFormat(obj: SceneObject): boolean {
  if ((obj.type as string) === 'obj') return true;
  const name = (obj.name || '').toLowerCase();
  const url = (obj.url || '').toLowerCase();
  return name.endsWith('.obj') || url.includes('.obj') || url.startsWith('data:model/obj');
}

export function isFbxFormat(obj: SceneObject): boolean {
  if ((obj.type as string) === 'fbx') return true;
  const name = (obj.name || '').toLowerCase();
  const url = (obj.url || '').toLowerCase();
  return name.endsWith('.fbx') || url.includes('.fbx') || url.startsWith('data:model/fbx');
}

function CustomMaterial({ material }: { material: SceneObject['material'] }) {
  const wireframeMode = useStore((state) => state.wireframeMode);

  const rx = material?.repeatX ?? 2;
  const ry = material?.repeatY ?? 2;

  const waveHeight = material?.waveHeight ?? 0.08;
  const waveSpeed = material?.waveSpeed ?? 1.0;

  const isWater =
    material?.map === 'water' ||
    material?.normalMap === 'water' ||
    (material?.map && material.map.includes('waternormals.jpg')) ||
    (material?.normalMap && material.normalMap.includes('waternormals.jpg'));

  // Centralized texture acquisition and instance caching
  const texture = useManagedTexture(material?.map, {
    isNormalMap: false,
    repeatX: rx,
    repeatY: ry,
    isWater: !!isWater,
  });

  const normalTexture = useManagedTexture(material?.normalMap, {
    isNormalMap: true,
    repeatX: rx,
    repeatY: ry,
    isWater: !!isWater,
  });

  const textureRef = useRef<THREE.Texture | null>(null);
  const normalTextureRef = useRef<THREE.Texture | null>(null);

  const uTimeRef = useRef<{ value: number } | null>(null);
  const uWaveHeightRef = useRef<{ value: number } | null>(null);
  const uWaveSpeedRef = useRef<{ value: number } | null>(null);

  useEffect(() => {
    textureRef.current = texture;
  }, [texture]);

  useEffect(() => {
    normalTextureRef.current = normalTexture;
  }, [normalTexture]);

  useEffect(() => {
    if (uWaveHeightRef.current) {
      uWaveHeightRef.current.value = waveHeight;
    }
  }, [waveHeight]);

  useEffect(() => {
    if (uWaveSpeedRef.current) {
      uWaveSpeedRef.current.value = waveSpeed;
    }
  }, [waveSpeed]);

  useFrame((state) => {
    if (isWater) {
      const time = state.clock.getElapsedTime();
      if (uTimeRef.current) {
        uTimeRef.current.value = time;
      }
      if (textureRef.current) {
        textureRef.current.offset.x = time * 0.015;
        textureRef.current.offset.y = time * 0.015;
      }
      if (normalTextureRef.current) {
        normalTextureRef.current.offset.x = -time * 0.02;
        normalTextureRef.current.offset.y = time * 0.01;
      }
    }
  });

  const customProgramCacheKey = React.useCallback(() => {
    return isWater ? 'water_material_custom_shader' : 'standard_material';
  }, [isWater]);

  const handleBeforeCompile = React.useCallback((shader: any) => {
    if (isWater) {
      shader.uniforms.uTime = { value: 0 };
      shader.uniforms.uWaveHeight = { value: 0.08 };
      shader.uniforms.uWaveSpeed = { value: 1.0 };
      uTimeRef.current = shader.uniforms.uTime;
      uWaveHeightRef.current = shader.uniforms.uWaveHeight;
      uWaveSpeedRef.current = shader.uniforms.uWaveSpeed;

      shader.vertexShader = `
        uniform float uTime;
        uniform float uWaveHeight;
        uniform float uWaveSpeed;
        varying float vWaveHeight;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
          #include <begin_vertex>
          float wave = sin(position.x * 4.0 + uTime * 2.0 * uWaveSpeed) * uWaveHeight + 
                       cos(position.z * 4.0 + uTime * 1.5 * uWaveSpeed) * uWaveHeight;
          transformed.y += wave;
          vWaveHeight = wave;
        `
      );

      shader.fragmentShader = `
        uniform float uWaveHeight;
        varying float vWaveHeight;
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
          #include <map_fragment>
          
          vec3 baseColor = diffuseColor.rgb;
          vec3 deepColor = baseColor * 0.15;
          vec3 crestColor = clamp(baseColor * 1.4 + vec3(0.0, 0.15, 0.2), 0.0, 1.0);
          
          float heightFactor = (vWaveHeight / max(0.01, uWaveHeight)) * 0.5 + 0.5;
          heightFactor = clamp(heightFactor, 0.0, 1.0);
          
          vec3 waterColor = mix(deepColor, crestColor, heightFactor);
          
          float foamThreshold = 0.85;
          if (heightFactor > foamThreshold) {
            float foamIntensity = (heightFactor - foamThreshold) / (1.0 - foamThreshold);
            waterColor = mix(waterColor, vec3(1.0, 1.0, 1.0), foamIntensity * 0.45);
          }
          
          diffuseColor.rgb = waterColor;
        `
      );
    }
  }, [isWater]);

  if (!material) return null;

  if (isWater) {
    return (
      <meshStandardMaterial
        key="water"
        color={material.color}
        roughness={0.05}
        metalness={0.1}
        envMapIntensity={material.envMapIntensity}
        map={texture}
        normalMap={normalTexture}
        wireframe={wireframeMode}
        transparent={true}
        opacity={material.opacity !== undefined ? material.opacity : 0.65}
        customProgramCacheKey={customProgramCacheKey}
        onBeforeCompile={handleBeforeCompile}
      />
    );
  }

  return (
    <meshStandardMaterial
      color={material.color}
      roughness={material.roughness}
      metalness={material.metalness}
      envMapIntensity={material.envMapIntensity}
      map={texture}
      normalMap={normalTexture}
      wireframe={wireframeMode}
      transparent={material.opacity !== undefined && material.opacity < 1.0}
      opacity={material.opacity !== undefined ? material.opacity : 1.0}
    />
  );
}

function renderGeometry(geometryType?: string, isWater?: boolean) {
  switch (geometryType) {
    case 'box':
      return <boxGeometry args={[1, 1, 1, isWater ? 16 : 1, isWater ? 16 : 1, isWater ? 16 : 1]} />;
    case 'sphere':
      return <sphereGeometry args={[0.5, 64, 64]} />;
    case 'plane':
      return <planeGeometry args={[1, 1, isWater ? 64 : 1, isWater ? 64 : 1]} />;
    case 'cylinder':
      return <cylinderGeometry args={[0.5, 0.5, 1, 32]} />;
    case 'cone':
      return <coneGeometry args={[0.5, 1, 32]} />;
    case 'torus':
      return <torusGeometry args={[0.5, 0.2, 16, 64]} />;
    case 'torusKnot':
      return <torusKnotGeometry args={[0.4, 0.1, 64, 16]} />;
    case 'ring':
      return <ringGeometry args={[0.3, 0.6, 32]} />;
    case 'wedge':
      return (
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={18}
            array={
              new Float32Array([
                0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5,
                -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5,
                -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, -0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5,
                0.5, -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, -0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5,
              ])
            }
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-normal"
            count={18}
            array={
              new Float32Array([
                1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
                0, 0, -1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0.707, -0.707, 0, 0.707, -0.707,
                0, 0.707, -0.707, 0, 0.707, -0.707, 0, 0.707, -0.707, 0, 0.707, -0.707,
              ])
            }
            itemSize={3}
          />
        </bufferGeometry>
      );
    default:
      return <boxGeometry args={[1, 1, 1]} />;
  }
}

export const compiledScripts = new Map<string, Function>();
export const failedScripts = new Set<string>();

export function clearCompiledScripts(): void {
  compiledScripts.clear();
  failedScripts.clear();
}

// Module-scoped scratch objects for zero-allocation per-frame physics & behavior updates
const _tempTranslation = { x: 0, y: 0, z: 0 };
const _tempQuat = new THREE.Quaternion();
const _tempDeltaQuat = new THREE.Quaternion();
const _tempAxisY = new THREE.Vector3(0, 1, 0);
const _tempEulerA = new THREE.Euler();
const _tempEulerB = new THREE.Euler();
const _tempQuatA = new THREE.Quaternion();
const _tempQuatB = new THREE.Quaternion();
const _tempVecA = new THREE.Vector3();
const _tempVecB = new THREE.Vector3();

const SceneNode = React.memo(function SceneNode({
  obj,
  isSelected,
  setOrbitEnabled,
  isPlaying,
  isCSGChild = false,
}: {
  obj: SceneObject;
  isSelected: boolean;
  setOrbitEnabled: (v: boolean) => void;
  isPlaying: boolean;
  isCSGChild?: boolean;
}) {
  const ref = useRef<any>(null);
  const initialPos = useRef(obj.position);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const updateObject = useStore((state) => state.updateObject);
  const transformMode = useStore((state) => state.transformMode);
  const selectObject = useStore((state) => state.selectObject);
  const snapGrid = useStore((state) => state.snapGrid);
  const showOverlays = useStore((state) => state.showOverlays);
  const snapValue = useStore((state) => state.snapValue);
  const showEmitters = useStore((state) => state.showEmitters);
  const selectedIds = useStore((state) => state.selectedIds);
  const activeTool = useStore((state) => state.activeTool);

  const objects = useStore((state) => state.objects);
  const assets = useAssetStore((state) => state.assets);
  const children = useMemo(() => objects.filter((o) => o.parentId === obj.id), [objects, obj.id]);
  const prevIsPlaying = useRef(isPlaying);

  // Eagerly compile custom scripts outside of the render loop with cleanup
  useEffect(() => {
    if (!obj.scripts || obj.scripts.length === 0) return;
    obj.scripts.forEach((scriptId) => {
      const script = assets.find((a) => a.id === scriptId);
      if (script && script.content) {
        try {
          const fn = new Function('self', 'delta', script.content);
          compiledScripts.set(scriptId, fn);
          failedScripts.delete(scriptId); // Reset blacklisting when script is updated/recompiled
        } catch (e: any) {
          failedScripts.add(scriptId);
          compiledScripts.delete(scriptId);
          console.error(`[Script Compile Error] ${scriptId}:`, e.message);
        }
      } else {
        compiledScripts.delete(scriptId);
        failedScripts.delete(scriptId);
      }
    });

    return () => {
      // Cleanup scripts that are no longer referenced by any scene objects
      const allObjects = useStore.getState().objects;
      const referencedScripts = new Set<string>();
      for (const otherObj of allObjects) {
        if (otherObj.id !== obj.id && otherObj.scripts) {
          for (const sId of otherObj.scripts) referencedScripts.add(sId);
        }
      }
      if (obj.scripts) {
        for (const sId of obj.scripts) {
          if (!referencedScripts.has(sId)) {
            compiledScripts.delete(sId);
            failedScripts.delete(sId);
          }
        }
      }
    };
  }, [obj.scripts, obj.id, assets]);

  useEffect(() => {
    if (prevIsPlaying.current !== isPlaying) {
      if (!isPlaying && ref.current) {
        ref.current.position.set(...obj.position);
        ref.current.rotation.set(...obj.rotation);
      } else {
        initialPos.current = obj.position;
      }
      prevIsPlaying.current = isPlaying;
    }
  }, [isPlaying, obj.position, obj.rotation]);

  // FIX 1: Include anchored objects so floors/walls always enter the physics engine.
  const hasPhysics = (obj.physics && obj.physics !== 'none') || obj.anchored;
  const isSimulating = isPlaying && hasPhysics;

  const handleRef = useCallback((node: any) => {
    ref.current = node;
    if (obj.id === 'obj_player') {
      if (node && typeof node.translation === 'function') {
        playerRigidBodyRef = node;
      } else {
        playerRigidBodyRef = null;
      }
    }
  }, [obj.id]);

  useFrame((state, delta) => {
    const isPaused = useStore.getState().isPaused;
    if (!isPlaying || isPaused || !ref.current) return;
    if (isSimulating) {
      if (obj.behavior === 'spin') {
        const r = ref.current.rotation();
        _tempQuat.set(r.x, r.y, r.z, r.w);
        _tempDeltaQuat.setFromAxisAngle(_tempAxisY, delta);
        _tempQuat.multiply(_tempDeltaQuat);
        if (typeof ref.current.setNextKinematicRotation === 'function') {
          ref.current.setNextKinematicRotation(_tempQuat);
        } else {
          ref.current.setRotation(_tempQuat, true);
        }
      } else if (obj.behavior === 'float') {
        const t = ref.current.translation();
        const newY = initialPos.current[1] + Math.sin(state.clock.elapsedTime * 2 + obj.position[0]) * 0.5;
        _tempTranslation.x = t.x;
        _tempTranslation.y = newY;
        _tempTranslation.z = t.z;
        if (typeof ref.current.setNextKinematicTranslation === 'function') {
          ref.current.setNextKinematicTranslation(_tempTranslation);
        } else {
          ref.current.setTranslation(_tempTranslation, true);
        }
      } else if (obj.behavior === 'buoyancy') {
        const t = ref.current.translation();
        const time = state.clock.elapsedTime;
        const speed = 1.5;
        const phase = obj.position[0] * 0.5 + obj.position[2] * 0.5;
        const newY = initialPos.current[1] + Math.sin(time * speed + phase) * 0.2;
        _tempTranslation.x = t.x;
        _tempTranslation.y = newY;
        _tempTranslation.z = t.z;
        if (typeof ref.current.setNextKinematicTranslation === 'function') {
          ref.current.setNextKinematicTranslation(_tempTranslation);
        } else {
          ref.current.setTranslation(_tempTranslation, true);
        }

        const pitch = Math.sin(time * speed * 0.8 + phase) * 0.05;
        const roll = Math.cos(time * speed * 0.6 + phase + 1.0) * 0.05;
        _tempEulerA.set(obj.rotation[0], obj.rotation[1], obj.rotation[2]);
        _tempEulerB.set(pitch, 0, roll);
        _tempQuatA.setFromEuler(_tempEulerA);
        _tempQuatB.setFromEuler(_tempEulerB);
        _tempQuatA.multiply(_tempQuatB);
        if (typeof ref.current.setNextKinematicRotation === 'function') {
          ref.current.setNextKinematicRotation(_tempQuatA);
        } else {
          ref.current.setRotation(_tempQuatA, true);
        }
      } else if (obj.behavior === 'follow') {
        const t = ref.current.translation();
        _tempVecA.copy(state.camera.position);
        _tempVecA.y = t.y;
        _tempVecB.set(t.x, t.y, t.z);
        _tempVecB.lerp(_tempVecA, delta * 1.5);
        _tempTranslation.x = _tempVecB.x;
        _tempTranslation.y = _tempVecB.y;
        _tempTranslation.z = _tempVecB.z;
        if (typeof ref.current.setNextKinematicTranslation === 'function') {
          ref.current.setNextKinematicTranslation(_tempTranslation);
        } else {
          ref.current.setTranslation(_tempTranslation, true);
        }
      }
    } else {
      if (obj.behavior === 'spin') {
        ref.current.rotation.y += delta;
        ref.current.rotation.x += delta * 0.5;
      } else if (obj.behavior === 'float') {
        ref.current.position.y = initialPos.current[1] + Math.sin(state.clock.elapsedTime * 2 + obj.position[0]) * 0.5;
      } else if (obj.behavior === 'buoyancy') {
        const time = state.clock.elapsedTime;
        const speed = 1.5;
        const phase = obj.position[0] * 0.5 + obj.position[2] * 0.5;
        ref.current.position.y = initialPos.current[1] + Math.sin(time * speed + phase) * 0.2;

        const pitch = Math.sin(time * speed * 0.8 + phase) * 0.05;
        const roll = Math.cos(time * speed * 0.6 + phase + 1.0) * 0.05;
        _tempEulerA.set(obj.rotation[0], obj.rotation[1], obj.rotation[2]);
        _tempEulerB.set(pitch, 0, roll);
        _tempQuatA.setFromEuler(_tempEulerA);
        _tempQuatB.setFromEuler(_tempEulerB);
        _tempQuatA.multiply(_tempQuatB);
        ref.current.rotation.setFromQuaternion(_tempQuatA);
      } else if (obj.behavior === 'follow') {
        _tempVecA.copy(state.camera.position);
        _tempVecA.y = ref.current.position.y;
        ref.current.position.lerp(_tempVecA, delta * 1.5);
        ref.current.lookAt(_tempVecA);
      }
    }

    if (obj.scripts && obj.scripts.length > 0) {
      obj.scripts.forEach((scriptId) => {
        if (failedScripts.has(scriptId)) return;
        const fn = compiledScripts.get(scriptId);
        if (fn) {
          try {
            fn(ref.current, delta);
          } catch (e: any) {
            failedScripts.add(scriptId);
            console.error(`[Script Runtime Error] Script "${scriptId}" failed and was paused:`, e.message);
          }
        }
      });
    }
  });

  const groupContent = (
    <group
      ref={isSimulating ? null : handleRef}
      name={obj.name}
      userData={{ id: obj.id }}
      position={isSimulating ? [0, 0, 0] : obj.position}
      rotation={isSimulating ? [0, 0, 0] : obj.rotation}
      scale={obj.scale}
      onPointerDown={(e) => {
        // Guard: block all pointer events when gizmo handles are focused
        const gf = useStore.getState().gizmoFocused;
        console.log(`[SceneNode:${obj.id}] onPointerDown — gizmoFocused=${gf}, button=${e.button}`);
        if (gf) {
          console.log(`[SceneNode:${obj.id}] BLOCKED by gizmoFocused guard`);
          e.stopPropagation();
          return;
        }
        if (e.button === 0 && !obj.locked) {
          e.stopPropagation();
          selectObject(obj.id);
        }
        if (e.button === 2) {
          dragStartRef.current = { x: e.clientX, y: e.clientY };
        }
      }}
      onContextMenu={(e) => {
        // Guard: block context menu when gizmo is focused
        if (useStore.getState().gizmoFocused) {
          e.stopPropagation();
          return;
        }
        e.stopPropagation();

        if (dragStartRef.current) {
          const deltaX = Math.abs(e.clientX - dragStartRef.current.x);
          const deltaY = Math.abs(e.clientY - dragStartRef.current.y);
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          dragStartRef.current = null;
          if (distance > 5) {
            return;
          }
        }

        selectObject(obj.id);
        useStore.getState().openContextMenu(e.clientX, e.clientY, 'viewport', obj.id);
      }}
    >
      <>
        {!isObjFormat(obj) && !isFbxFormat(obj) && !['gltf', 'obj', 'fbx', 'light', 'group', 'csg', 'script', 'texture', 'decal', 'motor6d', 'SUN', 'MOON'].includes(obj.type) && !obj.url && (() => {
          const isObjWater = !!(obj.material && (
            obj.material.map === 'water' ||
            obj.material.normalMap === 'water' ||
            (obj.material.map && obj.material.map.includes('waternormals.jpg')) ||
            (obj.material.normalMap && obj.material.normalMap.includes('waternormals.jpg'))
          ));
          return (
            (['tornado', 'smoke', 'water', 'sparks', 'fire'].includes(obj.type) || ['tornado', 'smoke', 'water', 'sparks', 'fire'].includes(obj.geometry || '')) ? (
              <ParticleEmitter type={['tornado', 'smoke', 'water', 'sparks', 'fire'].includes(obj.type) ? obj.type : (obj.geometry || '')} isPlaying={isPlaying} particleProps={obj.particleProps} />
            ) : (
              <mesh castShadow receiveShadow visible={!isCSGChild && obj.visible !== false}>
                {renderGeometry(obj.geometry, isObjWater)}
                {isSelected && !isPlaying && showOverlays ? (
                  <meshBasicMaterial color="#ffffff" wireframe />
                ) : (
                  obj.material && <CustomMaterial material={obj.material} />
                )}
              </mesh>
            )
          );
        })()}

        {obj.type === 'csg' && (
          <mesh castShadow receiveShadow>
            <Geometry>
              {children.map((child) => {
                const geom = renderGeometry(child.geometry);
                const props = {
                  position: child.position,
                  rotation: child.rotation,
                  scale: child.scale,
                };
                if (child.csgMode === 'base') return <Base key={`csg-${child.id}`} {...props}>{geom}</Base>;
                if (child.csgMode === 'subtraction') return <Subtraction key={`csg-${child.id}`} {...props}>{geom}</Subtraction>;
                if (child.csgMode === 'addition') return <Addition key={`csg-${child.id}`} {...props}>{geom}</Addition>;
                if (child.csgMode === 'intersection') return <Intersection key={`csg-${child.id}`} {...props}>{geom}</Intersection>;
                return <Base key={`csg-${child.id}`} {...props}>{geom}</Base>;
              })}
            </Geometry>
            {isSelected && !isPlaying && showOverlays ? (
              <meshBasicMaterial color="#ffffff" wireframe />
            ) : (
              obj.material && <CustomMaterial material={obj.material} />
            )}
          </mesh>
        )}

        {isObjFormat(obj) && obj.url && (
          <ModelErrorBoundary
            assetName={obj.name}
            fallback={
              <mesh>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color="#ef4444" wireframe />
              </mesh>
            }
          >
            <Suspense fallback={<meshBasicMaterial wireframe color="#3b82f6" />}>
              <ObjModel url={obj.url} objId={obj.id} />
            </Suspense>
          </ModelErrorBoundary>
        )}

        {isFbxFormat(obj) && !isObjFormat(obj) && obj.url && (
          <ModelErrorBoundary
            assetName={obj.name}
            fallback={
              <mesh>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color="#ef4444" wireframe />
              </mesh>
            }
          >
            <Suspense fallback={<meshBasicMaterial wireframe color="#3b82f6" />}>
              <FbxModel url={obj.url} objId={obj.id} />
            </Suspense>
          </ModelErrorBoundary>
        )}

        {(obj.type === 'gltf' || (!isObjFormat(obj) && !isFbxFormat(obj) && (obj.type as string) === 'model')) && obj.url && (
          <ModelErrorBoundary
            assetName={obj.name}
            fallback={
              <mesh>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color="#ef4444" wireframe />
              </mesh>
            }
          >
            <Suspense fallback={<meshBasicMaterial wireframe color="#3b82f6" />}>
              <GltfModel url={obj.url} isPlayer={obj.id === 'obj_player'} objId={obj.id} />
            </Suspense>
          </ModelErrorBoundary>
        )}

        {obj.type === 'light' && obj.lightProps && (
          <>
            {(!obj.lightProps.lightType || obj.lightProps.lightType === 'point') && (
              <pointLight
                color={obj.lightProps.color}
                intensity={obj.lightProps.intensity}
                distance={obj.lightProps.distance}
                castShadow
              />
            )}

            {obj.lightProps.lightType === 'spot' && (
              <spotLight
                color={obj.lightProps.color}
                intensity={obj.lightProps.intensity}
                distance={obj.lightProps.distance}
                angle={obj.lightProps.angle ?? 0.5}
                penumbra={obj.lightProps.penumbra ?? 0.5}
                castShadow
                shadow-mapSize={[1024, 1024]}
              />
            )}

            {obj.lightProps.lightType === 'directional' && (
              <directionalLight
                color={obj.lightProps.color}
                intensity={obj.lightProps.intensity}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-far={50}
                shadow-camera-left={-10}
                shadow-camera-right={10}
                shadow-camera-top={10}
                shadow-camera-bottom={-10}
              />
            )}

            {showEmitters && (!isPlaying || isSelected) && (
              <mesh>
                {(!obj.lightProps.lightType || obj.lightProps.lightType === 'point') && (
                  <sphereGeometry args={[0.2, 16, 16]} />
                )}
                {obj.lightProps.lightType === 'spot' && (
                  <coneGeometry args={[0.25, 0.5, 16]} />
                )}
                {obj.lightProps.lightType === 'directional' && (
                  <boxGeometry args={[0.3, 0.3, 0.3]} />
                )}
                <meshBasicMaterial color={obj.lightProps.color} wireframe />
              </mesh>
            )}
          </>
        )}
      </>

      {children.map((child) => (
        <SceneNode
          key={child.id}
          obj={child}
          isSelected={selectedIds.includes(child.id)}
          setOrbitEnabled={setOrbitEnabled}
          isPlaying={isPlaying}
          isCSGChild={obj.type === 'csg'}
        />
      ))}
    </group>
  );

  const isPlane = obj.geometry === 'plane';

  const getColliderProp = () => {
    if (obj.physicsCollisions === false || obj.isSolid === false) return false;
    // Emitters should not generate collision hitboxes!
    if (['fire', 'smoke', 'water', 'sparks', 'tornado'].includes(obj.type) || ['fire', 'smoke', 'water', 'sparks', 'tornado'].includes(obj.geometry || '')) return false;
    if (isPlane || obj.geometry === 'box' || obj.geometry === 'sphere') return false;
    const type = obj.physicsColliderType || 'auto';
    if (type !== 'auto') return type as any;
    if (obj.type === 'mesh') return 'hull';
    if (obj.type === 'gltf' || (obj.type as string) === 'fbx' || (obj.type as string) === 'obj' || isObjFormat(obj) || isFbxFormat(obj)) return 'hull';
    return undefined;
  };

  // FIX 2: Keep the RigidBody's rotation equal to the object's rotation so
  //         rotated planes (walls, ramps) have correctly-oriented colliders.
  // FIX 3: Safely omit mass when undefined so Rapier auto-computes it from the colliders.
  const hasJoints = false;
  const wrapperProps = isSimulating
    ? {
        type: hasJoints
          ? 'kinematicPosition'
          : (obj.anchored || obj.physics === 'fixed' ? 'fixed' : 'dynamic'),
        position: obj.position,
        rotation: obj.rotation,
        colliders: getColliderProp(),
        ...(obj.physicsMass !== undefined ? { mass: obj.physicsMass } : {}),
        restitution: obj.physicsRestitution !== undefined ? obj.physicsRestitution : 0.2,
        friction: obj.physicsFriction !== undefined ? obj.physicsFriction : 0.5,
        ccd: true,
        ...(obj.id === 'obj_player' ? { lockRotations: true } : {}),
      }
    : {};

  return (
    <>
      {isSimulating ? (
        <RigidBody
          key={`${obj.id}-${obj.url || ''}-${obj.geometry || ''}`}
          {...wrapperProps}
          userData={{ id: obj.id }}
          ref={handleRef}
          onCollisionEnter={(payload) => {
            if (isSimulating) {
              CollisionEventBroker.handleRapierCollisionEnter(obj.id, payload, ref.current, obj);
            }
          }}
          onCollisionExit={(payload) => {
            if (isSimulating) {
              CollisionEventBroker.handleRapierCollisionExit(obj.id, payload, obj);
            }
          }}
          onIntersectionEnter={(payload) => {
            if (isSimulating) {
              CollisionEventBroker.handleRapierIntersectionEnter(obj.id, payload, obj);
            }
          }}
          onIntersectionExit={(payload) => {
            if (isSimulating) {
              CollisionEventBroker.handleRapierIntersectionExit(obj.id, payload, obj);
            }
          }}
        >
          {/* groupContent inherits the RigidBody transform — no extra wrapper needed */}
          {groupContent}

          {/* Plane collider lives in local space. The visual plane is on the XY axes, facing +Z.
              We give it a half-thickness of 0.5 on Z, and offset it by -0.5 so its +Z face
              exactly aligns with the visual plane at Z=0. */}
          {obj.physicsCollisions !== false && obj.isSolid !== false && isPlane && (
            <CuboidCollider
              args={[obj.scale[0] * 0.5, obj.scale[1] * 0.5, 0.5]}
              position={[0, 0, -0.5]}
            />
          )}
          {obj.physicsCollisions !== false && obj.isSolid !== false && !isPlane && obj.geometry === 'box' && (
            <CuboidCollider
              args={[obj.scale[0] * 0.5, obj.scale[1] * 0.5, obj.scale[2] * 0.5]}
            />
          )}
          {obj.physicsCollisions !== false && obj.isSolid !== false && !isPlane && obj.geometry === 'sphere' && (
            <BallCollider
              args={[obj.scale[0] * 0.5]}
            />
          )}
        </RigidBody>
      ) : (
        groupContent
      )}

      {isSelected && selectedIds.length === 1 && !isPlaying && activeTool !== 'foliage' && obj.type !== 'group' && (
        <GizmoWrapper
          objRef={ref}
          objId={obj.id}
          transformMode={transformMode === 'select' ? 'translate' : transformMode}
          snapGrid={snapGrid}
          snapValue={snapValue}
          setOrbitEnabled={setOrbitEnabled}
          updateObject={updateObject}
          obj={obj}
        />
      )}
    </>
  );
});

/**
 * GizmoWrapper — robust transform-controls wrapper that:
 * 1. Never gets stuck in grasp state (global pointerup + safety timeout)
 * 2. Supports center-pivot mode (shifts gizmo to bounding-box center)
 * 3. Shows grab/grabbing cursor feedback
 */
function GizmoWrapper({
  objRef,
  objId,
  transformMode,
  snapGrid,
  snapValue,
  setOrbitEnabled,
  updateObject,
  obj,
}: {
  objRef: React.RefObject<any>;
  objId: string;
  transformMode: 'translate' | 'rotate' | 'scale';
  snapGrid: boolean;
  snapValue: number;
  setOrbitEnabled: (v: boolean) => void;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  obj: SceneObject;
}) {
  const pivotMode = useStore((state) => state.pivotMode);
  const isDragging = useRef(false);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tc, setTc] = useState<any>(null);

  // Calculate pivot offset based on mode
  const pivotOffset = useMemo(() => {
    if (pivotMode === 'base') return [0, 0, 0] as [number, number, number];

    // Center pivot: shift gizmo up by half the object height
    if (obj.geometry === 'box') return [0, 0, 0] as [number, number, number]; // box is already centered
    if (obj.geometry === 'sphere') return [0, 0, 0] as [number, number, number]; // sphere already centered
    if (obj.geometry === 'cylinder') return [0, 0, 0] as [number, number, number];
    if (obj.geometry === 'cone') return [0, 0, 0] as [number, number, number];
    if (obj.geometry === 'torus') return [0, 0, 0] as [number, number, number];
    if (obj.geometry === 'torusKnot') return [0, 0, 0] as [number, number, number];

    // For GLTF models, compute bounding box center offset dynamically
    if (obj.type === 'gltf' || (obj.type as string) === 'fbx') {
      // The offset is applied by computing the bounding box in useEffect below
      return [0, 0, 0] as [number, number, number];
    }

    return [0, 0, 0] as [number, number, number];
  }, [pivotMode, obj.geometry, obj.type]);

  // Robust release function
  const releaseGrasp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (safetyTimer.current) {
      clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }

    setOrbitEnabled(true);
    document.body.style.cursor = '';
    // Reset gizmo focus on release so selection guard is cleared
    useStore.getState().setGizmoFocused(false);

    if (objRef.current) {
      const o = objRef.current;
      updateObject(objId, {
        position: [o.position.x, o.position.y, o.position.z],
        rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
        scale: [o.scale.x, o.scale.y, o.scale.z],
      });
    }
  }, [objRef, objId, updateObject, setOrbitEnabled]);

  // Global safety listeners to catch missed releases
  useEffect(() => {
    const onGlobalPointerUp = () => {
      if (isDragging.current) releaseGrasp();
      // Always clear gizmoFocused on any pointer release as a safety net
      useStore.getState().setGizmoFocused(false);
    };

    const onBlurOrHidden = () => {
      if (isDragging.current) releaseGrasp();
      useStore.getState().setGizmoFocused(false);
    };

    const onVisibilityChange = () => {
      if (document.hidden && isDragging.current) releaseGrasp();
    };

    window.addEventListener('pointerup', onGlobalPointerUp);
    window.addEventListener('blur', onBlurOrHidden);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('pointerup', onGlobalPointerUp);
      window.removeEventListener('blur', onBlurOrHidden);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      // Ensure clean state on unmount
      if (isDragging.current) {
        isDragging.current = false;
        setOrbitEnabled(true);
        document.body.style.cursor = '';
      }
      // Always clear gizmoFocused on unmount to prevent stuck block
      useStore.getState().setGizmoFocused(false);
      if (safetyTimer.current) {
        clearTimeout(safetyTimer.current);
        safetyTimer.current = null;
      }
    };
  }, [releaseGrasp, setOrbitEnabled]);

  // Gizmo handle hover detection using three.js TransformControls' internal `axis` property.
  // `tc.axis` is non-null ONLY when the pointer is directly over a gizmo handle (e.g. "X", "Y", "XY").
  // This replaces the old pointerenter/pointerleave approach which operated on the domElement
  // (which covers the entire canvas, not just the handles).
  useEffect(() => {
    if (!tc) return;

    const domEl = tc.domElement || tc.el;
    if (!domEl) return;

    // On every pointermove, sync tc.axis to gizmoFocused in the store.
    // This ensures the guard state is always accurate before any click.
    const onPointerMove = () => {
      if (isDragging.current) return; // Don't change during active drag
      const isOverHandle = (tc as any).axis !== null;
      const state = useStore.getState();
      if (isOverHandle !== state.gizmoFocused) {
        state.setGizmoFocused(isOverHandle);
      }
      // Cursor feedback
      document.body.style.cursor = isOverHandle ? 'grab' : '';
    };

    // Capture-phase pointerdown: fires BEFORE R3F's bubble-phase raycaster.
    // Sets gizmoFocused synchronously so that R3F's event filter (on Canvas)
    // can reject all raycast hits for this event. We do NOT call
    // stopImmediatePropagation() because TransformControls' own handler
    // also listens on the same element and must still receive the event
    // to start the drag operation.
    const onPointerDown = () => {
      const axis = (tc as any).axis;
      console.log(`[GizmoWrapper] capture-phase pointerdown — tc.axis=${axis}, gizmoFocused=${useStore.getState().gizmoFocused}`);
      if (axis !== null) {
        useStore.getState().setGizmoFocused(true);
        console.log(`[GizmoWrapper] SET gizmoFocused=true (axis=${axis})`);
      }
    };

    domEl.addEventListener('pointermove', onPointerMove);
    domEl.addEventListener('pointerdown', onPointerDown, true); // capture phase

    return () => {
      domEl.removeEventListener('pointermove', onPointerMove);
      domEl.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [tc]);

  return (
    <TransformControls
      ref={setTc}
      object={objRef}
      mode={transformMode}
      size={1.35}
      translationSnap={snapGrid ? snapValue : null}
      rotationSnap={snapGrid ? Math.PI / 8 : null}
      scaleSnap={snapGrid ? 0.5 : null}
      onMouseDown={() => {
        isDragging.current = true;
        setOrbitEnabled(false);
        document.body.style.cursor = 'grabbing';

        // Safety timeout: auto-release after 150ms of no dragging-end event
        if (safetyTimer.current) clearTimeout(safetyTimer.current);
        safetyTimer.current = setTimeout(() => {
          // Only fire if still dragging (event was missed)
          // We don't auto-release during active drag, instead reset on next pointerup
        }, 150);
      }}
      onMouseUp={() => {
        releaseGrasp();
      }}
      onChange={() => {
        // Reset safety timer on each change (proves drag is active)
        if (safetyTimer.current) {
          clearTimeout(safetyTimer.current);
          safetyTimer.current = null;
        }
        // DO NOT call updateObject() here!
        // TransformControls updates objRef.current in real-time.
        // Full Zustand store update + Zundo history occurs onMouseUp (releaseGrasp).
      }}
    />
  );
}

/**
 * MultiSelectionGizmo — renders a unified transform handle positioned at the shared centroid
 * when multiple objects are selected simultaneously.
 * Supports translation, rotation around centroid, and scaling from centroid.
 */
function MultiSelectionGizmo({
  setOrbitEnabled,
}: {
  setOrbitEnabled: (v: boolean) => void;
}) {
  const { scene } = useThree();
  const selectedIds = useStore((s) => s.selectedIds);
  const objects = useStore((s) => s.objects);
  const transformMode = useStore((s) => s.transformMode);
  const snapGrid = useStore((s) => s.snapGrid);
  const snapValue = useStore((s) => s.snapValue);
  const isPlaying = useStore((s) => s.isPlaying);
  const activeTool = useStore((s) => s.activeTool);
  const updateObjects = useStore((s) => s.updateObjects);

  const anchorRef = useRef<THREE.Group>(null);
  const [tc, setTc] = useState<any>(null);
  const isDragging = useRef(false);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedStoreObjects = useMemo(() => {
    if (selectedIds.length <= 1) return [];
    return objects.filter(
      (o) => selectedIds.includes(o.id) && o.type !== 'group' && o.visible !== false
    );
  }, [selectedIds, objects]);

  // Compute shared centroid position across all selected objects
  const currentCentroid = useMemo(() => {
    if (selectedStoreObjects.length === 0) return null;
    let sumX = 0;
    let sumY = 0;
    let sumZ = 0;
    for (let i = 0; i < selectedStoreObjects.length; i++) {
      const p = selectedStoreObjects[i].position;
      sumX += p[0];
      sumY += p[1];
      sumZ += p[2];
    }
    const count = selectedStoreObjects.length;
    return new THREE.Vector3(sumX / count, sumY / count, sumZ / count);
  }, [selectedStoreObjects]);

  // Sync anchor group position to centroid when not dragging
  useEffect(() => {
    if (!isDragging.current && anchorRef.current && currentCentroid) {
      anchorRef.current.position.copy(currentCentroid);
      anchorRef.current.quaternion.identity();
      anchorRef.current.scale.set(1, 1, 1);
      anchorRef.current.updateMatrixWorld(true);
    }
  }, [currentCentroid]);

  // Store snapshot of transforms when drag commences
  const dragSnapshotRef = useRef<{
    initialCentroid: THREE.Vector3;
    objects: Array<{
      id: string;
      node: THREE.Object3D;
      initialPos: THREE.Vector3;
      initialQuat: THREE.Quaternion;
      initialScale: THREE.Vector3;
      offsetFromCentroid: THREE.Vector3;
    }>;
  } | null>(null);

  const releaseGrasp = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;

    if (safetyTimer.current) {
      clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }

    setOrbitEnabled(true);
    document.body.style.cursor = '';
    useStore.getState().setGizmoFocused(false);

    if (dragSnapshotRef.current) {
      const updatesMap: Record<string, Partial<SceneObject>> = {};
      for (const item of dragSnapshotRef.current.objects) {
        const node = item.node;
        updatesMap[item.id] = {
          position: [node.position.x, node.position.y, node.position.z],
          rotation: [node.rotation.x, node.rotation.y, node.rotation.z],
          scale: [node.scale.x, node.scale.y, node.scale.z],
        };
      }
      updateObjects(updatesMap);
      dragSnapshotRef.current = null;
    }
  }, [setOrbitEnabled, updateObjects]);

  // Global safety listeners
  useEffect(() => {
    const onGlobalPointerUp = () => {
      if (isDragging.current) releaseGrasp();
      useStore.getState().setGizmoFocused(false);
    };
    const onBlurOrHidden = () => {
      if (isDragging.current) releaseGrasp();
      useStore.getState().setGizmoFocused(false);
    };
    const onVisibilityChange = () => {
      if (document.hidden && isDragging.current) releaseGrasp();
    };

    window.addEventListener('pointerup', onGlobalPointerUp);
    window.addEventListener('blur', onBlurOrHidden);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('pointerup', onGlobalPointerUp);
      window.removeEventListener('blur', onBlurOrHidden);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (isDragging.current) {
        isDragging.current = false;
        setOrbitEnabled(true);
        document.body.style.cursor = '';
      }
      useStore.getState().setGizmoFocused(false);
      if (safetyTimer.current) {
        clearTimeout(safetyTimer.current);
        safetyTimer.current = null;
      }
    };
  }, [releaseGrasp, setOrbitEnabled]);

  // Gizmo handle hover detection
  useEffect(() => {
    if (!tc) return;
    const domEl = tc.domElement || tc.el;
    if (!domEl) return;

    const onPointerMove = () => {
      if (isDragging.current) return;
      const isOverHandle = (tc as any).axis !== null;
      const state = useStore.getState();
      if (isOverHandle !== state.gizmoFocused) {
        state.setGizmoFocused(isOverHandle);
      }
      document.body.style.cursor = isOverHandle ? 'grab' : '';
    };

    const onPointerDown = () => {
      const axis = (tc as any).axis;
      if (axis !== null) {
        useStore.getState().setGizmoFocused(true);
      }
    };

    domEl.addEventListener('pointermove', onPointerMove);
    domEl.addEventListener('pointerdown', onPointerDown, true);

    return () => {
      domEl.removeEventListener('pointermove', onPointerMove);
      domEl.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [tc]);

  if (isPlaying || activeTool === 'foliage' || selectedStoreObjects.length <= 1 || !currentCentroid) {
    return null;
  }

  return (
    <>
      <group ref={anchorRef} position={currentCentroid.toArray()} name="multi_selection_anchor" />
      {anchorRef.current && (
        <TransformControls
          ref={setTc}
          object={anchorRef}
          mode={transformMode === 'select' ? 'translate' : transformMode}
          size={1.35}
          translationSnap={snapGrid ? snapValue : null}
          rotationSnap={snapGrid ? Math.PI / 8 : null}
          scaleSnap={snapGrid ? 0.5 : null}
          onMouseDown={() => {
            if (!anchorRef.current) return;
            isDragging.current = true;
            setOrbitEnabled(false);
            document.body.style.cursor = 'grabbing';

            const exportScene = scene.getObjectByName('export_scene');
            if (!exportScene) return;

            const snapList: NonNullable<typeof dragSnapshotRef.current>['objects'] = [];
            const initialCentroid = anchorRef.current.position.clone();

            for (const obj of selectedStoreObjects) {
              let node: THREE.Object3D | null = null;
              exportScene.traverse((child) => {
                if (!node && (child.userData?.id === obj.id || (child.name === obj.name && child !== exportScene))) {
                  node = child;
                }
              });

              if (node) {
                const initialPos = (node as THREE.Object3D).position.clone();
                const initialQuat = (node as THREE.Object3D).quaternion.clone();
                const initialScale = (node as THREE.Object3D).scale.clone();
                const offset = initialPos.clone().sub(initialCentroid);

                snapList.push({
                  id: obj.id,
                  node: node as THREE.Object3D,
                  initialPos,
                  initialQuat,
                  initialScale,
                  offsetFromCentroid: offset,
                });
              }
            }

            dragSnapshotRef.current = {
              initialCentroid,
              objects: snapList,
            };
          }}
          onMouseUp={releaseGrasp}
          onChange={() => {
            if (!isDragging.current || !dragSnapshotRef.current || !anchorRef.current) return;
            if (safetyTimer.current) {
              clearTimeout(safetyTimer.current);
              safetyTimer.current = null;
            }

            const { initialCentroid, objects: snapObjects } = dragSnapshotRef.current;
            const currentAnchorPos = anchorRef.current.position;
            const anchorQuat = anchorRef.current.quaternion;
            const anchorScale = anchorRef.current.scale;

            for (const item of snapObjects) {
              // 1. Scaled and rotated offset from anchor
              const scaledOffset = item.offsetFromCentroid.clone().multiply(anchorScale);
              scaledOffset.applyQuaternion(anchorQuat);
              item.node.position.copy(currentAnchorPos).add(scaledOffset);

              // 2. Combined orientation
              item.node.quaternion.copy(anchorQuat).multiply(item.initialQuat);

              // 3. Combined scale
              item.node.scale.copy(item.initialScale).multiply(anchorScale);

              item.node.updateMatrixWorld(true);
            }
          }}
        />
      )}
    </>
  );
}

function playProceduralFootstep() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    const bufferSize = ctx.sampleRate * 0.08;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 250;
    filter.Q.value = 3.0;
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    
    noise.start();
    
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.05);
    
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.05, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
    noise.stop(ctx.currentTime + 0.09);
  } catch (e) {
    console.warn('[Audio] Failed to play procedural footstep:', e);
  }
}

function playProceduralLanding() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    const bufferSize = ctx.sampleRate * 0.18;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 180;
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    
    noise.start();
    
    osc.frequency.setValueAtTime(60, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.12);
    
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.2, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.13);
    noise.stop(ctx.currentTime + 0.19);
  } catch (e) {
    console.warn('[Audio] Failed to play procedural landing:', e);
  }
}

function playLandingSound(url: string) {
  if (!url || url === '/sounds/footstep.wav') {
    playProceduralLanding();
    return;
  }
  try {
    const audio = new Audio(url);
    audio.volume = 0.45;
    audio.play().catch(err => {
      console.warn('[Audio] Play landing sound file failed, falling back:', err);
      playProceduralLanding();
    });
  } catch (e) {
    console.warn('[Audio] Landing sound error, falling back:', e);
    playProceduralLanding();
  }
}

function PlayerController() {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const keys = useRef({ w: false, a: false, s: false, d: false, space: false, shift: false, c: false, q: false });
  const lastSpacePressed = useRef(false);
  const jumpCooldown = useRef(0);
  const jumpCount = useRef(0);
  const [locked, setLocked] = useState(false);
  const isPlaying = useStore((state) => state.isPlaying);
  const objects = useStore((state) => state.objects);
  const environment = useStore((state) => state.environment);
  const playerObj = useMemo(() => objects.find((o) => o.id === 'obj_player'), [objects]);
  const characterActions = useMemo(() => playerObj?.characterActions ?? {
    autoJump: false,
    doubleJump: false,
    sprintEnabled: true,
    crouchEnabled: false,
    dashEnabled: false,
    dashDistance: 5.0,
    dashCooldown: 1.0,
    autoClimb: false,
    footstepAudioEnabled: false,
    footstepAudioUrl: '/sounds/footstep.wav',
  }, [playerObj?.characterActions]);
  const { rapier, world } = useRapier();

  const handleLock = React.useCallback(() => setLocked(true), []);
  const handleUnlock = React.useCallback(() => {
    setLocked(false);
    if (useStore.getState().isPlaying) {
      useStore.getState().setPaused(true);
    }
  }, []);

  const isPaused = useStore((state) => state.isPaused);

  // Keep refs for dash state
  const dashTimeLeft = useRef(0);
  const dashDirection = useRef(new THREE.Vector3());
  const dashCooldownRemaining = useRef(0);
  const lastQPressed = useRef(false);

  // Keep refs for climb state
  const isClimbing = useRef(false);
  const climbTimer = useRef(0);

  // Keep refs for audio state
  const wasGrounded = useRef(true);
  const footstepTimer = useRef(0);

  useEffect(() => {
    if (isPaused) {
      keys.current = { w: false, a: false, s: false, d: false, space: false, shift: false, c: false, q: false };
    }
  }, [isPaused]);

  useEffect(() => {
    if (!isPlaying && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (camera.position.y < 1) camera.position.y = 1.6;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (useStore.getState().isPaused) return;
      const key = e.key.toLowerCase();
      if (key === 'w') keys.current.w = true;
      if (key === 'a') keys.current.a = true;
      if (key === 's') keys.current.s = true;
      if (key === 'd') keys.current.d = true;
      if (key === 'c') keys.current.c = true;
      if (key === 'q') keys.current.q = true;
      if (e.code === 'Space') keys.current.space = true;
      if (e.key === 'Shift') keys.current.shift = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === 'w') keys.current.w = false;
      if (key === 'a') keys.current.a = false;
      if (key === 's') keys.current.s = false;
      if (key === 'd') keys.current.d = false;
      if (key === 'c') keys.current.c = false;
      if (key === 'q') keys.current.q = false;
      if (e.code === 'Space') keys.current.space = false;
      if (e.key === 'Shift') keys.current.shift = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [camera]);

  useFrame((_, delta) => {
    if (isPaused) return;
    if (playerRigidBodyRef && typeof playerRigidBodyRef.isValid === 'function' && playerRigidBodyRef.isValid()) {
      if (jumpCooldown.current > 0) {
        jumpCooldown.current -= delta;
      }
      if (dashCooldownRemaining.current > 0) {
        dashCooldownRemaining.current -= delta;
      }
      if (climbTimer.current > 0) {
        climbTimer.current -= delta;
      }

      // 1. Get player position from physics engine
      let translation = playerRigidBodyRef.translation();

      // Check if player fell off the map (Y threshold)
      if (translation.y < -20) {
        const spawnPos = playerObj?.position || [-2, 1, 0];
        playerRigidBodyRef.setTranslation({ x: spawnPos[0], y: spawnPos[1], z: spawnPos[2] }, true);
        playerRigidBodyRef.setLinvel({ x: 0, y: 0, z: 0 }, true);
        translation = playerRigidBodyRef.translation(); // Get updated position
      }

      const playerPos = new THREE.Vector3(translation.x, translation.y, translation.z);

      // --- DETECT IF PLAYER IS IN WATER ---
      let isInWater = false;
      let waterSurfaceY = -999;

      const waterObjects = objects.filter((o) => {
        if (o.id === 'obj_player') return false;
        return o.material && (
          o.material.map === 'water' ||
          o.material.normalMap === 'water' ||
          (o.material.map && o.material.map.includes('waternormals.jpg')) ||
          (o.material.normalMap && o.material.normalMap.includes('waternormals.jpg'))
        );
      });

      for (const water of waterObjects) {
        const halfScaleX = water.scale[0] * 0.5;
        const halfScaleZ = water.scale[2] * 0.5;
        const isWaterPlane = water.geometry === 'plane';
        
        const wx = water.position[0];
        const wy = water.position[1];
        const wz = water.position[2];
        
        const px = playerPos.x;
        const py = playerPos.y;
        const pz = playerPos.z;
        
        if (isWaterPlane) {
          const dx = Math.abs(px - wx);
          const dz = Math.abs(pz - wz);
          if (dx <= halfScaleX && dz <= halfScaleZ) {
            if (py <= wy + 0.5) {
              isInWater = true;
              waterSurfaceY = Math.max(waterSurfaceY, wy);
            }
          }
        } else {
          const halfScaleY = water.scale[1] * 0.5;
          const dx = Math.abs(px - wx);
          const dy = Math.abs(py - wy);
          const dz = Math.abs(pz - wz);
          
          if (dx <= halfScaleX && dy <= halfScaleY + 0.8 && dz <= halfScaleZ) {
            isInWater = true;
            waterSurfaceY = Math.max(waterSurfaceY, wy + halfScaleY);
          }
        }
      }

      // 2. Camera follow math (third-person mode)
      const distance = 5.0; // Distance behind player
      const heightOffset = 1.5; // Look height offset above player origin
      
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      
      const target = playerPos.clone();
      target.y += heightOffset;
      
      camera.position.copy(target).sub(forward.clone().multiplyScalar(distance));
      camera.position.y = Math.max(translation.y + 0.2, camera.position.y);

      // 3. Movement controls (only when pointer is locked)
      if (locked) {
        // Project camera forward and right vectors onto horizontal XZ plane
        const camForward = new THREE.Vector3();
        camera.getWorldDirection(camForward);
        camForward.y = 0;
        if (camForward.lengthSq() < 0.0001) {
          const localUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
          camForward.copy(localUp);
          camForward.y = 0;
          if (camForward.lengthSq() < 0.0001) {
            camForward.set(0, 0, -1);
          }
        }
        camForward.normalize();

        const camRight = new THREE.Vector3();
        camRight.crossVectors(camForward, camera.up).normalize();

        // Calculate horizontal movement vector based on WASD keys
        const moveDir = new THREE.Vector3();
        if (keys.current.w) moveDir.add(camForward);
        if (keys.current.s) moveDir.sub(camForward);
        if (keys.current.d) moveDir.add(camRight);
        if (keys.current.a) moveDir.sub(camRight);

        if (moveDir.lengthSq() > 0) {
          moveDir.normalize();
        }

        // --- DASH LOGIC ---
        const dashEnabled = characterActions.dashEnabled;
        const dashDistance = characterActions.dashDistance ?? 5.0;
        const dashCooldown = characterActions.dashCooldown ?? 1.0;
        const qPressed = keys.current.q;
        const qNewlyPressed = qPressed && !lastQPressed.current;
        lastQPressed.current = qPressed;

        if (dashEnabled && qNewlyPressed && dashCooldownRemaining.current <= 0 && dashTimeLeft.current <= 0 && !isClimbing.current) {
          dashTimeLeft.current = 0.15; // 150ms dash duration
          dashCooldownRemaining.current = dashCooldown;
          if (moveDir.lengthSq() > 0) {
            dashDirection.current.copy(moveDir).normalize();
          } else {
            dashDirection.current.copy(camForward).normalize();
          }
        }

        // --- GROUNDED RAYCAST ---
        let isGrounded = false;
        if (world && rapier) {
          const origin = { x: translation.x, y: translation.y - 0.85, z: translation.z };
          const ray = new rapier.Ray(origin, { x: 0, y: -1, z: 0 });
          const maxToi = 0.25;
          const hit = world.castRay(
            ray,
            maxToi,
            true,
            undefined,
            undefined,
            undefined,
            undefined,
            (collider) => {
              const parent = collider.parent();
              return !parent || parent.handle !== playerRigidBodyRef.handle;
            }
          );
          isGrounded = hit !== null && playerRigidBodyRef.linvel().y <= 0.1;
        } else {
          isGrounded = Math.abs(playerRigidBodyRef.linvel().y) < 0.1;
        }

        if (isGrounded) {
          jumpCount.current = 0;
        }

        // --- LANDING AND FOOTSTEP AUDIO TRIGGER ---
        const landed = isGrounded && !wasGrounded.current;
        wasGrounded.current = isGrounded;

        if (landed && characterActions.footstepAudioEnabled) {
          playLandingSound(characterActions.footstepAudioUrl || '/sounds/footstep.wav');
        }

        if (isGrounded && moveDir.lengthSq() > 0 && characterActions.footstepAudioEnabled && dashTimeLeft.current <= 0 && !isClimbing.current) {
          const stepInterval = keys.current.shift ? 0.28 : 0.38;
          footstepTimer.current += delta;
          if (footstepTimer.current >= stepInterval) {
            footstepTimer.current = 0;
            playProceduralFootstep();
          }
        } else {
          footstepTimer.current = 0;
        }

        // --- AUTO-CLIMB DETECTION ---
        let isClimbingThisFrame = false;
        if (characterActions.autoClimb && world && rapier && moveDir.lengthSq() > 0 && dashTimeLeft.current <= 0) {
          const forwardOrigin = { x: translation.x, y: translation.y - 0.2, z: translation.z };
          const forwardDir = { x: moveDir.x, y: 0, z: moveDir.z };
          const forwardRay = new rapier.Ray(forwardOrigin, forwardDir);
          
          const forwardHit = world.castRay(
            forwardRay,
            0.65,
            true,
            undefined,
            undefined,
            undefined,
            undefined,
            (collider) => {
              const parent = collider.parent();
              return !parent || parent.handle !== playerRigidBodyRef.handle;
            }
          );

          if (forwardHit !== null) {
            const hitDistance = forwardHit.timeOfImpact;
            const hitPointX = translation.x + forwardDir.x * hitDistance;
            const hitPointZ = translation.z + forwardDir.z * hitDistance;
            
            const upOrigin = {
              x: hitPointX + forwardDir.x * 0.05,
              y: translation.y,
              z: hitPointZ + forwardDir.z * 0.05
            };
            const upRay = new rapier.Ray(upOrigin, { x: 0, y: 1, z: 0 });
            const upHit = world.castRay(
              upRay,
              1.6,
              true,
              undefined,
              undefined,
              undefined,
              undefined,
              (collider) => {
                const parent = collider.parent();
                return !parent || parent.handle !== playerRigidBodyRef.handle;
              }
            );

            if (upHit === null) {
              isClimbingThisFrame = true;
            }
          }
        }

        if (isClimbingThisFrame) {
          if (!isClimbing.current) {
            isClimbing.current = true;
            climbTimer.current = 0.8;
          }
        } else if (climbTimer.current <= 0) {
          isClimbing.current = false;
        }

        // --- VELOCITY DETERMINATION ---
        let targetVelX = 0;
        let targetVelY = playerRigidBodyRef.linvel().y;
        let targetVelZ = 0;

        if (dashTimeLeft.current > 0) {
          dashTimeLeft.current -= delta;
          const dashSpeed = dashDistance / 0.15;
          targetVelX = dashDirection.current.x * dashSpeed;
          targetVelZ = dashDirection.current.z * dashSpeed;
          targetVelY = 0;
        } else if (isClimbing.current) {
          targetVelY = 3.5;
          targetVelX = moveDir.x * 1.5;
          targetVelZ = moveDir.z * 1.5;
        } else {
          const speed = isInWater
            ? 3.0
            : (characterActions.sprintEnabled && keys.current.shift)
              ? 10.0
              : (characterActions.crouchEnabled && keys.current.c)
                ? 2.5
                : 5.0;
          targetVelX = moveDir.x * speed;
          targetVelZ = moveDir.z * speed;

          if (moveDir.lengthSq() > 0) {
            const angle = Math.atan2(moveDir.x, moveDir.z) + Math.PI;
            const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
            playerRigidBodyRef.setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }, true);
          }

          const spacePressedThisFrame = keys.current.space;
          const spaceNewlyPressed = spacePressedThisFrame && !lastSpacePressed.current;
          lastSpacePressed.current = spacePressedThisFrame;

          if (isInWater) {
            const targetSurfaceY = waterSurfaceY - 0.4;
            if (keys.current.space) {
              targetVelY = 3.0; // Swim up
            } else if (playerPos.y < targetSurfaceY) {
              // Float up to surface
              const floatForce = (targetSurfaceY - playerPos.y) * 4.0;
              targetVelY = Math.min(2.0, targetVelY + floatForce * delta * 8.0);
            } else {
              // Sinking damping
              if (targetVelY < -1.0) targetVelY = -1.0;
            }
          } else {
            if (characterActions.autoJump && isGrounded && moveDir.lengthSq() > 0 && jumpCooldown.current <= 0) {
              if (world && rapier) {
                const kneeOrigin = { x: translation.x, y: translation.y - 0.6, z: translation.z };
                const rayDir = { x: moveDir.x, y: 0, z: moveDir.z };
                const kneeRay = new rapier.Ray(kneeOrigin, rayDir);
                
                const kneeHit = world.castRay(
                  kneeRay,
                  0.6,
                  true,
                  undefined,
                  undefined,
                  undefined,
                  undefined,
                  (collider) => {
                    const parent = collider.parent();
                    return !parent || parent.handle !== playerRigidBodyRef.handle;
                  }
                );

                if (kneeHit !== null) {
                  const obstacleDistance = kneeHit.timeOfImpact;
                  const hipOrigin = { x: translation.x, y: translation.y - 0.35, z: translation.z };
                  const hipRay = new rapier.Ray(hipOrigin, rayDir);
                  const hipHit = world.castRay(
                    hipRay,
                    obstacleDistance + 0.05,
                    true,
                    undefined,
                    undefined,
                    undefined,
                    undefined,
                    (collider) => {
                      const parent = collider.parent();
                      return !parent || parent.handle !== playerRigidBodyRef.handle;
                    }
                  );

                  if (hipHit === null) {
                    targetVelY = 5.0;
                    jumpCooldown.current = 0.2;
                    jumpCount.current = 1;
                  }
                }
              }
            }

            if (spaceNewlyPressed && jumpCooldown.current <= 0) {
              if (isGrounded) {
                targetVelY = 7.0;
                jumpCooldown.current = 0.2;
                jumpCount.current = 1;
              } else if (characterActions.doubleJump && jumpCount.current === 1) {
                targetVelY = 6.0;
                jumpCooldown.current = 0.2;
                jumpCount.current = 2;
              }
            }
          }
        }

        playerRigidBodyRef.setLinvel({
          x: targetVelX,
          y: targetVelY,
          z: targetVelZ
        }, true);

        // --- ANIMATION STATE SYNCHRONIZATION ---
        let nextAnimState: 'idle' | 'walk' | 'sprint' | 'jump' | 'dash' | 'climb' = 'idle';
        if (isClimbing.current) {
          nextAnimState = 'climb';
        } else if (dashTimeLeft.current > 0) {
          nextAnimState = 'dash';
        } else if (isInWater) {
          nextAnimState = 'walk'; // Fallback swimming animation
        } else if (!isGrounded) {
          nextAnimState = 'jump';
        } else if (moveDir.lengthSq() > 0) {
          nextAnimState = (characterActions.sprintEnabled && keys.current.shift) ? 'sprint' : 'walk';
        } else {
          nextAnimState = 'idle';
        }
        useStore.getState().setPlayerAnimationState(nextAnimState);

      } else {
        const currentVel = playerRigidBodyRef.linvel();
        playerRigidBodyRef.setLinvel({
          x: 0,
          y: currentVel.y,
          z: 0
        }, true);
        useStore.getState().setPlayerAnimationState('idle');
      }
    } else {
      if (!locked) return;
      const d = Math.min(delta, 0.1);
      const speed = keys.current.shift ? 25.0 : 15.0;
      const mass = 5.0;

      velocity.current.x -= velocity.current.x * 10.0 * d;
      velocity.current.z -= velocity.current.z * 10.0 * d;
      velocity.current.y += (environment.gravity ?? -9.81) * mass * d;

      direction.current.z = Number(keys.current.w) - Number(keys.current.s);
      direction.current.x = Number(keys.current.d) - Number(keys.current.a);
      direction.current.normalize();

      if (keys.current.w || keys.current.s) velocity.current.z -= direction.current.z * speed * d;
      if (keys.current.a || keys.current.d) velocity.current.x += direction.current.x * speed * d;

      camera.translateX(velocity.current.x * d);
      camera.translateZ(velocity.current.z * d);
      camera.position.y += velocity.current.y * d;

      if (camera.position.y < 1.6) {
        velocity.current.y = 0;
        camera.position.y = 1.6;
        if (keys.current.space) {
          velocity.current.y = 15;
        }
      }
    }
  });

  return <PointerLockControls onLock={handleLock} onUnlock={handleUnlock} />;
}

function CameraController({ orbitRef }: { orbitRef: React.RefObject<any> }) {
  const { camera, gl } = useThree();
  const keys = useRef({ w: false, a: false, s: false, d: false, q: false, e: false, shift: false });
  const { objects, selectedIds, environment } = useStore();
  const focusState = useRef<{
    active: boolean;
    targetPos: THREE.Vector3;
    startCamPos: THREE.Vector3;
    endCamPos: THREE.Vector3;
    startTarget: THREE.Vector3;
    progress: number;
  } | null>(null);

  useEffect(() => {
    gl.toneMappingExposure = environment.exposure;
  }, [environment.exposure, gl]);

  useEffect(() => {
    const handleFocus = () => {
      if (selectedIds.length > 0 && orbitRef.current) {
        const obj = useStore.getState().objects.find((o) => o.id === selectedIds[0]);
        if (obj) {
          // Compute world position naively (assuming uniform scale for parent hierarchy for simplicity)
          let currentObj: any = obj;
          const worldPos = new THREE.Vector3();
          const visited = new Set();
          const objMap = new Map(useStore.getState().objects.map((o) => [o.id, o]));

          while (currentObj && !visited.has(currentObj.id)) {
            visited.add(currentObj.id);
            worldPos.add(new THREE.Vector3(...currentObj.position));
            currentObj = objMap.get(currentObj.parentId);
          }

          const maxScale = Math.max(...obj.scale);
          const distance = Math.max(maxScale * 4, 3);

          const dir = camera.position.clone().sub(orbitRef.current.target).normalize();
          if (dir.lengthSq() === 0) dir.set(0, 0, 1);

          const endCamPos = worldPos.clone().add(dir.multiplyScalar(distance));

          focusState.current = {
            active: true,
            targetPos: worldPos,
            startCamPos: camera.position.clone(),
            endCamPos: endCamPos,
            startTarget: orbitRef.current.target.clone(),
            progress: 0,
          };
        }
      }
    };

    const handleSnap = (e: Event) => {
      const customEvent = e as CustomEvent;
      const view = customEvent.detail.view;
      if (orbitRef.current) {
        const target = orbitRef.current.target.clone();
        const distance = orbitRef.current.getDistance();

        let newPos = target.clone();
        if (view === 'top') {
          newPos.y += distance;
          newPos.x = target.x;
          newPos.z = target.z;
        } else if (view === 'front') {
          newPos.z += distance;
          newPos.x = target.x;
          newPos.y = target.y;
        } else if (view === 'side') {
          newPos.x += distance;
          newPos.y = target.y;
          newPos.z = target.z;
        }

        focusState.current = {
          active: true,
          targetPos: target,
          startCamPos: camera.position.clone(),
          endCamPos: newPos,
          startTarget: orbitRef.current.target.clone(),
          progress: 0,
        };
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      )
        return;
      const key = e.key.toLowerCase();
      if (key in keys.current) keys.current[key as keyof typeof keys.current] = true;
      if (e.key === 'Shift') keys.current.shift = true;

      // Focus Selected Object (F)
      if (key === 'f') {
        handleFocus();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keys.current) keys.current[key as keyof typeof keys.current] = false;
      if (e.key === 'Shift') keys.current.shift = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('focus_camera', handleFocus);
    window.addEventListener('snap_camera', handleSnap);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('focus_camera', handleFocus);
      window.removeEventListener('snap_camera', handleSnap);
    };
  }, [selectedIds, camera]);

  useFrame((_, delta) => {
    if (!orbitRef.current) return;

    // Handle Focus Animation
    if (focusState.current && focusState.current.active) {
      focusState.current.progress += delta * 2.5;
      if (focusState.current.progress >= 1) {
        focusState.current.progress = 1;
        focusState.current.active = false;
      }
      const t = focusState.current.progress;
      const ease = 1 - Math.pow(1 - t, 4); // easeOutQuart

      camera.position.lerpVectors(focusState.current.startCamPos, focusState.current.endCamPos, ease);
      orbitRef.current.target.lerpVectors(focusState.current.startTarget, focusState.current.targetPos, ease);
      orbitRef.current.update();

      // Cancel focus if manual movement is attempted
      const isMoving =
        keys.current.w || keys.current.a || keys.current.s || keys.current.d || keys.current.q || keys.current.e;
      if (isMoving) focusState.current.active = false;
      return;
    }

    // Check if any movement keys are pressed
    const isMoving =
      keys.current.w || keys.current.a || keys.current.s || keys.current.d || keys.current.q || keys.current.e;
    if (!isMoving) return;

    const speed = (keys.current.shift ? 15 : 5) * delta;
    const dir = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);

    camera.getWorldDirection(dir);
    right.crossVectors(dir, up).normalize();

    const deltaPos = new THREE.Vector3();

    if (keys.current.w) deltaPos.add(dir.clone().multiplyScalar(speed));
    if (keys.current.s) deltaPos.add(dir.clone().multiplyScalar(-speed));
    if (keys.current.a) deltaPos.add(right.clone().multiplyScalar(-speed));
    if (keys.current.d) deltaPos.add(right.clone().multiplyScalar(speed));
    if (keys.current.e) deltaPos.y += speed;
    if (keys.current.q) deltaPos.y -= speed;

    if (deltaPos.lengthSq() > 0) {
      camera.position.add(deltaPos);
      orbitRef.current.target.add(deltaPos);
    }
  });

  return null;
}

function ExportHelper() {
  const { scene } = useThree();
  useEffect(() => {
    const handleExport = (e: any) => {
      const exportScene = scene.getObjectByName('export_scene') || scene;
      const isBinary = e?.detail?.binary ?? false;
      const filename = e?.detail?.filename ?? (isBinary ? 'scene.glb' : 'scene.gltf');

      exportSceneWithPipeline(exportScene, {
        binary: isBinary,
        filename,
      }).catch((err) => {
        console.error('[ExportHelper] Export pipeline failed:', err);
      });
    };
    window.addEventListener('export_gltf', handleExport);
    return () => window.removeEventListener('export_gltf', handleExport);
  }, [scene]);

  return null;
}

function BoneVisualizer() {
  const workspaceMode = useStore((s) => s.workspaceMode);
  const activeClonedScene = useStore((s) => s.activeClonedScene);
  const selectedBoneId = useStore((s) => s.selectedBoneId);
  const transformMode = useStore((s) => s.transformMode);
  const helperRef = useRef<THREE.SkeletonHelper | null>(null);
  const { scene } = useThree();

  useEffect(() => {
    if (workspaceMode !== 'animation' || !activeClonedScene) {
      if (helperRef.current) {
        scene.remove(helperRef.current);
        helperRef.current.dispose();
        helperRef.current = null;
      }
      return;
    }

    const helper = new THREE.SkeletonHelper(activeClonedScene);
    (helper.material as THREE.LineBasicMaterial).linewidth = 3;
    (helper.material as THREE.LineBasicMaterial).depthTest = false;
    (helper.material as THREE.LineBasicMaterial).transparent = true;
    (helper.material as THREE.LineBasicMaterial).opacity = 0.85;
    helperRef.current = helper;
    scene.add(helper);

    return () => {
      if (helperRef.current) {
        scene.remove(helperRef.current);
        helperRef.current.dispose();
        helperRef.current = null;
      }
    };
  }, [workspaceMode, activeClonedScene, scene]);

  useFrame(() => {
    if (helperRef.current) {
      (helperRef.current as any).update();
    }
  });

  const selectedBoneObject = useMemo(() => {
    if (!activeClonedScene || !selectedBoneId) return null;
    let found: THREE.Object3D | null = null;
    activeClonedScene.traverse((child: any) => {
      if (child.name === selectedBoneId || child.uuid === selectedBoneId) {
        found = child;
      }
    });
    return found;
  }, [activeClonedScene, selectedBoneId]);

  if (workspaceMode !== 'animation') return null;

  return (
    <>
      {selectedBoneObject && (
        <TransformControls
          object={selectedBoneObject}
          mode={transformMode === 'select' ? 'rotate' : transformMode}
          size={0.75}
          space="local"
        />
      )}
    </>
  );
}

function AssetStagingIndicator() {
  const [progress, setProgress] = useState<StagingProgressEvent>({
    total: 0,
    completed: 0,
    inFlight: 0,
    percent: 100,
  });

  useEffect(() => {
    return AssetStagingManager.subscribeProgress((p) => {
      setProgress(p);
    });
  }, []);

  if (progress.total === 0 || progress.percent >= 100) return null;

  return (
    <div className="absolute top-4 left-4 z-40 bg-bg-panel/90 backdrop-blur-md border border-accent/40 px-3 py-2 rounded-xl shadow-lg flex items-center gap-2.5 text-xs text-text-primary animate-in fade-in slide-in-from-top-2 duration-200 select-none pointer-events-none">
      <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <div className="flex flex-col">
        <span className="font-semibold text-[11px] text-white">Staging 3D Assets...</span>
        <span className="text-[10px] text-text-secondary">
          {progress.completed} of {progress.total} assets staged ({progress.percent}%)
        </span>
      </div>
    </div>
  );
}

/**
 * SpatialAudioSceneController — mounts AudioListener to camera,
 * manages 3D PositionalAudio nodes for objects with audioProps,
 * and renders falloff debug spheres for selected audio objects in editor mode.
 */
function SpatialAudioSceneController() {
  const { camera, scene } = useThree();
  const objects = useStore((s) => s.objects);
  const selectedIds = useStore((s) => s.selectedIds);
  const isPlaying = useStore((s) => s.isPlaying);

  // Attach listener to camera once
  useEffect(() => {
    const listener = SpatialAudioManager.getListener();
    if (camera && !camera.children.includes(listener)) {
      camera.add(listener);
    }
    return () => {
      if (camera && camera.children.includes(listener)) {
        camera.remove(listener);
      }
    };
  }, [camera]);

  // Sync scene object audio
  useEffect(() => {
    const exportScene = scene.getObjectByName('export_scene');
    if (!exportScene) return;

    for (const obj of objects) {
      if (obj.audioProps?.url) {
        let node: THREE.Object3D | null = null;
        exportScene.traverse((child) => {
          if (!node && (child.userData?.id === obj.id || (child.name === obj.name && child !== exportScene))) {
            node = child;
          }
        });

        if (node) {
          SpatialAudioManager.attachAudioToObject(node, obj.id, obj.audioProps.url, {
            ...obj.audioProps,
            muted: !isPlaying && obj.audioProps.autoplay === false,
          });
        }
      } else {
        SpatialAudioManager.removeAudio(obj.id);
      }
    }
  }, [objects, isPlaying, scene]);

  // Find selected object with spatial audio props for falloff wireframe visualization
  const selectedAudioObj = useMemo(() => {
    if (isPlaying || selectedIds.length !== 1) return null;
    return (
      objects.find(
        (o) => o.id === selectedIds[0] && o.audioProps?.url && o.audioProps?.sourceType !== 'ambient'
      ) || null
    );
  }, [objects, selectedIds, isPlaying]);

  if (!selectedAudioObj || !selectedAudioObj.audioProps) return null;

  const refDist = selectedAudioObj.audioProps.refDistance ?? 1;
  const maxDist = selectedAudioObj.audioProps.maxDistance ?? selectedAudioObj.audioProps.distance ?? 50;

  return (
    <group position={selectedAudioObj.position}>
      {/* Ref Distance Sphere (100% Volume Horizon) */}
      <mesh>
        <sphereGeometry args={[refDist, 16, 16]} />
        <meshBasicMaterial color="#10b981" wireframe transparent opacity={0.35} />
      </mesh>

      {/* Max Distance Sphere (Audible Boundary) */}
      <mesh>
        <sphereGeometry args={[maxDist, 24, 24]} />
        <meshBasicMaterial color="#059669" wireframe transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

export default function Viewport() {
  const { objects, selectedIds, selectObject, environment, addObject, isPlaying, isPaused, togglePause, setPaused, showGrid, sidebarVisible, bottomPanelVisible, inspectorVisible, toggleSidebar, toggleBottomPanel, toggleInspector } = useStore();
  const showOverlays = useStore((state) => state.showOverlays);
  const showPhysicsDebug = useStore((state) => state.showPhysicsDebug);
  const isPickingAsset = useStore((state) => state.isPickingAsset);
  const activePickerTarget = useStore((state) => state.activePickerTarget);

  // Background asset pre-staging for any 3D models in current scene
  useEffect(() => {
    objects.forEach((obj) => {
      if (obj.url && (obj.type === 'gltf' || (obj.type as string) === 'fbx' || (obj.type as string) === 'obj' || isObjFormat(obj) || isFbxFormat(obj))) {
        AssetStagingManager.stageAsset(obj.url, (obj.type as any) || 'gltf').catch(() => {});
      }
    });
  }, [objects]);

  const sunObj = objects.find((o) => o.id === 'obj_sun');
  const sunPosition = sunObj ? sunObj.position : [10, 20, 10];

  const moonObj = objects.find((o) => o.id === 'obj_moon');
  const moonPosition = moonObj ? moonObj.position : [-20, -40, -20];

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key.toLowerCase() === 'h') {
        useStore.getState().toggleOverlays();
      }
      if (e.key.toLowerCase() === 'p') {
        // If in play mode, 'p' toggles pause instead of toggling active tool
        if (useStore.getState().isPlaying) {
          e.preventDefault();
          useStore.getState().togglePause();
          return;
        }
        const current = useStore.getState().activeTool;
        useStore.getState().setActiveTool(current === 'foliage' ? 'select' : 'foliage');
      }
      if (e.key === 'Escape' && useStore.getState().isPlaying) {
        useStore.getState().setPaused(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [marqueeBox, setMarqueeBox] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [marqueeSelectedIds, setMarqueeSelectedIds] = useState<string[]>([]);
  const orbitRef = useRef<any>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const rootObjects = objects.filter((o) => !o.parentId);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Handle files dropped from desktop
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.glb') || lowerName.endsWith('.gltf') || lowerName.endsWith('.obj') || lowerName.endsWith('.fbx')) {
        const url = URL.createObjectURL(file);
        const modelType = lowerName.endsWith('.obj') ? 'obj' : (lowerName.endsWith('.fbx') ? 'fbx' : 'gltf');
        addObject({
          id: `obj_${crypto.randomUUID()}`,
          name: file.name,
          type: modelType,
          url: url,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        });
      }
      return;
    }

    // Handle assets dropped from BottomPanel
    const assetData = e.dataTransfer.getData('application/json');
    if (assetData) {
      try {
        const asset = JSON.parse(assetData);
        const selectedId = selectedIds[0] || null;
        const selectedObj = objects.find((o) => o.id === selectedId);
        // Never auto-insert into the starter_player system folder
        let parentId: string | null = null;
        if (selectedObj) {
          if (selectedObj.type === 'group' && selectedObj.id !== 'starter_player') {
            parentId = selectedObj.id;
          } else if (selectedObj.parentId && selectedObj.parentId !== 'starter_player') {
            parentId = selectedObj.parentId;
          }
        }

        if (asset.type === 'model' || asset.type === 'scene') {
          if (asset.url) {
            const lower = (asset.name || asset.url || '').toLowerCase();
            const modelType = lower.endsWith('.obj') ? 'obj' : (lower.endsWith('.fbx') ? 'fbx' : 'gltf');
            addObject({
              id: `obj_${crypto.randomUUID()}`,
              name: asset.name,
              type: modelType,
              url: asset.url,
              position: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
              parentId: parentId,
            });
          } else {
            addObject({
              id: `obj_${crypto.randomUUID()}`,
              name: asset.name,
              type: 'mesh',
              geometry: 'box', // Default to box for now
              position: [0, 1, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
              material: { color: '#ffffff', roughness: 0.5, metalness: 0, envMapIntensity: 1 },
              parentId: parentId,
            });
          }
        } else if (asset.type === 'material') {
          addObject({
            id: `obj_${crypto.randomUUID()}`,
            name: `Box with ${asset.name}`,
            type: 'mesh',
            geometry: 'box',
            position: [0, 1, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            material: { color: '#888888', roughness: 0.2, metalness: 0.8, envMapIntensity: 1 }, // Shiny metal-like for material test
            parentId: parentId,
          });
        }
      } catch (error) {
        console.error('Failed to parse asset data:', error);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <AssetStagingIndicator />
      {isPickingAsset && (
        <div className="absolute inset-0 bg-neutral-950/45 backdrop-blur-[1px] z-[45] flex flex-col items-center justify-center pointer-events-none select-none">
          <div className="bg-bg-panel/95 backdrop-blur-md border border-accent/40 px-5 py-3.5 rounded-2xl shadow-2xl flex flex-col items-center gap-2 max-w-sm text-center animate-in fade-in zoom-in-95 duration-200">
            <span className="text-xl animate-bounce">📂</span>
            <span className="text-white text-xs font-bold tracking-wide">Asset Picker Active</span>
            <span className="text-[10px] text-text-secondary leading-normal">
              {activePickerTarget === 'materialMap'
                ? 'Select an image/texture asset from the Content Browser below to apply it as the Color/Base Map.'
                : activePickerTarget === 'materialNormalMap'
                ? 'Select an image/texture asset from the Content Browser below to apply it as the Normal Map.'
                : 'Select an asset from the Content Browser below to link it to the properties.'}
            </span>
          </div>
        </div>
      )}
      {isDragging && (
        <div className="absolute inset-0 bg-accent/20 border-2 border-accent border-dashed z-50 flex items-center justify-center pointer-events-none">
          <div className="bg-bg-panel px-6 py-4 rounded-lg shadow-xl flex flex-col items-center gap-3">
            <span className="text-4xl">📥</span>
            <span className="text-white font-bold tracking-wider">Drop .GLB / .GLTF Here</span>
          </div>
        </div>
      )}
      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        camera={{ position: [5, 5, 5], fov: 50 }}
        events={(state) => ({
          ...events(state),
          // Gizmo occlusion fix: when a gizmo handle is focused, drop ALL
          // raycast intersections so R3F never dispatches pointer events to
          // scene objects behind the gizmo. This is the definitive fix because
          // it operates at the raycaster result level, before any onPointerDown
          // handlers fire on scene objects.
          filter: (items: THREE.Intersection[], s: any) => {
            if (useStore.getState().gizmoFocused) {
              return []; // Block all scene object interactions
            }
            return items;
          },
        })}
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
        onPointerMissed={() => {
          // Don't deselect if gizmo is being interacted with
          if (useStore.getState().gizmoFocused) return;
          selectObject(null);
        }}
        onPointerDown={(e) => {
          if (e.button === 2) {
            // Right click
            dragStartRef.current = { x: e.clientX, y: e.clientY };
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();

          if (dragStartRef.current) {
            const deltaX = Math.abs(e.clientX - dragStartRef.current.x);
            const deltaY = Math.abs(e.clientY - dragStartRef.current.y);
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            dragStartRef.current = null;
            if (distance > 5) {
              return; // It was a drag!
            }
          }

          useStore.getState().openContextMenu(e.nativeEvent.clientX, e.nativeEvent.clientY, 'viewport', null);
        }}
      >
        <Stats parent={containerRef} className="!absolute !top-0 !left-0 !z-50" />
        {environment.fogEnabled && (
          <fogExp2 attach="fog" color={environment.fogColor} density={environment.fogDensity} />
        )}

        <>
          <Suspense fallback={null}>
            <DayNightCycle />
            <BoneVisualizer />

            <Physics paused={!isPlaying || isPaused} debug={showPhysicsDebug} gravity={[0, environment.gravity ?? -9.81, 0]}>
              <group name="export_scene">
                {rootObjects.map((obj) => (
                  <SceneNode
                    key={obj.id}
                    obj={obj}
                    isSelected={selectedIds.includes(obj.id)}
                    setOrbitEnabled={setOrbitEnabled}
                    isPlaying={isPlaying}
                  />
                ))}
              </group>
              {isPlaying && <PlayerController />}
            </Physics>

            {showGrid && (!isPlaying || objects.length === 0) && (
              <Grid
                infiniteGrid
                fadeDistance={50}
                cellColor="#444"
                sectionColor="#666"
                sectionSize={1}
                cellSize={0.2}
              />
            )}

            <ContactShadows position={[0, -0.01, 0]} opacity={0.4} scale={50} blur={2} far={10} />

            <EffectComposer>
              <Bloom luminanceThreshold={1.0} intensity={1.5} levels={9} mipmapBlur />
              <ToneMapping />
              <SunGodRays />
            </EffectComposer>
          </Suspense>
        </>
        <ExportHelper />
        <FoliageRenderer />
        <FoliagePainterController />
        <SpatialAudioSceneController />
        {!isPlaying && <MultiSelectionGizmo setOrbitEnabled={setOrbitEnabled} />}
        {!isPlaying && (
          <MarqueeSelectionController
            setMarqueeBox={setMarqueeBox}
            setMarqueeSelectedIds={setMarqueeSelectedIds}
          />
        )}

        {!isPlaying && <CameraController orbitRef={orbitRef} />}

        {!isPlaying && (
          <OrbitControls
            ref={orbitRef}
            enabled={orbitEnabled}
            makeDefault
            target={[0, 0, 0]}
            mouseButtons={{
              LEFT: -1 as unknown as THREE.MOUSE,
              MIDDLE: THREE.MOUSE.PAN,
              RIGHT: THREE.MOUSE.ROTATE,
            }}
          />
        )}

        {!isPlaying && (
          <GizmoHelper alignment="top-right" margin={[80, 80]}>
            <GizmoViewport axisColors={['#ff3653', '#8adb00', '#2c8fff']} labelColor="white" />
          </GizmoHelper>
        )}
      </Canvas>

      {/* Marquee Selection Rectangle Overlay */}
      {marqueeBox && (
        <div
          className="absolute pointer-events-none border border-sky-400 bg-sky-500/20 rounded-[2px] z-40 backdrop-blur-[0.5px] shadow-[0_0_8px_rgba(56,189,248,0.25)]"
          style={{
            left: Math.min(marqueeBox.startX, marqueeBox.endX),
            top: Math.min(marqueeBox.startY, marqueeBox.endY),
            width: Math.abs(marqueeBox.endX - marqueeBox.startX),
            height: Math.abs(marqueeBox.endY - marqueeBox.startY),
          }}
        />
      )}

      {/* Meta Overlay */}
      {!isPlaying && (
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10 select-none">
          <div className="flex gap-1 bg-bg-panel/80 backdrop-blur-sm border border-border p-1 rounded shadow-lg text-xs font-mono text-text-secondary items-center">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('snap_camera', { detail: { view: 'top' } }))}
              className="px-2 py-1 hover:bg-bg-deep hover:text-white transition-colors rounded cursor-pointer"
            >
              TOP
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('snap_camera', { detail: { view: 'front' } }))}
              className="px-2 py-1 hover:bg-bg-deep hover:text-white transition-colors rounded cursor-pointer"
            >
              FRONT
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('snap_camera', { detail: { view: 'side' } }))}
              className="px-2 py-1 hover:bg-bg-deep hover:text-white transition-colors rounded cursor-pointer"
            >
              SIDE
            </button>
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => window.dispatchEvent(new Event('focus_camera'))}
              className="bg-bg-panel/80 backdrop-blur-sm border border-border px-2 py-1 rounded shadow-lg text-xs font-mono text-text-secondary hover:bg-bg-deep hover:text-white transition-colors cursor-pointer"
            >
              FOCUS (F)
            </button>
          </div>
        </div>
      )}

      {isPlaying && !isPaused && (
        <>
          <div className="absolute top-6 left-1/2 transform -translate-x-1/2 pointer-events-none text-center z-10 font-mono select-none drop-shadow-lg">
            <div className="text-emerald-400 text-sm font-bold tracking-widest bg-emerald-950/60 px-4 py-1.5 rounded-full backdrop-blur-md border border-emerald-500/30">
              TEST MODE ACTIVE
            </div>
            <div className="text-white/60 text-[10px] mt-1.5 drop-shadow-md">
              Click canvas to lock mouse • ESC to release
            </div>
          </div>
          {/* Simple Crosshair */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
            <div className="w-1 h-1 bg-white/80 rounded-full"></div>
          </div>
        </>
      )}

      {/* Visually striking glassmorphic Pause Overlay */}
      {isPlaying && isPaused && (
        <div
          onClick={() => useStore.getState().setPaused(false)}
          className="absolute inset-0 bg-neutral-950/60 backdrop-blur-md flex items-center justify-center z-40 select-none animate-in fade-in duration-300 cursor-pointer"
        >
          <div className="bg-bg-panel/40 backdrop-blur-xl border border-white/10 p-8 rounded-2xl flex flex-col items-center gap-6 shadow-2xl max-w-sm text-center transform scale-100 hover:scale-[1.02] transition-transform duration-300 relative overflow-hidden group">
            {/* Ambient inner glow */}
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/20 transition-colors duration-500" />
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-sky-500/20 transition-colors duration-500" />

            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)] animate-pulse">
              <Pause size={24} className="text-amber-400" />
            </div>

            <div className="flex flex-col gap-1.5">
              <h2 className="text-white text-lg font-bold tracking-widest uppercase">Simulation Paused</h2>
              <p className="text-text-secondary text-[11px] font-mono leading-relaxed">
                Physics engine, animation updates, and scripting execution are frozen.
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                useStore.getState().setPaused(false);
              }}
              className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold py-2 px-6 rounded-lg text-xs transition-all duration-150 shadow-md hover:shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 border-none"
            >
              <Play size={12} className="fill-current" />
              <span>Resume Simulation</span>
            </button>

            <div className="text-[10px] text-text-secondary/60 font-mono">
              Press <span className="bg-neutral-900 border border-neutral-800 px-1 py-0.5 rounded text-white font-sans font-bold">P</span> to resume • Click anywhere
            </div>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 right-4 pointer-events-none">
        <div className="bg-bg-panel/80 backdrop-blur-sm border border-border px-3 py-2 rounded shadow-lg flex gap-4 text-[10px] font-mono text-text-secondary uppercase">
          <div className="flex flex-col">
            <span className="text-text-primary font-bold">Renderer</span>
            <span>WebGL 2.0</span>
          </div>
          <div className="flex flex-col">
            <span className="text-text-primary font-bold">Post-Proc</span>
            <span>Active</span>
          </div>
        </div>
      </div>

      {/* REOPEN LEFT SIDEBAR */}
      {!sidebarVisible && (
        <button
          onClick={toggleSidebar}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-50 group flex items-center cursor-pointer"
          title="Open Sidebar"
        >
          <div className="h-20 w-1 bg-sky-500/20 group-hover:bg-sky-500/60 rounded-r-full transition-all" />
          <div className="p-1.5 bg-neutral-900 border border-l-0 border-neutral-800 rounded-r-lg text-neutral-400 group-hover:text-white shadow-xl -ml-px flex items-center justify-center">
            <ChevronRight size={14} />
          </div>
        </button>
      )}

      {/* REOPEN RIGHT INSPECTOR */}
      {!inspectorVisible && (
        <button
          onClick={toggleInspector}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-50 group flex flex-row-reverse items-center cursor-pointer"
          title="Open Inspector"
        >
          <div className="h-20 w-1 bg-sky-500/20 group-hover:bg-sky-500/60 rounded-l-full transition-all" />
          <div className="p-1.5 bg-neutral-900 border border-r-0 border-neutral-800 rounded-l-lg text-neutral-400 group-hover:text-white shadow-xl -mr-px flex items-center justify-center">
            <ChevronLeft size={14} />
          </div>
        </button>
      )}

      {/* REOPEN BOTTOM PANEL */}
      {!bottomPanelVisible && (
        <button
          onClick={toggleBottomPanel}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 z-50 group flex flex-col-reverse items-center cursor-pointer"
          title="Open Bottom Panel"
        >
          <div className="w-20 h-1 bg-sky-500/20 group-hover:bg-sky-500/60 rounded-t-full transition-all" />
          <div className="p-1 bg-neutral-900 border border-b-0 border-neutral-800 rounded-t-lg text-neutral-400 group-hover:text-white shadow-xl -mb-px flex items-center justify-center">
            <ChevronUp size={14} />
          </div>
        </button>
      )}
    </div>
  );
}

function getCloudColor(currentHour: number) {
  const midnightColor = new THREE.Color('#1e2d3b');
  const dawnColor = new THREE.Color('#e09375'); // warm rosy peach dawn
  const noonColor = new THREE.Color('#ffffff'); // pure white noon
  const duskColor = new THREE.Color('#e06a3b'); // sunset orange gold

  let c = new THREE.Color();
  if (currentHour < 4) {
    c.copy(midnightColor);
  } else if (currentHour < 6) {
    const t = (currentHour - 4) / 2;
    c.lerpColors(midnightColor, dawnColor, t);
  } else if (currentHour < 12) {
    const t = (currentHour - 6) / 6;
    c.lerpColors(dawnColor, noonColor, t);
  } else if (currentHour < 16) {
    c.copy(noonColor);
  } else if (currentHour < 18) {
    const t = (currentHour - 16) / 2;
    c.lerpColors(noonColor, duskColor, t);
  } else if (currentHour < 20) {
    const t = (currentHour - 18) / 2;
    c.lerpColors(duskColor, midnightColor, t);
  } else {
    c.copy(midnightColor);
  }
  return c;
}

function seededRandom(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const COMPASS_DEGREES: Record<string, number> = {
  N: 270,
  NE: 315,
  E: 0,
  SE: 45,
  S: 90,
  SW: 135,
  W: 180,
  NW: 225,
};

function getWindAngle(direction: string | undefined): number {
  const deg = COMPASS_DEGREES[direction || 'SE'] ?? 45;
  return (deg * Math.PI) / 180;
}

function IndividualCloud({
  initialX,
  y,
  z,
  scale,
  speedMultiplier,
  cloudsType,
  currentHour,
}: {
  initialX: number;
  y: number;
  z: number;
  scale: number;
  speedMultiplier: number;
  cloudsType: 'volumetric' | 'flat' | 'voxel' | 'nimbus' | 'snow' | 'blizzard';
  currentHour: number;
}) {
  const environment = useStore((s) => s.environment);
  const xRef = useRef(initialX);
  const zRef = useRef(z);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const isPaused = useStore.getState().isPaused;
    if (isPaused) return;
    if (groupRef.current && environment.cloudsEnabled) {
      // Wind Vector Calculation
      const angle = environment.windEnabled ? getWindAngle(environment.windDirection) : 0.0;
      const strength = environment.windEnabled ? (environment.windStrength || 2.0) * 0.75 : environment.cloudsSpeed * 1.5;

      xRef.current += Math.cos(angle) * strength * speedMultiplier * delta * 4.0;
      zRef.current += Math.sin(angle) * strength * speedMultiplier * delta * 4.0;

      // Boundary reset loop
      if (xRef.current > 180) xRef.current = -180;
      if (xRef.current < -180) xRef.current = 180;
      if (zRef.current > 180) zRef.current = -180;
      if (zRef.current < -180) zRef.current = 180;

      // Dissipation fading near bounds
      const maxDist = Math.max(Math.abs(xRef.current), Math.abs(zRef.current));
      let fade = 1.0;
      if (maxDist > 130) {
        fade = Math.max(0.0, (180 - maxDist) / 50);
      }

      const activeScale = scale * fade;
      groupRef.current.scale.set(activeScale, activeScale, activeScale);
      groupRef.current.position.set(xRef.current, y, zRef.current);
    }
  });

  if (!environment.cloudsEnabled) return null;

  return (
    <group ref={groupRef}>
      {cloudsType === 'flat' ? (
        <FlatCloudCluster position={[0, 0, 0]} scale={1} currentHour={currentHour} />
      ) : cloudsType === 'voxel' ? (
        <VoxelCloudCluster position={[0, 0, 0]} scale={1} currentHour={currentHour} />
      ) : cloudsType === 'snow' ? (
        <SnowCloudCluster position={[0, 0, 0]} scale={1} currentHour={currentHour} />
      ) : (
        <CloudCluster position={[0, 0, 0]} scale={1} currentHour={currentHour} />
      )}
    </group>
  );
}

const CirrusShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uDensity;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      vec2 shift = vec2(100.0);
      mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
      for (int i = 0; i < 4; ++i) {
        v += a * noise(p);
        p = rot * p * 2.0 + shift;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = vUv * 6.0;
      uv.x -= uTime * 0.012;
      uv.y += uTime * 0.004;

      float n1 = fbm(uv * 1.6);
      float n2 = fbm(uv * 3.2 + vec2(n1 * 1.5));
      
      float wispVal = n2 * n1;

      float alpha = smoothstep(0.18, 0.55, wispVal * uDensity);

      float distFromCenter = length(vUv - vec2(0.5));
      float borderFade = smoothstep(0.5, 0.32, distFromCenter);

      gl_FragColor = vec4(uColor, alpha * borderFade * 0.9);
    }
  `
};

function CirrusClouds({ currentHour }: { currentHour: number }) {
  const environment = useStore((s) => s.environment);
  const cloudColor = useMemo(() => getCloudColor(currentHour), [currentHour]);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    const isPaused = useStore.getState().isPaused;
    if (isPaused) return;
    if (materialRef.current && environment.cloudsEnabled) {
      const speed = environment.windEnabled ? (environment.windStrength || 2.0) * 0.2 : environment.cloudsSpeed * 0.4;
      timeRef.current += delta * speed;
      materialRef.current.uniforms.uTime.value = timeRef.current;
      materialRef.current.uniforms.uColor.value.copy(cloudColor);
      materialRef.current.uniforms.uDensity.value = environment.cloudsDensity;
    }
  });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color() },
    uDensity: { value: 1.0 },
  }), []);

  if (!environment.cloudsEnabled) return null;

  return (
    <mesh position={[0, 160, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2000, 2000, 4, 4]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={CirrusShader.vertexShader}
        fragmentShader={CirrusShader.fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.NormalBlending}
      />
    </mesh>
  );
}

function PhysicalClouds({ currentHour }: { currentHour: number }) {
  const environment = useStore((s) => s.environment);

  const cloudsList = useMemo(() => {
    const arr = [];
    let seed = 100;
    for (let i = 0; i < 24; i++) {
      const rx = seededRandom(seed++);
      const rz = seededRandom(seed++);
      const ry = seededRandom(seed++);
      const rs = seededRandom(seed++);
      const rsp = seededRandom(seed++);

      const x = (rx - 0.5) * 360;
      const z = (rz - 0.5) * 360;
      const y = 30 + ry * 12;
      const scale = 0.7 + rs * 1.3;
      const speedMultiplier = 0.7 + rsp * 0.6;

      arr.push({ id: i, x, y, z, scale, speedMultiplier });
    }
    return arr;
  }, []);

  if (!environment.cloudsEnabled) return null;

  if (environment.cloudsType === 'cirrus') {
    return <CirrusClouds currentHour={currentHour} />;
  }

  if (environment.cloudsType === 'nimbus') {
    return <NimbusCirrusClouds />;
  }

  if (environment.cloudsType === 'blizzard') {
    return <BlizzardCirrusClouds />;
  }

  return (
    <>
      {cloudsList.map((cloud) => (
        <IndividualCloud
          key={cloud.id}
          initialX={cloud.x}
          y={cloud.y}
          z={cloud.z}
          scale={cloud.scale}
          speedMultiplier={cloud.speedMultiplier}
          cloudsType={environment.cloudsType as any}
          currentHour={currentHour}
        />
      ))}
    </>
  );
}

function CloudCluster({
  position,
  scale = 1,
  currentHour,
}: {
  position: [number, number, number];
  scale?: number;
  currentHour: number;
}) {
  const environment = useStore((s) => s.environment);
  const cloudColor = useMemo(() => getCloudColor(currentHour), [currentHour]);

  return (
    <group position={position} scale={[scale, scale, scale]}>
      {/* Overlapping opaque spheres that seamlessly blend into a continuous organic mass */}
      {/* Base Center Puff */}
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[10 * environment.cloudsDensity, 16, 16]} />
        <meshStandardMaterial
          color={cloudColor}
          roughness={0.95}
          metalness={0.0}
        />
      </mesh>
      {/* Right Puff */}
      <mesh position={[6 * environment.cloudsDensity, -1 * environment.cloudsDensity, -2 * environment.cloudsDensity]} castShadow receiveShadow>
        <sphereGeometry args={[8 * environment.cloudsDensity, 16, 16]} />
        <meshStandardMaterial
          color={cloudColor}
          roughness={0.95}
          metalness={0.0}
        />
      </mesh>
      {/* Left Puff */}
      <mesh position={[-6 * environment.cloudsDensity, -1.5 * environment.cloudsDensity, 2 * environment.cloudsDensity]} castShadow receiveShadow>
        <sphereGeometry args={[7 * environment.cloudsDensity, 16, 16]} />
        <meshStandardMaterial
          color={cloudColor}
          roughness={0.95}
          metalness={0.0}
        />
      </mesh>
      {/* Top Puff */}
      <mesh position={[0, 4 * environment.cloudsDensity, 0]} castShadow receiveShadow>
        <sphereGeometry args={[7 * environment.cloudsDensity, 16, 16]} />
        <meshStandardMaterial
          color={cloudColor}
          roughness={0.95}
          metalness={0.0}
        />
      </mesh>
      {/* Front Puff */}
      <mesh position={[2 * environment.cloudsDensity, -1 * environment.cloudsDensity, 5 * environment.cloudsDensity]} castShadow receiveShadow>
        <sphereGeometry args={[6 * environment.cloudsDensity, 16, 16]} />
        <meshStandardMaterial
          color={cloudColor}
          roughness={0.95}
          metalness={0.0}
        />
      </mesh>
      {/* Back Puff */}
      <mesh position={[-2 * environment.cloudsDensity, -0.5 * environment.cloudsDensity, -5 * environment.cloudsDensity]} castShadow receiveShadow>
        <sphereGeometry args={[6 * environment.cloudsDensity, 16, 16]} />
        <meshStandardMaterial
          color={cloudColor}
          roughness={0.95}
          metalness={0.0}
        />
      </mesh>
    </group>
  );
}

function FlatCloudCluster({
  position,
  scale = 1,
  currentHour,
}: {
  position: [number, number, number];
  scale?: number;
  currentHour: number;
}) {
  const environment = useStore((s) => s.environment);
  const cloudColor = useMemo(() => getCloudColor(currentHour), [currentHour]);

  return (
    <group position={position} scale={[scale, scale, scale]}>
      {/* Low-poly horizontal flat clouds layers - Opaque for perfect voxel blending */}
      {/* Base Layer */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[30 * environment.cloudsDensity, 1.2 * environment.cloudsDensity, 16 * environment.cloudsDensity]} />
        <meshStandardMaterial
          color={cloudColor}
          roughness={0.95}
          metalness={0.0}
        />
      </mesh>
      {/* Top Offset Layer */}
      <mesh position={[4 * environment.cloudsDensity, 0.6 * environment.cloudsDensity, -2 * environment.cloudsDensity]} castShadow receiveShadow>
        <boxGeometry args={[18 * environment.cloudsDensity, 0.8 * environment.cloudsDensity, 10 * environment.cloudsDensity]} />
        <meshStandardMaterial
          color={cloudColor}
          roughness={0.95}
          metalness={0.0}
        />
      </mesh>
      {/* Secondary side-wing layer */}
      <mesh position={[-6 * environment.cloudsDensity, -0.3 * environment.cloudsDensity, 3 * environment.cloudsDensity]} castShadow receiveShadow>
        <boxGeometry args={[12 * environment.cloudsDensity, 0.6 * environment.cloudsDensity, 8 * environment.cloudsDensity]} />
        <meshStandardMaterial
          color={cloudColor}
          roughness={0.95}
          metalness={0.0}
        />
      </mesh>
    </group>
  );
}

function VoxelCloudCluster({
  position,
  scale = 1,
  currentHour,
}: {
  position: [number, number, number];
  scale?: number;
  currentHour: number;
}) {
  const environment = useStore((s) => s.environment);
  const cloudColor = useMemo(() => getCloudColor(currentHour), [currentHour]);
  const d = environment.cloudsDensity;

  return (
    <group position={position} scale={[scale, scale, scale]}>
      {/* Voxel / Chiseled isometric step-cube formations */}
      {/* Base Center Block */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[11 * d, 6 * d, 11 * d]} />
        <meshStandardMaterial color={cloudColor} roughness={0.95} metalness={0.0} />
      </mesh>
      {/* Right Step Block */}
      <mesh position={[5.5 * d, 0.5 * d, -2 * d]} castShadow receiveShadow>
        <boxGeometry args={[8 * d, 4 * d, 8 * d]} />
        <meshStandardMaterial color={cloudColor} roughness={0.95} metalness={0.0} />
      </mesh>
      {/* Left Step Block */}
      <mesh position={[-5.5 * d, -1 * d, 2 * d]} castShadow receiveShadow>
        <boxGeometry args={[7 * d, 4 * d, 7 * d]} />
        <meshStandardMaterial color={cloudColor} roughness={0.95} metalness={0.0} />
      </mesh>
      {/* Top Cap Block */}
      <mesh position={[0, 4.5 * d, 0]} castShadow receiveShadow>
        <boxGeometry args={[7 * d, 3 * d, 7 * d]} />
        <meshStandardMaterial color={cloudColor} roughness={0.95} metalness={0.0} />
      </mesh>
      {/* Front Step Block */}
      <mesh position={[2 * d, -0.5 * d, 5.5 * d]} castShadow receiveShadow>
        <boxGeometry args={[6 * d, 3 * d, 6 * d]} />
        <meshStandardMaterial color={cloudColor} roughness={0.95} metalness={0.0} />
      </mesh>
      {/* Back Step Block */}
      <mesh position={[-2 * d, 0 * d, -5.5 * d]} castShadow receiveShadow>
        <boxGeometry args={[6 * d, 3 * d, 6 * d]} />
        <meshStandardMaterial color={cloudColor} roughness={0.95} metalness={0.0} />
      </mesh>
    </group>
  );
}

const NimbusCirrusShader = {
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uDensity;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                 mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      vec2 shift = vec2(100.0);
      mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
      for (int i = 0; i < 5; ++i) {
        v += a * noise(p);
        p = rot * p * 2.1 + shift;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = vUv * 5.0;
      uv.x -= uTime * 0.024;
      uv.y += uTime * 0.008;

      float n1 = fbm(uv * 1.4);
      float n2 = fbm(uv * 2.8 + vec2(n1 * 2.0));
      
      float stormVal = n2 * 0.7 + n1 * 0.5;

      float alpha = smoothstep(0.12, 0.45, stormVal * uDensity * 1.3);

      float distFromCenter = length(vUv - vec2(0.5));
      float borderFade = smoothstep(0.5, 0.35, distFromCenter);

      gl_FragColor = vec4(uColor, alpha * borderFade * 0.95);
    }
  `
};

function NimbusCirrusClouds() {
  const environment = useStore((s) => s.environment);
  const cloudColor = useMemo(() => new THREE.Color('#2a3342'), []);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    const isPaused = useStore.getState().isPaused;
    if (isPaused) return;
    if (materialRef.current && environment.cloudsEnabled) {
      const speed = environment.windEnabled ? (environment.windStrength || 2.0) * 0.3 : environment.cloudsSpeed * 0.6;
      timeRef.current += delta * speed;
      materialRef.current.uniforms.uTime.value = timeRef.current;
      materialRef.current.uniforms.uColor.value.copy(cloudColor);
      materialRef.current.uniforms.uDensity.value = environment.cloudsDensity;
    }
  });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#2a3342') },
    uDensity: { value: 1.0 },
  }), []);

  if (!environment.cloudsEnabled) return null;

  return (
    <mesh position={[0, 160, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2000, 2000, 4, 4]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={NimbusCirrusShader.vertexShader}
        fragmentShader={NimbusCirrusShader.fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.NormalBlending}
      />
    </mesh>
  );
}

function BlizzardCirrusClouds() {
  const environment = useStore((s) => s.environment);
  const cloudColor = useMemo(() => new THREE.Color('#e5edf5'), []); // Crispy cold snow-white blizzard overcast
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    const isPaused = useStore.getState().isPaused;
    if (isPaused) return;
    if (materialRef.current && environment.cloudsEnabled) {
      const speed = environment.windEnabled ? (environment.windStrength || 2.0) * 0.3 : environment.cloudsSpeed * 0.6;
      timeRef.current += delta * speed;
      materialRef.current.uniforms.uTime.value = timeRef.current;
      materialRef.current.uniforms.uColor.value.copy(cloudColor);
      materialRef.current.uniforms.uDensity.value = environment.cloudsDensity;
    }
  });

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#e5edf5') },
    uDensity: { value: 1.0 },
  }), []);

  if (!environment.cloudsEnabled) return null;

  return (
    <mesh position={[0, 160, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2000, 2000, 4, 4]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={NimbusCirrusShader.vertexShader}
        fragmentShader={NimbusCirrusShader.fragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.NormalBlending}
      />
    </mesh>
  );
}

function useDynamicTexture(url: string | null) {
  return useManagedTexture(url, { repeatX: 1, repeatY: 1 });
}

function RainParticles() {
  const environment = useStore((s) => s.environment);
  const count = 1500; // Number of rain streaks
  const pointsRef = useRef<THREE.Points>(null);
  const linesRef = useRef<THREE.LineSegments>(null);

  // Dynamic custom texture
  const customTexture = useDynamicTexture(environment.rainTextureUrl);

  // Generate initial positions and speed multipliers
  const rainData = useMemo(() => {
    const positions = new Float32Array(count * 6); // 2 vertices per line, 3 coords each
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 200;
      const z = (Math.random() - 0.5) * 200;
      const y = Math.random() * 120; // Scattered heights
      const length = 2.0 + Math.random() * 2.0;

      // Vertex 0: Top
      positions[i * 6] = x;
      positions[i * 6 + 1] = y;
      positions[i * 6 + 2] = z;

      // Vertex 1: Bottom
      positions[i * 6 + 3] = x;
      positions[i * 6 + 4] = y - length;
      positions[i * 6 + 5] = z;

      speeds[i] = 0.8 + Math.random() * 0.4;
    }
    return { positions, speeds };
  }, [count]);

  const posAttributeRef = useRef<THREE.BufferAttribute>(null);

  useFrame((_, delta) => {
    // Read the absolute latest environment settings from the store to avoid stale closures
    const activeEnv = useStore.getState().environment;
    const isPaused = useStore.getState().isPaused;
    if (isPaused) return;
    const activeRef = activeEnv.rainTextureUrl && customTexture ? pointsRef : linesRef;
    if (!activeRef.current || !activeEnv.rainEnabled || !posAttributeRef.current) return;

    const positions = posAttributeRef.current.array as Float32Array;
    const speed = activeEnv.rainSpeed || 1.0;
    const density = activeEnv.rainIntensity || 0.5;

    // Wind Vector
    const windRad = getWindAngle(activeEnv.windDirection);
    const windX = activeEnv.windEnabled ? Math.cos(windRad) * (activeEnv.windStrength || 2.0) : 0;
    const windZ = activeEnv.windEnabled ? Math.sin(windRad) * (activeEnv.windStrength || 2.0) : 0;

    // We animate the Y and horizontal positions
    for (let i = 0; i < count; i++) {
      // Scale count based on density (deactivate drops that exceed current density)
      if (i > count * density) {
        // Hide drop by setting vertices to 0
        positions[i * 6 + 1] = -10;
        positions[i * 6 + 4] = -10;
        continue;
      }

      const dropSpeed = rainData.speeds[i] * speed * 90.0 * delta;

      let topY = positions[i * 6 + 1];
      topY -= dropSpeed;

      let x = positions[i * 6];
      let z = positions[i * 6 + 2];

      // Wind drift force on drop
      x += windX * delta * 20.0 * rainData.speeds[i];
      z += windZ * delta * 20.0 * rainData.speeds[i];

      // Reset when drop falls below the ground
      if (topY < 0) {
        topY = 100 + Math.random() * 30;
        x = (Math.random() - 0.5) * 200;
        z = (Math.random() - 0.5) * 200;
      }

      positions[i * 6] = x;
      positions[i * 6 + 1] = topY;
      positions[i * 6 + 2] = z;

      // Bottom Vertex slants in wind direction
      positions[i * 6 + 3] = x + windX * 1.5;
      positions[i * 6 + 4] = topY - (2.0 + rainData.speeds[i] * 2.0); // Dynamic length
      positions[i * 6 + 5] = z + windZ * 1.5;
    }

    posAttributeRef.current.needsUpdate = true;
  });

  // Reactive render check
  const renderRain = useStore((state) => state.environment.rainEnabled);
  if (!renderRain) return null;

  if (environment.rainTextureUrl && customTexture) {
    return (
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            ref={posAttributeRef}
            attach="attributes-position"
            args={[rainData.positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          map={customTexture}
          size={1.6}
          sizeAttenuation={true}
          transparent={true}
          opacity={0.8 * (environment.rainIntensity || 0.5)}
          depthWrite={false}
        />
      </points>
    );
  }

  return (
    <lineSegments ref={linesRef}>
      <bufferGeometry>
        <bufferAttribute
          ref={posAttributeRef}
          attach="attributes-position"
          args={[rainData.positions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color="#78a0d0"
        transparent={true}
        opacity={0.35 * (environment.rainIntensity || 0.5)}
        depthWrite={false}
        linewidth={1}
      />
    </lineSegments>
  );
}

function SnowCloudCluster({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
  currentHour: number;
}) {
  const environment = useStore((s) => s.environment);
  const cloudColor = '#eef3f8'; // Crisp, cold fluffy snow white
  const d = environment.cloudsDensity;

  return (
    <group position={position} scale={[scale, scale, scale]}>
      {/* Thick overlapping cold snow pillows - flattened Y, expanded X/Z */}
      {/* Base Center Puff */}
      <mesh castShadow receiveShadow scale={[1.6, 0.7, 1.6]}>
        <sphereGeometry args={[9 * d, 16, 16]} />
        <meshStandardMaterial color={cloudColor} roughness={0.98} metalness={0.0} />
      </mesh>
      {/* Right Puff */}
      <mesh position={[6 * d, -0.5 * d, -2 * d]} scale={[1.5, 0.65, 1.5]} castShadow receiveShadow>
        <sphereGeometry args={[7.5 * d, 16, 16]} />
        <meshStandardMaterial color={cloudColor} roughness={0.98} metalness={0.0} />
      </mesh>
      {/* Left Puff */}
      <mesh position={[-6 * d, -0.5 * d, 2 * d]} scale={[1.5, 0.65, 1.5]} castShadow receiveShadow>
        <sphereGeometry args={[7 * d, 16, 16]} />
        <meshStandardMaterial color={cloudColor} roughness={0.98} metalness={0.0} />
      </mesh>
      {/* Top Puff */}
      <mesh position={[0, 3 * d, 0]} scale={[1.4, 0.6, 1.4]} castShadow receiveShadow>
        <sphereGeometry args={[7 * d, 16, 16]} />
        <meshStandardMaterial color={cloudColor} roughness={0.98} metalness={0.0} />
      </mesh>
      {/* Front Puff */}
      <mesh position={[2 * d, -0.2 * d, 6 * d]} scale={[1.4, 0.6, 1.4]} castShadow receiveShadow>
        <sphereGeometry args={[6.5 * d, 16, 16]} />
        <meshStandardMaterial color={cloudColor} roughness={0.98} metalness={0.0} />
      </mesh>
      {/* Back Puff */}
      <mesh position={[-2 * d, -0.2 * d, -6 * d]} scale={[1.4, 0.6, 1.4]} castShadow receiveShadow>
        <sphereGeometry args={[6.5 * d, 16, 16]} />
        <meshStandardMaterial color={cloudColor} roughness={0.98} metalness={0.0} />
      </mesh>
    </group>
  );
}

function SnowParticles() {
  const environment = useStore((s) => s.environment);
  const count = 1200; // Number of snowflakes
  const pointsRef = useRef<THREE.Points>(null);

  // Dynamic custom texture
  const customTexture = useDynamicTexture(environment.snowTextureUrl);

  // Generate initial positions, speed multipliers, and horizontal drift offsets
  const snowData = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const offsets = new Float32Array(count); // side-to-side oscillation phase offsets

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 200; // X
      positions[i * 3 + 1] = Math.random() * 120;     // Y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 200; // Z

      speeds[i] = 0.4 + Math.random() * 0.4;
      offsets[i] = Math.random() * Math.PI * 2;
    }
    return { positions, speeds, offsets };
  }, [count]);

  // Soft fluffy circular snowflake texture generated procedurally
  const snowTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.7)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 16, 16);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  const posAttributeRef = useRef<THREE.BufferAttribute>(null);

  useFrame((state, delta) => {
    // Read the absolute latest environment settings from the store to avoid stale closures
    const activeEnv = useStore.getState().environment;
    const isPaused = useStore.getState().isPaused;
    if (isPaused) return;
    if (!pointsRef.current || !activeEnv.snowEnabled || !posAttributeRef.current) return;

    const positions = posAttributeRef.current.array as Float32Array;
    const speed = activeEnv.snowSpeed || 1.0;
    const density = activeEnv.snowIntensity || 0.5;
    const time = state.clock.getElapsedTime();

    // Wind Vector
    const windRad = getWindAngle(activeEnv.windDirection);
    const windX = activeEnv.windEnabled ? Math.cos(windRad) * (activeEnv.windStrength || 2.0) : 0;
    const windZ = activeEnv.windEnabled ? Math.sin(windRad) * (activeEnv.windStrength || 2.0) : 0;
    const turbulence = activeEnv.windTurbulence || 0.5;

    for (let i = 0; i < count; i++) {
      if (i > count * density) {
        positions[i * 3 + 1] = -10; // Hide
        continue;
      }

      // Slower snow flutter fall
      let y = positions[i * 3 + 1];
      y -= snowData.speeds[i] * speed * 15.0 * delta;

      // Wind-driven dynamic drift with turbulence gusts
      let x = positions[i * 3];
      let z = positions[i * 3 + 2];

      const gust = activeEnv.windEnabled ? (1.0 + Math.sin(time * 2.0 + snowData.offsets[i]) * turbulence) : 1.0;
      x += windX * gust * delta * 15.0 * snowData.speeds[i] + Math.sin(time * 1.5 + snowData.offsets[i]) * 4.0 * delta;
      z += windZ * gust * delta * 15.0 * snowData.speeds[i] + Math.cos(time * 1.2 + snowData.offsets[i]) * 3.0 * delta;

      // Reset when snow reaches ground Y = 0
      if (y < 0) {
        y = 100 + Math.random() * 20;
        x = (Math.random() - 0.5) * 200;
        z = (Math.random() - 0.5) * 200;
      }

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }

    posAttributeRef.current.needsUpdate = true;
  });

  // Reactive render check
  const renderSnow = useStore((state) => state.environment.snowEnabled);
  if (!renderSnow) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          ref={posAttributeRef}
          attach="attributes-position"
          args={[snowData.positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        map={customTexture || snowTexture}
        size={1.5}
        sizeAttenuation={true}
        transparent={true}
        opacity={0.8 * (environment.snowIntensity || 0.5)}
        depthWrite={false}
      />
    </points>
  );
}

let cachedCircleTexture: THREE.CanvasTexture | null = null;
function getCircleTexture() {
  if (cachedCircleTexture) return cachedCircleTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 32, 32);
  }
  cachedCircleTexture = new THREE.CanvasTexture(canvas);
  return cachedCircleTexture;
}

let cachedRealisticTexture: THREE.CanvasTexture | null = null;
function getRealisticTexture() {
  if (cachedRealisticTexture) return cachedRealisticTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 64, 64);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 64;
    tempCanvas.height = 64;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      const drawPuff = (x: number, y: number, r: number, op: number) => {
        tempCtx.fillStyle = `rgba(255, 255, 255, ${op})`;
        tempCtx.beginPath();
        tempCtx.arc(x, y, r, 0, Math.PI * 2);
        tempCtx.fill();
      };
      drawPuff(32, 32, 13, 0.45);
      const numPuffs = 12;
      for (let i = 0; i < numPuffs; i++) {
        const angle = (i / numPuffs) * Math.PI * 2;
        const dist = 6 + Math.sin(angle * 3) * 6 + Math.cos(angle * 5) * 3;
        const px = 32 + Math.cos(angle) * dist;
        const py = 32 + Math.sin(angle) * dist;
        const size = 5 + Math.random() * 8;
        drawPuff(px, py, size, 0.15 + Math.random() * 0.2);
      }
      ctx.filter = 'blur(4px)';
      ctx.drawImage(tempCanvas, 0, 0);
    }
    const imgData = ctx.getImageData(0, 0, 64, 64);
    const data = imgData.data;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const idx = (y * 64 + x) * 4;
        const alpha = data[idx + 3];
        if (alpha > 0) {
          const nx = x - 32;
          const ny = y - 32;
          const dist = Math.sqrt(nx * nx + ny * ny);
          const s1 = Math.sin(x * 0.35 + 2.0) * Math.cos(y * 0.35 + 1.0);
          const s2 = Math.sin(x * 0.7 + y * 0.4) * 0.45;
          const noise = (s1 + s2 + 1.45) / 2.9;
          const edgeFade = Math.max(0, 1 - (dist / 32));
          data[idx + 3] = alpha * (0.55 + noise * 0.45) * edgeFade;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
  cachedRealisticTexture = new THREE.CanvasTexture(canvas);
  return cachedRealisticTexture;
}

let cachedSparkTexture: THREE.CanvasTexture | null = null;
function getSparkTexture() {
  if (cachedSparkTexture) return cachedSparkTexture;
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 32, 32);
    const baseGrad = ctx.createRadialGradient(16, 16, 0, 16, 16, 10);
    baseGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    baseGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
    baseGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.arc(16, 16, 16, 0, Math.PI * 2);
    ctx.fill();
    const flareGradX = ctx.createLinearGradient(0, 16, 32, 16);
    flareGradX.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
    flareGradX.addColorStop(0.5, 'rgba(255, 255, 255, 1.0)');
    flareGradX.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.strokeStyle = flareGradX;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 16);
    ctx.lineTo(32, 16);
    ctx.stroke();
    const flareGradY = ctx.createLinearGradient(16, 0, 16, 32);
    flareGradY.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
    flareGradY.addColorStop(0.5, 'rgba(255, 255, 255, 1.0)');
    flareGradY.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.strokeStyle = flareGradY;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(16, 32);
    ctx.stroke();
  }
  cachedSparkTexture = new THREE.CanvasTexture(canvas);
  return cachedSparkTexture;
}

function ParticleEmitter({ type, isPlaying, particleProps }: { type: string; isPlaying: boolean; particleProps?: SceneObject['particleProps'] }) {
  const count = particleProps?.count ?? 150;
  const speedVal = particleProps?.speed ?? 1.5;
  const sizeVal = particleProps?.size ?? (type === 'fire' ? 0.35 : type === 'tornado' ? 0.55 : type === 'smoke' ? 0.55 : type === 'water' ? 0.25 : type === 'sparks' ? 0.15 : 0.2);
  const colorVal = particleProps?.color ?? (type === 'fire' ? '#f97316' : type === 'tornado' ? '#a3a3a3' : type === 'smoke' ? '#a3a3a3' : type === 'water' ? '#38bdf8' : type === 'sparks' ? '#eab308' : '#ffffff');
  const opacityVal = particleProps?.opacity ?? (type === 'fire' ? 0.75 : type === 'tornado' ? 0.7 : type === 'smoke' ? 0.25 : type === 'water' ? 0.6 : type === 'sparks' ? 0.9 : 0.5);
  const shapeVal = particleProps?.shape ?? ((type === 'fire' || type === 'tornado') ? 'realistic' : type === 'sparks' ? 'spark' : 'circle');
  const lifetimeVal = particleProps?.lifetime ?? (type === 'smoke' ? 4.5 : type === 'sparks' ? 3.5 : 4.0);

  const emitSparks = particleProps?.emitSparks ?? true;
  const sparksBlendMode = particleProps?.sparksBlendMode ?? 'additive';
  const sparksEmissionRate = particleProps?.sparksEmissionRate ?? 200;
  const spreadVal = particleProps?.spread ?? 1.0;

  const pointsRef = React.useRef<THREE.Points>(null);
  const embersRef = React.useRef<THREE.Points>(null);

  const circleTexture = getCircleTexture();
  const realisticTexture = getRealisticTexture();
  const sparkTexture = getSparkTexture();

  const activeTexture = React.useMemo(() => {
    if (shapeVal === 'circle') return circleTexture;
    if (shapeVal === 'realistic') return realisticTexture;
    if (shapeVal === 'spark') return sparkTexture;
    return null;
  }, [shapeVal, circleTexture, realisticTexture, sparkTexture]);

  const tintColor = React.useMemo(() => new THREE.Color(colorVal), [colorVal]);

  const [positions, phases, velocities, maxLifes] = React.useMemo(() => {
    const pos = new Float32Array(count * 3);
    const phs = new Float32Array(count);
    const vels = new Float32Array(count * 3);
    const mlf = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      phs[i] = Math.random() * lifetimeVal; // Start life offset
      mlf[i] = lifetimeVal;
      
      vels[i * 3] = (Math.random() - 0.5) * speedVal * 0.25;
      vels[i * 3 + 1] = speedVal * (1.2 + Math.random() * 0.8);
      vels[i * 3 + 2] = (Math.random() - 0.5) * speedVal * 0.25;
    }
    return [pos, phs, vels, mlf];
  }, [count, lifetimeVal, speedVal]);

  const embersCount = Math.floor(sparksEmissionRate * 1.5);

  const [ePositions, ePhases, eVelocities, eMaxLifes] = React.useMemo(() => {
    if (type !== 'fire') return [new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0)];
    const pos = new Float32Array(embersCount * 3);
    const phs = new Float32Array(embersCount);
    const vels = new Float32Array(embersCount * 3);
    const mlf = new Float32Array(embersCount);
    
    for (let i = 0; i < embersCount; i++) {
      phs[i] = Math.random() * (lifetimeVal * 0.8);
      mlf[i] = lifetimeVal * 0.8;
      
      vels[i * 3] = (Math.random() - 0.5) * speedVal * 0.5;
      vels[i * 3 + 1] = speedVal * (1.8 + Math.random() * 1.0);
      vels[i * 3 + 2] = (Math.random() - 0.5) * speedVal * 0.5;
    }
    return [pos, phs, vels, mlf];
  }, [type, embersCount, lifetimeVal, speedVal]);

  const typeInt = type === 'fire' ? 0 : type === 'tornado' ? 1 : type === 'smoke' ? 2 : type === 'water' ? 3 : type === 'sparks' ? 4 : 5;

  const uniforms = React.useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: tintColor },
    uSize: { value: sizeVal },
    uSpeed: { value: speedVal },
    uSpread: { value: spreadVal },
    uOpacity: { value: opacityVal },
    uTexture: { value: activeTexture },
    uHasTexture: { value: activeTexture !== null },
    uType: { value: typeInt },
    uIsPlaying: { value: isPlaying ? 1.0 : 0.0 }
  }), [tintColor, sizeVal, speedVal, spreadVal, opacityVal, activeTexture, typeInt, isPlaying]);

  const embersUniforms = React.useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: tintColor },
    uSize: { value: sizeVal * 0.22 },
    uSpeed: { value: speedVal },
    uSpread: { value: spreadVal },
    uOpacity: { value: opacityVal * 0.9 },
    uTexture: { value: sparkTexture },
    uHasTexture: { value: true },
    uType: { value: 6 }, // 6 = Embers
    uIsPlaying: { value: isPlaying ? 1.0 : 0.0 }
  }), [tintColor, sizeVal, speedVal, spreadVal, opacityVal, sparkTexture, isPlaying]);

  useFrame((state) => {
    if (!isPlaying) return;
    const time = state.clock.getElapsedTime();
    if (pointsRef.current) {
      (pointsRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    }
    if (embersRef.current) {
      (embersRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = time;
    }
  });

  const effectStyles = React.useMemo(() => {
    switch (type) {
      case 'fire': return { blending: THREE.AdditiveBlending };
      case 'tornado': return { blending: THREE.NormalBlending };
      case 'smoke': return { blending: THREE.NormalBlending };
      case 'water': return { blending: THREE.NormalBlending };
      case 'sparks': return { blending: THREE.AdditiveBlending };
      default: return { blending: THREE.NormalBlending };
    }
  }, [type]);

  const vertexShader = React.useMemo(() => `
    uniform float uTime;
    uniform float uSize;
    uniform int uType;
    uniform float uSpeed;
    uniform float uSpread;
    uniform float uIsPlaying;

    attribute float aPhase;
    attribute float aMaxLife;
    attribute vec3 aVelocity;

    varying float vLifeProgress;
    varying float vPhase;

    void main() {
      float simulatedTime = uIsPlaying > 0.5 ? uTime : 0.0;
      float life = mod(simulatedTime * uSpeed + aPhase, aMaxLife);
      float progress = life / aMaxLife;
      vLifeProgress = progress;
      vPhase = aPhase;

      vec3 pos = position;

      if (uType == 0) { // Fire
        float height = progress * aMaxLife;
        pos.y += height;

        float rCoeff = abs(sin(aPhase * 14.3));
        float neckFactor = progress < 0.15 ? 1.0 : (progress < 0.5 ? 0.35 : 0.9);
        float baseRadius = 0.28 * uSpread * neckFactor * (1.1 - progress * 0.4) * rCoeff;
        
        pos.x += cos(aPhase) * baseRadius;
        pos.z += sin(aPhase) * baseRadius;
      } 
      else if (uType == 6) { // Embers
        pos.y += progress * aMaxLife;
        float radialDist = 0.08 * uSpread * (1.0 - progress * 0.35);
        float spin = progress * 3.5 + aPhase;
        pos.x += cos(spin) * radialDist;
        pos.z += sin(spin) * radialDist;
        
        pos.x += aVelocity.x * life;
        pos.y += aVelocity.y * life * 0.5;
        pos.z += aVelocity.z * life;
      }
      else {
        pos.x += aVelocity.x * life;
        pos.y += aVelocity.y * life;
        pos.z += aVelocity.z * life;
      }

      vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
      
      float sizeMultiplier = 1.0;
      if (uType == 0) sizeMultiplier = (1.1 - progress * 0.45);
      else if (uType == 1) sizeMultiplier = (1.0 + progress * 0.5);
      else if (uType == 6) sizeMultiplier = (1.0 - progress * 0.5);
      else sizeMultiplier = (0.6 + progress * 1.0);

      gl_PointSize = uSize * sizeMultiplier * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `, []);

  const fragmentShader = React.useMemo(() => `
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform sampler2D uTexture;
    uniform bool uHasTexture;
    uniform int uType;

    varying float vLifeProgress;
    varying float vPhase;

    void main() {
      float alpha = 1.0;
      if (vLifeProgress < 0.1) alpha = vLifeProgress / 0.1;
      else if (vLifeProgress > 0.5) alpha = 1.0 - (vLifeProgress - 0.5) / 0.5;

      alpha = clamp(alpha, 0.0, 1.0) * uOpacity;

      vec3 finalColor = uColor;

      if (uType == 0) { // Fire
        if (vLifeProgress < 0.15) {
          float t = vLifeProgress / 0.15;
          finalColor = mix(vec3(3.0, 2.8, 2.5), vec3(2.0, 1.4, 0.2), t) * uColor;
        } else if (vLifeProgress < 0.65) {
          float t = (vLifeProgress - 0.15) / 0.5;
          finalColor = mix(vec3(2.0, 1.4, 0.2), vec3(1.6, 0.35, 0.0), t) * uColor;
        } else {
          float t = (vLifeProgress - 0.65) / 0.35;
          finalColor = mix(vec3(1.6, 0.35, 0.0), vec3(0.1, 0.1, 0.1), t) * uColor;
        }
      } 
      else if (uType == 6) { // Embers
        if (vLifeProgress < 0.2) {
          finalColor = vec3(1.2, 1.0, 0.6);
        } else if (vLifeProgress < 0.7) {
          finalColor = vec3(1.0, 0.45, 0.05);
        } else {
          float fade = max(0.0, 1.0 - (vLifeProgress - 0.7) / 0.3);
          finalColor = vec3(0.9 * fade, 0.1 * fade, 0.0);
        }
      }

      if (uHasTexture) {
        vec4 texColor = texture2D(uTexture, gl_PointCoord);
        if (texColor.a < 0.01) discard;
        gl_FragColor = vec4(finalColor, alpha * texColor.a);
      } else {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);
        if (dist > 0.5) discard;
        float circleAlpha = (0.5 - dist) * 2.0;
        gl_FragColor = vec4(finalColor, alpha * circleAlpha);
      }
    }
  `, []);

  return (
    <>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
          <bufferAttribute attach="attributes-aMaxLife" args={[maxLifes, 1]} />
          <bufferAttribute attach="attributes-aVelocity" args={[velocities, 3]} />
        </bufferGeometry>
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent={true}
          depthWrite={false}
          blending={effectStyles.blending}
        />
      </points>
      {type === 'fire' && emitSparks && (
        <points ref={embersRef}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[ePositions, 3]} />
            <bufferAttribute attach="attributes-aPhase" args={[ePhases, 1]} />
            <bufferAttribute attach="attributes-aMaxLife" args={[eMaxLifes, 1]} />
            <bufferAttribute attach="attributes-aVelocity" args={[eVelocities, 3]} />
          </bufferGeometry>
          <shaderMaterial
            uniforms={embersUniforms}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            transparent={true}
            depthWrite={false}
            blending={sparksBlendMode === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending}
          />
        </points>
      )}
    </>
  );
}

interface FoliageSubMesh {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  localMatrix: THREE.Matrix4;
  baseColorHex?: string;
  enableWindSway?: boolean;
}

function InstancedSubMeshRenderer({
  subMeshes,
  instances,
}: {
  subMeshes: FoliageSubMesh[];
  instances: FoliageInstanceData[];
}) {
  const meshRefs = useRef<THREE.InstancedMesh[]>([]);
  const capacity = useMemo(() => computeInstancedCapacity(instances.length), [instances.length]);

  // Synchronize wind time in useFrame
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    subMeshes.forEach((part) => {
      const uniforms = (part.material as any).windUniforms;
      if (uniforms && uniforms.uWindTime) {
        uniforms.uWindTime.value = time;
      }
    });
  });

  useEffect(() => {
    if (!subMeshes.length) return;

    subMeshes.forEach((part, meshIdx) => {
      const instancedMesh = meshRefs.current[meshIdx];
      if (!instancedMesh) return;

      const boundingSphere = writeInstanceTransforms(
        instancedMesh,
        instances,
        part.localMatrix,
        part.baseColorHex
      );

      // Frustum culling bounding sphere per cluster
      if (instances.length > 0) {
        instancedMesh.geometry.boundingSphere = boundingSphere;
      }
    });
  }, [instances, subMeshes, capacity]);

  return (
    <group>
      {subMeshes.map((part, i) => (
        <instancedMesh
          key={`${part.geometry.id}_${capacity}`}
          ref={(el) => {
            if (el) meshRefs.current[i] = el;
          }}
          args={[part.geometry, part.material, capacity]}
          castShadow
          receiveShadow
          frustumCulled={true}
        />
      ))}
    </group>
  );
}

function GltfFoliageGroup({ url, instances }: { url: string; instances: FoliageInstanceData[] }) {
  const { scene } = useGLTF(url);

  // Extract all sub-meshes with their exact local matrix relative to GLTF scene root
  const subMeshes = useMemo(() => {
    scene.updateMatrixWorld(true);
    const rootInverse = scene.matrixWorld.clone().invert();
    const arr: FoliageSubMesh[] = [];

    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const localMatrix = mesh.matrixWorld.clone().premultiply(rootInverse);

        let mat = mesh.material;
        if (Array.isArray(mat)) mat = mat[0];
        const clonedMat = mat ? mat.clone() : new THREE.MeshStandardMaterial({ color: '#2e7d32' });
        applyWindSwayShader(clonedMat, 0.8);

        arr.push({
          geometry: mesh.geometry,
          material: clonedMat,
          localMatrix,
          baseColorHex: (clonedMat as any).color ? `#${(clonedMat as any).color.getHexString()}` : '#4ade80',
          enableWindSway: true,
        });
      }
    });
    return arr;
  }, [scene]);

  return <InstancedSubMeshRenderer subMeshes={subMeshes} instances={instances} />;
}

function ProceduralFoliageGroup({ presetId, instances }: { presetId: string; instances: FoliageInstanceData[] }) {
  const subMeshes = useMemo(() => {
    const parts = getProceduralFoliageParts(presetId);
    return parts || [];
  }, [presetId]);

  return <InstancedSubMeshRenderer subMeshes={subMeshes} instances={instances} />;
}

function FoliageRenderer() {
  const instances = useStore((state) => state.foliageInstances);

  // Group instances into spatial clusters (32m x 32m) per asset URL
  const clusters = useMemo(() => {
    return clusterFoliageInstances(instances);
  }, [instances]);

  return (
    <>
      {clusters.map((cluster) => {
        if (cluster.assetUrl.startsWith('procedural:')) {
          return (
            <ProceduralFoliageGroup
              key={cluster.chunkKey}
              presetId={cluster.assetUrl}
              instances={cluster.instances}
            />
          );
        }
        return (
          <ModelErrorBoundary key={cluster.chunkKey}>
            <Suspense fallback={null}>
              <GltfFoliageGroup url={cluster.assetUrl} instances={cluster.instances} />
            </Suspense>
          </ModelErrorBoundary>
        );
      })}
    </>
  );
}

function FoliagePainterController() {
  const { camera, raycaster, scene, gl } = useThree();
  const activeTool = useStore((s) => s.activeTool);
  const brushAssetUrl = useStore((s) => s.foliageBrushAssetId);
  const brushRadius = useStore((s) => s.foliageBrushRadius);
  const brushDensity = useStore((s) => s.foliageBrushDensity);
  const addFoliageInstances = useStore((s) => s.addFoliageInstances);
  const eraseFoliageInRadius = useStore((s) => s.eraseFoliageInRadius);

  const [isPainting, setIsPainting] = useState(false);
  const mouse = useRef(new THREE.Vector2(0, 0));
  const isShiftDown = useRef(false);
  const cursorRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') isShiftDown.current = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') isShiftDown.current = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const paint = useCallback(() => {
    const targetAssetUrl = brushAssetUrl || 'procedural:grass';

    const exportScene = scene.getObjectByName('export_scene');
    if (!exportScene) return;

    raycaster.setFromCamera(mouse.current, camera);
    const intersects = raycaster.intersectObjects(exportScene.children, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const point = hit.point;

      if (isShiftDown.current) {
        eraseFoliageInRadius([point.x, point.y, point.z], brushRadius, brushAssetUrl);
      } else {
        const countToSpawn = Math.max(1, Math.floor(brushDensity / 3));
        const newInstances: FoliageInstanceData[] = [];
        
        for (let i = 0; i < countToSpawn; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.sqrt(Math.random()) * brushRadius;
          const offset = new THREE.Vector3(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

          const rayStart = point.clone().add(offset).add(new THREE.Vector3(0, 10, 0));
          const snapRay = new THREE.Raycaster(rayStart, new THREE.Vector3(0, -1, 0));
          const snapIntersects = snapRay.intersectObjects(exportScene.children, true);

          if (snapIntersects.length > 0) {
            const snapHit = snapIntersects[0];
            const rotY = Math.random() * Math.PI * 2;
            const rotX = (Math.random() - 0.5) * 0.1;
            const rotZ = (Math.random() - 0.5) * 0.1;
            const baseScale = 0.7 + Math.random() * 0.5;

            newInstances.push({
              id: `fol_${crypto.randomUUID()}`,
              assetUrl: targetAssetUrl,
              position: [snapHit.point.x, snapHit.point.y, snapHit.point.z],
              rotation: [rotX, rotY, rotZ],
              scale: [baseScale, baseScale, baseScale],
            });
          }
        }

        if (newInstances.length > 0) {
          addFoliageInstances(newInstances);
        }
      }
    }
  }, [brushAssetUrl, brushRadius, brushDensity, camera, raycaster, scene, addFoliageInstances, eraseFoliageInRadius]);

  useFrame(() => {
    if (activeTool !== 'foliage') return;

    const exportScene = scene.getObjectByName('export_scene');
    if (!exportScene) return;

    raycaster.setFromCamera(mouse.current, camera);
    const intersects = raycaster.intersectObjects(exportScene.children, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      if (cursorRef.current) {
        cursorRef.current.position.copy(hit.point);
        const lookTarget = hit.point.clone().add(hit.face?.normal || new THREE.Vector3(0, 1, 0));
        cursorRef.current.lookAt(lookTarget);
        cursorRef.current.rotateX(Math.PI / 2);
        cursorRef.current.visible = true;
      }
    } else {
      if (cursorRef.current) cursorRef.current.visible = false;
    }

    if (isPainting) {
      paint();
    }
  });

  useEffect(() => {
    if (activeTool !== 'foliage') {
      setIsPainting(false);
      return;
    }

    const domElement = gl.domElement;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button === 0) {
        setIsPainting(true);
        const rect = domElement.getBoundingClientRect();
        mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = domElement.getBoundingClientRect();
      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (e.button === 0) {
        setIsPainting(false);
      }
    };

    domElement.addEventListener('pointerdown', handlePointerDown);
    domElement.addEventListener('pointermove', handlePointerMove);
    domElement.addEventListener('pointerup', handlePointerUp);

    return () => {
      domElement.removeEventListener('pointerdown', handlePointerDown);
      domElement.removeEventListener('pointermove', handlePointerMove);
      domElement.removeEventListener('pointerup', handlePointerUp);
    };
  }, [activeTool, gl.domElement]);

  if (activeTool !== 'foliage') return null;

  return (
    <mesh ref={cursorRef} visible={false}>
      <ringGeometry args={[brushRadius - 0.05, brushRadius, 64]} />
      <meshBasicMaterial
        color={isShiftDown.current ? '#ef4444' : '#10b981'}
        transparent
        opacity={0.8}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}


