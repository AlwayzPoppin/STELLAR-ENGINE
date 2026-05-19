import React, { Suspense, useRef, useState, useMemo, useEffect, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
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
} from '@react-three/drei';
import { Physics, RigidBody, CuboidCollider, BallCollider } from '@react-three/rapier';
import { Geometry, Base, Addition, Subtraction, Intersection } from '@react-three/csg';
import { EffectComposer, Bloom, ToneMapping, Vignette, Outline, Selection, Select, GodRays } from '@react-three/postprocessing';
import { useStore, SceneObject, FoliageInstanceData } from '../store/useStore';
import { useAssetStore } from '../store/useAssetStore';
import * as THREE from 'three';
import { Layers, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { BlendFunction, KernelSize } from 'postprocessing';



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

function DayNightCycle() {
  const isPlaying = useStore((state) => state.isPlaying);
  const environment = useStore((state) => state.environment);
  const objects = useStore((state) => state.objects);
  const { scene } = useThree();
  const sunLightRef = useRef<any>();
  const moonLightRef = useRef<any>();
  const [sunPos, setSunPos] = useState<[number, number, number]>([200, 400, 200]);
  const [skyParams, setSkyParams] = useState({ turbidity: 10, rayleigh: 3 });
  const [ambientInt, setAmbientInt] = useState(0.2);
  const [sunInt, setSunInt] = useState(1.5);
  const [moonInt, setMoonInt] = useState(0.3);
  const [currentHourState, setCurrentHourState] = useState(environment.timeOfDay);

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

  const startClockTime = useRef(0);
  const startTimeRef = useRef(environment.timeOfDay);
  const prevIsPlaying = useRef(isPlaying);

  useFrame((state) => {
    let currentHour = environment.timeOfDay;

    if (isPlaying) {
      if (!prevIsPlaying.current) {
        // Just started playing! Record start time
        startClockTime.current = state.clock.getElapsedTime();
        startTimeRef.current = environment.timeOfDay;
      }

      const elapsed = state.clock.getElapsedTime() - startClockTime.current;
      currentHour = (startTimeRef.current + (elapsed / (environment.cycleDuration || 60)) * 24) % 24;
    }

    prevIsPlaying.current = isPlaying;

    // Update sky colors
    const { top, bottom } = getSkyColors(currentHour);
    const skyObj = scene.getObjectByName('SkyDome');
    if (skyObj) {
      const mat = skyObj.material as THREE.ShaderMaterial;
      if (mat.uniforms) {
        mat.uniforms.colorTop.value = top;
        mat.uniforms.colorBottom.value = bottom;
      }
    }

    // Convert 24h time to radians. 12:00 (noon) should be top (PI/2), 0:00 (midnight) bottom (-PI/2)
    // So angle = (time / 24) * 2PI - PI/2
    const timeAngle = (currentHour / 24) * Math.PI * 2 - Math.PI / 2;
    const radius = 400;

    const x = Math.cos(timeAngle) * radius;
    const y = Math.sin(timeAngle) * radius;
    const z = 200;

    const sunHeight = y / radius; // -1 to 1
    const isDay = sunHeight > 0;

    // Update meshes directly
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

    // Calculate intensities using celestial volumetricIntensity & atmosphericContribution
    const baseAmbientDay = 0.05 + sunHeight * 0.45;
    const newAmbientInt = isDay
      ? baseAmbientDay * sunCelestial.atmosphericContribution
      : 0.01 + moonCelestial.atmosphericContribution * 0.05;
    const newSunInt = isDay ? sunHeight * 1.5 * sunCelestial.volumetricIntensity : 0;
    const newMoonInt = !isDay ? Math.abs(sunHeight) * 0.4 * moonCelestial.volumetricIntensity : 0;

    // Sky parameters for transitions
    let newTurbidity = 10;
    let newRayleigh = 3;

    if (isDay && sunHeight < 0.3) {
      // Sunset/Dusk or Sunrise/Morning
      newTurbidity = 20;
      newRayleigh = 10; // Dramatic red/orange scatter
    } else if (!isDay) {
      // Night or Deep Night
      newTurbidity = 2;
      newRayleigh = 0.5; // Very clear, dark sky
    }

    const isNimbus = environment.cloudsEnabled && environment.cloudsType === 'nimbus';
    const isSnowOrBlizzard = environment.cloudsEnabled && (environment.cloudsType === 'snow' || environment.cloudsType === 'blizzard');
    setAmbientInt(isNimbus ? newAmbientInt * 0.6 : (isSnowOrBlizzard ? newAmbientInt * 0.85 : newAmbientInt));
    setSunInt(newSunInt);
    setMoonInt(newMoonInt);
    setSkyParams({ turbidity: newTurbidity, rayleigh: newRayleigh });
    setSunPos([x, y, z]);

    // Track state for React-rendered components like Stars
    setCurrentHourState(currentHour);

    // Scale down IBL (environment map reflections) at night so objects aren't over-lit
    const envIntensity = isDay ? Math.max(0.3, sunHeight) : 0.05;
    scene.environmentIntensity = envIntensity;
  });
  // Calculate sky colors based on time
  const getSkyColors = (hour: number) => {
    const midnightTop = new THREE.Color('#0b1d3a');
    const midnightBottom = new THREE.Color('#162a45');

    const dawnTop = new THREE.Color('#3a4878');
    const dawnBottom = new THREE.Color('#e07a5f'); // Orange

    const noonTop = new THREE.Color('#1a82e2'); // Bright Blue
    const noonBottom = new THREE.Color('#a1caff'); // Light Blue

    const duskTop = new THREE.Color('#2c3e50');
    const duskBottom = new THREE.Color('#e65c00'); // Deep Orange

    let top = new THREE.Color();
    let bottom = new THREE.Color();

    if (hour < 4) {
      // 0:00 - 4:00: Deep Night
      top.copy(midnightTop);
      bottom.copy(midnightBottom);
    } else if (hour < 6) {
      // 4:00 - 6:00: Dawn Transition
      const t = (hour - 4) / 2;
      top.lerpColors(midnightTop, dawnTop, t);
      bottom.lerpColors(midnightBottom, dawnBottom, t);
    } else if (hour < 12) {
      // 6:00 - 12:00: Dawn to Noon
      const t = (hour - 6) / 6;
      top.lerpColors(dawnTop, noonTop, t);
      bottom.lerpColors(dawnBottom, noonBottom, t);
    } else if (hour < 16) {
      // 12:00 - 16:00: Pure Noon
      top.copy(noonTop);
      bottom.copy(noonBottom);
    } else if (hour < 18) {
      // 16:00 - 18:00: Dusk Transition
      const t = (hour - 16) / 2;
      top.lerpColors(noonTop, duskTop, t);
      bottom.lerpColors(noonBottom, duskBottom, t);
    } else if (hour < 20) {
      // 18:00 - 20:00: Dusk to Midnight
      const t = (hour - 18) / 2;
      top.lerpColors(duskTop, midnightTop, t);
      bottom.lerpColors(duskBottom, midnightBottom, t);
    } else {
      // 20:00 - 24:00: Deep Night
      top.copy(midnightTop);
      bottom.copy(midnightBottom);
    }

    return { top, bottom };
  };

  const { top, bottom } = useMemo(() => getSkyColors(currentHourState), [currentHourState]);

  return (
    <>
      {/* Custom Gradient Sky Dome inside Environment for reflections */}
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
            uniforms={{
              colorTop: { value: top },
              colorBottom: { value: bottom },
            }}
          />
        </mesh>
      </Environment>

      {/* Stars visible only at night (7 PM to 5 AM) */}
      {(currentHourState < 5 || currentHourState > 19) && (
        <Stars radius={300} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
      )}

      <ambientLight intensity={ambientInt} />

      <directionalLight
        ref={sunLightRef}
        position={sunPos}
        intensity={sunInt}
        color={sunColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />

      <directionalLight
        ref={moonLightRef}
        position={[-sunPos[0], -sunPos[1], -sunPos[2]]}
        intensity={moonInt}
        color={moonColor}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <PhysicalClouds currentHour={currentHourState} />
      <RainParticles />
      <SnowParticles />
    </>
  );
}

// GodRays wrapper — creates a memory-only mesh to avoid scene graph & focus issues
function SunGodRays() {
  const environment = useStore((s) => s.environment);
  const sunCelestial = useStore((s) => {
    const sunObj = s.objects.find((o) => o.id === 'obj_sun');
    return sunObj?.celestialProps ?? { volumetricIntensity: 1.0 };
  });

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
    const sunObj = scene.getObjectByName('Physical Sun');
    if (sunObj) {
      ghostSunMesh.position.copy(sunObj.position);
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

function GltfModel({ url }: { url: string }) {
  const { scene, animations } = useGLTF(url);
  const clonedScene = useMemo(() => {
    const clone = scene.clone();

    // Always enable shadows for meshes (except the sun)
    clone.traverse((child: any) => {
      if (child.isMesh) {
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

    return clone;
  }, [scene, url]);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const isPlaying = useStore((state) => state.isPlaying);

  useEffect(() => {
    if (animations && animations.length > 0 && clonedScene) {
      const mixer = new THREE.AnimationMixer(clonedScene);
      mixerRef.current = mixer;
      const action = mixer.clipAction(animations[0]);
      action.play();
      return () => {
        action.stop();
        mixer.uncacheRoot(clonedScene);
      };
    }
  }, [animations, clonedScene]);

  useFrame((_, delta) => {
    if (mixerRef.current && isPlaying) {
      mixerRef.current.update(delta);
    }
  });

  return <primitive object={clonedScene} />;
}

function FbxModel({ url }: { url: string }) {
  const fbx = useFBX(url);
  const clonedScene = useMemo(() => {
    const clone = fbx.clone();
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return clone;
  }, [fbx]);

  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const isPlaying = useStore((state) => state.isPlaying);

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
    if (mixerRef.current && isPlaying) {
      mixerRef.current.update(delta);
    }
  });

  return <primitive object={clonedScene} />;
}

const TEXTURE_URLS: Record<string, string> = {
  grid: 'https://raw.githubusercontent.com/pmndrs/drei-assets/master/prototype/Grid_Material.png',
  brick: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/brick_diffuse.jpg',
  wood: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/hardwood2_diffuse.jpg',
  metal:
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg',
};

function CustomMaterial({ material }: { material: SceneObject['material'] }) {
  const wireframeMode = useStore((state) => state.wireframeMode);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (material?.map && TEXTURE_URLS[material.map]) {
      new THREE.TextureLoader().load(TEXTURE_URLS[material.map], (tex) => {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(2, 2);
        setTexture(tex);
      });
    } else {
      setTexture(null);
    }
  }, [material?.map]);

  if (!material) return null;

  return (
    <meshStandardMaterial
      color={material.color}
      roughness={material.roughness}
      metalness={material.metalness}
      envMapIntensity={material.envMapIntensity}
      map={texture}
      wireframe={wireframeMode}
    />
  );
}

export function renderGeometry(geometryType?: string) {
  switch (geometryType) {
    case 'box':
      return <boxGeometry args={[1, 1, 1]} />;
    case 'sphere':
      return <sphereGeometry args={[0.5, 64, 64]} />;
    case 'plane':
      return <planeGeometry args={[1, 1]} />;
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

const compiledScripts: Record<string, Function> = {};

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
  const children = useMemo(() => objects.filter((o) => o.parentId === obj.id), [objects, obj.id]);
  const prevIsPlaying = useRef(isPlaying);

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

  useFrame((state, delta) => {
    if (!isPlaying || !ref.current) return;
    if (obj.behavior === 'spin') {
      ref.current.rotation.y += delta;
      ref.current.rotation.x += delta * 0.5;
    } else if (obj.behavior === 'float') {
      ref.current.position.y = initialPos.current[1] + Math.sin(state.clock.elapsedTime * 2 + obj.position[0]) * 0.5;
    } else if (obj.behavior === 'follow') {
      const targetPos = state.camera.position.clone();
      targetPos.y = ref.current.position.y;
      ref.current.position.lerp(targetPos, delta * 1.5);
      ref.current.lookAt(targetPos);
    }

    if (obj.scripts && obj.scripts.length > 0) {
      obj.scripts.forEach((scriptId) => {
        let fn = compiledScripts[scriptId];
        if (!fn) {
          const script = useAssetStore.getState().assets.find((a) => a.id === scriptId);
          if (script && script.content) {
            try {
              fn = new Function('self', 'delta', script.content);
              compiledScripts[scriptId] = fn;
            } catch (e: any) {
              console.error(`[Script Compile Error] ${scriptId}:`, e.message);
            }
          }
        }

        if (fn) {
          try {
            fn(ref.current, delta);
          } catch (e: any) {
            console.error(`[Script Runtime Error] ${scriptId}:`, e.message);
          }
        }
      });
    }
  });

  const groupContent = (
    <group
      ref={isSimulating ? null : ref}
      name={obj.name}
      position={isSimulating ? [0, 0, 0] : obj.position}
      rotation={isSimulating ? [0, 0, 0] : obj.rotation}
      scale={obj.scale}
      onPointerDown={(e) => {
        if (e.button === 0 && !obj.locked) {
          e.stopPropagation();
          selectObject(obj.id);
        }
        if (e.button === 2) {
          dragStartRef.current = { x: e.clientX, y: e.clientY };
        }
      }}
      onContextMenu={(e) => {
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
        {obj.type !== 'gltf' && obj.type !== 'light' && obj.type !== 'group' && obj.type !== 'csg' && (
          /* Check if it's one of your new effect identifiers */
          (['tornado', 'smoke', 'water', 'sparks', 'fire'].includes(obj.type) || ['tornado', 'smoke', 'water', 'sparks', 'fire'].includes(obj.geometry || '')) ? (
            <ParticleEmitter type={['tornado', 'smoke', 'water', 'sparks', 'fire'].includes(obj.type) ? obj.type : (obj.geometry || '')} isPlaying={isPlaying} particleProps={obj.particleProps} />
          ) : (
            /* Standard Solid Shapes Mesh Handler fallback */
            <mesh castShadow receiveShadow visible={!isCSGChild && obj.visible !== false}>
              {renderGeometry(obj.geometry)}
              {isSelected && !isPlaying && showOverlays && <meshBasicMaterial color="#ffffff" wireframe />}
              {obj.material && <CustomMaterial material={obj.material} />}
            </mesh>
          )
        )}

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
            {isSelected && !isPlaying && showOverlays && <meshBasicMaterial color="#ffffff" wireframe />}
            {obj.material && <CustomMaterial material={obj.material} />}
          </mesh>
        )}

        {obj.type === 'gltf' && obj.url && (
          <Suspense fallback={<meshBasicMaterial wireframe color="#3b82f6" />}>
            <GltfModel url={obj.url} />
          </Suspense>
        )}

        {obj.type === 'fbx' && obj.url && (
          <Suspense fallback={<meshBasicMaterial wireframe color="#3b82f6" />}>
            <FbxModel url={obj.url} />
          </Suspense>
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

      {(activeTool === 'skeleton_rig' || showOverlays) && obj.joints && (
        <SkeletalVisualizer joints={obj.joints} parentScale={obj.scale} />
      )}

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
    if (obj.type === 'gltf' || obj.type === 'fbx') return 'hull';
    return undefined;
  };

  // FIX 2: Keep the RigidBody's rotation equal to the object's rotation so
  //         rotated planes (walls, ramps) have correctly-oriented colliders.
  // FIX 3: Safely omit mass when undefined so Rapier auto-computes it from the colliders.
  const wrapperProps = isSimulating
    ? {
        type: obj.anchored || obj.physics === 'fixed' ? 'fixed' : 'dynamic',
        position: obj.position,
        rotation: obj.rotation,
        colliders: getColliderProp(),
        ...(obj.physicsMass !== undefined ? { mass: obj.physicsMass } : {}),
        restitution: obj.physicsRestitution !== undefined ? obj.physicsRestitution : 0.2,
        friction: obj.physicsFriction !== undefined ? obj.physicsFriction : 0.5,
        ccd: true,
      }
    : {};

  return (
    <>
      {isSimulating ? (
        <RigidBody {...wrapperProps} ref={ref}>
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

      {isSelected && !isPlaying && activeTool !== 'foliage' && activeTool !== 'skeleton_rig' && (
        <TransformControls
          object={ref}
          mode={transformMode}
          translationSnap={snapGrid ? snapValue : null}
          rotationSnap={snapGrid ? Math.PI / 8 : null}
          scaleSnap={snapGrid ? 0.5 : null}
          onMouseDown={() => setOrbitEnabled(false)}
          onMouseUp={() => {
            setOrbitEnabled(true);
            if (ref.current) {
              const o = ref.current;
              updateObject(obj.id, {
                position: [o.position.x, o.position.y, o.position.z],
                rotation: [o.rotation.x, o.rotation.y, o.rotation.z],
                scale: [o.scale.x, o.scale.y, o.scale.z],
              });
            }
          }}
        />
      )}
    </>
  );
});

function PlayerController() {
  const { camera } = useThree();
  const velocity = useRef(new THREE.Vector3());
  const direction = useRef(new THREE.Vector3());
  const keys = useRef({ w: false, a: false, s: false, d: false, space: false, shift: false });
  const [locked, setLocked] = useState(false);
  const isPlaying = useStore((state) => state.isPlaying);

  const handleLock = React.useCallback(() => setLocked(true), []);
  const handleUnlock = React.useCallback(() => setLocked(false), []);

  useEffect(() => {
    if (!isPlaying && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (camera.position.y < 1) camera.position.y = 1.6;

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keys.current) keys.current[key as keyof typeof keys.current] = true;
      if (e.code === 'Space') keys.current.space = true;
      if (e.key === 'Shift') keys.current.shift = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key in keys.current) keys.current[key as keyof typeof keys.current] = false;
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
    if (!locked) return;

    // Safety cap on delta for tab switching
    const d = Math.min(delta, 0.1);

    const speed = keys.current.shift ? 25.0 : 15.0;
    const mass = 5.0;

    velocity.current.x -= velocity.current.x * 10.0 * d;
    velocity.current.z -= velocity.current.z * 10.0 * d;
    velocity.current.y -= 9.8 * mass * d;

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
    const handleExport = () => {
      const exportScene = scene.getObjectByName('export_scene');
      if (exportScene) {
        const exporter = new GLTFExporter();
        exporter.parse(
          exportScene,
          (gltf) => {
            const output = JSON.stringify(gltf, null, 2);
            const blob = new Blob([output], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'scene.gltf';
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
          },
          (error) => {
            console.error('An error happened during parsing', error);
          },
          {},
        );
      }
    };
    window.addEventListener('export_gltf', handleExport);
    return () => window.removeEventListener('export_gltf', handleExport);
  }, [scene]);

  return null;
}

export default function Viewport() {
  const { objects, selectedIds, selectObject, environment, addObject, isPlaying, showGrid, sidebarVisible, bottomPanelVisible, inspectorVisible, toggleSidebar, toggleBottomPanel, toggleInspector } = useStore();
  const showOverlays = useStore((state) => state.showOverlays);
  const showPhysicsDebug = useStore((state) => state.showPhysicsDebug);

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
        const current = useStore.getState().activeTool;
        useStore.getState().setActiveTool(current === 'foliage' ? 'select' : 'foliage');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const orbitRef = useRef<any>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

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
      if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) {
        const url = URL.createObjectURL(file);
        addObject({
          id: `obj_${crypto.randomUUID()}`,
          name: file.name,
          type: 'gltf',
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
        if (asset.type === 'model' || asset.type === 'scene') {
          if (asset.url) {
            addObject({
              id: `obj_${crypto.randomUUID()}`,
              name: asset.name,
              type: 'gltf',
              url: asset.url,
              position: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
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
          });
        }
      } catch (error) {
        console.error('Failed to parse asset data:', error);
      }
    }
  };

  return (
    <div
      className="w-full h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
        onPointerMissed={() => selectObject(null)}
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
        <Stats />
        {environment.fogEnabled && (
          <fogExp2 attach="fog" color={environment.fogColor} density={environment.fogDensity} />
        )}

        <>
          <Suspense fallback={null}>
            <DayNightCycle />

            <Physics paused={!isPlaying} debug={showPhysicsDebug}>
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

        {!isPlaying && <CameraController orbitRef={orbitRef} />}

        {isPlaying ? (
          <PlayerController />
        ) : (
          <OrbitControls
            ref={orbitRef}
            enabled={orbitEnabled}
            makeDefault
            target={[0, 0, 0]}
            mouseButtons={{
              LEFT: THREE.MOUSE.NONE,
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

      {isPlaying && (
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
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return;
    }

    const loader = new THREE.TextureLoader();
    let active = true;

    loader.load(
      url,
      (tex) => {
        if (active) {
          tex.needsUpdate = true;
          setTexture(tex);
        }
      },
      undefined,
      (err) => {
        console.error('Failed to load dynamic texture:', err);
      }
    );

    return () => {
      active = false;
    };
  }, [url]);

  return texture;
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


function ParticleEmitter({ type, isPlaying, particleProps }: { type: string; isPlaying: boolean; particleProps?: SceneObject['particleProps'] }) {
  const environment = useStore((state) => state.environment);

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
  const applyPhysics = particleProps?.applyPhysics ?? true;
  const spreadVal = particleProps?.spread ?? 1.0;

  const pointsRef = React.useRef<THREE.Points>(null);

  // Soft radial circle texture generated procedurally
  const circleTexture = React.useMemo(() => {
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
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Realistic turbulent fluffy wispy flame/smoke texture generated procedurally
  const realisticTexture = React.useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, 64, 64);

      // Create organic fluffy puff shapes by combining multiple offscreen bubbles
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

        // Core mass
        drawPuff(32, 32, 13, 0.45);
        
        // Dynamic fractal boundary satellites
        const numPuffs = 12;
        for (let i = 0; i < numPuffs; i++) {
          const angle = (i / numPuffs) * Math.PI * 2;
          const dist = 6 + Math.sin(angle * 3) * 6 + Math.cos(angle * 5) * 3;
          const px = 32 + Math.cos(angle) * dist;
          const py = 32 + Math.sin(angle) * dist;
          const size = 5 + Math.random() * 8;
          drawPuff(px, py, size, 0.15 + Math.random() * 0.2);
        }

        // Draw overlapping fluffy shape using canvas blur filter for premium realistic blending
        ctx.filter = 'blur(4px)';
        ctx.drawImage(tempCanvas, 0, 0);
      }

      // Add high-fidelity internal wispiness and edge fade
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

            // High frequency wave modulation to mimic micro-turbulences
            const s1 = Math.sin(x * 0.35 + 2.0) * Math.cos(y * 0.35 + 1.0);
            const s2 = Math.sin(x * 0.7 + y * 0.4) * 0.45;
            const noise = (s1 + s2 + 1.45) / 2.9; // normalized noise

            const edgeFade = Math.max(0, 1 - (dist / 32));
            data[idx + 3] = alpha * (0.55 + noise * 0.45) * edgeFade;
          }
        }
      }
      ctx.putImageData(imgData, 0, 0);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Sharp cross-star texture generated procedurally
  const sparkTexture = React.useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Clear canvas
      ctx.clearRect(0, 0, 32, 32);

      // Radial base glow
      const baseGrad = ctx.createRadialGradient(16, 16, 0, 16, 16, 10);
      baseGrad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      baseGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
      baseGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = baseGrad;
      ctx.beginPath();
      ctx.arc(16, 16, 16, 0, Math.PI * 2);
      ctx.fill();

      // Sharp flares
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
    return new THREE.CanvasTexture(canvas);
  }, []);

  const activeTexture = React.useMemo(() => {
    if (shapeVal === 'circle') return circleTexture;
    if (shapeVal === 'realistic') return realisticTexture;
    if (shapeVal === 'spark') return sparkTexture;
    return null; // Square has no texture
  }, [shapeVal, circleTexture, realisticTexture, sparkTexture]);

  // Convert custom hex tint color to RGB multiplier dynamically
  const tintColor = React.useMemo(() => {
    return new THREE.Color(colorVal);
  }, [colorVal]);

  // Initialize particle positions, dynamic variables, color, size, and alpha vertex arrays
  const [positions, variables, colors, sizes, alphas] = React.useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vars = new Float32Array(count * 3); // [remainingLife, maxLife, seed/phase]
    const cols = new Float32Array(count * 3); // [r, g, b] per vertex
    const szs = new Float32Array(count); // Per-particle size array
    const als = new Float32Array(count); // Per-particle alpha array
    
    const maxLife = lifetimeVal;
    for (let i = 0; i < count; i++) {
      // Pre-warm particles uniformly over their lifespan so there is no cold-start
      const startLifePct = Math.random();
      const currentLife = startLifePct * maxLife;
      vars[i * 3] = currentLife; // remainingLife
      vars[i * 3 + 1] = maxLife;  // maxLife
      vars[i * 3 + 2] = Math.random() * Math.PI * 2; // phase angle / seed

      // Distribute positions based on life progression to warm the flame column
      const progress = 1.0 - (currentLife / maxLife);
      const height = progress * maxLife;
      pos[i * 3 + 1] = height; // Y height

      // Scatter base
      const rCoeff = Math.abs(Math.sin(vars[i * 3 + 2] * 14.3));
      const neckFactor = progress < 0.15 ? 1.0 : (progress < 0.5 ? 0.35 : 0.9);
      const baseRadius = 0.28 * spreadVal * (sizeVal / 0.38) * neckFactor * (1.1 - progress * 0.4) * rCoeff;
      pos[i * 3] = Math.cos(vars[i * 3 + 2]) * baseRadius;
      pos[i * 3 + 2] = Math.sin(vars[i * 3 + 2]) * baseRadius;

      szs[i] = sizeVal;
      als[i] = 0.0;
    }
    return [pos, vars, cols, szs, als];
  }, [type, count, sizeVal, lifetimeVal, spreadVal]);

  const posAttributeRef = React.useRef<THREE.BufferAttribute>(null);
  const colAttributeRef = React.useRef<THREE.BufferAttribute>(null);
  const sizeAttributeRef = React.useRef<THREE.BufferAttribute>(null);
  const alphaAttributeRef = React.useRef<THREE.BufferAttribute>(null);

  // Embers refs & attributes for cinematic sparks/embers overlay
  const embersRef = React.useRef<THREE.Points>(null);
  const embersPosRef = React.useRef<THREE.BufferAttribute>(null);
  const embersColRef = React.useRef<THREE.BufferAttribute>(null);
  const embersSizeRef = React.useRef<THREE.BufferAttribute>(null);
  const embersAlphaRef = React.useRef<THREE.BufferAttribute>(null);

  const embersCount = Math.floor(sparksEmissionRate * 1.5);

  // Initialize embers positions, dynamic variables, colors, sizes, and alphas
  const [embersPositions, embersVariables, embersColors, embersSizes, embersAlphas] = React.useMemo(() => {
    if (type !== 'fire') return [new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0), new Float32Array(0)];
    const pos = new Float32Array(embersCount * 3);
    const vars = new Float32Array(embersCount * 3); // [remainingLife, maxLife, phaseAngle]
    const cols = new Float32Array(embersCount * 3);
    const szs = new Float32Array(embersCount);
    const als = new Float32Array(embersCount);
    
    const maxLife = lifetimeVal * 0.8;
    for (let i = 0; i < embersCount; i++) {
      const startLifePct = Math.random();
      const currentLife = startLifePct * maxLife;
      vars[i * 3] = currentLife;
      vars[i * 3 + 1] = maxLife;
      vars[i * 3 + 2] = Math.random() * Math.PI * 2;

      const progress = 1.0 - (currentLife / maxLife);
      pos[i * 3 + 1] = progress * maxLife;
      
      const radialDist = 0.08 * spreadVal * (sizeVal / 0.35) * (1.0 - progress * 0.35);
      const spin = progress * 3.5 + vars[i * 3 + 2];
      pos[i * 3] = Math.cos(spin) * radialDist;
      pos[i * 3 + 2] = Math.sin(spin) * radialDist;

      szs[i] = sizeVal * 0.22;
      als[i] = 0.0;
    }
    return [pos, vars, cols, szs, als];
  }, [type, embersCount, sizeVal, lifetimeVal, spreadVal]);

  // Velocity buffers
  const velocities = React.useRef<Float32Array | null>(null);
  const embersVelocities = React.useRef<Float32Array | null>(null);

  React.useMemo(() => {
    const vels = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      vels[i * 3] = (Math.random() - 0.5) * speedVal * 0.25;
      vels[i * 3 + 1] = speedVal * (1.2 + Math.random() * 0.8);
      vels[i * 3 + 2] = (Math.random() - 0.5) * speedVal * 0.25;
    }
    velocities.current = vels;
  }, [count, speedVal]);

  React.useMemo(() => {
    if (type !== 'fire') return;
    const vels = new Float32Array(embersCount * 3);
    for (let i = 0; i < embersCount; i++) {
      vels[i * 3] = (Math.random() - 0.5) * speedVal * 0.5;
      vels[i * 3 + 1] = speedVal * (1.8 + Math.random() * 1.0);
      vels[i * 3 + 2] = (Math.random() - 0.5) * speedVal * 0.5;
    }
    embersVelocities.current = vels;
  }, [type, embersCount, speedVal]);



  const latestPropsRef = React.useRef({
    isPlaying,
    count,
    speedVal,
    sizeVal,
    colorVal,
    opacityVal,
    shapeVal,
    lifetimeVal,
    emitSparks,
    sparksBlendMode,
    sparksEmissionRate,
    applyPhysics,
    spreadVal,
    embersCount,
    tintColor,
  });

  latestPropsRef.current = {
    isPlaying,
    count,
    speedVal,
    sizeVal,
    colorVal,
    opacityVal,
    shapeVal,
    lifetimeVal,
    emitSparks,
    sparksBlendMode,
    sparksEmissionRate,
    applyPhysics,
    spreadVal,
    embersCount,
    tintColor,
  };

  const arraysRef = React.useRef({
    variables,
    embersVariables,
  });

  arraysRef.current = {
    variables,
    embersVariables,
  };

  const emissionAccumulator = React.useRef(0.0);
  const embersAccumulator = React.useRef(0.0);

  useFrame((state, delta) => {
    if (!posAttributeRef.current || !colAttributeRef.current || !sizeAttributeRef.current || !alphaAttributeRef.current || !pointsRef.current) return;

    // Retrieve up-to-date environment and particle attributes dynamically to prevent stale React closure bugs
    const currentEnvironment = useStore.getState().environment;

    const {
      isPlaying: currentIsPlaying,
      count: currentCount,
      speedVal: currentSpeedVal,
      sizeVal: currentSizeVal,
      colorVal: currentColorVal,
      opacityVal: currentOpacityVal,
      shapeVal: currentShapeVal,
      lifetimeVal: currentLifetimeVal,
      emitSparks: currentEmitSparks,
      sparksBlendMode: currentSparksBlendMode,
      sparksEmissionRate: currentSparksEmissionRate,
      applyPhysics: currentApplyPhysics,
      spreadVal: currentSpreadVal,
      embersCount: currentEmbersCount,
      tintColor: currentTintColor,
    } = latestPropsRef.current;

    const {
      variables: activeVariables,
      embersVariables: activeEmbersVariables,
    } = arraysRef.current;

    const currentPos = posAttributeRef.current.array as Float32Array;
    const currentCols = colAttributeRef.current.array as Float32Array;
    const currentSizes = sizeAttributeRef.current.array as Float32Array;
    const currentAlphas = alphaAttributeRef.current.array as Float32Array;
    const time = state.clock.getElapsedTime();

    const maxHeight = currentLifetimeVal;

    // 1. Spawning via Fractional Accumulator
    if (currentIsPlaying) {
      // Main flames spawning
      const emissionRate = currentCount / currentLifetimeVal; // Rate to maintain active count
      emissionAccumulator.current += emissionRate * delta;
      let flameToSpawn = Math.floor(emissionAccumulator.current);
      emissionAccumulator.current -= flameToSpawn;

      for (let i = 0; i < currentCount && flameToSpawn > 0; i++) {
        if (activeVariables[i * 3] <= 0.0) { // Found inactive or dead particle
          const maxLife = currentLifetimeVal;
          activeVariables[i * 3] = maxLife; // Remaining life
          activeVariables[i * 3 + 1] = maxLife; // Max life
          activeVariables[i * 3 + 2] = Math.random() * Math.PI * 2; // phase / seed

          // Spawn close to base center
          currentPos[i * 3] = (Math.random() - 0.5) * 0.28 * currentSpreadVal;
          currentPos[i * 3 + 1] = 0.0;
          currentPos[i * 3 + 2] = (Math.random() - 0.5) * 0.28 * currentSpreadVal;

          // Initial velocity
          if (velocities.current) {
            velocities.current[i * 3] = (Math.random() - 0.5) * currentSpeedVal * 0.25;
            velocities.current[i * 3 + 1] = currentSpeedVal * (1.2 + Math.random() * 0.8);
            velocities.current[i * 3 + 2] = (Math.random() - 0.5) * currentSpeedVal * 0.25;
          }

          flameToSpawn--;
        }
      }
    }

    // 2. Physics & Convection Loop
    // Wind Gusts & Turbulence calculation from "secret sauce" instructions
    // Apply dynamic global environment wind if applyPhysics is true
    let worldWindX = 0;
    let worldWindZ = 0;
    let worldTurbulence = 0.5;

    if (currentApplyPhysics && currentEnvironment.windEnabled) {
      const windRad = getWindAngle(currentEnvironment.windDirection);
      const strength = currentEnvironment.windStrength || 2.0;
      // Scale strength slightly so the flame simulation interacts elegantly without flying away completely
      worldWindX = Math.cos(windRad) * strength * 0.4;
      worldWindZ = Math.sin(windRad) * strength * 0.4;
      worldTurbulence = currentEnvironment.windTurbulence || 0.5;
    }

    const baseWindX = worldWindX;
    const baseWindZ = worldWindZ;
    
    // Incorporate wind turbulence gusts
    const gust = 1.0 + Math.sin(time * 2.0) * worldTurbulence * 0.5;
    
    const hasWind = worldWindX !== 0 || worldWindZ !== 0;
    const WindX = hasWind ? baseWindX * gust + Math.sin(time * 5.0) * 0.1 : 0;
    const WindZ = hasWind ? baseWindZ * gust + Math.sin(time * 4.0) * 0.1 : 0;

    for (let i = 0; i < currentCount; i++) {
      const xIdx = i * 3;
      const yIdx = i * 3 + 1;
      const zIdx = i * 3 + 2;

      let life = activeVariables[i * 3];

      if (life > 0.0) {
        if (currentIsPlaying) {
          life -= delta;
          activeVariables[i * 3] = life;
        }

        if (life <= 0.0) {
          currentAlphas[i] = 0.0;
          continue;
        }

        const maxLife = activeVariables[i * 3 + 1];
        const progress = 1.0 - (life / maxLife);
        const seed = activeVariables[i * 3 + 2];

        if (currentIsPlaying && velocities.current) {
          if (type === 'fire') {
            // Cinema-grade convection shaping: flares outward at bottom, pulls inward in middle (necking), spreads outward at top
            const neckFactor = progress < 0.15 ? 0.8 : (progress < 0.5 ? -3.0 : 1.2);
            
            // Lean the entire convection column axis with wind — aggressive offset so the 
            // necking pull drives particles TOWARD the wind-shifted axis instead of fighting it
            const driftedCenterX = WindX * progress * 6.5;
            const driftedCenterZ = WindZ * progress * 6.5;

            const convectionPullX = (currentPos[xIdx] - driftedCenterX) * neckFactor * (1.1 - progress);
            const convectionPullZ = (currentPos[zIdx] - driftedCenterZ) * neckFactor * (1.1 - progress);
            const convectionForceY = 3.2 * currentSpeedVal;

            // Direct wind acceleration — scales with progress so base stays anchored, tips blow hard
            const windPushX = WindX * (1.5 + progress * 4.5);
            const windPushZ = WindZ * (1.5 + progress * 4.5);

            velocities.current[xIdx] += (convectionPullX + windPushX) * delta;
            velocities.current[yIdx] += convectionForceY * delta;
            velocities.current[zIdx] += (convectionPullZ + windPushZ) * delta;

            // Dampen horizontal velocity to prevent runaway drift
            velocities.current[xIdx] *= 0.97;
            velocities.current[zIdx] *= 0.97;

            currentPos[xIdx] += velocities.current[xIdx] * delta;
            currentPos[yIdx] += velocities.current[yIdx] * delta;
            currentPos[zIdx] += velocities.current[zIdx] * delta;
          } else if (type === 'tornado') {
            const radius = (0.1 + progress * 2.2) * (currentSizeVal * 1.5);
            const spinWinding = time * (currentSpeedVal * 6.0) + (progress * 10.0) + seed;
            const wobbleX = Math.sin(time * 12 + seed) * 0.1 * progress;
            const wobbleZ = Math.cos(time * 12 + seed) * 0.1 * progress;

            currentPos[xIdx] = Math.cos(spinWinding) * radius + wobbleX;
            currentPos[yIdx] = progress * maxHeight;
            currentPos[zIdx] = Math.sin(spinWinding) * radius + wobbleZ;
          } else if (type === 'sparks') {
            currentPos[xIdx] += (Math.sin(time * 15 + seed) * 1.5 + WindX * progress * 0.8) * delta;
            currentPos[yIdx] += velocities.current[yIdx] * delta;
            currentPos[zIdx] += (Math.cos(time * 15 + seed) * 1.5 + WindZ * progress * 0.8) * delta;
          } else if (type === 'water') {
            currentPos[xIdx] += (Math.cos(time * 2 + seed) * 0.4 + WindX * 0.3) * delta;
            currentPos[yIdx] += velocities.current[yIdx] * delta;
            currentPos[zIdx] += (Math.sin(time * 2 + seed) * 0.4 + WindZ * 0.3) * delta;
          } else {
            currentPos[xIdx] += (Math.sin(time * 2 + seed) * 0.1 + WindX * 0.5) * delta;
            currentPos[yIdx] += velocities.current[yIdx] * delta;
            currentPos[zIdx] += (Math.cos(time * 2 + seed) * 0.1 + WindZ * 0.5) * delta;
          }
        }

        // Apply dynamic color over time
        let r = 1.0, g = 1.0, b = 1.0;
        if (type === 'fire') {
          if (progress < 0.15) {
            const t = progress / 0.15;
            r = THREE.MathUtils.lerp(3.0, 2.0, t);
            g = THREE.MathUtils.lerp(2.8, 1.4, t);
            b = THREE.MathUtils.lerp(2.5, 0.2, t);
          } else if (progress < 0.65) {
            const t = (progress - 0.15) / 0.50;
            r = THREE.MathUtils.lerp(2.0, 1.6, t);
            g = THREE.MathUtils.lerp(1.4, 0.35, t);
            b = THREE.MathUtils.lerp(0.2, 0.0, t);
          } else if (progress < 0.85) {
            const t = (progress - 0.65) / 0.20;
            r = THREE.MathUtils.lerp(1.6, 0.7, t);
            g = THREE.MathUtils.lerp(0.35, 0.05, t);
            b = THREE.MathUtils.lerp(0.0, 0.05, t);
          } else {
            const t = (progress - 0.85) / 0.15;
            r = THREE.MathUtils.lerp(0.7, 0.1, t);
            g = THREE.MathUtils.lerp(0.05, 0.1, t);
            b = THREE.MathUtils.lerp(0.05, 0.1, t);
          }
        } else if (type === 'tornado') {
          if (progress < 0.25) {
            r = 1.0; g = 0.65; b = 0.35;
          } else if (progress < 0.7) {
            const t = (progress - 0.25) / 0.45;
            r = THREE.MathUtils.lerp(1.0, 0.45, t); g = THREE.MathUtils.lerp(0.65, 0.4, t); b = THREE.MathUtils.lerp(0.35, 0.35, t);
          } else {
            const t = (progress - 0.7) / 0.3;
            r = THREE.MathUtils.lerp(0.45, 0.2, t); g = THREE.MathUtils.lerp(0.4, 0.2, t); b = THREE.MathUtils.lerp(0.35, 0.25, t);
          }
        } else if (type === 'sparks') {
          r = 1.0; g = THREE.MathUtils.lerp(0.8, 0.1, progress); b = THREE.MathUtils.lerp(0.2, 0.0, progress);
        } else if (type === 'water') {
          r = 0.2; g = THREE.MathUtils.lerp(0.6, 0.8, progress); b = 1.0;
        } else {
          r = g = b = THREE.MathUtils.lerp(0.4, 0.2, progress);
        }

        currentCols[xIdx] = r * currentTintColor.r;
        currentCols[yIdx] = g * currentTintColor.g;
        currentCols[zIdx] = b * currentTintColor.b;

        // Dynamic Sizing
        if (type === 'fire') {
          currentSizes[i] = currentSizeVal * (1.1 - progress * 0.45);
        } else if (type === 'tornado') {
          currentSizes[i] = currentSizeVal * (1.0 + progress * 0.5);
        } else if (type === 'sparks') {
          currentSizes[i] = currentSizeVal * (1.0 - progress);
        } else if (type === 'water') {
          currentSizes[i] = currentSizeVal * (1.0 - progress * 0.7);
        } else {
          currentSizes[i] = currentSizeVal * (0.6 + progress * 1.0);
        }

        // Dynamic Opacity Curve
        let opacityCoeff = 1.0;
        if (progress < 0.1) {
          opacityCoeff = progress / 0.1;
        } else if (progress > 0.5) {
          opacityCoeff = 1.0 - (progress - 0.5) / 0.5;
        }
        currentAlphas[i] = THREE.MathUtils.clamp(opacityCoeff, 0.0, 1.0);
      } else {
        currentAlphas[i] = 0.0;
      }
    }

    // 3. EMBERS & SPARKS DRAFT (Only for fire)
    if (type === 'fire' && currentEmitSparks && embersPosRef.current && embersColRef.current && embersSizeRef.current && embersAlphaRef.current) {
      const ePos = embersPosRef.current.array as Float32Array;
      const eCols = embersColRef.current.array as Float32Array;
      const eSizes = embersSizeRef.current.array as Float32Array;
      const eAlphas = embersAlphaRef.current.array as Float32Array;

      // Spawning via Fractional Accumulator
      if (currentIsPlaying) {
        const embersRate = currentEmbersCount / (currentLifetimeVal * 0.8);
        embersAccumulator.current += embersRate * delta;
        let embersToSpawn = Math.floor(embersAccumulator.current);
        embersAccumulator.current -= embersToSpawn;

        for (let i = 0; i < currentEmbersCount && embersToSpawn > 0; i++) {
          if (activeEmbersVariables[i * 3] <= 0.0) {
            const maxLife = currentLifetimeVal * 0.8;
            activeEmbersVariables[i * 3] = maxLife;
            activeEmbersVariables[i * 3 + 1] = maxLife;
            activeEmbersVariables[i * 3 + 2] = Math.random() * Math.PI * 2;

            ePos[i * 3] = (Math.random() - 0.5) * 0.25 * currentSpreadVal;
            ePos[i * 3 + 1] = Math.random() * 0.5;
            ePos[i * 3 + 2] = (Math.random() - 0.5) * 0.25 * currentSpreadVal;

            if (embersVelocities.current) {
              embersVelocities.current[i * 3] = (Math.random() - 0.5) * currentSpeedVal * 0.5;
              embersVelocities.current[i * 3 + 1] = currentSpeedVal * (1.8 + Math.random() * 1.0);
              embersVelocities.current[i * 3 + 2] = (Math.random() - 0.5) * currentSpeedVal * 0.5;
            }

            embersToSpawn--;
          }
        }
      }

      // Update simulation loop
      for (let i = 0; i < currentEmbersCount; i++) {
        const xIdx = i * 3;
        const yIdx = i * 3 + 1;
        const zIdx = i * 3 + 2;

        let life = activeEmbersVariables[i * 3];

        if (life > 0.0) {
          if (currentIsPlaying) {
            life -= delta;
            activeEmbersVariables[i * 3] = life;
          }

          if (life <= 0.0) {
            eAlphas[i] = 0.0;
            continue;
          }

          const maxLife = activeEmbersVariables[i * 3 + 1];
          const progress = 1.0 - (life / maxLife);
          const seed = activeEmbersVariables[i * 3 + 2];

          if (currentIsPlaying && embersVelocities.current) {
            // Erratic high-frequency swirl
            embersVelocities.current[xIdx] += Math.sin(time * 12.0 + seed) * 1.5 * delta;
            embersVelocities.current[zIdx] += Math.cos(time * 12.0 + seed) * 1.5 * delta;

            // Wind force on embers — lightweight sparks get blown harder than flames
            embersVelocities.current[xIdx] += WindX * (2.5 + progress * 6.0) * delta;
            embersVelocities.current[zIdx] += WindZ * (2.5 + progress * 6.0) * delta;

            // Dampen to prevent runaway
            embersVelocities.current[xIdx] *= 0.96;
            embersVelocities.current[zIdx] *= 0.96;

            // Upward climb
            ePos[xIdx] += embersVelocities.current[xIdx] * delta;
            ePos[yIdx] += embersVelocities.current[yIdx] * delta;
            ePos[zIdx] += embersVelocities.current[zIdx] * delta;
          }

          // Sparks start hot white/gold, turn red-orange, and fade
          if (progress < 0.2) {
            eCols[xIdx] = 1.2;
            eCols[yIdx] = 1.0;
            eCols[zIdx] = 0.6;
          } else if (progress < 0.7) {
            eCols[xIdx] = 1.0;
            eCols[yIdx] = 0.45;
            eCols[zIdx] = 0.05;
          } else {
            const fade = Math.max(0.0, 1.0 - (progress - 0.7) / 0.3);
            eCols[xIdx] = 0.9 * fade;
            eCols[yIdx] = 0.1 * fade;
            eCols[zIdx] = 0.0;
          }

          eSizes[i] = currentSizeVal * 0.22 * (1.0 - progress * 0.5);

          // Fade out near end of life
          let opacityCoeff = 1.0;
          if (progress > 0.7) {
            opacityCoeff = 1.0 - (progress - 0.7) / 0.3;
          }
          eAlphas[i] = THREE.MathUtils.clamp(opacityCoeff, 0.0, 1.0);
        } else {
          eAlphas[i] = 0.0;
        }
      }
      embersPosRef.current.needsUpdate = true;
      embersColRef.current.needsUpdate = true;
      embersSizeRef.current.needsUpdate = true;
      embersAlphaRef.current.needsUpdate = true;
    }



    posAttributeRef.current.needsUpdate = true;
    colAttributeRef.current.needsUpdate = true;
    sizeAttributeRef.current.needsUpdate = true;
    alphaAttributeRef.current.needsUpdate = true;
  });

  // Material & Shader setup
  const effectStyles = React.useMemo(() => {
    switch (type) {
      case 'fire': return { opacity: opacityVal, blending: THREE.AdditiveBlending };
      case 'tornado': return { opacity: opacityVal, blending: THREE.NormalBlending };
      case 'smoke': return { opacity: opacityVal, blending: THREE.NormalBlending };
      case 'water': return { opacity: opacityVal, blending: THREE.NormalBlending };
      case 'sparks': return { opacity: opacityVal, blending: THREE.AdditiveBlending };
      default: return { opacity: opacityVal, blending: THREE.NormalBlending };
    }
  }, [type, opacityVal]);

  const vertexShader = React.useMemo(() => `
    attribute float aSize;
    attribute float aAlpha;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      vColor = color;
      vAlpha = aAlpha;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      gl_PointSize = aSize * (300.0 / -mvPosition.z);
    }
  `, []);

  const fragmentShader = React.useMemo(() => `
    uniform sampler2D pointTexture;
    uniform float uOpacity;
    uniform bool uHasTexture;
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      float alphaVal = vAlpha * uOpacity;
      if (uHasTexture) {
        vec4 tex = texture2D(pointTexture, gl_PointCoord);
        if (tex.a < 0.01) discard;
        gl_FragColor = vec4(vColor, alphaVal * tex.a);
      } else {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float dist = length(uv);
        if (dist > 0.5) discard;
        float alpha = (0.5 - dist) * 2.0;
        gl_FragColor = vec4(vColor, alphaVal * alpha);
      }
    }
  `, []);

  const uniforms = React.useMemo(() => ({
    pointTexture: { value: activeTexture },
    uOpacity: { value: effectStyles.opacity },
    uHasTexture: { value: activeTexture !== null }
  }), [activeTexture, effectStyles.opacity]);

  const embersUniforms = React.useMemo(() => ({
    pointTexture: { value: sparkTexture },
    uOpacity: { value: opacityVal * 0.9 },
    uHasTexture: { value: true }
  }), [sparkTexture, opacityVal]);

  return (
    <>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            ref={posAttributeRef}
            attach="attributes-position"
            args={[positions, 3]}
          />
          <bufferAttribute
            ref={colAttributeRef}
            attach="attributes-color"
            args={[colors, 3]}
          />
          <bufferAttribute
            ref={sizeAttributeRef}
            attach="attributes-aSize"
            args={[sizes, 1]}
          />
          <bufferAttribute
            ref={alphaAttributeRef}
            attach="attributes-aAlpha"
            args={[alphas, 1]}
          />
        </bufferGeometry>
        <shaderMaterial
          vertexColors={true}
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
            <bufferAttribute
              ref={embersPosRef}
              attach="attributes-position"
              args={[embersPositions, 3]}
            />
            <bufferAttribute
              ref={embersColRef}
              attach="attributes-color"
              args={[embersColors, 3]}
            />
            <bufferAttribute
              ref={embersSizeRef}
              attach="attributes-aSize"
              args={[embersSizes, 1]}
            />
            <bufferAttribute
              ref={embersAlphaRef}
              attach="attributes-aAlpha"
              args={[embersAlphas, 1]}
            />
          </bufferGeometry>
          <shaderMaterial
            vertexColors={true}
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

function FoliageGroup({ url, instances }: { url: string; instances: FoliageInstanceData[] }) {
  const { scene } = useGLTF(url);
  const meshRefs = useRef<THREE.InstancedMesh[]>([]);

  const meshes = useMemo(() => {
    const arr: THREE.Mesh[] = [];
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        arr.push(child as THREE.Mesh);
      }
    });
    return arr;
  }, [scene]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    if (!meshRefs.current.length) return;

    meshes.forEach((_, idx) => {
      const instancedMesh = meshRefs.current[idx];
      if (instancedMesh) {
        instances.forEach((inst, i) => {
          dummy.position.set(...inst.position);
          dummy.rotation.set(...inst.rotation);
          dummy.scale.set(...inst.scale);
          dummy.updateMatrix();
          instancedMesh.setMatrixAt(i, dummy.matrix);
        });
        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.count = instances.length;
      }
    });
  }, [instances, meshes, dummy]);

  return (
    <group>
      {meshes.map((m, i) => (
        <instancedMesh
          key={m.uuid}
          ref={(el) => {
            if (el) meshRefs.current[i] = el;
          }}
          args={[m.geometry, m.material, 5000]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}

function FoliageRenderer() {
  const instances = useStore((state) => state.foliageInstances);

  const groups = useMemo(() => {
    const map = new Map<string, FoliageInstanceData[]>();
    instances.forEach((inst) => {
      if (!map.has(inst.assetUrl)) map.set(inst.assetUrl, []);
      map.get(inst.assetUrl)!.push(inst);
    });
    return Array.from(map.entries());
  }, [instances]);

  return (
    <>
      {groups.map(([url, groupInstances]) => (
        <FoliageGroup key={url} url={url} instances={groupInstances} />
      ))}
    </>
  );
}

function FoliagePainterController() {
  const { camera, raycaster, scene, gl } = useThree();
  const activeTool = useStore((s) => s.activeTool);
  const brushAssetUrl = useStore((s) => s.foliageBrushAssetId);
  const brushRadius = useStore((s) => s.foliageBrushRadius);
  const brushDensity = useStore((s) => s.foliageBrushDensity);
  const addFoliageInstance = useStore((s) => s.addFoliageInstance);
  const eraseFoliageInRadius = useStore((s) => s.eraseFoliageInRadius);

  const [isPainting, setIsPainting] = useState(false);
  const mouse = useRef({ x: 0, y: 0 });
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
    if (!brushAssetUrl) return;

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

            addFoliageInstance({
              id: `fol_${crypto.randomUUID()}`,
              assetUrl: brushAssetUrl,
              position: [snapHit.point.x, snapHit.point.y, snapHit.point.z],
              rotation: [rotX, rotY, rotZ],
              scale: [baseScale, baseScale, baseScale],
            });
          }
        }
      }
    }
  }, [brushAssetUrl, brushRadius, brushDensity, camera, raycaster, scene, addFoliageInstance, eraseFoliageInRadius]);

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

// ==========================================
// SKELETAL RIGGER VISUALIZERS
// ==========================================

const ConnectionLine = React.memo(function ConnectionLine({ start, end }: { start: THREE.Vector3; end: THREE.Vector3 }) {
  const points = useMemo(() => [start, end], [start, end]);
  const lineGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    return geom;
  }, [points]);

  return (
    <line geometry={lineGeometry}>
      <lineBasicMaterial color="#f59e0b" linewidth={3} depthTest={false} transparent opacity={0.85} />
    </line>
  );
});

const SkeletalVisualizer = React.memo(function SkeletalVisualizer({ joints, parentScale = [1, 1, 1] }: { joints?: any[], parentScale?: [number, number, number] }) {
  if (!joints || joints.length === 0) return null;

  const visualScale = useMemo(() => {
    const s = parentScale || [1, 1, 1];
    const maxScale = Math.max(s[0], s[1], s[2]);
    return 1 / (maxScale || 1);
  }, [parentScale]);

  const absolutePositions = useMemo(() => {
    const absolute: Record<string, THREE.Vector3> = {};
    
    const resolve = (joint: any): THREE.Vector3 => {
      if (absolute[joint.id]) return absolute[joint.id];
      
      const pos = new THREE.Vector3(...joint.position);
      if (joint.parentId) {
        const parent = joints.find(j => j.id === joint.parentId);
        if (parent) {
          const parentPos = resolve(parent);
          // Convert euler degree values to radians
          const euler = new THREE.Euler(
            (parent.rotation[0] * Math.PI) / 180,
            (parent.rotation[1] * Math.PI) / 180,
            (parent.rotation[2] * Math.PI) / 180
          );
          pos.applyEuler(euler);
          pos.add(parentPos);
        }
      }
      absolute[joint.id] = pos;
      return pos;
    };
    
    joints.forEach(j => resolve(j));
    return absolute;
  }, [joints]);

  return (
    <group>
      {joints.map((joint) => {
        const absPos = absolutePositions[joint.id] || new THREE.Vector3();
        const parentJoint = joint.parentId ? joints.find(j => j.id === joint.parentId) : null;
        const parentAbsPos = parentJoint ? (absolutePositions[parentJoint.id] || new THREE.Vector3()) : null;

        return (
          <group key={joint.id}>
            {/* Glowing joint node sphere */}
            <mesh position={absPos}>
              <sphereGeometry args={[0.045 * visualScale, 16, 16]} />
              <meshBasicMaterial color="#f59e0b" depthTest={false} transparent opacity={0.9} />
            </mesh>

            {/* Subtle orbital pointer ring */}
            <mesh position={absPos} rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.07 * visualScale, 0.08 * visualScale, 32]} />
              <meshBasicMaterial color="#fbbf24" depthTest={false} transparent opacity={0.4} />
            </mesh>

            {/* Bone link to parent */}
            {parentAbsPos && (
              <ConnectionLine start={parentAbsPos} end={absPos} />
            )}
          </group>
        );
      })}
    </group>
  );
});





