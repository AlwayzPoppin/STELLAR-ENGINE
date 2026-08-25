import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { temporal } from 'zundo';
import { useAssetStore, Asset } from './useAssetStore';
import { toast } from './useToastStore';
import { resolveProxiedUrl } from '../utils/format';
import { routeIntent, FocusScope } from './offlineRouter';
import { SerializationManager, safeSerializeObjectsSync, sanitizeObjectsSync } from '../utils/SerializationManager';
import * as THREE from 'three';

// Module-level cache for SkinnedMesh bind state during unbind/rebind workflow.
// Keyed by mesh UUID; entries are created on unbind and consumed on rebind.
const _skinnedMeshBindCache = new Map<string, {
  bindMatrix: THREE.Matrix4;
  bindMatrixInverse: THREE.Matrix4;
  bindMode: string;
  boneInverses: THREE.Matrix4[];
}>();

export interface QuestObjective {
  id: string;
  description: string;
  type: 'talk_to' | 'defeat_enemy' | 'collect_item' | 'reach_area';
  targetName: string;
  targetCount: number;
  currentCount: number;
  completed: boolean;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  objectives: QuestObjective[];
  rewardXp: number;
  rewardGold?: number;
  status: 'not_started' | 'active' | 'completed';
}

export interface ScriptedEventAction {
  id: string;
  type: 'dialogue' | 'spawn_prefab' | 'give_item' | 'teleport' | 'trigger_animation' | 'complete_objective' | 'set_variable' | 'toggle_visibility' | 'play_sound' | 'wait_delay' | 'transform_character' | 'spawn_effect' | 'apply_material_effect' | 'adjust_ultimate';
  params: Record<string, any>;
}

export interface ScriptedEvent {
  id: string;
  name: string;
  triggerType: 'on_level_start' | 'on_enter_trigger' | 'on_quest_start' | 'on_quest_complete' | 'on_key_pressed' | 'on_click' | 'on_variable_changed' | 'on_time_elapsed' | 'on_enemy_defeated';
  triggerTargetId?: string;
  actions: ScriptedEventAction[];
  requiresUltimate?: boolean;
}

export interface ActiveDialogue {
  id: string;
  speakerId?: string;
  speakerName?: string;
  text: string;
  position?: 'bottom' | 'overhead';
  duration?: number;
}

export type { FocusScope };

export function isKnuckleBoneName(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  if (
    lower.includes('socket') ||
    lower.includes('thumb') ||
    lower.includes('index') ||
    lower.includes('middle') ||
    lower.includes('ring') ||
    lower.includes('pinky')
  ) {
    return false;
  }
  return lower.includes('knuckle') || lower.includes('hand') || name === 'Bone_019' || name === 'Bone_024';
}

export interface AssistantPatch {
  targetId: string;
  targetName: string;
  before: Record<string, any>;
  after: Record<string, any>;
  cmd?: 'add_object' | 'delete_object' | 'add_quest' | 'add_scripted_event' | 'set_game_variable';
  params?: Record<string, any>;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  actionType?: 'text' | 'property_patch' | 'scene_action' | 'kickstart_blueprint' | 'meshy_generation';
  propertyPatch?: AssistantPatch;
  actionLabel?: string;
  actions?: AssistantPatch[];
  blueprint?: { genre: string; cameraStyle: string; coreFeatures: string[] };
  applied?: boolean;
  meshyPrompt?: string;
  meshyArtStyle?: 'realistic' | 'stylized';
  meshyTaskId?: string;
  refImageUrl?: string;
  refImageSeed?: number;
}

export interface AnimationConfig {
  triggerSettings?: {
    triggerMode: 'input' | 'condition' | 'none';
    inputSettings?: {
      isCombination: boolean;
      primaryKey: string;
      secondaryKey: string;
    };
    conditionSettings?: {
      propertySource: 'health' | 'isGrounded' | 'velocity' | 'lastHitType';
      operator: 'less_than' | 'equal_to' | 'greater_than';
      value: number | string;
    };
  };
  timeScale?: number;
  loop?: boolean;
}

export interface VoxelHotbarItem {
  id: string;
  name: string;
  geometry: 'box' | 'sphere' | 'cylinder' | 'cone' | 'wedge' | 'pyramid' | 'roundedCube' | 'torus';
  color: string;
  material?: string;
  icon?: string;
}

export interface VoxelHotbarProps {
  slotCount: number;
  activeSlotIndex: number;
  items: VoxelHotbarItem[];
  showKeybinds: boolean;
  styleVariant?: 'modern' | 'minecraft' | 'roblox';
  autoHideInEditMode?: boolean;
  enableVoxelMining?: boolean;
  enableVoxelPlacing?: boolean;
  miningRange?: number;
  placeCooldownMs?: number;
}

export type SceneObject = {
  id: string;
  name: string;
  type: 'mesh' | 'light' | 'group' | 'gltf' | 'obj' | 'fbx' | 'csg' | 'script' | 'gltf_part' | 'texture' | 'decal' | 'debris_emitter' | 'SUN' | 'MOON' | 'motor6d' | 'voxel_hotbar';
  geometry?: 'box' | 'sphere' | 'plane' | 'cylinder' | 'cone' | 'wedge' | 'pyramid' | 'roundedCube' | 'roundedBox' | 'torus' | 'torusKnot' | 'ring' | 'doorway' | 'frame' | 'tornado' | 'smoke' | 'water' | 'sparks' | 'fire' | 'halfSphere' | 'star' | 'crescentMoon' | 'teardrop' | 'wingBlade' | 'curvedHorn' | 'taperedTorso' | 'forearm' | 'limb' | 'text' | string;
  primitiveType?: string;
  textString?: string;
  textSize?: number;
  textDepth?: number;
  textFont?: 'pacifico' | 'lobster' | 'bebas' | 'monoton' | 'rye' | 'creepster' | 'pressstart' | 'helvetiker' | 'roboto' | 'impact' | 'gentilis' | 'optimer' | string;
  url?: string;
  textureUrl?: string | null;
  textureName?: string | null;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  // Voxel Block Hotbar System
  voxelHotbarProps?: VoxelHotbarProps;
  // Motor 6D Rigging Joint properties
  motor6dProps?: {
    part0Id?: string;
    part1Id?: string;
    c0?: [number, number, number, number, number, number];
    c1?: [number, number, number, number, number, number];
    currentAngle?: number;
    transform?: [number, number, number];
  };
  // Texture/Decal properties
  sourceId?: string;
  targetFace?: 'front' | 'back' | 'top' | 'bottom' | 'right' | 'left';
  repeatX?: number;
  repeatY?: number;
  offsetX?: number;
  offsetY?: number;
  textureRotation?: number;
  textureOpacity?: number;
  coreDiskRadius?: number;
  glowIntensity?: number;
  glowExponent?: number;
  meshRotationY?: number;
  voxelCelestialType?: 'sphere' | 'cube' | 'diamond' | 'pixel_ring';
  bevelRadius?: number;
  bevelSegments?: number;
  scriptCode?: string;
  csgMode?: 'base' | 'addition' | 'subtraction' | 'intersection';
  attachedBoneName?: string;
  gltfNodeName?: string;
  isProceduralEyelid?: 'left' | 'right';
  eyelidColor?: string;
  material?: {
    color: string;
    roughness: number;
    metalness: number;
    envMapIntensity: number;
    map?: string;
    normalMap?: string;
    repeatX?: number;
    repeatY?: number;
    opacity?: number;
    waveHeight?: number;
    waveSpeed?: number;
    offsetX?: number;
    offsetY?: number;
    textureRotation?: number;
    reflectance?: number;
    wetness?: number;
    emission?: number;
    emissiveIntensity?: number;
    preset?: string;
    presetMap?: string;
    customMap?: string | null;
  };
  faceMaterials?: Record<
    'right' | 'left' | 'top' | 'bottom' | 'front' | 'back',
    {
      color?: string;
      roughness?: number;
      metalness?: number;
      envMapIntensity?: number;
      map?: string;
      normalMap?: string;
      repeatX?: number;
      repeatY?: number;
      opacity?: number;
    }
  >;
  lightProps?: {
    lightType: 'point' | 'spot' | 'directional';
    color: string;
    intensity: number;
    distance: number;
    angle?: number;
    penumbra?: number;
  };
  celestialProps?: {
    colorTemperature: number;
    diskScale: number;
    volumetricIntensity: number;
    atmosphericContribution: number;
    godRaysEnabled?: boolean;
    rayWeight?: number;
    rayDecay?: number;
    rayExposure?: number;
  };
  behavior?: 'none' | 'spin' | 'float' | 'follow' | 'buoyancy';
  characterActions?: {
    autoJump: boolean;
    doubleJump: boolean;
    sprintEnabled: boolean;
    crouchEnabled: boolean;
    dashEnabled?: boolean;
    dashDistance?: number;
    dashCooldown?: number;
    autoClimb?: boolean;
    footstepAudioEnabled?: boolean;
    footstepAudioUrl?: string;
    footstepAudioPath?: string;
    cameraZoomEnabled?: boolean;
    minCameraDistance?: number;
    maxCameraDistance?: number;
  };
  blinkingProps?: {
    enabled?: boolean;
    mode?: 'texture' | 'blendshape';
    closedTextureUrl?: string;
    morphTargetName?: string;
    leftEyeMorph?: string;
    rightEyeMorph?: string;
    intervalMin?: number;
    intervalMax?: number;
    duration?: number;
    maxBlinks?: number;
    blinkPattern?: 'fixed' | 'random' | 'alternating';
  };
  morphWeights?: Record<string, number>;
  facialExpressionRig?: {
    mappings: {
      smileFrown: { type: 'morph' | 'bone'; morphUp?: string; morphDown?: string; boneName?: string; property?: 'rotation' | 'position' | 'scale'; axis?: 'x' | 'y' | 'z'; multiplier?: number };
      mouthOpen: { type: 'morph' | 'bone'; morphUp?: string; boneName?: string; property?: 'rotation' | 'position' | 'scale'; axis?: 'x' | 'y' | 'z'; multiplier?: number };
      browsRaise: { type: 'morph' | 'bone'; morphUp?: string; morphDown?: string; boneName?: string; property?: 'rotation' | 'position' | 'scale'; axis?: 'x' | 'y' | 'z'; multiplier?: number };
      eyesSquint: { type: 'morph' | 'bone'; morphUp?: string; morphDown?: string; boneName?: string; property?: 'rotation' | 'position' | 'scale'; axis?: 'x' | 'y' | 'z'; multiplier?: number };
    };
    values: {
      smileFrown: number;
      mouthOpen: number;
      browsRaise: number;
      eyesSquint: number;
    };
  };
  audioProps?: {
    assetId?: string;
    url?: string;
    volume?: number;
    loop?: boolean;
    distance?: number; // Legacy alias for maxDistance
    refDistance?: number; // Reference distance for falloff start (default: 1)
    maxDistance?: number; // Maximum audible distance (default: 50)
    rolloffFactor?: number; // Rolloff attenuation curve factor (default: 1)
    distanceModel?: 'linear' | 'inverse' | 'exponential'; // Falloff attenuation model
    coneInnerAngle?: number; // Directional sound cone inner angle in degrees
    coneOuterAngle?: number; // Directional sound cone outer angle in degrees
    coneOuterGain?: number; // Volume gain outside outer cone (0 to 1)
    autoplay?: boolean;
    muted?: boolean;
    sourceType?: 'point' | 'ambient' | 'surface';
  };
  waterPhysics?: {
    enabled?: boolean;
    buoyancyDensity?: number;
    fluidDrag?: number;
    surfaceBobbing?: boolean;
  };
  walkSpeed?: number;
  runSpeed?: number;
  jumpHeight?: number;
  physics?: 'dynamic' | 'fixed' | 'none';
  scripts?: string[];
  availableAnimations?: string[];
  animationConfigs?: Record<string, AnimationConfig>;
  physicsMass?: number;
  physicsRestitution?: number;
  physicsFriction?: number;
  physicsCollisions?: boolean;
  physicsColliderType?: 'auto' | 'cuboid' | 'ball' | 'trimesh' | 'hull';
  anchored?: boolean;
  isSolid?: boolean;
  parentId?: string | null;
  visible?: boolean;
  locked?: boolean;
  particleProps?: {
    count?: number;
    size?: number;
    opacity?: number;
    color?: string;
    speed?: number;
    shape?: 'square' | 'circle' | 'spark' | 'realistic';
    lifetime?: number;
    emitSparks?: boolean;
    sparksBlendMode?: 'additive' | 'normal';
    sparksEmissionRate?: number;
    applyPhysics?: boolean;
    spread?: number;
  };
  debrisProps?: {
    bounds: [number, number, number];
    assetId?: string | null;
    count: number;
    speed: number;
    spawnRate?: number;
    velocity: [number, number, number];
    particleShape?: 'dust' | 'embers' | 'crystals' | 'rocks' | 'leaves' | 'custom' | string;
    color?: string;
  };
  heightData?: number[];
  splatData?: number[];
  customBounds?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    minZ: number;
    maxZ: number;
  };
  pivotOffset?: [number, number, number];
  activeAnimation?: string;
  animationSpeed?: number;
  alternatingIdles?: boolean;
  alternateAnimation?: string;
  alternateFrequency?: number;
  customAnimations?: Record<string, AnimationTrack[]>;
  customRestPose?: Record<string, { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }>;
  vertexWeights?: Record<string, number[]>;
  paintEffectType?: 'none' | 'electrical';
  weightEffectSpeed?: number;
  weightEffectStrength?: number;
  weightEffectScale?: number;
  weightEffectSpeedR?: number;
  weightEffectStrengthR?: number;
  weightEffectScaleR?: number;
  weightEffectSpeedG?: number;
  weightEffectStrengthG?: number;
  weightEffectScaleG?: number;
  weightEffectSpeedB?: number;
  weightEffectStrengthB?: number;
  weightEffectScaleB?: number;
  weightEffectSpeedA?: number;
  weightEffectStrengthA?: number;
  weightEffectScaleA?: number;
  hasFacialRig?: boolean;
  health?: number;
  lastHitType?: string | null;
  combatStats?: {
    actionType: 'Projectile' | 'Hitscan' | 'AoE' | 'Melee';
    damage: number;
    speed: number;
    timeToLive: number;
  };
  combatController?: {
    abilities: Record<string, string>;
  };
  availableMorphs?: string[];
  baseLocomotion?: {
    idle: string | null;
    walk: string | null;
    run: string | null;
    jump: string | null;
    fall: string | null;
  };
  animationMap?: {
    idle?: string | null;
    walk_fwd?: string | null;
    walk_back?: string | null;
    walk_left?: string | null;
    walk_right?: string | null;
    run_fwd?: string | null;
    run_back_left?: string | null;
    run_back_right?: string | null;
    jump?: string | null;
    fall?: string | null;
    vault?: string | null;
    punch_1?: string | null;
    punch_2?: string | null;
    heavy_attack?: string | null;
    block?: string | null;
    dodge?: string | null;
    hit_reaction?: string | null;
    knockup?: string | null;
    death?: string | null;
  };
};

export interface BoneNode {
  id: string;
  name: string;
  children: BoneNode[];
}

export interface AnimationTrack {
  boneName: string;
  property: 'position' | 'rotation' | 'scale' | 'morph' | 'expression';
  keyframes: Record<number, any>; // Keyed by frame number
}

export const loadedAnimationsRegistry: Record<string, THREE.AnimationClip[]> = {};

export const bakeTracksToRegistry = (objId: string | null, clipName: string | null, tracks: AnimationTrack[]) => {
  if (!objId || !clipName) return;

  const clips = loadedAnimationsRegistry[objId];
  const clip = clips?.find((c) => c.name === clipName);
  if (!clip) return;

  const newThreeTracks: THREE.KeyframeTrack[] = [];

  tracks.forEach((track) => {
    const frameNumbers = Object.keys(track.keyframes)
      .map(Number)
      .sort((a, b) => a - b);
    if (frameNumbers.length === 0) return;

    const times = new Float32Array(frameNumbers.map((f) => f / 30));
    const propertySize = track.property === 'rotation' ? 4 : 3;
    const values = new Float32Array(frameNumbers.length * propertySize);

    frameNumbers.forEach((f, index) => {
      const val = track.keyframes[f];
      for (let j = 0; j < propertySize; j++) {
        values[index * propertySize + j] = val[j] !== undefined ? val[j] : 0;
      }
    });

    const trackName = `${track.boneName}.${track.property === 'rotation' ? 'quaternion' : track.property}`;
    
    let newTrack: THREE.KeyframeTrack;
    if (track.property === 'rotation') {
      newTrack = new THREE.QuaternionKeyframeTrack(trackName, times as any, values as any);
    } else {
      newTrack = new THREE.VectorKeyframeTrack(trackName, times as any, values as any);
    }
    
    newThreeTracks.push(newTrack);
  });

  clip.tracks = newThreeTracks;

  let maxTime = 0.01;
  newThreeTracks.forEach((t) => {
    if (t.times.length > 0) {
      maxTime = Math.max(maxTime, t.times[t.times.length - 1]);
    }
  });
  clip.duration = maxTime;
};

export const saveTracksToObjects = (state: any, newTracks: AnimationTrack[], overrideClipName?: string) => {
  const objId = state.animationTargetId;
  if (!objId) return state.objects;
  
  const obj = state.objects.find((o: any) => o.id === objId);
  if (!obj) return state.objects;
  
  const clipName = overrideClipName || obj.activeAnimation || null;
  if (!clipName) return state.objects;

  const customAnimations = obj.customAnimations || {};
  const updatedCustom = {
    ...customAnimations,
    [clipName]: newTracks,
  };

  const newObjects = state.objects.map((o: any) => {
    if (o.id === objId) {
      const availableAnims = o.availableAnimations || [];
      const updatedAvailable = availableAnims.includes(clipName)
        ? availableAnims
        : [...availableAnims, clipName];

      return {
        ...o,
        activeAnimation: clipName,
        availableAnimations: updatedAvailable,
        customAnimations: updatedCustom,
      };
    }
    return o;
  });

  return newObjects;
};

export type LensFlareLayer = {
  id: string;
  name?: string;
  enabled: boolean;
  textureUrl: string;
  sunTextureUrl?: string;
  moonTextureUrl?: string;
  autoSwitch?: boolean;
  offsetX: number;
  offsetY: number;
  scale: number;
  opacity: number;
  targetCelestial?: 'auto' | 'sun' | 'moon';
};

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type WeatherPreset = 'clear' | 'overcast' | 'rain' | 'snow' | 'storm';

export interface GameplaySettings {
  showCrosshair: boolean;
  crosshairStyle: 'classic' | 'dot' | 'circle' | 'dynamic';
  crosshairColor: string;
  enableVoxelMining: boolean;
  enableVoxelPlacing: boolean;
  miningRange: number;
  placeCooldownMs: number;
  cameraMode: 'third_person' | 'first_person' | 'shift_lock';
  fov: number;
  pvpDamage: boolean;
  fallDamage: boolean;
  respawnTime: number;
}

export interface SeasonSettings {
  enabled: boolean;
  activeSeason: Season;
  seasonCycleSpeed: number; // Duration per season in seconds (0 = manual lock)
  currentWeather: WeatherPreset;
  weatherTransitionSpeed: number; // Speed multiplier for lerp transitions
  autoWeatherChange: boolean; // Random weather variations based on season
}

export type EnvironmentSettings = {
  ambientIntensity: number;
  directionalIntensity: number;
  bloomIntensity: number;
  bloomMipmapBlur?: boolean;
  preset: 'city' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'studio' | 'park' | 'lobby' | string;
  skyPreset?: string;
  fogEnabled: boolean;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  fogDensity: number;
  exposure: number;
  timeOfDay: number;
  cycleDuration: number;
  cloudsEnabled: boolean;
  cloudsDensity: number;
  cloudsSpeed: number;
  cloudsAltitude?: number;
  cloudsSize?: number;
  cloudsType: 'volumetric' | 'flat' | 'cirrus' | 'voxel' | 'nimbus' | 'blizzard';
  rainEnabled: boolean;
  rainIntensity: number;
  rainSpeed: number;
  rainTextureUrl: string | null;
  snowEnabled: boolean;
  snowIntensity: number;
  snowSpeed: number;
  snowTextureUrl: string | null;
  windEnabled: boolean;
  windStrength: number;
  windDirection: 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';
  windTurbulence: number;
  gravity: number;
  spaceEnabled: boolean;
  spaceMode?: boolean;
  cameraMode?: 'third-person' | 'top-down' | 'side-scroller' | 'moba';
  cameraSensitivity?: number;
  invertCameraY?: boolean;
  cameraType?: string;
  freezeTime?: boolean;
  godRaysEnabled?: boolean;
  godRaysQuality?: 'performance' | 'balanced' | 'cinematic';
  cameraFollow?: boolean;
  lensFlareEnabled?: boolean;
  lensFlareAutoSwitch?: boolean;
  lensFlareLayers?: LensFlareLayer[];
  lensFlareTextureUrl?: string;
  lensFlareOffsetX?: number;
  lensFlareOffsetY?: number;
  lensFlareScale?: number;
  globalDebrisEnabled?: boolean;
  globalDebrisAssetId?: string | null;
  globalDebrisCount?: number;
  globalDebrisSpeed?: number;
  globalDebrisShape?: 'dust' | 'embers' | 'crystals' | 'rocks' | 'leaves' | string;
  seasonSettings?: SeasonSettings;
};

export interface FoliageInstanceData {
  id: string;
  assetUrl: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

// --- Multi-Scene types ---
export type SceneData = {
  id: string;
  name: string;
  objects: SceneObject[];
};

type SceneHistoryEntry = {
  pastStates: any[];
  futureStates: any[];
};

export interface EnginePreferences {
  graphicsQuality: 'performance' | 'balanced' | 'cinematic' | 'ultra';
  renderScale: 0.75 | 1.0 | 1.25 | 1.5;
  godRaysEnabled: boolean;
  showFpsCounter: boolean;
  shadowQuality: 'low' | 'medium' | 'high' | 'ultra';
}

export interface StoreState {
  activeTool: 'select' | 'foliage' | 'TerrainBrush' | 'weightPaint';
  setActiveTool: (tool: 'select' | 'foliage' | 'TerrainBrush' | 'weightPaint') => void;
  weightBrushRadius: number;
  setWeightBrushRadius: (r: number) => void;
  weightBrushStrength: number;
  setWeightBrushStrength: (s: number) => void;
  weightBrushValue: number;
  setWeightBrushValue: (v: number) => void;
  activeWeightChannel: 'r' | 'g' | 'b' | 'a';
  setActiveWeightChannel: (channel: 'r' | 'g' | 'b' | 'a') => void;
  brushSettings: {
    size: number;
    strength: number;
    mode: 'raise' | 'lower' | 'flatten' | 'smooth' | 'paint_sand' | 'paint_dirt' | 'erase';
    sandTextureUrl?: string;
    dirtTextureUrl?: string;
    textureTiling?: number;
    textureOffsetX?: number;
    textureOffsetY?: number;
  };
  setBrushSettings: (settings: Partial<{
    size: number;
    strength: number;
    mode: 'raise' | 'lower' | 'flatten' | 'smooth' | 'paint_sand' | 'paint_dirt' | 'erase';
    sandTextureUrl?: string;
    dirtTextureUrl?: string;
    textureTiling?: number;
    textureOffsetX?: number;
    textureOffsetY?: number;
  }>) => void;
  foliageBrushAssetId: string | null;
  setFoliageBrushAssetId: (id: string | null) => void;
  foliageInstances: FoliageInstanceData[];
  addFoliageInstance: (instance: FoliageInstanceData) => void;
  addFoliageInstances: (instances: FoliageInstanceData[]) => void;
  clearFoliage: (assetUrl?: string) => void;
  eraseFoliageInRadius: (point: [number, number, number], radius: number, assetUrl?: string | null) => void;
  foliageBrushRadius: number;
  setFoliageBrushRadius: (r: number) => void;
  foliageBrushDensity: number;
  setFoliageBrushDensity: (d: number) => void;
  environment: EnvironmentSettings;
  updateEnvironment: (updates: Partial<EnvironmentSettings>) => void;
  // Multi-scene data
  scenes: Record<string, SceneData>;
  activeSceneId: string;
  sceneHistories: Record<string, SceneHistoryEntry>;
  // Backward-compatible flat property kept in sync with scenes[activeSceneId].objects
  objects: SceneObject[];
  selectedIds: string[];
  activeFaceTab: 'all' | 'front' | 'back' | 'top' | 'bottom' | 'right' | 'left';
  setActiveFaceTab: (tab: 'all' | 'front' | 'back' | 'top' | 'bottom' | 'right' | 'left') => void;
  transformMode: 'select' | 'translate' | 'rotate' | 'scale';
  setTransformMode: (mode: 'select' | 'translate' | 'rotate' | 'scale') => void;
  pivotMode: 'center' | 'base';
  setPivotMode: (mode: 'center' | 'base') => void;
  gizmoFocused: boolean;
  setGizmoFocused: (focused: boolean) => void;
  facialFocusMode: boolean;
  setFacialFocusMode: (mode: boolean) => void;
  isDraggingTimeOfDay: boolean;
  setIsDraggingTimeOfDay: (isDragging: boolean) => void;
  activePreviewAsset: Asset | null;
  previewRect: { top: number; left: number; width: number; height: number } | null;
  setActivePreviewAsset: (asset: Asset | null, rect: { top: number; left: number; width: number; height: number } | null) => void;
  snapGrid: boolean;
  toggleSnapGrid: () => void;
  snapValue: number;
  setSnapValue: (val: number) => void;
  rotationSnapAngle: number;
  setRotationSnapAngle: (val: number) => void;
  showGrid: boolean;
  toggleGrid: () => void;
  showOverlays: boolean;
  toggleOverlays: () => void;
  showPhysicsDebug: boolean;
  togglePhysicsDebug: () => void;
  showEmitters: boolean;
  toggleEmitters: () => void;
  wireframeMode: boolean;
  toggleWireframeMode: () => void;
  isPlaying: boolean;
  togglePlay: () => void;
  stopPlay: () => void;
  isPaused: boolean;
  togglePause: () => void;
  setPaused: (paused: boolean) => void;
  playerAnimationState: string;
  setPlayerAnimationState: (animState: string) => void;
  modelAnimations: Record<string, string[]>;
  setObjectAnimations: (id: string, clipNames: string[]) => void;
  selectObject: (id: string | null, multi?: boolean) => void;
  setSelectedIds: (ids: string[]) => void;
  marqueeSelectedIds: string[];
  setMarqueeSelectedIds: (ids: string[]) => void;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  updateObjects: (updatesMap: Record<string, Partial<SceneObject>>) => void;
  addObject: (obj: SceneObject) => void;
  addObjects: (objs: SceneObject[]) => void;
  deleteObject: (id: string) => void;
  duplicateObject: (id: string) => void;
  duplicateAndMirrorObject: (id: string, axis?: 'x' | 'y' | 'z') => void;
  clonePrefab: (sourceNodeId: string, targetParentId: string | null) => void;
  addPrimitive: (
    type:
      | 'box'
      | 'sphere'
      | 'plane'
      | 'cylinder'
      | 'cone'
      | 'wedge'
      | 'torus'
      | 'torusKnot'
      | 'ring'
      | 'doorway'
      | 'frame'
      | 'horizontalFrame'
      | 'light'
      | 'group'
      | 'groundPlane'
      | 'halfSphere'
      | 'star'
      | 'crescentMoon'
      | 'tornado'
      | 'smoke'
      | 'water'
      | 'sparks'
      | 'fire'
      | 'text'
      | 'wall'
      | 'floor'
      | 'ceiling'
      | 'motor6d'
      | 'voxel_hotbar'
      | 'pyramid'
      | 'roundedCube'
      | 'teardrop'
      | 'wingBlade'
      | 'curvedHorn'
      | 'taperedTorso'
      | 'forearm'
      | 'limb'
      | string,
  ) => void;
  setParent: (childId: string, parentId: string | null) => void;
  clearScene: () => void;
  startNewScene: () => void;
  projectName: string;
  setProjectName: (name: string) => void;
  saveProject: () => void;
  saveProjectAs: () => void;
  loadProject: (jsonData: string) => void;
  contextMenu: { x: number; y: number; type: 'hierarchy' | 'viewport' | 'workspace' | 'lighting' | 'animation' | 'asset' | 'sceneTab'; targetId: string | null; extra?: any } | null;
  openContextMenu: (x: number, y: number, type: 'hierarchy' | 'viewport' | 'workspace' | 'lighting' | 'animation' | 'asset' | 'sceneTab', targetId: string | null, extra?: any) => void;
  closeContextMenu: () => void;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  renamingAssetId: string | null;
  setRenamingAssetId: (id: string | null) => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  csgOperation: (op: 'addition' | 'subtraction' | 'intersection') => void;
  createScriptForObject: (objectId?: string) => void;
  addScript: (parentFolderId?: string | null) => void;
  // Script Document Interface
  openScripts: string[];
  activeScriptId: string | null;
  openScript: (id: string) => void;
  closeScript: (id: string) => void;
  setActiveScript: (id: string | null) => void;
  copiedProperties: Partial<SceneObject> | null;
  copyProperties: (obj: SceneObject) => void;
  pasteProperties: (targetId: string) => void;
  copiedObject: SceneObject | SceneObject[] | null;
  copyObject: (obj: SceneObject) => void;
  pasteObject: (targetParentId: string) => void;
  copiedFaceTexture: Partial<SceneObject> | null;
  copyFaceTexture: (textureNode: SceneObject) => void;
  pasteFaceTexture: (targetParentId: string, targetFace: string) => void;
  sidebarVisible: boolean;
  bottomPanelVisible: boolean;
  inspectorVisible: boolean;
  isPreferencesModalOpen: boolean;
  setPreferencesModalOpen: (open: boolean) => void;
  enginePreferences: EnginePreferences;
  updateEnginePreferences: (updates: Partial<EnginePreferences>) => void;
  gameplaySettings: GameplaySettings;
  updateGameplaySettings: (updates: Partial<GameplaySettings>) => void;
  toggleSidebar: () => void;
  toggleBottomPanel: () => void;
  toggleInspector: () => void;
  panelWidth: number;
  setPanelWidth: (w: number) => void;
  hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  isPickingAsset: boolean;
  setIsPickingAsset: (isPicking: boolean) => void;
  activePickerTarget: string | null;
  setActivePickerTarget: (target: string | null) => void;
  sceneId: string;
  sceneVersion: number;
  undo: () => void;
  redo: () => void;
  // Multi-scene actions
  createNewScene: (name?: string) => void;
  switchScene: (sceneId: string) => void;
  renameScene: (sceneId: string, name: string) => void;
  deleteScene: (sceneId: string) => void;
  duplicateScene: (sceneId: string) => void;
  snapSelectedToGround: () => void;
  activePlayerId: string | null;
  setActivePlayerId: (id: string | null) => void;
  workspaceMode: 'level' | 'script' | 'animation' | 'logic';
  setWorkspaceMode: (mode: 'level' | 'script' | 'animation' | 'logic') => void;
  animationTargetId: string | null;
  setAnimationTargetId: (id: string | null) => void;
  animationVersion: number;
  currentFrame: number;
  setCurrentFrame: (frame: number) => void;
  maxFrames: number;
  setMaxFrames: (max: number) => void;
  isPlayingAnimation: boolean;
  setIsPlayingAnimation: (playing: boolean) => void;
  loopMode: 'repeat' | 'once';
  setLoopMode: (mode: 'repeat' | 'once') => void;
  alternatingIdles: boolean;
  setAlternatingIdles: (val: boolean) => void;
  activeSkeleton: BoneNode[];
  setActiveSkeleton: (skeleton: BoneNode[]) => void;
  selectedBoneId: string | null;
  setSelectedBoneId: (id: string | null) => void;
  riggingSymmetry: boolean;
  setRiggingSymmetry: (val: boolean) => void;
  eyelidsSymmetry: boolean;
  setEyelidsSymmetry: (val: boolean) => void;
  tracks: AnimationTrack[];
  setTracks: (tracks: AnimationTrack[]) => void;
  updateKeyframe: (boneName: string, property: 'position' | 'rotation' | 'scale' | 'morph' | 'expression', frame: number, value: any) => void;
  loadClipToTimeline: (objId: string, clipName: string) => void;
  bakeAnimationToStore: (customClipName?: string) => void;
  renameAnimation: (objId: string, oldClipName: string, newClipName: string) => void;
  deleteAnimation: (objId: string, clipName: string) => void;
  copyAnimationToTarget: (sourceObjId: string, targetObjId: string, clipName: string) => void;
  cloneActiveAnimation: () => string | null;
  activeClonedScene: any | null;
  setActiveClonedScene: (scene: any | null) => void;
  keyframeClipboard: {
    type: 'single' | 'bone_all';
    property?: 'position' | 'rotation' | 'scale' | 'morph' | 'expression';
    value?: any;
    values?: Record<string, any>;
  } | null;
  setKeyframeClipboard: (clipboard: any) => void;
  isSkeletonUnbound: boolean;
  setIsSkeletonUnbound: (val: boolean) => void;
  unbindSkeleton: () => void;
  rebindSkeleton: () => void;
  resetRestPose: () => void;
  syncSkeletonPose: () => void;
  defaultRestPoses: Record<string, Record<string, { position: [number, number, number]; rotation: [number, number, number, number]; scale: [number, number, number] }>>;
  setDefaultRestPose: (objId: string, pose: Record<string, { position: [number, number, number]; rotation: [number, number, number, number]; scale: [number, number, number] }>) => void;
  resetFrameToDefault: () => void;
  resetSelectedBoneFrameToDefault: () => void;
  deleteKeyframe: (boneName: string, property: 'position' | 'rotation' | 'scale' | 'morph' | 'expression', frame: number) => void;
  deleteSelectedFrameGlobal: () => void;
  flipPoseSymmetrically: () => void;
  weaponSocket: 'none' | 'baseball_bat' | 'knife';
  setWeaponSocket: (socket: 'none' | 'baseball_bat' | 'knife') => void;
  addBoneToRig: (parentBoneName: string, newBoneName: string) => void;
  deleteBoneFromRig: (boneName: string) => void;
  renameBone: (oldName: string, newName: string) => void;
  generateFacialRig: (targetObjId: string) => void;
  removeFacialRig: (targetObjId: string) => void;
  alignFacialRigToMesh: (targetObjId: string) => void;
  // Meshy AI 3D Generation & Auto-Rigging Pipeline
  meshyApiKey: string;
  setMeshyApiKey: (key: string) => void;
  aiGenerationTasks: Array<{ id: string; prompt: string; artStyle: 'realistic' | 'stylized'; status: string; progress: number; url: string | null; thumbnailUrl?: string; errorMsg?: string; stage?: 'preview' | 'refine' | 'rigging'; targetObjectId?: string }>;
  generateAiAsset: (prompt: string, artStyle: 'realistic' | 'stylized') => Promise<string>;
  pollAiAssetTask: (taskId: string) => void;
  startMockTask: (taskId: string) => void;
  rigModelAsset: (objectId: string) => Promise<void>;
  pollRiggingTask: (taskId: string, objectId: string) => void;
  startMockRiggingTask: (taskId: string, objectId: string) => void;
  timelineHeight: number;
  setTimelineHeight: (height: number) => void;
  // AI Creative Assistant
  assistantMessages: AssistantMessage[];
  assistantPanelVisible: boolean;
  assistantIsLoading: boolean;
  assistantApiKey: string;
  assistantGameContext: string;
  setAssistantApiKey: (key: string) => void;
  setAssistantGameContext: (context: string) => void;
  toggleAssistantPanel: () => void;
  sendAssistantQuery: (query: string) => Promise<void>;
  applyPropertyPatch: (messageId: string) => void;
  applySceneAction: (messageId: string) => void;
  clearAssistantHistory: () => void;
  aiFocusScope: FocusScope;
  setAiFocusScope: (scope: FocusScope) => void;
  // Gameplay & Quests state
  quests: Quest[];
  scriptedEvents: ScriptedEvent[];
  gameVariables: Record<string, boolean | number | string>;
  addQuest: (quest: Quest) => void;
  updateQuest: (id: string, updates: Partial<Quest>) => void;
  deleteQuest: (id: string) => void;
  addScriptedEvent: (event: ScriptedEvent) => void;
  updateScriptedEvent: (id: string, updates: Partial<ScriptedEvent>) => void;
  deleteScriptedEvent: (id: string) => void;
  setGameVariable: (key: string, value: boolean | number | string) => void;
  deleteGameVariable: (key: string) => void;
  triggerScriptedEvents: (triggerType: ScriptedEvent['triggerType'], triggerTargetId?: string) => void;
  executeScriptedEvent: (event: ScriptedEvent) => Promise<void>;
  activeDialogue: ActiveDialogue | null;
  setActiveDialogue: (dialogue: ActiveDialogue | null) => void;
  ultimateCharge: number;
  setUltimateCharge: (v: number) => void;
  ultimateActive: boolean;
  setUltimateActive: (v: boolean) => void;
  ultimateCharacterId: string | null;
  ultimateDuration: number;
  setUltimateDuration: (v: number) => void;
}

export type EngineState = StoreState;

// --- Default objects for a new scene ---
const createDefaultObjects = (): SceneObject[] => [
  {
    id: 'obj_1',
    name: 'Default Cube',
    type: 'mesh',
    geometry: 'box',
    position: [0, 0.5, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    physics: 'dynamic',
    material: { color: '#ffffff', roughness: 0.2, metalness: 0.8, envMapIntensity: 1 },
  },
  {
    id: 'obj_2',
    name: 'Smooth Sphere',
    type: 'mesh',
    geometry: 'sphere',
    position: [2, 1, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    physics: 'dynamic',
    material: { color: '#ff4400', roughness: 0.1, metalness: 0.9, envMapIntensity: 1 },
  },
  {
    id: 'obj_3',
    name: 'Ground Plane',
    type: 'mesh',
    geometry: 'plane',
    position: [0, 0, 0],
    rotation: [-Math.PI / 2, 0, 0],
    scale: [10, 10, 1],
    physics: 'fixed',
    anchored: true,
    isSolid: true,
    material: { color: '#222222', roughness: 0.1, metalness: 0.1, envMapIntensity: 0.5 },
  },
  {
    id: 'starter_player',
    name: 'Starter Player',
    type: 'group',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    health: 100,
    lastHitType: 'none',
  },
  {
    id: 'asset_vault',
    name: 'Asset Vault',
    type: 'group',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    locked: true,
  },
  {
    id: 'sun-light',
    name: 'Sun (Directional Light)',
    type: 'SUN',
    position: [100, 100, 100],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    textureUrl: null,
    parentId: 'lighting',
  },
  {
    id: 'moon-light',
    name: 'Moon (Directional Light)',
    type: 'MOON',
    position: [-100, -100, -100],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    textureUrl: null,
    parentId: 'lighting',
  },
];

const defaultEnvironment: EnvironmentSettings = {
  ambientIntensity: 0.2,
  directionalIntensity: 1.5,
  bloomIntensity: 1.5,
  bloomMipmapBlur: true,
  preset: 'sunset',
  fogEnabled: false,
  fogColor: '#94a3b8',
  fogNear: 5,
  fogFar: 30,
  fogDensity: 0.025,
  exposure: 1,
  timeOfDay: 12,
  cycleDuration: 60,
  cloudsEnabled: true,
  cloudsDensity: 0.5,
  cloudsSpeed: 1.0,
  cloudsAltitude: 350,
  cloudsSize: 1.0,
  cloudsType: 'volumetric',
  godRaysEnabled: true,
  godRaysQuality: 'balanced',
  rainEnabled: false,
  rainIntensity: 0.5,
  rainSpeed: 1.0,
  rainTextureUrl: null,
  snowEnabled: false,
  snowIntensity: 0.5,
  snowSpeed: 1.0,
  snowTextureUrl: null,
  windEnabled: false,
  windStrength: 2.0,
  windDirection: 'SE',
  windTurbulence: 0.5,
  gravity: -9.81,
  spaceEnabled: false,
  spaceMode: false,
  globalDebrisEnabled: false,
  globalDebrisAssetId: null,
  globalDebrisCount: 150,
  globalDebrisSpeed: 1.0,
  globalDebrisShape: 'dust',
  seasonSettings: {
    enabled: false,
    activeSeason: 'spring',
    seasonCycleSpeed: 120,
    currentWeather: 'clear',
    weatherTransitionSpeed: 1.0,
    autoWeatherChange: true,
  },
  cameraMode: 'third-person',
  cameraSensitivity: 1.0,
  invertCameraY: false,
  cameraType: 'THIRD_PERSON',
  cameraFollow: true,
  freezeTime: false,
  lensFlareEnabled: true,
  lensFlareAutoSwitch: true,
  lensFlareLayers: [
    {
      id: 'layer-1',
      name: 'Clearcut Photorealistic',
      enabled: true,
      textureUrl: '/Lens_flares_001-clearcut.png',
      sunTextureUrl: '/Lens_flares_001-clearcut.png',
      moonTextureUrl: '/moon flare.png',
      autoSwitch: true,
      offsetX: -0.06,
      offsetY: 0.05,
      scale: 3600,
      opacity: 1.0,
    },
  ],
  lensFlareTextureUrl: '/Lens_flares_001-clearcut.png',
  lensFlareOffsetX: -0.06,
  lensFlareOffsetY: 0.05,
  lensFlareScale: 3600,
};

const getInitialEnvironment = (): EnvironmentSettings => {
  let env = { ...defaultEnvironment };
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      const saved = localStorage.getItem('stellar-engine-environment-autosave');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          env = { ...env, ...parsed };
        }
      }
    }
  } catch (e) {
    console.error('Failed to parse environment autosave data', e);
  }
  return env;
};

// --- Helper: sync both scenes map and flat objects ---
const syncSceneObjects = (state: EngineState, newObjects: SceneObject[]) => ({
  objects: newObjects,
  scenes: {
    ...state.scenes,
    [state.activeSceneId]: {
      ...state.scenes[state.activeSceneId],
      objects: newObjects,
    },
  },
});

export const computeObjectBounds = (obj: SceneObject): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
} => {
  if (obj.customBounds) {
    return obj.customBounds;
  }

  // 1. Create the matching Three.js geometry
  let geom: THREE.BufferGeometry;
  const geomType = obj.geometry || 'box';

  switch (geomType) {
    case 'box':
      geom = new THREE.BoxGeometry(1, 1, 1);
      break;
    case 'sphere':
      geom = new THREE.SphereGeometry(0.5, 32, 32);
      break;
    case 'cylinder':
      geom = new THREE.CylinderGeometry(0.5, 0.5, 1, 32);
      break;
    case 'cone':
      geom = new THREE.ConeGeometry(0.5, 1, 32);
      break;
    case 'plane':
      geom = new THREE.PlaneGeometry(1, 1);
      break;
    case 'torus':
      geom = new THREE.TorusGeometry(0.4, 0.1, 16, 100);
      break;
    case 'torusKnot':
      geom = new THREE.TorusKnotGeometry(0.4, 0.1, 64, 8);
      break;
    case 'ring':
      geom = new THREE.RingGeometry(0.2, 0.5, 32);
      break;
    default:
      // Fallback for custom shapes, groups, lights or emitters
      geom = new THREE.BoxGeometry(1, 1, 1);
  }

  // 2. Apply transformations using a dummy mesh
  const mesh = new THREE.Mesh(geom);
  mesh.scale.set(obj.scale[0], obj.scale[1], obj.scale[2]);
  mesh.rotation.set(obj.rotation[0], obj.rotation[1], obj.rotation[2]);
  mesh.position.set(0, 0, 0);
  mesh.updateMatrixWorld(true);

  // 3. Compute bounding box in world space
  const box = new THREE.Box3();
  box.setFromObject(mesh);

  const bounds = {
    minX: -box.min.x,
    maxX: box.max.x,
    minY: -box.min.y,
    maxY: box.max.y,
    minZ: -box.min.z,
    maxZ: box.max.z,
  };

  // Clean up
  geom.dispose();

  return bounds;
};

export function isDescendantOf(objId: string, parentTargetId: string, objects: SceneObject[]): boolean {
  let currentId: string | null = objId;
  const visited = new Set<string>();
  while (currentId) {
    if (currentId === parentTargetId) return true;
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const parentObj = objects.find((o) => o.id === currentId);
    currentId = parentObj?.parentId || null;
  }
  return false;
}

export function getWorldPositionOfObject(obj: SceneObject, objects: SceneObject[]): [number, number, number] {
  let x = obj.position[0];
  let y = obj.position[1];
  let z = obj.position[2];
  let currentParentId = obj.parentId;
  const visited = new Set<string>();
  while (currentParentId) {
    if (visited.has(currentParentId)) break;
    visited.add(currentParentId);
    const parentObj = objects.find((o) => o.id === currentParentId);
    if (parentObj) {
      x += parentObj.position[0];
      y += parentObj.position[1];
      z += parentObj.position[2];
      currentParentId = parentObj.parentId;
    } else {
      break;
    }
  }
  return [x, y, z];
}

const computeObjectBottomBound = (obj: SceneObject): number => {
  const bounds = computeObjectBounds(obj);
  return obj.position[1] - bounds.minY;
};

const getTerrainLocalHeight = (localX: number, localY: number, heightData?: number[]): number => {
  if (!heightData || heightData.length === 0) return 0;

  // Convert local coordinates to grid coordinates (0 to 64)
  const colFloat = (localX + 0.5) * 64;
  const rowFloat = (0.5 - localY) * 64;

  // Clamp to grid boundaries
  const col = Math.max(0, Math.min(63, Math.floor(colFloat)));
  const row = Math.max(0, Math.min(63, Math.floor(rowFloat)));

  const colWeight = colFloat - col;
  const rowWeight = rowFloat - row;

  // The grid has 65 vertices per row (64 segments + 1)
  const i00 = row * 65 + col;
  const i10 = row * 65 + (col + 1);
  const i01 = (row + 1) * 65 + col;
  const i11 = (row + 1) * 65 + (col + 1);

  const h00 = heightData[i00] || 0;
  const h10 = heightData[i10] || 0;
  const h01 = heightData[i01] || 0;
  const h11 = heightData[i11] || 0;

  // Bilinear interpolation for smooth height mapping
  const hTop = h00 * (1 - colWeight) + h10 * colWeight;
  const hBottom = h01 * (1 - colWeight) + h11 * colWeight;
  const hFinal = hTop * (1 - rowWeight) + hBottom * rowWeight;

  return hFinal;
};

export const getTerrainWorldHeightAt = (
  worldX: number,
  worldZ: number,
  terrainObj: SceneObject
): number | null => {
  // 1. Recreate the terrain's world matrix
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3(terrainObj.position[0], terrainObj.position[1], terrainObj.position[2]);
  const rotation = new THREE.Euler(terrainObj.rotation[0], terrainObj.rotation[1], terrainObj.rotation[2]);
  const scale = new THREE.Vector3(terrainObj.scale[0], terrainObj.scale[1], terrainObj.scale[2]);
  const quaternion = new THREE.Quaternion().setFromEuler(rotation);

  matrix.compose(position, quaternion, scale);

  // 2. Invert the matrix to transform world coordinates to local coordinates
  const invMatrix = matrix.clone().invert();
  const worldPoint = new THREE.Vector3(worldX, 0, worldZ);
  const localPoint = worldPoint.clone().applyMatrix4(invMatrix);

  // 3. Check if local coordinates are inside the plane boundary (width 1, height 1)
  if (localPoint.x >= -0.5 && localPoint.x <= 0.5 && localPoint.y >= -0.5 && localPoint.y <= 0.5) {
    // 4. Calculate local height using heightData
    const localHeight = getTerrainLocalHeight(localPoint.x, localPoint.y, terrainObj.heightData);

    // 5. Transform the local point (including local height) back to world space
    const surfaceLocalPoint = new THREE.Vector3(localPoint.x, localPoint.y, localHeight);
    const surfaceWorldPoint = surfaceLocalPoint.applyMatrix4(matrix);

    return surfaceWorldPoint.y;
  }

  return null;
};

const updateActivePlayerOnHierarchyChange = (objects: SceneObject[], currentActivePlayerId: string | null): string | null => {
  const children = objects.filter((o) => o.parentId === 'starter_player');
  if (children.length === 1) {
    return children[0].id;
  } else if (children.length === 0) {
    return null;
  } else {
    if (currentActivePlayerId && children.some((c) => c.id === currentActivePlayerId)) {
      return currentActivePlayerId;
    }
    return children[0].id;
  }
};

// Build initial scene
const INITIAL_SCENE_ID = 'scene_1';
const initialDefaultObjects = createDefaultObjects();

const sanitizeMaterialForAutosave = (material: any) => {
  if (!material) return material;
  const matCopy = { ...material };

  if (matCopy.presetMap === undefined) {
    if (typeof matCopy.map === 'string' && ['grid', 'brick', 'wood', 'metal', 'water'].includes(matCopy.map)) {
      matCopy.presetMap = matCopy.map;
    } else {
      matCopy.presetMap = 'none';
    }
  }

  if (matCopy.customMap === undefined) {
    if (typeof matCopy.map === 'string' && !['grid', 'brick', 'wood', 'metal', 'water'].includes(matCopy.map)) {
      matCopy.customMap = matCopy.map;
    } else {
      matCopy.customMap = null;
    }
  }

  if (matCopy.map) {
    if (typeof matCopy.map === 'string') {
      if (matCopy.map.startsWith('blob:')) delete matCopy.map;
    } else if (matCopy.map?.image?.src && typeof matCopy.map.image.src === 'string') {
      const src = matCopy.map.image.src;
      if (src.startsWith('blob:')) {
        delete matCopy.map;
      } else {
        matCopy.map = src;
      }
    } else if (matCopy.texturePath && typeof matCopy.texturePath === 'string') {
      matCopy.map = matCopy.texturePath;
    } else {
      matCopy.map = null;
    }
  }

  if (matCopy.normalMap) {
    if (typeof matCopy.normalMap === 'string') {
      if (matCopy.normalMap.startsWith('blob:')) delete matCopy.normalMap;
    } else if (matCopy.normalMap?.image?.src && typeof matCopy.normalMap.image.src === 'string') {
      const src = matCopy.normalMap.image.src;
      if (src.startsWith('blob:')) {
        delete matCopy.normalMap;
      } else {
        matCopy.normalMap = src;
      }
    } else {
      matCopy.normalMap = null;
    }
  }

  return matCopy;
};

const rebuildSceneObjects = (objs: any[]): SceneObject[] => {
  return objs.map((obj) => {
    if (obj && (obj.geometry || obj.type === 'mesh')) {
      const mat = obj.material ? sanitizeMaterialForAutosave(obj.material) : { color: '#ffffff', roughness: 0.5, metalness: 0, envMapIntensity: 1, presetMap: 'none', customMap: null };
      return {
        ...obj,
        id: obj.id,
        name: obj.name,
        type: obj.type || 'mesh',
        geometry: obj.geometry || 'box',
        position: obj.position || [0, 0, 0],
        rotation: obj.rotation || [0, 0, 0],
        scale: obj.scale || [1, 1, 1],
        textString: obj.textString ?? 'TEXT',
        textSize: obj.textSize ?? 1.0,
        textDepth: obj.textDepth ?? 0.2,
        textFont: obj.textFont ?? 'helvetiker',
        bevelRadius: obj.bevelRadius,
        bevelSegments: obj.bevelSegments,
        parentId: obj.parentId || null,
        locked: obj.locked || false,
        material: mat,
      };
    }
    return obj;
  });
};

const safeSerializeObjects = (objects: SceneObject[]): string => {
  return safeSerializeObjectsSync(objects);
};

const sanitizePayload = (objects: SceneObject[]): any[] => {
  return sanitizeObjectsSync(objects);
};

const sanitizeScenes = (scenes: Record<string, SceneData>): Record<string, SceneData> => {
  if (!scenes) return scenes;
  const cleanScenes: Record<string, SceneData> = {};
  for (const key of Object.keys(scenes)) {
    const scene = scenes[key];
    if (scene) {
      cleanScenes[key] = {
        ...scene,
        objects: scene.objects ? sanitizePayload(scene.objects) : [],
      };
    }
  }
  return cleanScenes;
};

const filterCelestialObjects = (objs: any[]): any[] => {
  if (!Array.isArray(objs)) return [];
  return objs.filter(
    (o) =>
      o &&
      o.id !== 'obj_sun' &&
      o.id !== 'obj_moon' &&
      !(o.url && typeof o.url === 'string' && (o.url.includes('_shining_sun') || o.url.includes('shining_moon_')))
  );
};

const ensureServiceObjects = (objs: any[]): any[] => {
  if (!Array.isArray(objs)) return [];
  const list = [...objs];

  if (!list.some((o) => o && o.id === 'starter_player')) {
    list.push({
      id: 'starter_player',
      name: 'Starter Player',
      type: 'group',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      health: 100,
      lastHitType: 'none',
    });
  }

  if (!list.some((o) => o && o.id === 'asset_vault')) {
    list.push({
      id: 'asset_vault',
      name: 'Asset Vault',
      type: 'group',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      locked: true,
    });
  }

  if (!list.some((o) => o && (o.id === 'sun-light' || o.type === 'SUN'))) {
    list.push({
      id: 'sun-light',
      name: 'Sun (Directional Light)',
      type: 'SUN',
      position: [100, 100, 100],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      textureUrl: null,
      parentId: 'lighting',
    });
  }

  if (!list.some((o) => o && (o.id === 'moon-light' || o.type === 'MOON'))) {
    list.push({
      id: 'moon-light',
      name: 'Moon (Directional Light)',
      type: 'MOON',
      position: [-100, -100, -100],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      textureUrl: null,
      parentId: 'lighting',
    });
  }

  return list;
};

const getInitialObjects = (): SceneObject[] => {
  let loaded: any[] = [];
  if (typeof window !== 'undefined' && (window as any).__STELLAR_HMR_STATE__?.objects?.length > 0) {
    loaded = (window as any).__STELLAR_HMR_STATE__.objects;
  } else {
    try {
      if (typeof sessionStorage !== 'undefined' && sessionStorage) {
        const sessionSaved = sessionStorage.getItem('stellar-engine-session-backup');
        if (sessionSaved) {
          const parsed = JSON.parse(sessionSaved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            loaded = parsed;
          }
        }
      }
      if (loaded.length === 0 && typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
        const saved = localStorage.getItem('stellar-engine-autosave');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            loaded = parsed;
          }
        }
      }
    } catch (e) {
      console.error("Failed to parse autosave data", e);
    }
  }

  if (!loaded || loaded.length === 0) {
    loaded = initialDefaultObjects;
  }

  return ensureServiceObjects(filterCelestialObjects(rebuildSceneObjects(loaded)));
};

const initialScenes: Record<string, SceneData> = {
  [INITIAL_SCENE_ID]: {
    id: INITIAL_SCENE_ID,
    name: 'Scene 1',
    objects: getInitialObjects(),
  },
};

const WORKSPACE_DB_NAME = 'stellar-engine-workspace-db';
const WORKSPACE_STORE_NAME = 'workspace_store';

const openWorkspaceDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(WORKSPACE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORKSPACE_STORE_NAME)) {
        db.createObjectStore(WORKSPACE_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const idbWorkspaceEngine = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      const db = await openWorkspaceDB();
      const value: string | null = await new Promise((resolve) => {
        const transaction = db.transaction(WORKSPACE_STORE_NAME, 'readonly');
        const store = transaction.objectStore(WORKSPACE_STORE_NAME);
        const request = store.get(name);
        request.onsuccess = () => resolve(request.result ? request.result.value : null);
        request.onerror = () => resolve(null);
      });
      if (value !== null) return value;
    } catch (e) {}

    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      try {
        const legacyValue = localStorage.getItem(name);
        if (legacyValue !== null) {
          try {
            idbWorkspaceEngine.setItem(name, legacyValue);
          } catch (e) {}
        }
        return legacyValue;
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  setItem: (name: string, value: string): void => {
    if (lastPersistedValues.get(name) === value) return;
    lastPersistedValues.set(name, value);

    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
      try {
        localStorage.setItem(name, value);
      } catch (e) {}
    }

    try {
      openWorkspaceDB().then((db) => {
        const transaction = db.transaction(WORKSPACE_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(WORKSPACE_STORE_NAME);
        store.put({ id: name, value });
      }).catch(() => {});
    } catch (e) {}
  },

  removeItem: async (name: string): Promise<void> => {
    lastPersistedValues.delete(name);
    try {
      const db = await openWorkspaceDB();
      await new Promise<void>((resolve) => {
        const transaction = db.transaction(WORKSPACE_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(WORKSPACE_STORE_NAME);
        const request = store.delete(name);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      });
    } catch (e) {}

    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.removeItem === 'function') {
      try {
        localStorage.removeItem(name);
      } catch (e) {}
    }
  },
};

const lastPersistedValues = new Map<string, string>();
const lastQuotaWarnTimes = new Map<string, number>();

let storeSet: any = null;

export const useStore = create<EngineState>()(
  persist(
    temporal(
    (set, get) => {
      storeSet = set;
      return {
      sceneId: 'default',
      // --- Multi-scene state ---
      scenes: initialScenes,
      activeSceneId: INITIAL_SCENE_ID,
      sceneHistories: {},
      activeTool: 'select' as const,
      setActiveTool: (tool: 'select' | 'foliage' | 'TerrainBrush' | 'weightPaint') =>
        set((state) => {
          const updates: any = { activeTool: tool };
          if (tool !== 'select' && state.transformMode !== 'select') {
            updates.transformMode = 'select';
          }
          return updates;
        }),
      weightBrushRadius: 0.5,
      setWeightBrushRadius: (r: number) => set({ weightBrushRadius: r }),
      weightBrushStrength: 0.2,
      setWeightBrushStrength: (s: number) => set({ weightBrushStrength: s }),
      weightBrushValue: 1.0,
      setWeightBrushValue: (v: number) => set({ weightBrushValue: v }),
      activeWeightChannel: 'r' as const,
      setActiveWeightChannel: (channel: 'r' | 'g' | 'b' | 'a') => set({ activeWeightChannel: channel }),
      brushSettings: {
        size: 15,
        strength: 2.0,
        mode: 'raise' as const,
        textureTiling: 1.0,
        textureOffsetX: 0.0,
        textureOffsetY: 0.0,
      },
      setBrushSettings: (settings) =>
        set((state) => ({
          brushSettings: { ...state.brushSettings, ...settings },
        })),
      foliageBrushAssetId: null,
      setFoliageBrushAssetId: (id) => set({ foliageBrushAssetId: id }),
      foliageInstances: [],
      addFoliageInstance: (instance) => set((state) => ({ foliageInstances: [...state.foliageInstances, instance] })),
      addFoliageInstances: (instances) => set((state) => ({ foliageInstances: [...state.foliageInstances, ...instances] })),
      clearFoliage: (assetUrl) => set((state) => ({
        foliageInstances: assetUrl ? state.foliageInstances.filter(i => i.assetUrl !== assetUrl) : []
      })),
      eraseFoliageInRadius: (point, radius, assetUrl) => set((state) => ({
        foliageInstances: state.foliageInstances.filter((inst) => {
          if (assetUrl && inst.assetUrl !== assetUrl) return true;
          const dx = inst.position[0] - point[0];
          const dy = inst.position[1] - point[1];
          const dz = inst.position[2] - point[2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          return dist > radius;
        })
      })),
      foliageBrushRadius: 2.0,
      setFoliageBrushRadius: (r) => set({ foliageBrushRadius: r }),
      foliageBrushDensity: 10,
      setFoliageBrushDensity: (d) => set({ foliageBrushDensity: d }),
      environment: getInitialEnvironment(),
      updateEnvironment: (updates) =>
        set((state) => {
          const nextEnv = { ...state.environment, ...updates };
          if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
            try {
              localStorage.setItem('stellar-engine-environment-autosave', JSON.stringify(nextEnv));
            } catch (e) {
              console.error('Failed to autosave environment settings', e);
            }
          }
          return { environment: nextEnv };
        }),
      // Flat objects kept in sync with scenes[activeSceneId].objects
      objects: getInitialObjects(),
      selectedIds: [],
      transformMode: 'translate',
      setTransformMode: (mode) =>
        set((state) => {
          const updates: any = { transformMode: mode };
          if (state.activeTool !== 'select') {
            updates.activeTool = 'select';
          }
          return updates;
        }),
      pivotMode: 'center',
      setPivotMode: (mode) => set({ pivotMode: mode }),
      activeFaceTab: 'all',
      setActiveFaceTab: (tab) => set({ activeFaceTab: tab }),
      gizmoFocused: false,
      setGizmoFocused: (focused) => set({ gizmoFocused: focused }),
      facialFocusMode: false,
      setFacialFocusMode: (mode) => set({ facialFocusMode: mode }),
      isDraggingTimeOfDay: false,
      setIsDraggingTimeOfDay: (isDragging) => set({ isDraggingTimeOfDay: isDragging }),
      activePreviewAsset: null,
      previewRect: null,
      setActivePreviewAsset: (asset, rect) => set({ activePreviewAsset: asset, previewRect: rect }),
      snapGrid: false,
      toggleSnapGrid: () => set((state) => ({ snapGrid: !state.snapGrid })),
      snapValue: 1.0,
      setSnapValue: (val) => set({ snapValue: val }),
      rotationSnapAngle: 15,
      setRotationSnapAngle: (val) => set({ rotationSnapAngle: val }),
      showGrid: true,
      toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
      showOverlays: true,
      toggleOverlays: () => set((state) => ({ showOverlays: !state.showOverlays })),
      isPreferencesModalOpen: false,
      setPreferencesModalOpen: (open) => set({ isPreferencesModalOpen: open }),
      enginePreferences: (() => {
        const defaults: EnginePreferences = {
          graphicsQuality: 'balanced',
          renderScale: 1.0,
          godRaysEnabled: true,
          showFpsCounter: true,
          shadowQuality: 'medium',
        };
        try {
          const saved = typeof window !== 'undefined' ? localStorage.getItem('stellar_engine_preferences') : null;
          if (saved) {
            return { ...defaults, ...JSON.parse(saved) };
          }
        } catch {
          // ignore
        }
        return defaults;
      })(),
      updateEnginePreferences: (updates) =>
        set((state) => {
          const updated = { ...state.enginePreferences, ...updates };
          try {
            if (typeof window !== 'undefined') {
              localStorage.setItem('stellar_engine_preferences', JSON.stringify(updated));
            }
          } catch {
            // ignore
          }
          const envUpdates: Partial<any> = {};
          if (updates.graphicsQuality !== undefined) envUpdates.godRaysQuality = updates.graphicsQuality;
          if (updates.godRaysEnabled !== undefined) envUpdates.godRaysEnabled = updates.godRaysEnabled;
          return {
            enginePreferences: updated,
            environment: { ...state.environment, ...envUpdates },
          };
        }),
      showPhysicsDebug: false,
      togglePhysicsDebug: () => set((state) => ({ showPhysicsDebug: !state.showPhysicsDebug })),
      showEmitters: true,
      toggleEmitters: () => set((state) => ({ showEmitters: !state.showEmitters })),
      wireframeMode: false,
      toggleWireframeMode: () => set((state) => ({ wireframeMode: !state.wireframeMode })),
      isPlaying: false,
      isPaused: false,
      playerAnimationState: 'idle',
      setPlayerAnimationState: (animState) => set({ playerAnimationState: animState }),
      modelAnimations: {},
      activePlayerId: null,
      setActivePlayerId: (id) => set({ activePlayerId: id }),
      workspaceMode: 'level',
      setWorkspaceMode: (mode) =>
        set((state) => {
          const updates: Partial<any> = { workspaceMode: mode, activeTool: 'select' };

          if (mode === 'level') {
            updates.activeScriptId = null;
            updates.animationTargetId = null;
          } else if (mode === 'script') {
            // Ensure a script is active
            if (!state.activeScriptId) {
              if (state.openScripts.length > 0) {
                updates.activeScriptId = state.openScripts[state.openScripts.length - 1];
              } else {
                const firstScript = state.objects.find((o) => o.type === 'script');
                if (firstScript) {
                  updates.openScripts = [...state.openScripts, firstScript.id];
                  updates.activeScriptId = firstScript.id;
                } else {
                  // No scripts in scene: create a new one!
                  const scriptId = `obj_${crypto.randomUUID()}`;
                  const newScript: SceneObject = {
                    id: scriptId,
                    name: 'Script.js',
                    type: 'script',
                    scriptCode: `function update(self, delta) {\n    console.log("Hello!");\n}`,
                    position: [0, 0, 0],
                    rotation: [0, 0, 0],
                    scale: [1, 1, 1],
                    parentId: null,
                  };
                  const sync = syncSceneObjects(state, [...state.objects, newScript]);
                  Object.assign(updates, sync);
                  updates.openScripts = [scriptId];
                  updates.activeScriptId = scriptId;
                  updates.selectedIds = [scriptId];
                }
              }
            }
          } else if (mode === 'animation') {
            updates.activeScriptId = null;
            if (!state.animationTargetId) {
              const selectedId = state.selectedIds[0];
              const selectedObj = selectedId ? state.objects.find((o) => o.id === selectedId) : null;
              if (selectedObj) {
                let curr = selectedObj;
                const visited = new Set();
                while (curr && !visited.has(curr.id)) {
                  visited.add(curr.id);
                  if (curr.type === 'gltf' || (curr.type as any) === 'fbx') {
                    updates.animationTargetId = curr.id;
                    break;
                  }
                  curr = curr.parentId ? state.objects.find((o) => o.id === curr.parentId) : null;
                }
              }
            }
          } else if (mode === 'logic') {
            updates.activeScriptId = null;
            updates.animationTargetId = null;
          }
          return updates;
        }),
      quests: [],
      scriptedEvents: [],
      gameVariables: {},
      activeDialogue: null,
      setActiveDialogue: (dialogue) => set({ activeDialogue: dialogue }),
      ultimateCharge: 0,
      setUltimateCharge: (v) => set({ ultimateCharge: THREE.MathUtils.clamp(v, 0, 100) }),
      ultimateActive: false,
      setUltimateActive: (v) => set({ ultimateActive: v }),
      ultimateCharacterId: null,
      ultimateDuration: 20.0,
      setUltimateDuration: (v) => set({ ultimateDuration: v }),
      addQuest: (quest) =>
        set((state) => ({ quests: [...state.quests, quest] })),
      updateQuest: (id, updates) =>
        set((state) => ({
          quests: state.quests.map((q) => (q.id === id ? { ...q, ...updates } : q)),
        })),
      deleteQuest: (id) =>
        set((state) => ({
          quests: state.quests.filter((q) => q.id !== id),
        })),
      addScriptedEvent: (event) =>
        set((state) => ({ scriptedEvents: [...state.scriptedEvents, event] })),
      updateScriptedEvent: (id, updates) =>
        set((state) => ({
          scriptedEvents: state.scriptedEvents.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),
      deleteScriptedEvent: (id) =>
        set((state) => ({
          scriptedEvents: state.scriptedEvents.filter((e) => e.id !== id),
        })),
      setGameVariable: (key, value) =>
        set((state) => ({
          gameVariables: { ...state.gameVariables, [key]: value },
        })),
      deleteGameVariable: (key) =>
        set((state) => {
          const newVars = { ...state.gameVariables };
          delete newVars[key];
          return { gameVariables: newVars };
        }),
      triggerScriptedEvents: (triggerType, triggerTargetId) => {
        const state = get();
        if (!state.isPlaying) return;

        const events = state.scriptedEvents.filter((e) => {
          if (e.triggerType !== triggerType) return false;
          if (triggerTargetId && e.triggerTargetId !== triggerTargetId) return false;
          return true;
        });

        for (const event of events) {
          state.executeScriptedEvent(event);
        }
      },
      executeScriptedEvent: async (event) => {
        const state = get();
        if (event.requiresUltimate) {
          if (state.ultimateCharge < 100) {
            toast.error('Ultimate Not Ready', `Requires 100% Charge (Current: ${Math.round(state.ultimateCharge)}%)`);
            return;
          }
          state.setUltimateCharge(0);
        }
        for (const action of event.actions) {
          if (!get().isPlaying) break;

          const params = action.params || {};

          switch (action.type) {
            case 'dialogue': {
              const dur = Number(params.duration) || 4.0;
              get().setActiveDialogue({
                id: action.id,
                speakerId: params.speakerId || undefined,
                speakerName: params.speakerName || 'NPC',
                text: params.text || 'Hello!',
                position: params.position || 'bottom',
                duration: dur
              });
              toast.info(`${params.speakerName || 'NPC'}: ${params.text || 'Hello!'}`);
              await new Promise<void>((resolve) => setTimeout(resolve, dur * 1000));
              if (get().activeDialogue?.id === action.id) {
                get().setActiveDialogue(null);
              }
              break;
            }

            case 'wait_delay': {
              const duration = Number(params.duration) || 1.0;
              await new Promise<void>((resolve) => setTimeout(resolve, duration * 1000));
              break;
            }

            case 'toggle_visibility':
              if (params.targetId) {
                get().updateObject(params.targetId, { visible: params.visible === true });
              }
              break;

            case 'set_variable':
              if (params.key) {
                get().setGameVariable(params.key, params.value);
                get().triggerScriptedEvents('on_variable_changed', params.key);
              }
              break;

            case 'play_sound':
              try {
                const audio = new Audio(params.audioUrl || '/sounds/click.mp3');
                audio.play().catch(() => {});
              } catch (e) {
                console.error('Audio play failed', e);
              }
              break;

            case 'spawn_prefab': {
              const name = params.prefabName || 'box';
              let pos: [number, number, number] = [0, 1, 0];
              if (Array.isArray(params.position)) {
                pos = params.position as [number, number, number];
              } else if (typeof params.position === 'string') {
                try {
                  pos = JSON.parse(params.position);
                } catch {}
              }
              get().addPrimitive(name as any);
              const updatedObjects = get().objects;
              const lastObj = updatedObjects[updatedObjects.length - 1];
              if (lastObj) {
                get().updateObject(lastObj.id, { position: pos });
              }
              break;
            }

            case 'transform_character': {
              const charId = params.characterId;
              if (!charId) break;

              const targetForm = params.targetForm || 'ultimate';
              const characterObj = get().objects.find(o => o.id === charId);
              const pos = characterObj ? characterObj.position : [0, 1, 0];

              if (targetForm === 'ultimate') {
                get().setUltimateActive(true);
                const duration = Number(params.ultimateDuration) || 20.0;
                set({ ultimateCharacterId: charId, ultimateDuration: duration });
                let targetScale: [number, number, number] = [1.2, 1.2, 1.2];
                if (params.changeScale) {
                  if (Array.isArray(params.scale)) {
                    targetScale = params.scale as [number, number, number];
                  } else if (typeof params.scale === 'string') {
                    try { targetScale = JSON.parse(params.scale); } catch {}
                  } else if (params.scaleX !== undefined && params.scaleY !== undefined && params.scaleZ !== undefined) {
                    targetScale = [Number(params.scaleX), Number(params.scaleY), Number(params.scaleZ)];
                  }
                }

                let targetMorphWeights: Record<string, number> = { 'veins': 1.0, 'bulk': 1.2 };
                if (params.morphTargets) {
                  if (typeof params.morphTargets === 'string') {
                    try { targetMorphWeights = JSON.parse(params.morphTargets); } catch {}
                  } else if (typeof params.morphTargets === 'object') {
                    targetMorphWeights = params.morphTargets;
                  }
                }

                get().updateObject(charId, {
                  scale: targetScale,
                  material: {
                    color: params.changeColor ? (params.color || '#555555') : '#555555',
                    roughness: 0.8,
                    metalness: 0.1,
                    envMapIntensity: 1.0
                  },
                  paintEffectType: params.applyPostEffect ? (params.postEffectType || 'electrical') : 'electrical',
                  morphWeights: targetMorphWeights
                });

                if (params.playVFX && params.vfxType && params.vfxType !== 'none') {
                  const vfxId = `obj_vfx_${crypto.randomUUID()}`;
                  
                  let vfxPos: [number, number, number] = [pos[0], pos[1] + 1, pos[2]];
                  const attach = params.vfxAttachPoint || 'center';
                  if (characterObj && characterObj.customBounds) {
                    const bounds = characterObj.customBounds;
                    if (attach === 'center') {
                      vfxPos[1] = pos[1] + (bounds.maxY - bounds.minY) / 2;
                    } else if (attach === 'head') {
                      vfxPos[1] = pos[1] + bounds.maxY;
                    } else if (attach === 'pivot') {
                      vfxPos[1] = pos[1];
                    }
                  }
                  if (attach === 'custom') {
                    vfxPos[0] += Number(params.vfxOffsetX) || 0;
                    vfxPos[1] += Number(params.vfxOffsetY) || 0;
                    vfxPos[2] += Number(params.vfxOffsetZ) || 0;
                  }

                  get().addObject({
                    id: vfxId,
                    name: `Transform ${params.vfxType}`,
                    type: 'mesh',
                    geometry: params.vfxType,
                    position: vfxPos,
                    rotation: [0, 0, 0],
                    scale: [1.5, 1.5, 1.5],
                    physics: 'none',
                    isSolid: false,
                    particleProps: {
                      count: 1000,
                      size: 0.4,
                      opacity: 0.8,
                      color: params.vfxColor || '#ff0055',
                      speed: 3.0,
                      shape: 'realistic',
                      lifetime: 2.0
                    }
                  });

                  const vfxDuration = Number(params.vfxDuration) || 2.0;
                  setTimeout(() => {
                    set((s) => ({ objects: s.objects.filter(o => o.id !== vfxId) }));
                  }, vfxDuration * 1000);
                }
              } else {
                get().setUltimateActive(false);
                set({ ultimateCharacterId: null });
                get().updateObject(charId, {
                  scale: [1, 1, 1],
                  material: {
                    color: '#38bdf8',
                    roughness: 0.5,
                    metalness: 0.0,
                    envMapIntensity: 1.0
                  },
                  paintEffectType: 'none',
                  morphWeights: {}
                });

                if (params.playVFX && params.vfxType && params.vfxType !== 'none') {
                  const vfxId = `obj_vfx_${crypto.randomUUID()}`;
                  
                  let vfxPos: [number, number, number] = [pos[0], pos[1] + 1, pos[2]];
                  const attach = params.vfxAttachPoint || 'center';
                  if (characterObj && characterObj.customBounds) {
                    const bounds = characterObj.customBounds;
                    if (attach === 'center') {
                      vfxPos[1] = pos[1] + (bounds.maxY - bounds.minY) / 2;
                    } else if (attach === 'head') {
                      vfxPos[1] = pos[1] + bounds.maxY;
                    } else if (attach === 'pivot') {
                      vfxPos[1] = pos[1];
                    }
                  }
                  if (attach === 'custom') {
                    vfxPos[0] += Number(params.vfxOffsetX) || 0;
                    vfxPos[1] += Number(params.vfxOffsetY) || 0;
                    vfxPos[2] += Number(params.vfxOffsetZ) || 0;
                  }

                  get().addObject({
                    id: vfxId,
                    name: `Restore ${params.vfxType}`,
                    type: 'mesh',
                    geometry: params.vfxType,
                    position: vfxPos,
                    rotation: [0, 0, 0],
                    scale: [1.2, 1.2, 1.2],
                    physics: 'none',
                    isSolid: false,
                    particleProps: {
                      count: 800,
                      size: 0.3,
                      opacity: 0.7,
                      color: params.vfxColor || '#38bdf8',
                      speed: 2.0,
                      shape: 'circle',
                      lifetime: 1.5
                    }
                  });

                  setTimeout(() => {
                    set((s) => ({ objects: s.objects.filter(o => o.id !== vfxId) }));
                  }, 1500);
                }
              }
              break;
            }

            case 'spawn_effect': {
              const targetId = params.targetId;
              const effectType = params.effectType || 'fire';
              
              let pos: [number, number, number] = [0, 1, 0];
              let targetObj = null;
              if (targetId) {
                targetObj = get().objects.find(o => o.id === targetId);
                if (targetObj) pos = targetObj.position;
              }

              let vfxPos: [number, number, number] = [pos[0], pos[1], pos[2]];
              const attach = params.vfxAttachPoint || 'pivot';
              if (targetObj && targetObj.customBounds) {
                const bounds = targetObj.customBounds;
                if (attach === 'center') {
                  vfxPos[1] = pos[1] + (bounds.maxY - bounds.minY) / 2;
                } else if (attach === 'head') {
                  vfxPos[1] = pos[1] + bounds.maxY;
                }
              }
              if (attach === 'custom') {
                vfxPos[0] += Number(params.vfxOffsetX) || 0;
                vfxPos[1] += Number(params.vfxOffsetY) || 0;
                vfxPos[2] += Number(params.vfxOffsetZ) || 0;
              }

              const vfxId = `obj_spawned_vfx_${crypto.randomUUID()}`;
              get().addObject({
                id: vfxId,
                name: `Effect_${effectType}`,
                type: 'mesh',
                geometry: effectType,
                position: vfxPos,
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
                physics: 'none',
                isSolid: false,
                particleProps: {
                  count: Number(params.count) || 800,
                  size: Number(params.size) || 0.35,
                  opacity: Number(params.opacity) || 0.7,
                  color: params.color || '#ffffff',
                  speed: Number(params.speed) || 1.5,
                  shape: params.shape || 'circle',
                  lifetime: Number(params.lifetime) || 3.0
                }
              });

              const lifetime = Number(params.lifetime) || 3.0;
              setTimeout(() => {
                set((s) => ({ objects: s.objects.filter(o => o.id !== vfxId) }));
              }, lifetime * 1000);
              break;
            }

            case 'apply_material_effect': {
              const targetId = params.targetId;
              if (targetId) {
                get().updateObject(targetId, {
                  paintEffectType: (params.effectType || 'none') as any
                });
              }
              break;
            }

            case 'adjust_ultimate': {
              const amount = params.amount !== undefined ? Number(params.amount) : 25;
              const current = get().ultimateCharge;
              get().setUltimateCharge(current + amount);
              break;
            }
          }
        }
      },
      animationTargetId: null,
      defaultRestPoses: {},
      setDefaultRestPose: (objId, pose) => set((state) => ({
        defaultRestPoses: { ...state.defaultRestPoses, [objId]: pose }
      })),
      animationVersion: 0,
      setAnimationTargetId: (id) => set({ animationTargetId: id }),
      currentFrame: 0,
      setCurrentFrame: (frame) => {
        set({ currentFrame: frame });
        if (!get().isPlaying && !get().isPlayingAnimation) {
          syncActiveClonedScenePose(get());
        }
      },
      maxFrames: 60,
      setMaxFrames: (max) => set({ maxFrames: max }),
      isPlayingAnimation: false,
      setIsPlayingAnimation: (playing) => set((state) => {
        const updates: any = { isPlayingAnimation: playing };
        if (!playing) {
          updates.currentFrame = state.currentFrame;
        }
        return updates;
      }),
      loopMode: 'repeat',
      setLoopMode: (mode) => set({ loopMode: mode }),
      alternatingIdles: true,
      setAlternatingIdles: (val) => set({ alternatingIdles: val }),
      meshyApiKey: typeof window !== 'undefined' ? (localStorage.getItem('meshy_api_key') || 'msy_dummy_api_key_for_test_mode_12345678') : 'msy_dummy_api_key_for_test_mode_12345678',
      setMeshyApiKey: (key) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('meshy_api_key', key);
        }
        set({ meshyApiKey: key });
      },
      aiGenerationTasks: [],
      timelineHeight: 240,
      setTimelineHeight: (height) => set({ timelineHeight: height }),
      // AI Creative Assistant
      assistantMessages: [],
      assistantPanelVisible: false,
      assistantIsLoading: false,
      assistantApiKey: typeof window !== 'undefined' ? (localStorage.getItem('gemini_api_key') || '') : '',
      assistantGameContext: typeof window !== 'undefined' ? (localStorage.getItem('assistant_game_context') || '') : '',
      setAssistantApiKey: (key) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('gemini_api_key', key);
        }
        set({ assistantApiKey: key });
      },
      setAssistantGameContext: (context) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('assistant_game_context', context);
        }
        set({ assistantGameContext: context });
      },
      toggleAssistantPanel: () => set((state) => ({ assistantPanelVisible: !state.assistantPanelVisible })),
      clearAssistantHistory: () => set({ assistantMessages: [] }),
      aiFocusScope: 'GLOBAL' as FocusScope,
      setAiFocusScope: (scope: FocusScope) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('ai_focus_scope', scope);
        }
        set({ aiFocusScope: scope });
      },
      applyPropertyPatch: (messageId) => {
        const msg = get().assistantMessages.find((m) => m.id === messageId);
        if (!msg?.propertyPatch) return;
        const { targetId, targetName, after } = msg.propertyPatch;
        
        if (targetId === 'environment') {
          get().updateEnvironment(after);
          toast.success('Scene Updated', `Applied changes to Environment settings.`);
        } else {
          get().updateObject(targetId, after);
          toast.success('Scene Updated', `Applied changes to ${targetName || 'Object'}.`);
        }

        set((state) => ({
          assistantMessages: state.assistantMessages.map((m) =>
            m.id === messageId ? { ...m, applied: true } : m
          )
        }));
      },
      applySceneAction: (messageId) => {
        const msg = get().assistantMessages.find((m) => m.id === messageId);
        if (!msg) return;

        let appliedCount = 0;
        if (msg.actions) {
          for (const patch of msg.actions) {
            if (patch.cmd === 'add_object' && patch.params) {
              const { type, customName, color, voxelHotbarProps } = patch.params;
              if (type === 'voxel_hotbar') {
                const hotbarId = `hotbar_${crypto.randomUUID().substring(0, 8)}`;
                get().addObject({
                  id: hotbarId,
                  name: customName || 'Voxel Block Hotbar (HUD)',
                  type: 'voxel_hotbar',
                  position: [0, 0, 0],
                  rotation: [0, 0, 0],
                  scale: [1, 1, 1],
                  voxelHotbarProps: voxelHotbarProps || {
                    slotCount: 9,
                    activeSlotIndex: 0,
                    showKeybinds: true,
                    styleVariant: 'minecraft',
                    autoHideInEditMode: false,
                    enableVoxelMining: true,
                    enableVoxelPlacing: true,
                    miningRange: 8.0,
                    placeCooldownMs: 150,
                    items: [],
                  },
                });
              } else {
                get().addPrimitive(type || 'cube');
                const objs = get().objects;
                const newObj = objs[objs.length - 1];
                if (newObj) {
                  const updates: Partial<SceneObject> = {};
                  if (customName) updates.name = customName;
                  if (color) updates.material = { ...newObj.material, color };
                  if (voxelHotbarProps) updates.voxelHotbarProps = voxelHotbarProps;
                  if (Object.keys(updates).length > 0) {
                    get().updateObject(newObj.id, updates);
                  }
                }
              }
            } else if (patch.cmd === 'delete_object') {
              const targetId = patch.targetId || get().selectedIds[0];
              if (targetId) get().deleteObject(targetId);
            } else if (patch.cmd === 'add_quest' && patch.params) {
              get().addQuest({
                id: `quest_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                title: patch.params.title || 'New Quest',
                description: patch.params.description || 'Complete the objectives.',
                rewardXp: patch.params.rewardXp || 100,
                rewardGold: patch.params.rewardGold || 50,
                status: 'not_started',
                objectives: (patch.params.objectives || []).map((o: any, idx: number) => ({
                  id: `obj_${idx}_${Date.now()}`,
                  type: o.type || 'collect_item',
                  description: o.description || `Complete ${o.type || 'objective'}`,
                  targetName: o.targetName || 'target',
                  targetCount: o.targetCount || 1,
                  currentCount: 0
                }))
              });
            } else if (patch.cmd === 'add_scripted_event' && patch.params) {
              get().addScriptedEvent({
                id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                name: patch.params.name || 'New Event',
                triggerType: patch.params.triggerType || 'on_level_start',
                triggerTargetId: patch.params.triggerTargetId,
                actions: (patch.params.actions || []).map((a: any) => ({
                  id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                  type: a.type || 'dialogue',
                  params: a.params || {}
                }))
              });
            } else if (patch.cmd === 'set_game_variable' && patch.params) {
              get().setGameVariable(patch.params.key, patch.params.value);
            } else {
              if (patch.targetId === 'environment') {
                get().updateEnvironment(patch.after);
              } else {
                get().updateObject(patch.targetId, patch.after);
              }
            }
            appliedCount++;
          }
        }

        if (msg.actionType === 'kickstart_blueprint' && msg.blueprint) {
          const bp = msg.blueprint;
          const summary = `Genre: ${bp.genre}\nCamera Style: ${bp.cameraStyle}\nCore Features: ${bp.coreFeatures.join(', ')}`;
          get().setAssistantGameContext(summary);
          toast.success(`🎮 Kickstarted '${bp.genre}'`, `Viewport and camera locked to track!`);
        } else {
          const label = msg.actionLabel || 'Scene Changes';
          toast.success(`✨ ${label}`, `Applied ${appliedCount} change${appliedCount > 1 ? 's' : ''} to your scene.`);
        }

        set((state) => ({
          assistantMessages: state.assistantMessages.map((m) =>
            m.id === messageId ? { ...m, applied: true } : m
          )
        }));
      },
      sendAssistantQuery: async (query) => {
        const apiKey = get().assistantApiKey;
        if (!apiKey) return;

        // Auto-detect game context from chat if not set
        const gameCtx = get().assistantGameContext;
        const lowerQuery = query.toLowerCase();
        if (!gameCtx && (lowerQuery.includes('making') || lowerQuery.includes('building') || lowerQuery.includes('creating') || lowerQuery.includes('my game'))) {
          get().setAssistantGameContext(query);
        }

        // Push user message
        const userMsg: AssistantMessage = {
          id: `msg_${Date.now()}_user`,
          role: 'user',
          content: query,
          timestamp: Date.now()
        };
        set((state) => ({
          assistantMessages: [...state.assistantMessages, userMsg],
          assistantIsLoading: true
        }));

        // Build context from selected objects and scene
        const selectedIds = get().selectedIds;
        const objects = get().objects;
        const selectedObj = objects.find((o) => selectedIds.includes(o.id));
        const sceneList = objects.slice(0, 50).map((o) => ({ id: o.id, name: o.name, type: o.type }));
        const currentEnv = get().environment;
        const gameBible = get().assistantGameContext;

        const contextBlock = [
          `You are a Creative AI Assistant embedded inside "Stellar Engine", a browser-based 3D game engine.`,
          `You are a creative partner and scene director — NOT a programmer. You NEVER generate code, scripts, or technical instructions.`,
          gameBible ? `\nGAME BIBLE (the user's creative vision):\n"${gameBible}"\nAll of your suggestions and modifications must align with this creative vision and theme.` : '',
          ``,
          `YOUR ROLE: When the user describes a creative change in plain English (e.g., "make the lighting spooky", "turn this into a heavy concrete barrier", "give me an underground parking lot vibe"), you translate that into direct property modifications and apply them. You think in terms of mood, aesthetics, and game feel — not technical specs.`,
          ``,
          `SCENE OBJECTS (${objects.length} total):`,
          JSON.stringify(sceneList, null, 2),
          selectedObj ? `\nCURRENTLY SELECTED OBJECT:\n${JSON.stringify({
            id: selectedObj.id,
            name: selectedObj.name,
            type: selectedObj.type,
            geometry: selectedObj.geometry,
            position: selectedObj.position,
            rotation: selectedObj.rotation,
            scale: selectedObj.scale,
            material: selectedObj.material,
            lightProps: selectedObj.lightProps,
            celestialProps: selectedObj.celestialProps,
            physics: selectedObj.physics,
            physicsMass: selectedObj.physicsMass,
            anchored: selectedObj.anchored,
            visible: selectedObj.visible,
            behavior: selectedObj.behavior
          }, null, 2)}` : '\nNo object currently selected.',
          `\nGLOBAL ENVIRONMENT SETTINGS (modifiable via targetId "environment"):\n${JSON.stringify(currentEnv, null, 2)}`,
          ``,
          `AVAILABLE ENVIRONMENT PRESETS: city, sunset, dawn, night, warehouse, forest, apartment, studio, park, lobby`,
          `AVAILABLE CLOUD TYPES: volumetric, flat, cirrus, voxel, nimbus, snow, blizzard`,
          `AVAILABLE WIND DIRECTIONS: N, NE, E, SE, S, SW, W, NW`,
          ``,
          `RESPONSE FORMAT: You MUST respond with valid JSON in ONE of these structures:`,
          ``,
          `1. For conversational answers (no scene changes):`,
          `{ "type": "text", "content": "Your friendly response here" }`,
          ``,
          `2. For general scene modifications or agentic commands (one or more actions bundled together):`,
          `{`,
          `  "type": "scene_action",`,
          `  "content": "Your friendly explanation of what these changes will do and why they fit the creative vision",`,
          `  "actionLabel": "A short creative label like: Setup Quest Trigger",`,
          `  "actions": [`,
          `    { "targetId": "environment", "targetName": "Environment", "before": { "ambientIntensity": 0.2 }, "after": { "ambientIntensity": 0.05 } },`,
          `    { "cmd": "add_object", "targetName": "Red Neon Sphere", "before": {}, "after": {}, "params": { "type": "sphere", "customName": "Red Sphere", "color": "#ff0000" } },`,
          `    { "cmd": "delete_object", "targetId": "obj_to_remove_id", "targetName": "Old Crate", "before": {}, "after": {} },`,
          `    { "cmd": "add_quest", "targetName": "Defeat the Dragon", "before": {}, "after": {}, "params": { "title": "Defeat the Dragon", "rewardXp": 250, "objectives": [{ "type": "defeat_enemy", "targetName": "Dragon Boss", "targetCount": 1 }] } },`,
          `    { "cmd": "add_scripted_event", "targetName": "T Key Transformation", "before": {}, "after": {}, "params": { "name": "Transform Trigger", "triggerType": "on_key_pressed", "triggerTargetId": "T", "actions": [{ "type": "toggle_visibility", "params": { "targetId": "BlueFormModel", "visible": false } }] } },`,
          `    { "cmd": "set_game_variable", "targetName": "Game Score", "before": {}, "after": {}, "params": { "key": "score", "value": 100 } }`,
          `  ]`,
          `}`,
          ``,
          `3. For kickstarting or defining a new game genre:`,
          `{`,
          `  "type": "kickstart_blueprint",`,
          `  "content": "A warm overview of the genre setup you are about to initialize",`,
          `  "actionLabel": "Kickstart 'Streets of Rage' Engine Blueprint",`,
          `  "blueprint": {`,
          `    "genre": "3D Side-Scroller Beat 'Em Up",`,
          `    "cameraStyle": "Side-Scrolling Follow Track",`,
          `    "coreFeatures": ["Melee Combos", "Side-Scrolling Bound Clamps", "Parallel Camera Track"]`,
          `  },`,
          `  "actions": [`,
          `    { "targetId": "environment", "targetName": "Environment", "before": { "cameraMode": "third-person", "cameraType": "THIRD_PERSON", "cameraFollow": true }, "after": { "cameraMode": "side-scroller", "cameraType": "SIDE_SCROLLER", "cameraFollow": true } }`,
          `  ]`,
          `}`,
          ``,
          `4. For generating 3D models, assets, characters, props, or weapons via Meshy AI:`,
          `{`,
          `  "type": "meshy_generation",`,
          `  "content": "Friendly confirmation that you have prepared the asset generation prompt for Meshy AI.",`,
          `  "meshyPrompt": "An optimized, highly descriptive prompt to feed into the 3D model generator (e.g. 'A futuristic robot warrior with metallic plating, gold accents, low poly stylized game asset, high quality')",`,
          `  "meshyArtStyle": "stylized" // or "realistic"`,
          `}`,
          ``,
          `RULES:`,
          `- Use "kickstart_blueprint" whenever a user describes a type of game they want to create.`,
          `- Use "scene_action" for other general creative edits and agentic updates (like creating quests, adding objects, setting variables, and deleting objects).`,
          `- Use "meshy_generation" whenever the user asks to generate, create, design, or paint a new 3D model, character, avatar, weapon, or prop.`,
          `- For each property-tweak action entry, include current values in "before" and your proposed values in "after".`,
          `- For structural commands ("add_object", "delete_object", "add_quest", "add_scripted_event", "set_game_variable"), specify "cmd" and "params".`,
          `- To modify global environment settings, use targetId "environment".`,
          `- Keep your explanations warm, creative, and jargon-free.`
        ].join('\n');

        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [
                  { role: 'user', parts: [{ text: contextBlock + '\n\nUSER QUERY: ' + query }] }
                ],
                generationConfig: {
                  temperature: 0.7,
                  maxOutputTokens: 4096,
                  responseMimeType: 'application/json'
                }
              })
            }
          );

          if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
          }

          const data = await response.json();
          const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

          let parsed: any;
          try {
            parsed = JSON.parse(rawText);
          } catch {
            parsed = { type: 'text', content: rawText };
          }

          const assistantMsg: AssistantMessage = {
            id: `msg_${Date.now()}_assistant`,
            role: 'assistant',
            content: parsed.content || rawText,
            timestamp: Date.now(),
            actionType: parsed.type || 'text',
            propertyPatch: parsed.propertyPatch,
            actionLabel: parsed.actionLabel,
            actions: parsed.actions,
            blueprint: parsed.blueprint
          };

          set((state) => ({
            assistantMessages: [...state.assistantMessages, assistantMsg],
            assistantIsLoading: false
          }));
        } catch (err: any) {
          console.warn('[AI Assistant] Gemini request failed, using offline intent router:', err);

          const fallbackMsg = routeIntent(query, {
            scope: get().aiFocusScope,
            selectedObj: selectedObj ? {
              id: selectedObj.id,
              name: selectedObj.name,
              material: selectedObj.material,
              physics: selectedObj.physics,
              physicsMass: selectedObj.physicsMass,
            } : null,
            currentEnv,
            gameBible: gameBible || '',
            objects: objects,
          });

          set((state) => ({
            assistantMessages: [...state.assistantMessages, fallbackMsg],
            assistantIsLoading: false
          }));
        }
      },
      activeSkeleton: [],
      setActiveSkeleton: (skeleton) => set({ activeSkeleton: skeleton }),
      selectedBoneId: null,
      setSelectedBoneId: (id) => set({ selectedBoneId: id }),
      riggingSymmetry: false,
      setRiggingSymmetry: (val) => set({ riggingSymmetry: val }),
      eyelidsSymmetry: true,
      setEyelidsSymmetry: (val) => set({ eyelidsSymmetry: val }),
      tracks: [],
      setTracks: (tracks) => set({ tracks }),
      updateKeyframe: (boneName, property, frame, value) =>
        set((state) => {
          let found = false;
          const newTracks = state.tracks.map((track) => {
            if (track.boneName === boneName && track.property === property) {
              found = true;
              let updatedKeyframes;
              if (Array.isArray(track.keyframes)) {
                const filtered = track.keyframes.filter((k: any) => !(k && typeof k === 'object' && k.frame === frame));
                updatedKeyframes = [...filtered, { frame, value }];
              } else {
                updatedKeyframes = {
                  ...track.keyframes,
                  [frame]: value,
                };
              }
              return {
                ...track,
                keyframes: updatedKeyframes,
              };
            }
            return track;
          });

          if (!found) {
            newTracks.push({
              boneName,
              property,
              keyframes: {
                [frame]: value,
              },
            });
          }

          if (state.riggingSymmetry) {
            const partnerName = getSymmetricalBoneName(boneName);
            if (partnerName) {
              let mirroredVal = value;
              if (property === 'position') {
                mirroredVal = [-value[0], value[1], value[2]];
              } else if (property === 'rotation') {
                mirroredVal = [value[0], -value[1], -value[2], value[3]];
              }
              
              let partnerFound = false;
              for (let i = 0; i < newTracks.length; i++) {
                const track = newTracks[i];
                if (track.boneName === partnerName && track.property === property) {
                  partnerFound = true;
                  let partnerKeyframes;
                  if (Array.isArray(track.keyframes)) {
                    const filtered = track.keyframes.filter((k: any) => !(k && typeof k === 'object' && k.frame === frame));
                    partnerKeyframes = [...filtered, { frame, value: mirroredVal }];
                  } else {
                    partnerKeyframes = {
                      ...track.keyframes,
                      [frame]: mirroredVal,
                    };
                  }
                  newTracks[i] = {
                    ...track,
                    keyframes: partnerKeyframes,
                  };
                  break;
                }
              }
              
              if (!partnerFound) {
                newTracks.push({
                  boneName: partnerName,
                  property,
                  keyframes: {
                    [frame]: mirroredVal,
                  },
                });
              }
            }
          }

          const objId = state.animationTargetId;
          const obj = objId ? state.objects.find((o) => o.id === objId) : null;
          const clipName = obj?.activeAnimation || null;
          bakeTracksToRegistry(objId, clipName, newTracks);

          const newObjects = saveTracksToObjects(state, newTracks);
          return { 
            tracks: newTracks,
            animationVersion: state.animationVersion + 1,
            ...syncSceneObjects(state, newObjects)
          };
        }),
      activeClonedScene: null,
      setActiveClonedScene: (scene) => set({ activeClonedScene: scene }),
      keyframeClipboard: null,
      setKeyframeClipboard: (clipboard) => set({ keyframeClipboard: clipboard }),
      isSkeletonUnbound: false,
      setIsSkeletonUnbound: (val) => set({ isSkeletonUnbound: val }),
      unbindSkeleton: () => {
        const scene = get().activeClonedScene;
        if (!scene) return;

        // Cache the original bind state for safety / potential future restore.
        scene.traverse((child: any) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            _skinnedMeshBindCache.set(child.uuid, {
              bindMatrix: child.bindMatrix.clone(),
              bindMatrixInverse: child.bindMatrixInverse.clone(),
              bindMode: child.bindMode,
              boneInverses: child.skeleton.boneInverses.map((m: THREE.Matrix4) => m.clone()),
            });
          }
        });

        // Stop animation playback and set the unbound flag.
        // The useFrame guard in Viewport.tsx will prevent any animation tracks
        // or mixer updates from overwriting bone transforms while the user
        // manually repositions bones. Skinning stays fully active so the mesh
        // deforms in real-time as bones are moved — this gives the user direct
        // visual feedback on bone alignment.
        //
        // NOTE: We intentionally do NOT call skeleton.pose() here. Meshy AI
        // (and similar auto-riggers) export skeletons with non-bone parent
        // transforms (Groups with rotation). Three.js's skeleton.pose() does
        // not account for non-bone parents when decomposing root bone
        // matrices, causing a coordinate space collapse.
        set({ isSkeletonUnbound: true, isPlaying: false, isPaused: false });
      },
      rebindSkeleton: () => {
        const scene = get().activeClonedScene;
        const objId = get().animationTargetId;
        if (!scene || !objId) return;

        const customRestPose: Record<string, { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] }> = {};

        // Snapshot every bone's current local transform. These are the
        // positions the user has adjusted (or left untouched).
        scene.traverse((child: any) => {
          if (child instanceof THREE.SkinnedMesh && child.skeleton) {
            // Clean up the cached bind state.
            _skinnedMeshBindCache.delete(child.uuid);
          }
          if (child.isBone || child instanceof THREE.Bone) {
            customRestPose[child.name] = {
              position: [child.position.x, child.position.y, child.position.z],
              rotation: [child.rotation.x, child.rotation.y, child.rotation.z],
              scale: [child.scale.x, child.scale.y, child.scale.z],
            };
          }
        });

        // Persist the custom rest pose on the scene object. On the next
        // model load/clone (triggered by sceneVersion bump), the Viewport.tsx
        // cloning logic applies these transforms before the initial bind,
        // establishing the corrected rest pose from scratch.
        get().updateObject(objId, { customRestPose });

        set({ isSkeletonUnbound: false, sceneVersion: get().sceneVersion + 1 });
      },
      resetRestPose: () => {
        const objId = get().animationTargetId;
        if (!objId) return;

        const obj = get().objects.find((o) => o.id === objId);
        const clipName = obj?.activeAnimation || null;

        get().updateObject(objId, {
          customRestPose: undefined,
          activeAnimation: 'None',
        });

        // Also clear active animation tracks since they are relative/bound to the custom rest pose
        bakeTracksToRegistry(objId, clipName, []);

        set({
          isSkeletonUnbound: false,
          tracks: [],
          animationVersion: get().animationVersion + 1,
          sceneVersion: get().sceneVersion + 1
        });
      },
      syncSkeletonPose: () => {
        syncActiveClonedScenePose(get());
      },
      resetFrameToDefault: () => {
        const state = get();
        const objId = state.animationTargetId;
        if (!objId) return;

        const roundedFrame = Math.round(state.currentFrame);
        const defaultPose = state.defaultRestPoses[objId];
        
        const obj = state.objects.find((o) => o.id === objId);
        const clipName = obj?.activeAnimation || null;

        // Collect all unique bone names in the skeleton to reset
        const boneNames = new Set<string>();
        if (defaultPose) {
          Object.keys(defaultPose).forEach(name => boneNames.add(name));
        }
        state.tracks.forEach(track => boneNames.add(track.boneName));

        let newTracks = [...state.tracks];
        boneNames.forEach((boneName) => {
          const position = getOriginalClipValue(objId, clipName, boneName, 'position', roundedFrame, defaultPose) || [0, 0, 0];
          const rotation = getOriginalClipValue(objId, clipName, boneName, 'rotation', roundedFrame, defaultPose) || [0, 0, 0, 1];
          const scale = getOriginalClipValue(objId, clipName, boneName, 'scale', roundedFrame, defaultPose) || [1, 1, 1];

          newTracks = updateKeyframeHelper(newTracks, boneName, 'position', roundedFrame, position);
          newTracks = updateKeyframeHelper(newTracks, boneName, 'rotation', roundedFrame, rotation);
          newTracks = updateKeyframeHelper(newTracks, boneName, 'scale', roundedFrame, scale);
        });

        bakeTracksToRegistry(objId, clipName, newTracks);
        const newObjects = saveTracksToObjects(state, newTracks);

        set({
          tracks: newTracks,
          animationVersion: state.animationVersion + 1,
          ...syncSceneObjects(state, newObjects)
        });
      },
      resetSelectedBoneFrameToDefault: () => {
        const state = get();
        const objId = state.animationTargetId;
        const boneName = state.selectedBoneId;
        if (!objId || !boneName) return;

        const roundedFrame = Math.round(state.currentFrame);
        const defaultPose = state.defaultRestPoses[objId];

        const obj = state.objects.find((o) => o.id === objId);
        const clipName = obj?.activeAnimation || null;

        const position = getOriginalClipValue(objId, clipName, boneName, 'position', roundedFrame, defaultPose) || [0, 0, 0];
        const rotation = getOriginalClipValue(objId, clipName, boneName, 'rotation', roundedFrame, defaultPose) || [0, 0, 0, 1];
        const scale = getOriginalClipValue(objId, clipName, boneName, 'scale', roundedFrame, defaultPose) || [1, 1, 1];

        let newTracks = [...state.tracks];
        newTracks = updateKeyframeHelper(newTracks, boneName, 'position', roundedFrame, position);
        newTracks = updateKeyframeHelper(newTracks, boneName, 'rotation', roundedFrame, rotation);
        newTracks = updateKeyframeHelper(newTracks, boneName, 'scale', roundedFrame, scale);

        bakeTracksToRegistry(objId, clipName, newTracks);
        const newObjects = saveTracksToObjects(state, newTracks);

        set({
          tracks: newTracks,
          animationVersion: state.animationVersion + 1,
          ...syncSceneObjects(state, newObjects)
        });
      },
      flipPoseSymmetrically: () => {
        const state = get();
        const objId = state.animationTargetId;
        const scene = state.activeClonedScene;
        if (!objId || !scene) return;

        const roundedFrame = Math.round(state.currentFrame);
        const obj = state.objects.find((o) => o.id === objId);
        const clipName = obj?.activeAnimation || null;

        // 1. Collect all bones in the scene
        const bones: any[] = [];
        scene.traverse((child: any) => {
          if (child.isBone || child instanceof THREE.Bone) {
            bones.push(child);
          }
        });

        if (bones.length === 0) return;

        // 2. Clone the current posed state of all bones so we can resolve swaps correctly
        const originalTransforms: Record<string, {
          position: THREE.Vector3;
          quaternion: THREE.Quaternion;
          scale: THREE.Vector3;
        }> = {};

        bones.forEach((bone) => {
          originalTransforms[bone.name] = {
            position: bone.position.clone(),
            quaternion: bone.quaternion.clone(),
            scale: bone.scale.clone(),
          };
        });

        // 3. Process each bone and calculate mirrored/flipped values
        let newTracks = [...state.tracks];
        const processed = new Set<string>();

        bones.forEach((bone) => {
          if (processed.has(bone.name)) return;

          const partnerName = getSymmetricalBoneName(bone.name);

          if (partnerName) {
            const partnerBone = bones.find((b) => b.name === partnerName);
            if (partnerBone) {
              // Swap Left/Right transforms with mirroring
              const t1 = originalTransforms[bone.name];
              const t2 = originalTransforms[partnerName];

              // Bone 1 gets mirrored Bone 2
              const newPos1 = [-t2.position.x, t2.position.y, t2.position.z];
              const newRot1 = [t2.quaternion.x, -t2.quaternion.y, -t2.quaternion.z, t2.quaternion.w];
              const newScale1 = [t2.scale.x, t2.scale.y, t2.scale.z];

              // Bone 2 gets mirrored Bone 1
              const newPos2 = [-t1.position.x, t1.position.y, t1.position.z];
              const newRot2 = [t1.quaternion.x, -t1.quaternion.y, -t1.quaternion.z, t1.quaternion.w];
              const newScale2 = [t1.scale.x, t1.scale.y, t1.scale.z];

              // Apply to THREE bones
              bone.position.set(newPos1[0], newPos1[1], newPos1[2]);
              bone.quaternion.set(newRot1[0], newRot1[1], newRot1[2], newRot1[3]);
              bone.scale.set(newScale1[0], newScale1[1], newScale1[2]);
              bone.updateMatrix();

              partnerBone.position.set(newPos2[0], newPos2[1], newPos2[2]);
              partnerBone.quaternion.set(newRot2[0], newRot2[1], newRot2[2], newRot2[3]);
              partnerBone.scale.set(newScale2[0], newScale2[1], newScale2[2]);
              partnerBone.updateMatrix();

              // Write to tracks
              newTracks = updateKeyframeHelper(newTracks, bone.name, 'position', roundedFrame, newPos1);
              newTracks = updateKeyframeHelper(newTracks, bone.name, 'rotation', roundedFrame, newRot1);
              newTracks = updateKeyframeHelper(newTracks, bone.name, 'scale', roundedFrame, newScale1);

              newTracks = updateKeyframeHelper(newTracks, partnerName, 'position', roundedFrame, newPos2);
              newTracks = updateKeyframeHelper(newTracks, partnerName, 'rotation', roundedFrame, newRot2);
              newTracks = updateKeyframeHelper(newTracks, partnerName, 'scale', roundedFrame, newScale2);

              processed.add(bone.name);
              processed.add(partnerName);
            } else {
              // Partner not found in scene, treat as central bone
              const t = originalTransforms[bone.name];
              const newPos = [-t.position.x, t.position.y, t.position.z];
              const newRot = [t.quaternion.x, -t.quaternion.y, -t.quaternion.z, t.quaternion.w];
              const newScale = [t.scale.x, t.scale.y, t.scale.z];

              bone.position.set(newPos[0], newPos[1], newPos[2]);
              bone.quaternion.set(newRot[0], newRot[1], newRot[2], newRot[3]);
              bone.scale.set(newScale[0], newScale[1], newScale[2]);
              bone.updateMatrix();

              newTracks = updateKeyframeHelper(newTracks, bone.name, 'position', roundedFrame, newPos);
              newTracks = updateKeyframeHelper(newTracks, bone.name, 'rotation', roundedFrame, newRot);
              newTracks = updateKeyframeHelper(newTracks, bone.name, 'scale', roundedFrame, newScale);

              processed.add(bone.name);
            }
          } else {
            // Central bone: mirror itself
            const t = originalTransforms[bone.name];
            const newPos = [-t.position.x, t.position.y, t.position.z];
            const newRot = [t.quaternion.x, -t.quaternion.y, -t.quaternion.z, t.quaternion.w];
            const newScale = [t.scale.x, t.scale.y, t.scale.z];

            bone.position.set(newPos[0], newPos[1], newPos[2]);
            bone.quaternion.set(newRot[0], newRot[1], newRot[2], newRot[3]);
            bone.scale.set(newScale[0], newScale[1], newScale[2]);
            bone.updateMatrix();

            newTracks = updateKeyframeHelper(newTracks, bone.name, 'position', roundedFrame, newPos);
            newTracks = updateKeyframeHelper(newTracks, bone.name, 'rotation', roundedFrame, newRot);
            newTracks = updateKeyframeHelper(newTracks, bone.name, 'scale', roundedFrame, newScale);

            processed.add(bone.name);
          }
        });

        // 4. Update the skeleton world matrices
        scene.traverse((child: any) => {
          if (child.isBone || child instanceof THREE.Bone) {
            child.updateMatrixWorld(true);
          }
        });

        // 5. Save and synchronize
        bakeTracksToRegistry(objId, clipName, newTracks);
        const newObjects = saveTracksToObjects(state, newTracks);

        set({
          tracks: newTracks,
          animationVersion: state.animationVersion + 1,
          ...syncSceneObjects(state, newObjects)
        });
      },
      deleteKeyframe: (boneName, property, frame) =>
        set((state) => {
          const newTracks = state.tracks.map((track) => {
            if (track.boneName === boneName && track.property === property) {
              let newKeyframes;
              if (Array.isArray(track.keyframes)) {
                newKeyframes = track.keyframes.filter((k: any) => !(k && typeof k === 'object' && k.frame === frame));
              } else {
                newKeyframes = { ...track.keyframes };
                delete newKeyframes[frame];
              }
              return {
                ...track,
                keyframes: newKeyframes,
              };
            }
            return track;
          });

          const objId = state.animationTargetId;
          const obj = objId ? state.objects.find((o) => o.id === objId) : null;
          const clipName = obj?.activeAnimation || null;
          bakeTracksToRegistry(objId, clipName, newTracks);

          const newObjects = saveTracksToObjects(state, newTracks);
          return { 
            tracks: newTracks,
            animationVersion: state.animationVersion + 1,
            ...syncSceneObjects(state, newObjects)
          };
        }),
      deleteSelectedFrameGlobal: () =>
        set((state) => {
          const roundedFrame = Math.round(state.currentFrame);
          const newTracks = state.tracks.map((track) => {
            const newKeyframes = { ...track.keyframes };
            delete newKeyframes[roundedFrame];
            return {
              ...track,
              keyframes: newKeyframes,
            };
          });

          const objId = state.animationTargetId;
          const obj = objId ? state.objects.find((o) => o.id === objId) : null;
          const clipName = obj?.activeAnimation || null;
          bakeTracksToRegistry(objId, clipName, newTracks);

          const newObjects = saveTracksToObjects(state, newTracks);
          return { 
            tracks: newTracks,
            animationVersion: state.animationVersion + 1,
            ...syncSceneObjects(state, newObjects)
          };
        }),
      weaponSocket: 'none',
      setWeaponSocket: (socket) => set({ weaponSocket: socket }),

      addBoneToRig: (parentBoneName, newBoneName) => {
        const scene = get().activeClonedScene;
        if (!scene) return;

        // Find the parent bone in the scene graph
        let parentBone: any = null;
        scene.traverse((child: any) => {
          if ((child.isBone || child instanceof THREE.Bone) && child.name === parentBoneName) {
            parentBone = child;
          }
        });

        if (!parentBone) {
          console.warn(`[addBoneToRig] Parent bone "${parentBoneName}" not found`);
          return;
        }

        const currentTracks = get().tracks;
        const newTracks = [...currentTracks];

        const objId = get().animationTargetId;
        const currentDefaultRestPoses = get().defaultRestPoses;
        const updatedDefaultRestPoses = { ...currentDefaultRestPoses };
        if (objId && !updatedDefaultRestPoses[objId]) {
          updatedDefaultRestPoses[objId] = {};
        } else if (objId) {
          updatedDefaultRestPoses[objId] = { ...currentDefaultRestPoses[objId] };
        }

        // Helper to cleanly create and bind a bone
        const createAndBindBone = (parent: THREE.Bone, name: string, pos: [number, number, number]) => {
          let exists = false;
          scene.traverse((child: any) => {
            if ((child.isBone || child instanceof THREE.Bone) && child.name === name) {
              exists = true;
            }
          });
          if (exists) {
            console.warn(`[addBoneToRig] Bone "${name}" already exists`);
            return null;
          }

          const boneObj = new THREE.Bone();
          boneObj.name = name;
          boneObj.position.fromArray(pos);
          parent.add(boneObj);

          // Update any SkinnedMesh skeletons to include the new bone
          scene.traverse((child: any) => {
            if (child.isSkinnedMesh && child.skeleton) {
              const skeleton = child.skeleton;
              if (skeleton.bones.includes(parent) && !skeleton.bones.includes(boneObj)) {
                const newBones = [...skeleton.bones, boneObj];
                const parentIdx = skeleton.bones.indexOf(parent);
                const parentInverse = skeleton.boneInverses[parentIdx];
                boneObj.updateMatrix();
                const newInverse = new THREE.Matrix4()
                  .copy(boneObj.matrix)
                  .invert()
                  .multiply(parentInverse);
                const newInverses = [...skeleton.boneInverses, newInverse];
                const newSkeleton = new THREE.Skeleton(newBones, newInverses);
                child.bind(newSkeleton, child.bindMatrix);
              }
            }
          });

          // Add empty tracks
          ['position', 'rotation', 'scale'].forEach((prop) => {
            const hasTrack = newTracks.some(t => t.boneName === name && t.property === prop);
            if (!hasTrack) {
              newTracks.push({
                boneName: name,
                property: prop as 'position' | 'rotation' | 'scale',
                keyframes: {},
              });
            }
          });

          // Register default rest pose
          if (objId && updatedDefaultRestPoses[objId]) {
            updatedDefaultRestPoses[objId][name] = {
              position: [boneObj.position.x, boneObj.position.y, boneObj.position.z] as [number, number, number],
              rotation: [boneObj.quaternion.x, boneObj.quaternion.y, boneObj.quaternion.z, boneObj.quaternion.w] as [number, number, number, number],
              scale: [boneObj.scale.x, boneObj.scale.y, boneObj.scale.z] as [number, number, number],
            };
          }

          return boneObj;
        };

        // Create main bone
        const newBone = createAndBindBone(parentBone, newBoneName, [0, 0.1, 0]);
        if (!newBone) return;

        // If it is a knuckle bone, automatically add 4 socket child bones
        if (isKnuckleBoneName(newBoneName)) {
          createAndBindBone(newBone, `${newBoneName}_IndexSocket`, [-0.03, 0, 0]);
          createAndBindBone(newBone, `${newBoneName}_MiddleSocket`, [-0.01, 0, 0]);
          createAndBindBone(newBone, `${newBoneName}_RingSocket`, [0.01, 0, 0]);
          createAndBindBone(newBone, `${newBoneName}_PinkySocket`, [0.03, 0, 0]);
        }

        // Rebuild the hierarchy and update the store
        const buildHierarchy = (object: THREE.Object3D) => {
          const rootBones: THREE.Bone[] = [];
          const getDescendantBones = (obj: THREE.Object3D): THREE.Bone[] => {
            const descendants: THREE.Bone[] = [];
            obj.children.forEach((c: any) => {
              if (c.isBone || c instanceof THREE.Bone) {
                descendants.push(c);
              } else {
                descendants.push(...getDescendantBones(c));
              }
            });
            return descendants;
          };

          object.traverse((child: any) => {
            if (child.isBone || child instanceof THREE.Bone) {
              let isRoot = true;
              let parent = child.parent;
              while (parent) {
                if (parent.isBone || parent instanceof THREE.Bone) {
                  isRoot = false;
                  break;
                }
                parent = parent.parent;
              }
              if (isRoot) rootBones.push(child);
            }
          });

          const buildNode = (bone: THREE.Bone): BoneNode => ({
            id: bone.name || bone.uuid,
            name: bone.name || 'Unnamed Bone',
            children: getDescendantBones(bone).map(buildNode),
          });

          return rootBones.map(buildNode);
        };

        const obj = objId ? get().objects.find((o) => o.id === objId) : null;
        const clipName = obj?.activeAnimation || null;
        bakeTracksToRegistry(objId, clipName, newTracks);

        const newObjects = saveTracksToObjects(get(), newTracks);

        set((state) => ({
          activeSkeleton: buildHierarchy(scene),
          sceneVersion: state.sceneVersion + 1,
          tracks: newTracks,
          animationVersion: state.animationVersion + 1,
          defaultRestPoses: updatedDefaultRestPoses,
          ...syncSceneObjects(state, newObjects),
        }));
        console.log(`[addBoneToRig] Added bone "${newBoneName}" and configured knuckle sockets if applicable.`);
      },

      deleteBoneFromRig: (boneName) => {
        const scene = get().activeClonedScene;
        if (!scene) return;

        let targetBone: any = null;
        scene.traverse((child: any) => {
          if ((child.isBone || child instanceof THREE.Bone) && child.name === boneName) {
            targetBone = child;
          }
        });

        if (!targetBone || !targetBone.parent) {
          console.warn(`[deleteBoneFromRig] Bone "${boneName}" not found or has no parent`);
          return;
        }

        // Reparent any children to the deleted bone's parent
        const parent = targetBone.parent;
        const children = [...targetBone.children];
        children.forEach((child: any) => {
          targetBone.remove(child);
          parent.add(child);
        });

        parent.remove(targetBone);

        // Rebuild skeletons
        scene.traverse((child: any) => {
          if (child.isSkinnedMesh && child.skeleton) {
            const skeleton = child.skeleton;
            const boneIdx = skeleton.bones.indexOf(targetBone);
            if (boneIdx !== -1) {
              const newBones = skeleton.bones.filter((_: any, i: number) => i !== boneIdx);
              const newInverses = skeleton.boneInverses.filter((_: any, i: number) => i !== boneIdx);

              // Clone geometry to avoid modifying shared cache/original geometry
              child.geometry = child.geometry.clone();

              // Update skinIndex references
              const geo = child.geometry;
              const skinIndexAttr = geo?.attributes?.skinIndex;
              if (skinIndexAttr) {
                for (let i = 0; i < skinIndexAttr.count; i++) {
                  const update = (getter: string, setter: string) => {
                    const val = (skinIndexAttr as any)[getter](i);
                    if (val === boneIdx) {
                      // Remap to parent bone index
                      const parentIdx = skeleton.bones.indexOf(parent);
                      (skinIndexAttr as any)[setter](i, parentIdx >= 0 ? parentIdx : 0);
                    } else if (val > boneIdx) {
                      (skinIndexAttr as any)[setter](i, val - 1);
                    }
                  };
                  update('getX', 'setX');
                  update('getY', 'setY');
                  update('getZ', 'setZ');
                  update('getW', 'setW');
                }
                skinIndexAttr.needsUpdate = true;
              }

              const newSkeleton = new THREE.Skeleton(newBones, newInverses);
              child.bind(newSkeleton, child.bindMatrix);
            }
          }
        });

        // Rebuild hierarchy
        const buildHierarchy = (object: THREE.Object3D) => {
          const rootBones: THREE.Bone[] = [];
          const getDescendantBones = (obj: THREE.Object3D): THREE.Bone[] => {
            const descendants: THREE.Bone[] = [];
            obj.children.forEach((c: any) => {
              if (c.isBone || c instanceof THREE.Bone) {
                descendants.push(c);
              } else {
                descendants.push(...getDescendantBones(c));
              }
            });
            return descendants;
          };

          object.traverse((child: any) => {
            if (child.isBone || child instanceof THREE.Bone) {
              let isRoot = true;
              let p = child.parent;
              while (p) {
                if (p.isBone || p instanceof THREE.Bone) {
                  isRoot = false;
                  break;
                }
                p = p.parent;
              }
              if (isRoot) rootBones.push(child);
            }
          });

          const buildNode = (bone: THREE.Bone): BoneNode => ({
            id: bone.name || bone.uuid,
            name: bone.name || 'Unnamed Bone',
            children: getDescendantBones(bone).map(buildNode),
          });

          return rootBones.map(buildNode);
        };

        // Filter out deleted bone's tracks
        const currentTracks = get().tracks;
        const newTracks = currentTracks.filter(t => t.boneName !== boneName);

        const objId = get().animationTargetId;
        const obj = objId ? get().objects.find((o) => o.id === objId) : null;
        const clipName = obj?.activeAnimation || null;
        bakeTracksToRegistry(objId, clipName, newTracks);

        const newObjects = saveTracksToObjects(get(), newTracks);

        // Remove deleted bone from defaultRestPoses
        const currentDefaultRestPoses = get().defaultRestPoses;
        let updatedDefaultRestPoses = currentDefaultRestPoses;
        if (objId && currentDefaultRestPoses[objId] && currentDefaultRestPoses[objId][boneName]) {
          const poseObj = { ...currentDefaultRestPoses[objId] };
          delete poseObj[boneName];
          updatedDefaultRestPoses = {
            ...currentDefaultRestPoses,
            [objId]: poseObj,
          };
        }

        set((state) => ({
          activeSkeleton: buildHierarchy(scene),
          selectedBoneId: null,
          sceneVersion: state.sceneVersion + 1,
          tracks: newTracks,
          animationVersion: state.animationVersion + 1,
          defaultRestPoses: updatedDefaultRestPoses,
          ...syncSceneObjects(state, newObjects),
        }));
        console.log(`[deleteBoneFromRig] Removed bone "${boneName}"`);
      },

      generateFacialRig: (targetObjId) => {
        const scene = get().activeClonedScene;
        if (!scene) return;

        const targetObj = get().objects.find((o) => o.id === targetObjId);
        if (!targetObj) return;
        if (targetObj.hasFacialRig) {
          console.warn('[generateFacialRig] Facial rig already exists');
          return;
        }

        // Auto-detect head bone
        let headBone: any = null;
        scene.traverse((child: any) => {
          if ((child.isBone || child instanceof THREE.Bone) && child.name.toLowerCase().includes('head')) {
            if (!headBone) headBone = child;
          }
        });

        if (!headBone) {
          console.warn('[generateFacialRig] No head bone found in skeleton');
          return;
        }

        const facialBones: Array<{ name: string; offset: [number, number, number] }> = [
          { name: 'Face_BrowLeft',        offset: [-0.04,  0.06,  0.08] },
          { name: 'Face_BrowRight',       offset: [ 0.04,  0.06,  0.08] },
          { name: 'Face_EyeLeft',         offset: [-0.03,  0.04,  0.08] },
          { name: 'Face_EyeRight',        offset: [ 0.03,  0.04,  0.08] },
          { name: 'Face_CheekLeft',       offset: [-0.05,  0.01,  0.07] },
          { name: 'Face_CheekRight',      offset: [ 0.05,  0.01,  0.07] },
          { name: 'Face_NoseBridge',      offset: [ 0.0,   0.03,  0.09] },
          { name: 'Face_Jaw',            offset: [ 0.0,  -0.04,  0.06] },
          { name: 'Face_LipUpper',        offset: [ 0.0,  -0.01,  0.09] },
          { name: 'Face_LipLower',        offset: [ 0.0,  -0.03,  0.09] },
          { name: 'Face_LipCornerLeft',   offset: [-0.03, -0.02,  0.085] },
          { name: 'Face_LipCornerRight',  offset: [ 0.03, -0.02,  0.085] },
          { name: 'Face_Chin',           offset: [ 0.0,  -0.06,  0.07] },
        ];

        const newTracks = [...get().tracks];
        const objId = get().animationTargetId;
        const currentDefaultRestPoses = get().defaultRestPoses;
        const updatedDefaultRestPoses = { ...currentDefaultRestPoses };
        if (objId && !updatedDefaultRestPoses[objId]) {
          updatedDefaultRestPoses[objId] = {};
        } else if (objId) {
          updatedDefaultRestPoses[objId] = { ...currentDefaultRestPoses[objId] };
        }

        let createdCount = 0;
        for (const def of facialBones) {
          // Skip if already exists
          let exists = false;
          scene.traverse((child: any) => {
            if ((child.isBone || child instanceof THREE.Bone) && child.name === def.name) {
              exists = true;
            }
          });
          if (exists) continue;

          const boneObj = new THREE.Bone();
          boneObj.name = def.name;
          boneObj.position.fromArray(def.offset);
          headBone.add(boneObj);

          // Bind into SkinnedMesh skeletons
          scene.traverse((child: any) => {
            if (child.isSkinnedMesh && child.skeleton) {
              const skeleton = child.skeleton;
              if (skeleton.bones.includes(headBone) && !skeleton.bones.includes(boneObj)) {
                const newBones = [...skeleton.bones, boneObj];
                const parentIdx = skeleton.bones.indexOf(headBone);
                const parentInverse = skeleton.boneInverses[parentIdx];
                boneObj.updateMatrix();
                const newInverse = new THREE.Matrix4()
                  .copy(boneObj.matrix)
                  .invert()
                  .multiply(parentInverse);
                const newInverses = [...skeleton.boneInverses, newInverse];
                const newSkeleton = new THREE.Skeleton(newBones, newInverses);
                child.bind(newSkeleton, child.bindMatrix);
              }
            }
          });

          // Add empty tracks
          ['position', 'rotation', 'scale'].forEach((prop) => {
            const hasTrack = newTracks.some(t => t.boneName === def.name && t.property === prop);
            if (!hasTrack) {
              newTracks.push({
                boneName: def.name,
                property: prop as 'position' | 'rotation' | 'scale',
                keyframes: {},
              });
            }
          });

          // Register default rest pose
          if (objId && updatedDefaultRestPoses[objId]) {
            updatedDefaultRestPoses[objId][def.name] = {
              position: [boneObj.position.x, boneObj.position.y, boneObj.position.z] as [number, number, number],
              rotation: [boneObj.quaternion.x, boneObj.quaternion.y, boneObj.quaternion.z, boneObj.quaternion.w] as [number, number, number, number],
              scale: [boneObj.scale.x, boneObj.scale.y, boneObj.scale.z] as [number, number, number],
            };
          }

          createdCount++;
        }

        if (createdCount === 0) return;

        // Rebuild hierarchy
        const buildHierarchy = (object: THREE.Object3D) => {
          const rootBones: THREE.Bone[] = [];
          const getDescendantBones = (obj: THREE.Object3D): THREE.Bone[] => {
            const descendants: THREE.Bone[] = [];
            obj.children.forEach((c: any) => {
              if (c.isBone || c instanceof THREE.Bone) {
                descendants.push(c);
              } else {
                descendants.push(...getDescendantBones(c));
              }
            });
            return descendants;
          };

          object.traverse((child: any) => {
            if (child.isBone || child instanceof THREE.Bone) {
              let isRoot = true;
              let parent = child.parent;
              while (parent) {
                if (parent.isBone || parent instanceof THREE.Bone) {
                  isRoot = false;
                  break;
                }
                parent = parent.parent;
              }
              if (isRoot) rootBones.push(child);
            }
          });

          const buildNode = (bone: THREE.Bone): BoneNode => ({
            id: bone.name || bone.uuid,
            name: bone.name || 'Unnamed Bone',
            children: getDescendantBones(bone).map(buildNode),
          });

          return rootBones.map(buildNode);
        };

        const obj = objId ? get().objects.find((o) => o.id === objId) : null;
        const clipName = obj?.activeAnimation || null;
        bakeTracksToRegistry(objId, clipName, newTracks);

        const newObjects = saveTracksToObjects(get(), newTracks);

        // Mark the target object as having a facial rig
        get().updateObject(targetObjId, { hasFacialRig: true });

        set((state) => ({
          activeSkeleton: buildHierarchy(scene),
          sceneVersion: state.sceneVersion + 1,
          tracks: newTracks,
          animationVersion: state.animationVersion + 1,
          defaultRestPoses: updatedDefaultRestPoses,
          ...syncSceneObjects(state, newObjects),
        }));
        console.log(`[generateFacialRig] Generated ${createdCount} facial rig bones on head bone "${headBone.name}"`);
      },

      removeFacialRig: (targetObjId) => {
        const scene = get().activeClonedScene;
        if (!scene) return;

        // Collect all Face_* bones
        const faceBones: any[] = [];
        scene.traverse((child: any) => {
          if ((child.isBone || child instanceof THREE.Bone) && child.name.startsWith('Face_')) {
            faceBones.push(child);
          }
        });

        if (faceBones.length === 0) return;

        // Remove each Face_* bone from the scene graph and skeleton
        for (const bone of faceBones) {
          const parent = bone.parent;
          if (!parent) continue;

          // Remove children (reparent to parent)
          const children = [...bone.children];
          children.forEach((child: any) => {
            bone.remove(child);
            parent.add(child);
          });

          parent.remove(bone);

          // Remove from skeletons
          scene.traverse((child: any) => {
            if (child.isSkinnedMesh && child.skeleton) {
              const skeleton = child.skeleton;
              const boneIdx = skeleton.bones.indexOf(bone);
              if (boneIdx !== -1) {
                const newBones = skeleton.bones.filter((_: any, i: number) => i !== boneIdx);
                const newInverses = skeleton.boneInverses.filter((_: any, i: number) => i !== boneIdx);

                child.geometry = child.geometry.clone();
                const skinIndexAttr = child.geometry?.attributes?.skinIndex;
                if (skinIndexAttr) {
                  const parentIdx = skeleton.bones.indexOf(parent);
                  for (let i = 0; i < skinIndexAttr.count; i++) {
                    const update = (getter: string, setter: string) => {
                      const val = (skinIndexAttr as any)[getter](i);
                      if (val === boneIdx) {
                        (skinIndexAttr as any)[setter](i, parentIdx >= 0 ? parentIdx : 0);
                      } else if (val > boneIdx) {
                        (skinIndexAttr as any)[setter](i, val - 1);
                      }
                    };
                    update('getX', 'setX');
                    update('getY', 'setY');
                    update('getZ', 'setZ');
                    update('getW', 'setW');
                  }
                  skinIndexAttr.needsUpdate = true;
                }

                const newSkeleton = new THREE.Skeleton(newBones, newInverses);
                child.bind(newSkeleton, child.bindMatrix);
              }
            }
          });
        }

        // Filter out Face_* tracks
        const faceNames = new Set(faceBones.map((b: any) => b.name));
        const currentTracks = get().tracks;
        const newTracks = currentTracks.filter(t => !faceNames.has(t.boneName));

        // Rebuild hierarchy
        const buildHierarchy = (object: THREE.Object3D) => {
          const rootBones: THREE.Bone[] = [];
          const getDescendantBones = (obj: THREE.Object3D): THREE.Bone[] => {
            const descendants: THREE.Bone[] = [];
            obj.children.forEach((c: any) => {
              if (c.isBone || c instanceof THREE.Bone) {
                descendants.push(c);
              } else {
                descendants.push(...getDescendantBones(c));
              }
            });
            return descendants;
          };

          object.traverse((child: any) => {
            if (child.isBone || child instanceof THREE.Bone) {
              let isRoot = true;
              let p = child.parent;
              while (p) {
                if (p.isBone || p instanceof THREE.Bone) {
                  isRoot = false;
                  break;
                }
                p = p.parent;
              }
              if (isRoot) rootBones.push(child);
            }
          });

          const buildNode = (bone: THREE.Bone): BoneNode => ({
            id: bone.name || bone.uuid,
            name: bone.name || 'Unnamed Bone',
            children: getDescendantBones(bone).map(buildNode),
          });

          return rootBones.map(buildNode);
        };

        const objId = get().animationTargetId;
        const obj = objId ? get().objects.find((o) => o.id === objId) : null;
        const clipName = obj?.activeAnimation || null;
        bakeTracksToRegistry(objId, clipName, newTracks);

        const newObjects = saveTracksToObjects(get(), newTracks);

        // Remove Face_* from defaultRestPoses
        const currentDefaultRestPoses = get().defaultRestPoses;
        let updatedDefaultRestPoses = currentDefaultRestPoses;
        if (objId && currentDefaultRestPoses[objId]) {
          const poseObj = { ...currentDefaultRestPoses[objId] };
          faceNames.forEach((name) => delete poseObj[name]);
          updatedDefaultRestPoses = {
            ...currentDefaultRestPoses,
            [objId]: poseObj,
          };
        }

        // Clear hasFacialRig flag
        get().updateObject(targetObjId, { hasFacialRig: false });

        set((state) => ({
          activeSkeleton: buildHierarchy(scene),
          selectedBoneId: null,
          sceneVersion: state.sceneVersion + 1,
          tracks: newTracks,
          animationVersion: state.animationVersion + 1,
          defaultRestPoses: updatedDefaultRestPoses,
          ...syncSceneObjects(state, newObjects),
        }));
        console.log(`[removeFacialRig] Removed ${faceBones.length} facial rig bones`);
      },

      alignFacialRigToMesh: (targetObjId) => {
        const scene = get().activeClonedScene;
        if (!scene) {
          toast.error('Alignment Failed', 'Active scene not loaded.');
          return;
        }

        const targetObj = get().objects.find((o) => o.id === targetObjId);
        if (!targetObj) return;

        // Auto-detect head bone
        let headBone: any = null;
        scene.traverse((child: any) => {
          if ((child.isBone || child instanceof THREE.Bone) && child.name.toLowerCase().includes('head')) {
            if (!headBone) headBone = child;
          }
        });

        if (!headBone) {
          toast.error('Alignment Failed', 'No head bone found in skeleton. Is the character rigged?');
          return;
        }

        // Find the skinned mesh that represents the head/body
        let targetMesh: THREE.SkinnedMesh | null = null;
        scene.traverse((child: any) => {
          if (child.isSkinnedMesh && child.skeleton) {
            if (child.skeleton.bones.includes(headBone)) {
              targetMesh = child;
            }
          }
        });

        if (!targetMesh) {
          // Fallback to any SkinnedMesh in the scene
          scene.traverse((child: any) => {
            if (child.isSkinnedMesh) {
              targetMesh = child;
            }
          });
        }

        if (!targetMesh) {
          toast.error('Alignment Failed', 'No SkinnedMesh found in model.');
          return;
        }

        const mesh = targetMesh as THREE.SkinnedMesh;
        const skeleton = mesh.skeleton;
        const headBoneIndex = skeleton.bones.indexOf(headBone);
        
        const geometry = mesh.geometry;
        const positionAttr = geometry.attributes.position;
        const skinIndexAttr = geometry.attributes.skinIndex;
        const skinWeightAttr = geometry.attributes.skinWeight;

        if (!positionAttr || !skinIndexAttr || !skinWeightAttr || headBoneIndex === -1) {
          toast.error('Alignment Failed', 'Model geometry lacks skinning indices or weights.');
          return;
        }

        // Gather all vertices heavily influenced by the head bone
        const headVertices: THREE.Vector3[] = [];
        const tempVertex = new THREE.Vector3();
        
        // Fast sampling step to support high-poly models without lagging
        const step = positionAttr.count > 10000 ? Math.ceil(positionAttr.count / 2000) : 1;

        for (let i = 0; i < positionAttr.count; i += step) {
          const indices = [
            skinIndexAttr.getX(i),
            skinIndexAttr.getY(i),
            skinIndexAttr.getZ(i),
            skinIndexAttr.getW(i)
          ];
          const weights = [
            skinWeightAttr.getX(i),
            skinWeightAttr.getY(i),
            skinWeightAttr.getZ(i),
            skinWeightAttr.getW(i)
          ];

          let headInfluence = 0;
          for (let j = 0; j < 4; j++) {
            if (indices[j] === headBoneIndex) {
              headInfluence += weights[j];
            }
          }

          if (headInfluence > 0.15) {
            tempVertex.fromBufferAttribute(positionAttr, i);
            // Convert mesh local space vertex to head bone local space
            const worldVertex = tempVertex.clone().applyMatrix4(mesh.matrixWorld);
            const headInv = new THREE.Matrix4().copy(headBone.matrixWorld).invert();
            const localToHead = worldVertex.clone().applyMatrix4(headInv);
            headVertices.push(localToHead);
          }
        }

        if (headVertices.length === 0) {
          toast.error('Alignment Failed', 'Could not locate any vertices bound to the Head joint.');
          return;
        }

        // Calculate bounding box of head vertices in Head local space
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;

        for (const v of headVertices) {
          if (v.x < minX) minX = v.x;
          if (v.x > maxX) maxX = v.x;
          if (v.y < minY) minY = v.y;
          if (v.y > maxY) maxY = v.y;
          if (v.z < minZ) minZ = v.z;
          if (v.z > maxZ) maxZ = v.z;
        }

        const headWidth = maxX - minX;
        const headHeight = maxY - minY;
        const headDepth = maxZ - minZ;
        const headCenter = new THREE.Vector3(
          (minX + maxX) / 2,
          (minY + maxY) / 2,
          (minZ + maxZ) / 2
        );

        // Standard face is on the front side (+Z)
        const zFront = maxZ;

        // Apply alignment positions to the facial bones if they exist in the scene
        const alignmentMap: Record<string, [number, number, number]> = {
          'Face_BrowLeft':        [headCenter.x - headWidth * 0.18, headCenter.y + headHeight * 0.14, zFront - headDepth * 0.05],
          'Face_BrowRight':       [headCenter.x + headWidth * 0.18, headCenter.y + headHeight * 0.14, zFront - headDepth * 0.05],
          'Face_EyeLeft':         [headCenter.x - headWidth * 0.14, headCenter.y + headHeight * 0.04, zFront - headDepth * 0.08],
          'Face_EyeRight':        [headCenter.x + headWidth * 0.14, headCenter.y + headHeight * 0.04, zFront - headDepth * 0.08],
          'Face_CheekLeft':       [headCenter.x - headWidth * 0.22, headCenter.y - headHeight * 0.08, zFront - headDepth * 0.12],
          'Face_CheekRight':      [headCenter.x + headWidth * 0.22, headCenter.y - headHeight * 0.08, zFront - headDepth * 0.12],
          'Face_NoseBridge':      [headCenter.x, headCenter.y + headHeight * 0.02, zFront + headDepth * 0.01],
          'Face_Jaw':            [headCenter.x, headCenter.y - headHeight * 0.32, zFront - headDepth * 0.2],
          'Face_LipUpper':        [headCenter.x, headCenter.y - headHeight * 0.15, zFront - headDepth * 0.02],
          'Face_LipLower':        [headCenter.x, headCenter.y - headHeight * 0.23, zFront - headDepth * 0.02],
          'Face_LipCornerLeft':   [headCenter.x - headWidth * 0.15, headCenter.y - headHeight * 0.19, zFront - headDepth * 0.05],
          'Face_LipCornerRight':  [headCenter.x + headWidth * 0.15, headCenter.y - headHeight * 0.19, zFront - headDepth * 0.05],
          'Face_Chin':           [headCenter.x, headCenter.y - headHeight * 0.42, zFront - headDepth * 0.1],
        };

        let alignedCount = 0;
        headBone.children.forEach((child: any) => {
          if ((child.isBone || child instanceof THREE.Bone) && alignmentMap[child.name]) {
            child.position.fromArray(alignmentMap[child.name]);
            alignedCount++;
          }
        });

        // Re-bake rest poses in store
        const currentDefaultRestPoses = get().defaultRestPoses;
        const updatedDefaultRestPoses = { ...currentDefaultRestPoses };
        if (targetObjId && updatedDefaultRestPoses[targetObjId]) {
          const poses = { ...updatedDefaultRestPoses[targetObjId] };
          headBone.children.forEach((child: any) => {
            if ((child.isBone || child instanceof THREE.Bone) && alignmentMap[child.name]) {
              poses[child.name] = {
                position: [child.position.x, child.position.y, child.position.z] as [number, number, number],
                rotation: [child.quaternion.x, child.quaternion.y, child.quaternion.z, child.quaternion.w] as [number, number, number, number],
                scale: [child.scale.x, child.scale.y, child.scale.z] as [number, number, number],
              };
            }
          });
          updatedDefaultRestPoses[targetObjId] = poses;
        }

        set((state) => ({
          sceneVersion: state.sceneVersion + 1,
          defaultRestPoses: updatedDefaultRestPoses,
        }));

        toast.success('AI Alignment Succeeded', `Projected ${alignedCount} facial bones to character front mesh coordinates.`);
      },

      renameBone: (oldName, newName) => {
        const scene = get().activeClonedScene;
        if (!scene) return;

        let targetBone: any = null;
        scene.traverse((child: any) => {
          if ((child.isBone || child instanceof THREE.Bone) && child.name === oldName) {
            targetBone = child;
          }
        });

        if (!targetBone) return;
        targetBone.name = newName;

        // Rebuild hierarchy
        const buildHierarchy = (object: THREE.Object3D) => {
          const rootBones: THREE.Bone[] = [];
          const getDescendantBones = (obj: THREE.Object3D): THREE.Bone[] => {
            const descendants: THREE.Bone[] = [];
            obj.children.forEach((c: any) => {
              if (c.isBone || c instanceof THREE.Bone) {
                descendants.push(c);
              } else {
                descendants.push(...getDescendantBones(c));
              }
            });
            return descendants;
          };

          object.traverse((child: any) => {
            if (child.isBone || child instanceof THREE.Bone) {
              let isRoot = true;
              let p = child.parent;
              while (p) {
                if (p.isBone || p instanceof THREE.Bone) {
                  isRoot = false;
                  break;
                }
                p = p.parent;
              }
              if (isRoot) rootBones.push(child);
            }
          });

          const buildNode = (bone: THREE.Bone): BoneNode => ({
            id: bone.name || bone.uuid,
            name: bone.name || 'Unnamed Bone',
            children: getDescendantBones(bone).map(buildNode),
          });

          return rootBones.map(buildNode);
        };

        // Map old bone name to new bone name in tracks
        const currentTracks = get().tracks;
        let newTracks = currentTracks.map(t => {
          if (t.boneName === oldName) {
            return {
              ...t,
              boneName: newName,
            };
          }
          return t;
        });

        const objId = get().animationTargetId;
        const currentDefaultRestPoses = get().defaultRestPoses;
        let updatedDefaultRestPoses = { ...currentDefaultRestPoses };
        if (objId && !updatedDefaultRestPoses[objId]) {
          updatedDefaultRestPoses[objId] = {};
        } else if (objId) {
          updatedDefaultRestPoses[objId] = { ...currentDefaultRestPoses[objId] };
        }

        // Rename bone in defaultRestPoses
        if (objId && updatedDefaultRestPoses[objId] && updatedDefaultRestPoses[objId][oldName]) {
          updatedDefaultRestPoses[objId][newName] = updatedDefaultRestPoses[objId][oldName];
          delete updatedDefaultRestPoses[objId][oldName];
        }

        // If it is renamed to a knuckle bone, automatically add 4 socket child bones
        if (isKnuckleBoneName(newName)) {
          const createAndBindBone = (parent: THREE.Bone, name: string, pos: [number, number, number]) => {
            let exists = false;
            scene.traverse((child: any) => {
              if ((child.isBone || child instanceof THREE.Bone) && child.name === name) {
                exists = true;
              }
            });
            if (exists) return null;

            const boneObj = new THREE.Bone();
            boneObj.name = name;
            boneObj.position.fromArray(pos);
            parent.add(boneObj);

            scene.traverse((child: any) => {
              if (child.isSkinnedMesh && child.skeleton) {
                const skeleton = child.skeleton;
                if (skeleton.bones.includes(parent) && !skeleton.bones.includes(boneObj)) {
                  const newBones = [...skeleton.bones, boneObj];
                  const parentIdx = skeleton.bones.indexOf(parent);
                  const parentInverse = skeleton.boneInverses[parentIdx];
                  boneObj.updateMatrix();
                  const newInverse = new THREE.Matrix4()
                    .copy(boneObj.matrix)
                    .invert()
                    .multiply(parentInverse);
                  const newInverses = [...skeleton.boneInverses, newInverse];
                  const newSkeleton = new THREE.Skeleton(newBones, newInverses);
                  child.bind(newSkeleton, child.bindMatrix);
                }
              }
            });

            ['position', 'rotation', 'scale'].forEach((prop) => {
              const hasTrack = newTracks.some(t => t.boneName === name && t.property === prop);
              if (!hasTrack) {
                newTracks.push({
                  boneName: name,
                  property: prop as 'position' | 'rotation' | 'scale',
                  keyframes: {},
                });
              }
            });

            if (objId && updatedDefaultRestPoses[objId]) {
              updatedDefaultRestPoses[objId][name] = {
                position: [boneObj.position.x, boneObj.position.y, boneObj.position.z],
                rotation: [boneObj.quaternion.x, boneObj.quaternion.y, boneObj.quaternion.z, boneObj.quaternion.w],
                scale: [boneObj.scale.x, boneObj.scale.y, boneObj.scale.z],
              };
            }

            return boneObj;
          };

          createAndBindBone(targetBone, `${newName}_IndexSocket`, [-0.03, 0, 0]);
          createAndBindBone(targetBone, `${newName}_MiddleSocket`, [-0.01, 0, 0]);
          createAndBindBone(targetBone, `${newName}_RingSocket`, [0.01, 0, 0]);
          createAndBindBone(targetBone, `${newName}_PinkySocket`, [0.03, 0, 0]);
        }

        const obj = objId ? get().objects.find((o) => o.id === objId) : null;
        const clipName = obj?.activeAnimation || null;
        bakeTracksToRegistry(objId, clipName, newTracks);

        const newObjects = saveTracksToObjects(get(), newTracks);

        set((state) => ({
          activeSkeleton: buildHierarchy(scene),
          selectedBoneId: newName,
          sceneVersion: state.sceneVersion + 1,
          tracks: newTracks,
          animationVersion: state.animationVersion + 1,
          defaultRestPoses: updatedDefaultRestPoses,
          ...syncSceneObjects(state, newObjects),
        }));
      },
      loadClipToTimeline: (objId, clipName) => {
        // 'None' is a sentinel meaning "no animation selected" — not a real clip name
        if (!clipName || clipName === 'None') return;

        const clips = loadedAnimationsRegistry[objId];
        const clip = clips?.find((c) => c.name === clipName);

        const obj = get().objects.find((o) => o.id === objId);
        const customTracks = obj?.customAnimations?.[clipName];

        // If the clip doesn't exist in the runtime registry AND there are no
        // persisted custom tracks, there's nothing to load.
        if (!clip && !customTracks) {
          console.warn(`[Store] Clip not found in registry or customAnimations: ${clipName} for object ${objId}`);
          return;
        }

        if (customTracks) {
          // Bake them back to the Three.js AnimationClip so it is in sync
          // (only if the clip exists in the runtime registry)
          if (clip) {
            bakeTracksToRegistry(objId, clipName, customTracks);
          }

          // Determine max frames from custom tracks keyframes or from clip duration
          let maxFrames = 60;
          if (clip) {
            maxFrames = Math.round(clip.duration * 30) || 60;
          } else {
            // Derive maxFrames from the highest keyframe number in the custom tracks
            let highest = 0;
            customTracks.forEach((t: AnimationTrack) => {
              Object.keys(t.keyframes).forEach((k) => {
                const f = Number(k);
                if (f > highest) highest = f;
              });
            });
            maxFrames = highest > 0 ? highest : 60;
          }

          set({
            tracks: customTracks,
            maxFrames,
            currentFrame: 0,
            animationVersion: get().animationVersion + 1,
          });
          return;
        }

        const parsedTracks: AnimationTrack[] = [];
        clip.tracks.forEach((threeTrack) => {
          const match = threeTrack.name.match(/^(.+)\.(position|quaternion|scale|rotation)$/);
          if (!match) return;

          const boneNameRaw = match[1];
          const rawProp = match[2];
          const boneName = boneNameRaw.includes('/') ? boneNameRaw.split('/').pop()! : boneNameRaw;
          const property = rawProp === 'quaternion' ? 'rotation' : (rawProp as 'position' | 'rotation' | 'scale');

          const keyframes: Record<number, any> = {};
          const valueSize = property === 'rotation' ? 4 : 3;

          for (let i = 0; i < threeTrack.times.length; i++) {
            const time = threeTrack.times[i];
            const frame = Math.round(time * 30);

            const valSlice = [];
            for (let j = 0; j < valueSize; j++) {
              valSlice.push(threeTrack.values[i * valueSize + j]);
            }
            keyframes[frame] = valSlice;
          }

          parsedTracks.push({
            boneName,
            property,
            keyframes,
          });
        });

        const maxFrames = Math.round(clip.duration * 30);

        // Pre-populate empty tracks for finger bones if they exist in the scene graph
        const scene = get().activeClonedScene;
        if (scene) {
          scene.traverse((child: any) => {
            if ((child.isBone || child instanceof THREE.Bone) && /Hand(Thumb|Index|Middle|Ring|Pinky)_\d\d/i.test(child.name)) {
              // Rotation track
              const hasRot = parsedTracks.some(t => t.boneName === child.name && t.property === 'rotation');
              if (!hasRot) {
                parsedTracks.push({
                  boneName: child.name,
                  property: 'rotation',
                  keyframes: {},
                });
              }
              // Position track
              const hasPos = parsedTracks.some(t => t.boneName === child.name && t.property === 'position');
              if (!hasPos) {
                parsedTracks.push({
                  boneName: child.name,
                  property: 'position',
                  keyframes: {},
                });
              }
            }
          });
        }

        set({
          tracks: parsedTracks,
          maxFrames: maxFrames > 0 ? maxFrames : 60,
          currentFrame: 0,
        });
      },
      bakeAnimationToStore: (customClipName?: string) => {
        const state = get();
        const objId = state.animationTargetId;
        if (!objId) return;

        const obj = state.objects.find((o) => o.id === objId);
        const clipName = customClipName || obj?.activeAnimation || null;
        if (!clipName) return;

        bakeTracksToRegistry(objId, clipName, state.tracks);

        const newObjects = saveTracksToObjects(state, state.tracks, clipName);
        set((s) => ({
          ...syncSceneObjects(s, newObjects),
          animationVersion: s.animationVersion + 1,
        }));
      },
      renameAnimation: (objId, oldClipName, newClipName) => {
        if (!newClipName || !newClipName.trim() || oldClipName === newClipName) return;
        const newName = newClipName.trim();

        // 1. Update objects list in store
        const newObjects = get().objects.map((o) => {
          if (o.id === objId) {
            const custom = o.customAnimations || {};
            const updatedCustom = { ...custom };
            if (updatedCustom[oldClipName]) {
              updatedCustom[newName] = updatedCustom[oldClipName];
              delete updatedCustom[oldClipName];
            }

            const available = o.availableAnimations || [];
            const updatedAvailable = available.map(name => name === oldClipName ? newName : name);

            const isActive = o.activeAnimation === oldClipName;

            return {
              ...o,
              activeAnimation: isActive ? newName : o.activeAnimation,
              availableAnimations: updatedAvailable,
              customAnimations: updatedCustom,
            };
          }
          return o;
        });

        // 2. Update modelAnimations
        const currentModelAnims = get().modelAnimations[objId] || [];
        const updatedModelAnims = currentModelAnims.map((name: string) => name === oldClipName ? newName : name);

        // 3. Rename in loadedAnimationsRegistry
        const clips = loadedAnimationsRegistry[objId];
        if (clips) {
          const clip = clips.find(c => c.name === oldClipName);
          if (clip) {
            clip.name = newName;
          }
        }

        set((state) => ({
          ...syncSceneObjects(state, newObjects),
          modelAnimations: {
            ...state.modelAnimations,
            [objId]: updatedModelAnims,
          },
          animationVersion: state.animationVersion + 1,
        }));
      },
      deleteAnimation: (objId, clipName) => {
        let wasActive = false;

        // 1. Update objects list in store
        const newObjects = get().objects.map((o) => {
          if (o.id === objId) {
            const custom = o.customAnimations || {};
            const updatedCustom = { ...custom };
            delete updatedCustom[clipName];

            const available = o.availableAnimations || [];
            const updatedAvailable = available.filter(name => name !== clipName);

            wasActive = o.activeAnimation === clipName;

            return {
              ...o,
              activeAnimation: wasActive ? 'None' : o.activeAnimation,
              availableAnimations: updatedAvailable,
              customAnimations: updatedCustom,
            };
          }
          return o;
        });

        // 2. Update modelAnimations
        const currentModelAnims = get().modelAnimations[objId] || [];
        const updatedModelAnims = currentModelAnims.filter((name: string) => name !== clipName);

        // 3. Remove from loadedAnimationsRegistry
        const clips = loadedAnimationsRegistry[objId];
        if (clips) {
          loadedAnimationsRegistry[objId] = clips.filter(c => c.name !== clipName);
        }

        set((state) => ({
          ...syncSceneObjects(state, newObjects),
          modelAnimations: {
            ...state.modelAnimations,
            [objId]: updatedModelAnims,
          },
          tracks: wasActive ? [] : state.tracks,
          animationVersion: state.animationVersion + 1,
        }));
      },
      copyAnimationToTarget: (sourceObjId, targetObjId, clipName) => {
        const state = get();
        const sourceObj = state.objects.find((o) => o.id === sourceObjId);
        const targetObj = state.objects.find((o) => o.id === targetObjId);
        if (!sourceObj || !targetObj) return;

        // 1. Get the source clip from registry
        const sourceClips = loadedAnimationsRegistry[sourceObjId] || [];
        const sourceClip = sourceClips.find((c) => c.name === clipName);

        // 2. Resolve tracks
        let tracksToCopy: AnimationTrack[] = [];
        if (sourceObj.customAnimations?.[clipName]) {
          tracksToCopy = JSON.parse(JSON.stringify(sourceObj.customAnimations[clipName]));
        } else if (sourceClip) {
          // Convert registry tracks
          tracksToCopy = sourceClip.tracks.map((threeTrack) => {
            const parts = threeTrack.name.split('.');
            const boneName = parts[0];
            const threeProperty = parts[1];
            let property: 'position' | 'rotation' | 'scale' | 'morph' | 'expression';
            let propertySize = 3;

            if (threeProperty === 'quaternion') {
              property = 'rotation';
              propertySize = 4;
            } else if (threeProperty === 'position') {
              property = 'position';
              propertySize = 3;
            } else if (threeProperty === 'scale') {
              property = 'scale';
              propertySize = 3;
            } else {
              property = 'position';
              propertySize = 3;
            }

            const keyframes: Record<number, any> = {};
            for (let i = 0; i < threeTrack.times.length; i++) {
              const frame = Math.round(threeTrack.times[i] * 30);
              const startIndex = i * propertySize;
              const valueSlice = Array.from(threeTrack.values.slice(startIndex, startIndex + propertySize));
              keyframes[frame] = valueSlice;
            }

            return { boneName, property, keyframes };
          });
        }

        if (tracksToCopy.length === 0 && !sourceClip) {
          toast.error('Copy Failed', `Animation clip "${clipName}" not found.`);
          return;
        }

        // 3. Update loadedAnimationsRegistry for target
        if (!loadedAnimationsRegistry[targetObjId]) {
          loadedAnimationsRegistry[targetObjId] = [];
        }

        const targetClips = loadedAnimationsRegistry[targetObjId];
        const existingClipIdx = targetClips.findIndex((c) => c.name === clipName);

        // Clone or create a new Three.js AnimationClip
        let targetClip: THREE.AnimationClip;
        if (sourceClip) {
          targetClip = sourceClip.clone();
        } else {
          targetClip = new THREE.AnimationClip(clipName, -1, []);
        }

        if (existingClipIdx !== -1) {
          targetClips[existingClipIdx] = targetClip;
        } else {
          targetClips.push(targetClip);
        }

        // 4. Update tracks in registry
        bakeTracksToRegistry(targetObjId, clipName, tracksToCopy);

        // 5. Update target object's customAnimations and availableAnimations in state
        const updatedObjects = state.objects.map((o) => {
          if (o.id === targetObjId) {
            const available = o.availableAnimations || [];
            const updatedAvailable = available.includes(clipName) ? available : [...available, clipName];
            const custom = o.customAnimations || {};
            return {
              ...o,
              availableAnimations: updatedAvailable,
              customAnimations: {
                ...custom,
                [clipName]: tracksToCopy,
              },
            };
          }
          return o;
        });

        // 6. Update modelAnimations map in store
        const currentTargetAnims = state.modelAnimations[targetObjId] || [];
        const updatedTargetAnims = currentTargetAnims.includes(clipName)
          ? currentTargetAnims
          : [...currentTargetAnims, clipName];

        set((s) => ({
          ...syncSceneObjects(s, updatedObjects),
          modelAnimations: {
            ...s.modelAnimations,
            [targetObjId]: updatedTargetAnims,
          },
          animationVersion: s.animationVersion + 1,
        }));

        toast.success('Animation Copied', `Successfully copied "${clipName}" to "${targetObj.name}".`);
      },
      cloneActiveAnimation: () => {
        const state = get();
        const objId = state.animationTargetId;
        if (!objId) return null;

        const obj = state.objects.find((o) => o.id === objId);
        if (!obj) return null;

        const activeClipName = obj.activeAnimation;
        if (!activeClipName || activeClipName === 'None') return null;

        // Retrieve raw THREE.AnimationClip from registry
        const clips = loadedAnimationsRegistry[objId] || [];
        const clip = clips.find((c) => c.name === activeClipName);
        if (!clip) return null;

        // Use clone() to copy clip
        const clonedClip = clip.clone();
        const clonedName = `${activeClipName}_EDIT`;
        clonedClip.name = clonedName;

        // Add to loadedAnimationsRegistry
        loadedAnimationsRegistry[objId] = [...clips, clonedClip];

        // Add to availableAnimations and modelAnimations
        const originalAvailable = obj.availableAnimations || [];
        const updatedAvailable = originalAvailable.includes(clonedName)
          ? originalAvailable
          : [...originalAvailable, clonedName];

        const originalModelAnims = state.modelAnimations[objId] || [];
        const updatedModelAnims = originalModelAnims.includes(clonedName)
          ? originalModelAnims
          : [...originalModelAnims, clonedName];

        const updatedObjects = state.objects.map((o) => {
          if (o.id === objId) {
            return {
              ...o,
              availableAnimations: updatedAvailable,
              activeAnimation: clonedName,
            };
          }
          return o;
        });

        // Set the active animation and update availableAnimations
        set((s) => ({
          ...syncSceneObjects(s, updatedObjects),
          modelAnimations: {
            ...s.modelAnimations,
            [objId]: updatedModelAnims,
          },
        }));

        // Now load this clip to the timeline
        get().loadClipToTimeline(objId, clonedName);

        // Bake/save the initial tracks to customAnimations for safety
        get().bakeAnimationToStore(clonedName);

        return clonedName;
      },
      setObjectAnimations: (id, clipNames) => set((state) => ({
        modelAnimations: {
          ...state.modelAnimations,
          [id]: clipNames,
        },
      })),
      togglePlay: () => {
        set((state) => {
          const nextPlaying = !state.isPlaying;
          const newActivePlayerId = nextPlaying 
            ? updateActivePlayerOnHierarchyChange(state.objects, state.activePlayerId)
            : state.activePlayerId;
          return {
            isPlaying: nextPlaying,
            isPaused: nextPlaying ? state.isPaused : false,
            activePlayerId: newActivePlayerId,
            activeScriptId: nextPlaying ? null : state.activeScriptId,
          };
        });
        if (get().isPlaying) {
          get().triggerScriptedEvents('on_level_start');

          // Dynamically import & run robloxLuaEngine for active scripts in simulation
          import('../utils/robloxLuaEngine').then(({ executeRobloxLuaScript }) => {
            const currentObjects = get().objects;
            currentObjects.forEach((obj) => {
              if (obj.type === 'script' && obj.scriptCode) {
                executeRobloxLuaScript(obj.scriptCode);
              }
            });
            const currentAssets = useAssetStore.getState().assets;
            currentAssets.forEach((asset) => {
              if (asset.type === 'script' && asset.content) {
                executeRobloxLuaScript(asset.content);
              }
            });
          });
        }
      },
      stopPlay: () => set({ isPlaying: false, isPaused: false }),
      togglePause: () => set((state) => ({ isPaused: state.isPlaying ? !state.isPaused : false })),
      setPaused: (paused) => set((state) => ({ isPaused: state.isPlaying ? paused : false })),
      gameplaySettings: {
        showCrosshair: true,
        crosshairStyle: 'classic',
        crosshairColor: '#ffffff',
        enableVoxelMining: true,
        enableVoxelPlacing: true,
        miningRange: 8.0,
        placeCooldownMs: 150,
        cameraMode: 'third_person',
        fov: 75,
        pvpDamage: true,
        fallDamage: false,
        respawnTime: 3,
      },
      updateGameplaySettings: (updates) =>
        set((state) => ({
          gameplaySettings: { ...state.gameplaySettings, ...updates },
        })),
      setSelectedIds: (ids) => set({ selectedIds: ids }),
      marqueeSelectedIds: [],
      setMarqueeSelectedIds: (ids) => set({ marqueeSelectedIds: ids }),
      selectObject: (id, multi) =>
        set((state) => {
          let selectedIds = [];
          if (multi && id) {
            if (state.selectedIds.includes(id)) {
              selectedIds = state.selectedIds.filter((v) => v !== id);
            } else {
              selectedIds = [...state.selectedIds, id];
            }
          } else {
            selectedIds = id ? [id] : [];
          }

          const updates: any = { selectedIds, activeFaceTab: 'all' };

          // If in animation mode and selection changes, try to automatically update animationTargetId
          if (state.workspaceMode === 'animation' && selectedIds.length === 1) {
            const selectedId = selectedIds[0];
            const obj = state.objects.find((o) => o.id === selectedId);
            if (obj) {
              let curr = obj;
              const visited = new Set();
              while (curr && !visited.has(curr.id)) {
                visited.add(curr.id);
                if (curr.type === 'gltf' || (curr.type as any) === 'fbx') {
                  updates.animationTargetId = curr.id;
                  break;
                }
                curr = curr.parentId ? state.objects.find((o) => o.id === curr.parentId) : null;
              }
            }
          }
          return updates;
        }),
      updateObject: (id, updates) =>
        set((state) => {
          let exists = state.objects.some((obj) => obj.id === id);
          let newObjects: SceneObject[];
          if (!exists && (id === 'sun-light' || id === 'moon-light')) {
            const defaultObj: SceneObject = {
              id,
              name: id === 'sun-light' ? 'Sun (Directional Light)' : 'Moon (Directional Light)',
              type: id === 'sun-light' ? 'SUN' : 'MOON',
              position: id === 'sun-light' ? [100, 100, 100] : [-100, -100, -100],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
              textureUrl: null,
              parentId: 'lighting',
              ...updates,
            };
            newObjects = [...state.objects, defaultObj];
          } else {
            newObjects = state.objects.map((obj) => (obj.id === id ? { ...obj, ...updates } : obj));
          }
          const isEyelid = id.endsWith('_eyelid_left') || id.endsWith('_eyelid_right');
          if (state.eyelidsSymmetry && isEyelid) {
            const otherId = id.endsWith('_eyelid_left')
              ? id.replace('_eyelid_left', '_eyelid_right')
              : id.replace('_eyelid_right', '_eyelid_left');
            const otherUpdates: any = {};
            if (updates.position) {
              otherUpdates.position = [-updates.position[0], updates.position[1], updates.position[2]];
            }
            if (updates.rotation) {
              otherUpdates.rotation = [updates.rotation[0], -updates.rotation[1], -updates.rotation[2]];
            }
            if (updates.scale) {
              otherUpdates.scale = [...updates.scale];
            }
            if (updates.material) {
              otherUpdates.material = { ...updates.material };
            }
            newObjects = newObjects.map((obj) => (obj.id === otherId ? { ...obj, ...otherUpdates } : obj));
          }
          return syncSceneObjects(state, newObjects);
        }),
      updateObjects: (updatesMap) =>
        set((state) => {
          const newObjects = state.objects.map((obj) => {
            const updates = updatesMap[obj.id];
            return updates ? { ...obj, ...updates } : obj;
          });
          return syncSceneObjects(state, newObjects);
        }),
      addObject: (obj) =>
        set((state) => {
          let preparedObj = obj;
          if (obj.parentId === 'starter_player') {
            preparedObj = {
              ...obj,
              physics: 'dynamic',
              physicsMass: 80,
              physicsCollisions: true,
              walkSpeed: obj.walkSpeed !== undefined ? obj.walkSpeed : 5,
              runSpeed: obj.runSpeed !== undefined ? obj.runSpeed : 10,
              jumpHeight: obj.jumpHeight !== undefined ? obj.jumpHeight : 15,
              characterActions: {
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
                cameraZoomEnabled: true,
                minCameraDistance: 2.0,
                maxCameraDistance: 15.0,
              }
            };
          }
          const newObjects = [...state.objects, preparedObj];
          const newActivePlayerId = updateActivePlayerOnHierarchyChange(newObjects, state.activePlayerId);
          return {
            ...syncSceneObjects(state, newObjects),
            activePlayerId: newActivePlayerId,
          };
        }),
      addObjects: (objs) =>
        set((state) => {
          const newObjects = [...state.objects, ...objs];
          const newActivePlayerId = updateActivePlayerOnHierarchyChange(newObjects, state.activePlayerId);
          return {
            ...syncSceneObjects(state, newObjects),
            activePlayerId: newActivePlayerId,
          };
        }),
      deleteObject: (id) =>
        set((state) => {
          if (id === 'asset_vault') return state;

          const idsToDelete = new Set<string>([id]);
          const findDescendantsToDelete = (parentId: string) => {
            state.objects.forEach((obj) => {
              if (obj.parentId === parentId && !idsToDelete.has(obj.id)) {
                idsToDelete.add(obj.id);
                findDescendantsToDelete(obj.id);
              }
            });
          };
          findDescendantsToDelete(id);

          const newObjects = state.objects.filter((obj) => !idsToDelete.has(obj.id));
          const newActivePlayerId = updateActivePlayerOnHierarchyChange(newObjects, state.activePlayerId);
          return {
            ...syncSceneObjects(state, newObjects),
            selectedIds: state.selectedIds.filter((selected) => !idsToDelete.has(selected)),
            activePlayerId: newActivePlayerId,
          };
        }),
      duplicateObject: (id) =>
        set((state) => {
          const objToCopy = state.objects.find((o) => o.id === id);
          if (!objToCopy) return state;

          const duplicatedObjects: SceneObject[] = [];
          const idMap = new Map<string, string>();

          const duplicateHierarchy = (nodeId: string, newParentId: string | null) => {
            const originalNode = state.objects.find((o) => o.id === nodeId);
            if (!originalNode) return;

            const newId = `obj_${crypto.randomUUID()}`;
            idMap.set(nodeId, newId);

            const duplicatedNode: SceneObject = {
              ...originalNode,
              id: newId,
              parentId: newParentId,
            };

            if (originalNode.position) duplicatedNode.position = [...originalNode.position];
            if (originalNode.rotation) duplicatedNode.rotation = [0, 0, 0];
            if (originalNode.scale) duplicatedNode.scale = [...originalNode.scale];
            if (originalNode.material) duplicatedNode.material = { ...originalNode.material };
            if (originalNode.lightProps) duplicatedNode.lightProps = { ...originalNode.lightProps };
            if (originalNode.celestialProps) duplicatedNode.celestialProps = { ...originalNode.celestialProps };
            if (originalNode.particleProps) duplicatedNode.particleProps = { ...originalNode.particleProps };
            if (originalNode.customRestPose) duplicatedNode.customRestPose = JSON.parse(JSON.stringify(originalNode.customRestPose));
            if (originalNode.vertexWeights) duplicatedNode.vertexWeights = JSON.parse(JSON.stringify(originalNode.vertexWeights));
            if (originalNode.combatStats) duplicatedNode.combatStats = { ...originalNode.combatStats };

            if (nodeId === id) {
              duplicatedNode.position = [originalNode.position[0] + 0.5, originalNode.position[1], originalNode.position[2] + 0.5];
              duplicatedNode.name = `${originalNode.name} (Copy)`;
            }

            duplicatedObjects.push(duplicatedNode);

            const children = state.objects.filter((o) => o.parentId === nodeId);
            children.forEach((child) => duplicateHierarchy(child.id, newId));
          };

          duplicateHierarchy(id, objToCopy.parentId);

          const newObjects = [...state.objects, ...duplicatedObjects];
          return { ...syncSceneObjects(state, newObjects), selectedIds: [idMap.get(id)!] };
        }),
      duplicateAndMirrorObject: (id, axis = 'x') =>
        set((state) => {
          const objToCopy = state.objects.find((o) => o.id === id);
          if (!objToCopy) return state;

          const duplicatedObjects: SceneObject[] = [];
          const idMap = new Map<string, string>();

          const duplicateHierarchy = (nodeId: string, newParentId: string | null) => {
            const originalNode = state.objects.find((o) => o.id === nodeId);
            if (!originalNode) return;

            const newId = `obj_${crypto.randomUUID()}`;
            idMap.set(nodeId, newId);

            const duplicatedNode: SceneObject = {
              ...originalNode,
              id: newId,
              parentId: newParentId,
            };

            if (originalNode.position) duplicatedNode.position = [...originalNode.position];
            if (originalNode.rotation) duplicatedNode.rotation = [...originalNode.rotation];
            if (originalNode.scale) duplicatedNode.scale = [...originalNode.scale];
            if (originalNode.material) duplicatedNode.material = { ...originalNode.material };
            if (originalNode.lightProps) duplicatedNode.lightProps = { ...originalNode.lightProps };
            if (originalNode.celestialProps) duplicatedNode.celestialProps = { ...originalNode.celestialProps };
            if (originalNode.particleProps) duplicatedNode.particleProps = { ...originalNode.particleProps };
            if (originalNode.customRestPose) duplicatedNode.customRestPose = JSON.parse(JSON.stringify(originalNode.customRestPose));
            if (originalNode.vertexWeights) duplicatedNode.vertexWeights = JSON.parse(JSON.stringify(originalNode.vertexWeights));
            if (originalNode.combatStats) duplicatedNode.combatStats = { ...originalNode.combatStats };

            if (nodeId === id) {
              const [px, py, pz] = originalNode.position;
              const [rx, ry, rz] = originalNode.rotation;
              const [sx, sy, sz] = originalNode.scale;

              if (axis === 'x') {
                const mirroredX = px !== 0 ? -px : -1.0;
                duplicatedNode.position = [mirroredX, py, pz];
                duplicatedNode.scale = [-sx, sy, sz];
                duplicatedNode.rotation = [rx, -ry, -rz];
              } else if (axis === 'y') {
                const mirroredY = py !== 0 ? -py : 1.0;
                duplicatedNode.position = [px, mirroredY, pz];
                duplicatedNode.scale = [sx, -sy, sz];
                duplicatedNode.rotation = [-rx, ry, -rz];
              } else {
                const mirroredZ = pz !== 0 ? -pz : -1.0;
                duplicatedNode.position = [px, py, mirroredZ];
                duplicatedNode.scale = [sx, sy, -sz];
                duplicatedNode.rotation = [-rx, -ry, rz];
              }

              duplicatedNode.name = `${originalNode.name} (Mirrored)`;
            }

            duplicatedObjects.push(duplicatedNode);

            const children = state.objects.filter((o) => o.parentId === nodeId);
            children.forEach((child) => duplicateHierarchy(child.id, newId));
          };

          duplicateHierarchy(id, objToCopy.parentId);

          const newObjects = [...state.objects, ...duplicatedObjects];
          toast.success(
            'Object Mirrored',
            `Duplicated & mirrored "${objToCopy.name}" along ${axis.toUpperCase()}-axis`
          );

          return { ...syncSceneObjects(state, newObjects), selectedIds: [idMap.get(id)!] };
        }),
      clonePrefab: (sourceNodeId, targetParentId) =>
        set((state) => {
          const parentId = targetParentId === 'workspace' ? null : targetParentId;
          const clonedObjects: SceneObject[] = [];
          const idMap = new Map<string, string>();
          const nextModelAnimations = { ...state.modelAnimations };

          const cloneHierarchy = (nodeId: string, newParentId: string | null) => {
            const originalNode = state.objects.find((o) => o.id === nodeId);
            if (!originalNode) return;

            const newId = `obj_${crypto.randomUUID()}`;
            idMap.set(nodeId, newId);

            const clonedNode: SceneObject = {
              ...originalNode,
              id: newId,
              parentId: newParentId,
            };

            // Deep-copy properties to prevent mutation of shared structures
            if (originalNode.position) clonedNode.position = [...originalNode.position];
            if (originalNode.rotation) clonedNode.rotation = [...originalNode.rotation];
            if (originalNode.scale) clonedNode.scale = [...originalNode.scale];
            if (originalNode.material) clonedNode.material = { ...originalNode.material };
            if (originalNode.lightProps) clonedNode.lightProps = { ...originalNode.lightProps };
            if (originalNode.celestialProps) clonedNode.celestialProps = { ...originalNode.celestialProps };
            if (originalNode.particleProps) clonedNode.particleProps = { ...originalNode.particleProps };
            if (originalNode.customRestPose) clonedNode.customRestPose = JSON.parse(JSON.stringify(originalNode.customRestPose));
            if (originalNode.vertexWeights) clonedNode.vertexWeights = JSON.parse(JSON.stringify(originalNode.vertexWeights));
            if (originalNode.combatStats) clonedNode.combatStats = { ...originalNode.combatStats };
            if (originalNode.combatController) clonedNode.combatController = { abilities: { ...originalNode.combatController.abilities } };
            if (originalNode.availableMorphs) clonedNode.availableMorphs = [...originalNode.availableMorphs];
            if (originalNode.animationMap) clonedNode.animationMap = { ...originalNode.animationMap };
            if (originalNode.baseLocomotion) clonedNode.baseLocomotion = { ...originalNode.baseLocomotion };
            if (originalNode.animationConfigs) clonedNode.animationConfigs = JSON.parse(JSON.stringify(originalNode.animationConfigs));

            if (loadedAnimationsRegistry[nodeId]) {
              loadedAnimationsRegistry[newId] = loadedAnimationsRegistry[nodeId];
            }

            clonedObjects.push(clonedNode);

            // Recursively clone children
            const children = state.objects.filter((o) => o.parentId === nodeId);
            children.forEach((c) => cloneHierarchy(c.id, newId));
          };

          cloneHierarchy(sourceNodeId, parentId);

          // Copy animation entries in state modelAnimations
          idMap.forEach((newId, oldId) => {
            if (nextModelAnimations[oldId]) {
              nextModelAnimations[newId] = [...nextModelAnimations[oldId]];
            }
          });

          const newObjects = [...state.objects, ...clonedObjects];
          return {
            ...syncSceneObjects(state, newObjects),
            modelAnimations: nextModelAnimations,
          };
        }),
      addPrimitive: (type) => {
        const state = get();
        if (type === 'motor6d') {
          const selected = state.selectedIds;
          const part0Id = selected[0] || undefined;
          const part1Id = selected[1] || undefined;
          const newJointId = `joint_${crypto.randomUUID().substring(0, 8)}`;
          state.addObject({
            id: newJointId,
            name: 'Motor6D Joint',
            type: 'motor6d',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            parentId: part0Id || null,
            motor6dProps: {
              part0Id,
              part1Id,
              c0: [0, 0, 0, 0, 0, 0],
              c1: [0, 0, 0, 0, 0, 0],
              currentAngle: 0,
            },
          });
          toast.success('Motor6D Joint Created', part0Id && part1Id ? 'Connected selected parts!' : 'Created Motor6D joint node');
          return;
        }
        if (type === 'voxel_hotbar') {
          const hotbarId = `hotbar_${crypto.randomUUID().substring(0, 8)}`;
          state.addObject({
            id: hotbarId,
            name: 'Voxel Block Hotbar (HUD)',
            type: 'voxel_hotbar',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            voxelHotbarProps: {
              slotCount: 9,
              activeSlotIndex: 0,
              showKeybinds: true,
              styleVariant: 'minecraft',
              autoHideInEditMode: false,
              enableVoxelMining: true,
              enableVoxelPlacing: true,
              miningRange: 8.0,
              placeCooldownMs: 150,
              items: [
                { id: 'item_1', name: 'Grass Block', geometry: 'box', color: '#44aa44', material: 'Grass' },
                { id: 'item_2', name: 'Dirt Block', geometry: 'box', color: '#885522', material: 'Dirt' },
                { id: 'item_3', name: 'Stone Block', geometry: 'box', color: '#777777', material: 'Slate' },
                { id: 'item_4', name: 'Oak Wood', geometry: 'box', color: '#664422', material: 'Wood' },
                { id: 'item_5', name: 'Leaves Block', geometry: 'box', color: '#227722', material: 'Grass' },
                { id: 'item_6', name: 'Red Brick', geometry: 'box', color: '#aa3322', material: 'Plastic' },
                { id: 'item_7', name: 'Sand Block', geometry: 'box', color: '#ddcc77', material: 'Sand' },
                { id: 'item_8', name: 'Glass Block', geometry: 'box', color: '#88ddee', material: 'Glass' },
                { id: 'item_9', name: 'Voxel Pyramid', geometry: 'pyramid', color: '#cc44bb', material: 'SmoothPlastic' },
              ],
            },
          });
          toast.success('Voxel Hotbar Inserted', 'Added insertable Voxel HUD to scene!');
          return;
        }
        if (type === 'group') {
          state.addObject({
            id: `obj_${crypto.randomUUID()}`,
            name: 'Group',
            type: 'group',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          });
          return;
        }
        if (type === 'light') {
          state.addObject({
            id: `obj_${crypto.randomUUID()}`,
            name: `Point Light`,
            type: 'light',
            position: [0, 2, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            lightProps: { lightType: 'point', color: '#ffddaa', intensity: 3, distance: 10 },
          });
          return;
        }
        if (type === 'wall') {
          state.addObject({
            id: `obj_${crypto.randomUUID()}`,
            name: 'Wall',
            type: 'mesh',
            geometry: 'box',
            position: [0, 4, 0],
            rotation: [0, 0, 0],
            scale: [0.2, 8, 12],
            physics: 'fixed',
            material: { color: '#ffffff', roughness: 0.5, metalness: 0, envMapIntensity: 1 },
          });
          return;
        }
        if (type === 'floor') {
          state.addObject({
            id: `obj_${crypto.randomUUID()}`,
            name: 'Floor',
            type: 'mesh',
            geometry: 'box',
            position: [0, 0, 0],
            rotation: [0, 0, 0],
            scale: [20, 0.2, 20],
            physics: 'fixed',
            material: { color: '#ffffff', roughness: 0.5, metalness: 0, envMapIntensity: 1 },
          });
          return;
        }
        if (type === 'ceiling') {
          state.addObject({
            id: `obj_${crypto.randomUUID()}`,
            name: 'Ceiling',
            type: 'mesh',
            geometry: 'box',
            position: [0, 10, 0],
            rotation: [0, 0, 0],
            scale: [20, 0.2, 20],
            physics: 'fixed',
            material: { color: '#ffffff', roughness: 0.5, metalness: 0, envMapIntensity: 1 },
          });
          return;
        }
        if (type === 'groundPlane') {
          state.addObject({
            id: `obj_${crypto.randomUUID()}`,
            name: 'Ground Plane',
            type: 'mesh',
            geometry: 'plane',
            position: [0, 0, 0],
            rotation: [-Math.PI / 2, 0, 0],
            scale: [100, 100, 1],
            physics: 'fixed',
            material: { color: '#3f3f46', roughness: 0.8, metalness: 0, envMapIntensity: 1 },
          });
          return;
        }
        if (type === 'horizontalFrame') {
          state.addObject({
            id: `obj_${crypto.randomUUID()}`,
            name: 'Horizontal Frame',
            type: 'mesh',
            geometry: 'frame',
            position: [0, 0.1, 0],
            rotation: [-Math.PI / 2, 0, 0],
            scale: [1, 1, 1],
            physics: 'fixed',
            material: { color: '#ffffff', roughness: 0.5, metalness: 0, envMapIntensity: 1 },
          });
          return;
        }
        if (['tornado', 'smoke', 'water', 'sparks', 'fire'].includes(type)) {
          let count = 1200;
          let size = 0.25;
          let opacity = 0.6;
          let color = '#ffffff';
          let speed = 1.5;
          let shape: 'circle' | 'spark' | 'square' | 'realistic' = 'circle';
          let lifetime = 4.0;

          let emitSparks = true;
          let sparksBlendMode: 'additive' | 'normal' = 'additive';
          let sparksEmissionRate = 200;
          let applyPhysics = true;

          if (type === 'fire') { color = '#f97316'; size = 0.38; opacity = 0.75; shape = 'realistic'; lifetime = 4.0; count = 2200; speed = 1.6; }
          else if (type === 'tornado') { color = '#a3a3a3'; size = 0.6; opacity = 0.7; shape = 'realistic'; lifetime = 4.0; count = 1600; speed = 1.8; }
          else if (type === 'smoke') { color = '#a3a3a3'; size = 0.6; opacity = 0.3; shape = 'circle'; lifetime = 4.5; count = 1400; speed = 1.4; }
          else if (type === 'water') { color = '#38bdf8'; size = 0.28; opacity = 0.65; shape = 'circle'; lifetime = 4.0; count = 1600; speed = 1.8; }
          else if (type === 'sparks') { color = '#eab308'; size = 0.16; opacity = 0.95; shape = 'spark'; lifetime = 3.5; count = 1200; speed = 2.0; }

          state.addObject({
            id: `obj_${crypto.randomUUID()}`,
            name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
            type: 'mesh',
            geometry: type,
            position: [0, 1, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            physics: 'fixed',
            physicsCollisions: false,
            isSolid: false,
            material: { color: '#ffffff', roughness: 0.5, metalness: 0, envMapIntensity: 1 },
            particleProps: {
              count, size, opacity, color, speed, shape, lifetime, spread: 1.0,
              emitSparks, sparksBlendMode, sparksEmissionRate, applyPhysics
            }
          });
          return;
        }
        state.addObject({
          id: `obj_${crypto.randomUUID()}`,
          name: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
          type: 'mesh',
          geometry: type,
          position: [0, 1, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          physics: type === 'plane' ? 'fixed' : 'dynamic',
          material: { color: '#ffffff', roughness: 0.5, metalness: 0, envMapIntensity: 1 },
        });
      },
      setParent: (childId, parentId) =>
        set((state) => {
          if (childId === parentId) return state;

          let currentParent = parentId;
          while (currentParent) {
            if (currentParent === childId) return state;
            const parentObj = state.objects.find((o) => o.id === currentParent);
            currentParent = parentObj?.parentId || null;
          }

          const childObj = state.objects.find((o) => o.id === childId);
          if (!childObj) return state;

          // Preserve world position during reparenting
          const childWorldPos = getWorldPositionOfObject(childObj, state.objects);
          let newParentWorldPos: [number, number, number] = [0, 0, 0];
          if (parentId) {
            const newParentObj = state.objects.find((o) => o.id === parentId);
            if (newParentObj) {
              newParentWorldPos = getWorldPositionOfObject(newParentObj, state.objects);
            }
          }
          const newLocalPos: [number, number, number] = [
            childWorldPos[0] - newParentWorldPos[0],
            childWorldPos[1] - newParentWorldPos[1],
            childWorldPos[2] - newParentWorldPos[2],
          ];

          const newObjects = state.objects.map((obj) => {
            if (obj.id === childId) {
              if (parentId === 'starter_player') {
                return {
                  ...obj,
                  parentId,
                  position: newLocalPos,
                  physics: 'dynamic' as const,
                  physicsMass: 80,
                  physicsCollisions: true,
                  physicsColliderType: (obj.physicsColliderType || 'cuboid') as any,
                  walkSpeed: obj.walkSpeed !== undefined ? obj.walkSpeed : 5,
                  runSpeed: obj.runSpeed !== undefined ? obj.runSpeed : 10,
                  jumpHeight: obj.jumpHeight !== undefined ? obj.jumpHeight : 15,
                  characterActions: {
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
                    cameraZoomEnabled: true,
                    minCameraDistance: 2.0,
                    maxCameraDistance: 15.0,
                  }
                };
              } else if (obj.parentId === 'starter_player' && parentId !== 'starter_player') {
                return {
                  ...obj,
                  parentId,
                  position: newLocalPos,
                  physics: undefined,
                  physicsMass: undefined,
                  physicsCollisions: undefined,
                  physicsColliderType: undefined,
                  characterActions: undefined,
                  walkSpeed: undefined,
                  runSpeed: undefined,
                  jumpHeight: undefined,
                };
              }
              return { ...obj, parentId, position: newLocalPos };
            }
            return obj;
          });
          const newActivePlayerId = updateActivePlayerOnHierarchyChange(newObjects, state.activePlayerId);
          return {
            ...syncSceneObjects(state, newObjects),
            activePlayerId: newActivePlayerId,
          };
        }),
      clearScene: () => {
        const state = get();
        const newObjects: SceneObject[] = [];
        const newActivePlayerId = updateActivePlayerOnHierarchyChange(newObjects, null);
        set({
          ...syncSceneObjects(state, newObjects),
          selectedIds: [],
          sceneId: crypto.randomUUID(),
          activePlayerId: newActivePlayerId,
        });
        (useStore as any).temporal.getState().clear();
      },
      startNewScene: () => {
        const newObjects = createDefaultObjects();
        const freshSceneId = `scene_${crypto.randomUUID().substring(0, 8)}`;
        const freshScenes: Record<string, SceneData> = {
          [freshSceneId]: {
            id: freshSceneId,
            name: 'Scene 1',
            objects: newObjects,
          },
        };
        const newActivePlayerId = updateActivePlayerOnHierarchyChange(newObjects, null);
        set((state) => ({
          sceneId: crypto.randomUUID(),
          scenes: freshScenes,
          activeSceneId: freshSceneId,
          objects: newObjects,
          selectedIds: [],
          foliageInstances: [],
          environment: { ...defaultEnvironment },
          sceneHistories: {},
          activePlayerId: newActivePlayerId,
          projectName: 'Untitled Project',
        }));
        (useStore as any).temporal.getState().clear();
      },
      projectName: 'Untitled Project',
      setProjectName: (name: string) => set({ projectName: name }),
      saveProject: () => {
        const state = get();
        const data = JSON.stringify({ scenes: state.scenes, activeSceneId: state.activeSceneId, environment: state.environment }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = state.projectName.replace(/[^a-zA-Z0-9_\- ]/g, '_');
        a.download = `${safeName}.stellar`;
        a.click();
        URL.revokeObjectURL(url);
      },
      saveProjectAs: () => {
        const state = get();
        const newName = prompt('Save project as:', state.projectName);
        if (!newName || newName.trim() === '') return;
        const trimmed = newName.trim();
        set({ projectName: trimmed });
        const data = JSON.stringify({ scenes: state.scenes, activeSceneId: state.activeSceneId, environment: state.environment }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeName = trimmed.replace(/[^a-zA-Z0-9_\- ]/g, '_');
        a.download = `${safeName}.stellar`;
        a.click();
        URL.revokeObjectURL(url);
      },
      loadProject: (jsonStr: string) => {
        try {
          const parsed = JSON.parse(jsonStr);
          // New format: { scenes, activeSceneId, environment }
          if (parsed.scenes && parsed.activeSceneId && parsed.environment) {
            const activeId = parsed.activeSceneId;
            const rebuiltScenes: Record<string, SceneData> = {};
            for (const sId of Object.keys(parsed.scenes)) {
              const sc = parsed.scenes[sId];
              rebuiltScenes[sId] = {
                ...sc,
                objects: rebuildSceneObjects(sc.objects || []),
              };
            }
            const activeScene = rebuiltScenes[activeId];
            if (activeScene) {
              const newActivePlayerId = updateActivePlayerOnHierarchyChange(activeScene.objects, null);
              set({
                scenes: rebuiltScenes,
                activeSceneId: activeId,
                objects: activeScene.objects,
                environment: parsed.environment,
                selectedIds: [],
                sceneId: crypto.randomUUID(),
                sceneHistories: {},
                activePlayerId: newActivePlayerId,
              });
              (useStore as any).temporal.getState().clear();
            } else {
              alert('Invalid project file: active scene not found.');
            }
          }
          // Legacy format: { objects, environment }
          else if (parsed.objects && parsed.environment) {
            const rebuiltObjs = rebuildSceneObjects(parsed.objects);
            const legacySceneId = `scene_${crypto.randomUUID().substring(0, 8)}`;
            const legacyScene: SceneData = {
              id: legacySceneId,
              name: 'Scene 1',
              objects: rebuiltObjs,
            };
            const newActivePlayerId = updateActivePlayerOnHierarchyChange(rebuiltObjs, null);
            set({
              scenes: { [legacySceneId]: legacyScene },
              activeSceneId: legacySceneId,
              objects: rebuiltObjs,
              environment: parsed.environment,
              selectedIds: [],
              sceneId: crypto.randomUUID(),
              sceneHistories: {},
              activePlayerId: newActivePlayerId,
            });
            (useStore as any).temporal.getState().clear();
          } else {
            alert('Invalid project file structure.');
          }
        } catch (e) {
          alert('Failed to parse project file.');
        }
      },
      contextMenu: null,
      openContextMenu: (x, y, type, targetId = null, extra = null) => set({ contextMenu: { x, y, type, targetId, extra } }),
      closeContextMenu: () => set({ contextMenu: null }),
      createScriptForObject: (objectId) => {
        const scriptId = crypto.randomUUID();
        const obj = get().objects.find((o) => o.id === objectId);
        const isModel = obj && (obj.type === 'gltf' || obj.type === 'mesh' || (obj.type as string) === 'fbx');
        
        const defaultContent = isModel
          ? `// Interactive Shader Demo Script for energy/VFX meshes
// Cycles between Option A (PBR warp) and Option B (neon glow) every 5 seconds.

if (!self.userData.shaderDemo) {
  const simplexNoiseGLSL = \`
    vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
    float snoise(vec3 v){ 
      const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
      const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
      vec3 i  = floor(v + dot(v, C.yyy) );
      vec3 x0 =   v - i + dot(i, C.xxx) ;
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min( g.xyz, l.zxy );
      vec3 i2 = max( g.xyz, l.zxy );
      vec3 x1 = x0 - i1 + 1.0 * C.xxx;
      vec3 x2 = x0 - i2 + 2.0 * C.xxx;
      vec3 x3 = x0 - D.yyy;
      i = mod(i, 289.0 ); 
      vec4 p = permute( permute( permute( 
                 i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
               + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
      float n_ = 0.142857142857; // 1.0/7.0
      vec3  ns = n_ * D.wyz - D.xzx;
      vec4 j = p - 49.0 * floor(p * ns.z *ns.z);  //  mod(p,7*7)
      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)
      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);
      vec4 b0 = vec4( x.xy, y.xy );
      vec4 b1 = vec4( x.zw, y.zw );
      vec4 s0 = floor(b0)*2.0 + 1.0;
      vec4 s1 = floor(b1)*2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));
      vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
      vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
      vec3 p0 = vec3(a0.xy,h.x);
      vec3 p1 = vec3(a0.zw,h.y);
      vec3 p2 = vec3(a1.xy,h.z);
      vec3 p3 = vec3(a1.zw,h.w);
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                    dot(p2,x2), dot(p3,x3) ) );
    }
  \`;

  const originalMaterials = new Map();
  const customMaterials = new Map();

  self.traverse((child) => {
    if (child.isMesh && child.material) {
      // 1. Keep original material & prepare Option A (onBeforeCompile)
      const matA = child.material.clone();
      const uniformsA = {
        uTime: { value: 0 },
        uSpeed: { value: 6.0 },
        uStrength: { value: 0.15 }
      };
      
      matA.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = uniformsA.uTime;
        shader.uniforms.uSpeed = uniformsA.uSpeed;
        shader.uniforms.uStrength = uniformsA.uStrength;
        shader.vertexShader = \`
          uniform float uTime;
          uniform float uSpeed;
          uniform float uStrength;
          \${simplexNoiseGLSL}
          \${shader.vertexShader}
        \`;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          \`
            #include <begin_vertex>
            float mask = sin(uv.y * 3.14159);
            float noiseX = snoise(vec3(position.xyz * 3.0 + vec3(0.0, uTime * uSpeed, 0.0)));
            float noiseZ = snoise(vec3(position.xyz * 3.0 + vec3(100.0, uTime * uSpeed, 100.0)));
            transformed.x += noiseX * uStrength * mask;
            transformed.z += noiseZ * uStrength * mask;
          \`
        );
      };
      
      originalMaterials.set(child.uuid, { material: matA, uniforms: uniformsA });
      
      // 2. Prepare Option B (Custom ShaderMaterial)
      const matB = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uSpeed: { value: 5.0 },
          uStrength: { value: 0.2 },
          uColor: { value: new THREE.Color('#38bdf8') }
        },
        vertexShader: \`
          uniform float uTime;
          uniform float uSpeed;
          uniform float uStrength;
          varying vec2 vUv;
          \${simplexNoiseGLSL}
          void main() {
            vUv = uv;
            vec3 pos = position;
            float mask = sin(uv.y * 3.14159);
            float noiseX = snoise(vec3(pos.xy * 2.0, uTime * uSpeed));
            float noiseZ = snoise(vec3(pos.yz * 2.0, uTime * uSpeed));
            pos.x += noiseX * uStrength * mask;
            pos.z += noiseZ * uStrength * mask;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        \`,
        fragmentShader: \`
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            float glow = sin(vUv.x * 3.14159);
            gl_FragColor = vec4(uColor * (glow + 0.5), 1.0);
          }
        \`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      
      customMaterials.set(child.uuid, matB);
    }
  });

  self.userData.shaderDemo = {
    originalMaterials,
    customMaterials,
    lastCycleTime: Date.now(),
    showOptionA: true
  };
  
  console.log("Shader Demo Initialized! Cycles every 5s between Option A (PBR warp) and Option B (neon glow).");
}

const data = self.userData.shaderDemo;

// Cycle every 5 seconds
if (Date.now() - data.lastCycleTime > 5000) {
  data.showOptionA = !data.showOptionA;
  data.lastCycleTime = Date.now();
  console.log("Active Shader Switched to:", data.showOptionA ? "Option A (PBR Warp)" : "Option B (Additive Glow)");
}

const timeSecs = Date.now() * 0.001;

self.traverse((child) => {
  if (child.isMesh) {
    if (data.showOptionA) {
      const entry = data.originalMaterials.get(child.uuid);
      if (entry) {
        child.material = entry.material;
        entry.uniforms.uTime.value = timeSecs;
      }
    } else {
      const matB = data.customMaterials.get(child.uuid);
      if (matB) {
        child.material = matB;
        matB.uniforms.uTime.value = timeSecs;
      }
    }
  }
});`
          : `function update(self, delta) {\n\t// Logic for ${objectId || 'Workspace'}\n}`;

        const newScript = {
          id: scriptId,
          name: 'Script.js',
          type: 'script' as const,
          content: defaultContent,
          category: 'Scripts' as const,
        };

        // 1. Register in Asset Store
        useAssetStore.getState().addAsset(newScript);

        // 2. Link to Object (if applicable)
        if (objectId) {
          set((state) => {
            const newObjects = state.objects.map((obj) =>
              obj.id === objectId
                ? { ...obj, scripts: [...(obj.scripts || []), scriptId] }
                : obj
            );
            return syncSceneObjects(state, newObjects);
          });
        }

        // 3. Open in the new Viewport Tab instantly
        get().openScript(scriptId);
      },
      addScript: (parentFolderId) => {
        const scriptId = `obj_${crypto.randomUUID()}`;
        
        let targetParentId: string | null = null;
        if (parentFolderId !== undefined) {
          targetParentId = parentFolderId;
        } else {
          // Default to the selected hierarchy folder or Workspace
          const state = get();
          const firstSelectedId = state.selectedIds[0];
          if (firstSelectedId) {
            const selectedObj = state.objects.find(o => o.id === firstSelectedId);
            if (selectedObj) {
              if (selectedObj.type === 'group' || selectedObj.id === 'starter_player') {
                targetParentId = selectedObj.id;
              } else {
                targetParentId = selectedObj.parentId || null;
              }
            }
          }
        }

        const newScript: SceneObject = {
          id: scriptId,
          name: 'Script.js',
          type: 'script',
          scriptCode: `function update(self, delta) {\n    console.log("Hello!");\n}`,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          parentId: targetParentId,
        };

        set((state) => {
          const newObjects = [...state.objects, newScript];
          return {
            ...syncSceneObjects(state, newObjects),
            selectedIds: [scriptId],
          };
        });

        // Open in the new Viewport Tab instantly
        get().openScript(scriptId);
      },
      // Script Document Interface
      openScripts: [],
      activeScriptId: null,
      openScript: (id) =>
        set((state) => ({
          openScripts: state.openScripts.includes(id) ? state.openScripts : [...state.openScripts, id],
          activeScriptId: id,
        })),
      closeScript: (id) =>
        set((state) => {
          const remaining = state.openScripts.filter((s) => s !== id);
          const wasActive = state.activeScriptId === id;
          return {
            openScripts: remaining,
            activeScriptId: wasActive ? (remaining[remaining.length - 1] ?? null) : state.activeScriptId,
          };
        }),
      setActiveScript: (id) => set({ activeScriptId: id }),
      renamingId: null,
      setRenamingId: (id) => set({ renamingId: id }),
      renamingAssetId: null,
      setRenamingAssetId: (id) => set({ renamingAssetId: id }),
      groupSelected: () =>
        set((state) => {
          if (state.selectedIds.length <= 1) return state;

          // Create new group
          const groupId = `obj_${Math.random().toString(36).substr(2, 9)}`;
          // Calculate bounding box or simple center
          let cx = 0,
            cy = 0,
            cz = 0;
          const selectedObjects = state.objects.filter((o) => state.selectedIds.includes(o.id));
          selectedObjects.forEach((o) => {
            cx += o.position[0];
            cy += o.position[1];
            cz += o.position[2];
          });
          const len = selectedObjects.length || 1;
          cx /= len;
          cy /= len;
          cz /= len;

          const newGroup: SceneObject = {
            id: groupId,
            name: 'Group ' + groupId.substring(4, 8),
            type: 'group',
            position: [cx, cy, cz],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            parentId: selectedObjects[0]?.parentId || null, // Assign to first selected object's parent
          };

          const mappedObjects = state.objects.map((obj) => {
            if (state.selectedIds.includes(obj.id)) {
              // Adjust child local position relative to group center
              // (Simplification: ignoring complex nested rotations for now)
              return {
                ...obj,
                parentId: groupId,
                position: [obj.position[0] - cx, obj.position[1] - cy, obj.position[2] - cz] as [
                  number,
                  number,
                  number,
                ],
              };
            }
            return obj;
          });

          const newObjects = [...mappedObjects, newGroup];
          const newActivePlayerId = updateActivePlayerOnHierarchyChange(newObjects, state.activePlayerId);
          return {
            ...syncSceneObjects(state, newObjects),
            selectedIds: [groupId],
            activePlayerId: newActivePlayerId,
          };
        }),
      ungroupSelected: () =>
        set((state) => {
          const groupIds = state.selectedIds.filter((id) => {
            const obj = state.objects.find((o) => o.id === id);
            return obj && (obj.type === 'group' || obj.type === 'csg');
          });
          if (groupIds.length === 0) return state;

          let newObjects = [...state.objects];
          let newSelectedIds = state.selectedIds.filter((id) => !groupIds.includes(id));
          const extractedChildrenIds: string[] = [];

          groupIds.forEach((gid) => {
            const gObj = state.objects.find((o) => o.id === gid);
            if (!gObj) return;
            // Get children
            newObjects = newObjects
              .map((obj) => {
                if (obj.parentId === gid) {
                  extractedChildrenIds.push(obj.id);
                  // Convert back to world pos approx
                  return {
                    ...obj,
                    parentId: gObj.parentId,
                    csgMode: undefined,
                    position: [
                      obj.position[0] + gObj.position[0],
                      obj.position[1] + gObj.position[1],
                      obj.position[2] + gObj.position[2],
                    ] as [number, number, number],
                  };
                }
                return obj;
              })
              .filter((o) => o.id !== gid); // Remove the group
          });

          const newActivePlayerId = updateActivePlayerOnHierarchyChange(newObjects, state.activePlayerId);
          return {
            ...syncSceneObjects(state, newObjects),
            selectedIds: [...newSelectedIds, ...extractedChildrenIds],
            activePlayerId: newActivePlayerId,
          };
        }),
      csgOperation: (op) =>
        set((state) => {
          if (state.selectedIds.length <= 1) return state;

          // Create new CSG group
          const csgId = `csg_${Math.random().toString(36).substr(2, 9)}`;
          const selectedObjects = state.selectedIds
            .map((id) => state.objects.find((o) => o.id === id))
            .filter(Boolean) as SceneObject[];

          // Compute average center position (centroid) of all selected objects for CSG group pivot
          const count = selectedObjects.length;
          let sumX = 0, sumY = 0, sumZ = 0;
          selectedObjects.forEach((o) => {
            sumX += o.position[0];
            sumY += o.position[1];
            sumZ += o.position[2];
          });
          const cx = sumX / count;
          const cy = sumY / count;
          const cz = sumZ / count;

          const baseObj = selectedObjects[0];
          const newCsgGroup: SceneObject = {
            id: csgId,
            name: `CSG ${op.charAt(0).toUpperCase() + op.slice(1)}`,
            type: 'csg',
            position: [cx, cy, cz],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            parentId: baseObj.parentId || null,
            material: { ...baseObj.material } as any, // Inherit base material
          };

          const mappedObjects = state.objects.map((obj) => {
            if (state.selectedIds.includes(obj.id)) {
              return {
                ...obj,
                parentId: csgId,
                csgMode: (obj.id === baseObj.id ? 'base' : op) as 'base' | 'addition' | 'subtraction' | 'intersection',
                position: [obj.position[0] - cx, obj.position[1] - cy, obj.position[2] - cz] as [
                  number,
                  number,
                  number,
                ],
              };
            }
            return obj;
          });

          const newObjects = [...mappedObjects, newCsgGroup];
          return {
            ...syncSceneObjects(state, newObjects),
            selectedIds: [csgId],
          };
        }),
      copiedProperties: null,
      copyProperties: (obj) => {
        const { position, rotation, scale, material } = obj;
        set({ copiedProperties: { position, rotation, scale, material } });
      },
      pasteProperties: (targetId) =>
        set((state) => {
          if (!state.copiedProperties) return state;
          const newObjects = state.objects.map((obj) =>
            obj.id === targetId ? { ...obj, ...state.copiedProperties } : obj
          );
          return syncSceneObjects(state, newObjects);
        }),
      copiedObject: null,
      copyObject: (obj) => {
        const family: SceneObject[] = [];
        const gatherChildren = (nodeId: string) => {
          const node = useStore.getState().objects.find((o) => o.id === nodeId);
          if (node) {
            family.push(node);
            const children = useStore.getState().objects.filter((o) => o.parentId === nodeId);
            children.forEach((c) => gatherChildren(c.id));
          }
        };
        gatherChildren(obj.id);
        set({ copiedObject: JSON.parse(JSON.stringify(family)) });
        toast.success('Copied Object', `"${obj.name}" copied to clipboard.`);
      },
      pasteObject: (targetParentId) =>
        set((state) => {
          if (!state.copiedObject) {
            toast.error('Paste Failed', 'Clipboard is empty.');
            return state;
          }

          const family = Array.isArray(state.copiedObject) ? state.copiedObject : [state.copiedObject];
          const rootCopied = family[0];
          if (!rootCopied) return state;

          const isTexture = rootCopied.type === 'texture' || rootCopied.type === 'decal';

          if (isTexture) {
            const targetParent = state.objects.find((o) => o.id === targetParentId);
            if (!targetParent || (targetParent.type !== 'mesh' && targetParent.type !== 'csg')) {
              toast.error('Paste Failed', 'Textures can only be pasted onto Mesh or CSG objects.');
              return state;
            }

            const newId = `obj_${crypto.randomUUID()}`;
            const newObjects = state.objects
              .filter((o) => !(o.parentId === targetParentId && (o.type === 'texture' || o.type === 'decal') && o.targetFace === rootCopied.targetFace))
              .concat({
                ...rootCopied,
                id: newId,
                name: rootCopied.name,
                parentId: targetParentId,
                position: [0, 0, 0],
                rotation: [0, 0, 0],
                scale: [1, 1, 1],
              });

            toast.success('Texture Applied', `Pasted texture onto "${targetParent.name}".`);
            return {
              ...syncSceneObjects(state, newObjects),
              selectedIds: [newId],
            };
          } else {
            const idMap = new Map<string, string>();
            const newIdList: string[] = [];
            const pastedObjects: SceneObject[] = [];

            family.forEach((originalNode, index) => {
              const newId = `obj_${crypto.randomUUID()}`;
              idMap.set(originalNode.id, newId);

              let newParentId: string | null = null;
              if (index === 0) {
                newParentId = targetParentId === 'workspace' ? null : targetParentId;
              } else {
                newParentId = idMap.get(originalNode.parentId!) || null;
              }

              const pastedNode: SceneObject = {
                ...originalNode,
                id: newId,
                parentId: newParentId,
              };

              if (index === 0) {
                pastedNode.name = originalNode.name.endsWith(' (Copy)') ? originalNode.name : `${originalNode.name} (Copy)`;
                pastedNode.position = [originalNode.position[0] + 0.5, originalNode.position[1], originalNode.position[2] + 0.5];
              }

              pastedObjects.push(pastedNode);
              newIdList.push(newId);
            });

            const newObjects = [...state.objects, ...pastedObjects];
            toast.success('Object Pasted', `"${pastedObjects[0].name}" pasted successfully.`);
            return {
              ...syncSceneObjects(state, newObjects),
              selectedIds: [newIdList[0]],
            };
          }
        }),
      copiedFaceTexture: null,
      copyFaceTexture: (textureNode) => {
        const { sourceId, repeatX, repeatY, offsetX, offsetY, textureRotation } = textureNode;
        set({ copiedFaceTexture: { sourceId, repeatX, repeatY, offsetX, offsetY, textureRotation } });
        toast.success('Face texture copied', 'Texture mapping properties copied to clipboard.');
      },
      pasteFaceTexture: (targetParentId, targetFace) =>
        set((state) => {
          if (!state.copiedFaceTexture) {
            toast.error('Paste Failed', 'Clipboard is empty.');
            return state;
          }

          const existingTexture = state.objects.find(
            (o) => o.parentId === targetParentId && (o.type === 'texture' || o.type === 'decal') && o.targetFace === targetFace
          );

          let newObjects = [...state.objects];

          if (existingTexture) {
            newObjects = newObjects.map((obj) =>
              obj.id === existingTexture.id
                ? {
                    ...obj,
                    sourceId: state.copiedFaceTexture!.sourceId,
                    repeatX: state.copiedFaceTexture!.repeatX,
                    repeatY: state.copiedFaceTexture!.repeatY,
                    offsetX: state.copiedFaceTexture!.offsetX,
                    offsetY: state.copiedFaceTexture!.offsetY,
                    textureRotation: state.copiedFaceTexture!.textureRotation,
                  }
                : obj
            );
          } else {
            const newId = `obj_${crypto.randomUUID()}`;
            const faceFormatted = targetFace.charAt(0).toUpperCase() + targetFace.slice(1);
            const newTextureObj: SceneObject = {
              id: newId,
              name: `Texture - ${faceFormatted}`,
              type: 'texture',
              parentId: targetParentId,
              targetFace: targetFace as any,
              sourceId: state.copiedFaceTexture.sourceId,
              repeatX: state.copiedFaceTexture.repeatX,
              repeatY: state.copiedFaceTexture.repeatY,
              offsetX: state.copiedFaceTexture.offsetX,
              offsetY: state.copiedFaceTexture.offsetY,
              textureRotation: state.copiedFaceTexture.textureRotation,
              position: [0, 0, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
            };
            newObjects.push(newTextureObj);
          }

          // Keep parent's faceMaterials in sync for compatibility
          const parentObj = newObjects.find((o) => o.id === targetParentId);
          if (parentObj) {
            const updatedFaceMaterials = {
              ...parentObj.faceMaterials,
              [targetFace]: {
                ...parentObj.faceMaterials?.[targetFace as any],
                map: state.copiedFaceTexture.sourceId,
                repeatX: state.copiedFaceTexture.repeatX,
                repeatY: state.copiedFaceTexture.repeatY,
                offsetX: state.copiedFaceTexture.offsetX,
                offsetY: state.copiedFaceTexture.offsetY,
                textureRotation: state.copiedFaceTexture.textureRotation,
              },
            };
            newObjects = newObjects.map((obj) =>
              obj.id === targetParentId ? { ...obj, faceMaterials: updatedFaceMaterials } : obj
            );
          }

          toast.success('Face texture pasted', `Applied texture mapping properties to ${targetFace}.`);
          return syncSceneObjects(state, newObjects);
        }),
      sidebarVisible: true,
      bottomPanelVisible: true,
      inspectorVisible: true,
      toggleSidebar: () => set((state) => ({ sidebarVisible: !state.sidebarVisible })),
      toggleBottomPanel: () => set((state) => ({ bottomPanelVisible: !state.bottomPanelVisible })),
      toggleInspector: () => set((state) => ({ inspectorVisible: !state.inspectorVisible })),
      panelWidth: 450,
      setPanelWidth: (w) => set({ panelWidth: w }),
      hasHydrated: false,
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
      isPickingAsset: false,
      setIsPickingAsset: (isPicking) => set({ isPickingAsset: isPicking }),
      activePickerTarget: null,
      setActivePickerTarget: (target) => set({ activePickerTarget: target }),
      sceneVersion: 0,
      undo: () => {
        const temporal = (useStore as any).temporal.getState();
        if (temporal.pastStates.length === 0) return;
        temporal.pause();
        temporal.undo();
        // Sync scene objects and bump sceneVersion to trigger viewport re-render.
        // Do NOT deep-clone objects/tracks — temporal.undo() already restored
        // the correct references. Deep-cloning creates new references that
        // zundo's equality check (===) sees as a change, generating phantom
        // history entries on the next tracked update.
        set((state) => ({
          ...syncSceneObjects(state, state.objects),
          sceneVersion: state.sceneVersion + 1,
          animationVersion: state.animationVersion + 1,
        }));
        syncActiveClonedScenePose(get());
        temporal.resume();
      },
      redo: () => {
        const temporal = (useStore as any).temporal.getState();
        if (temporal.futureStates.length === 0) return;
        temporal.pause();
        temporal.redo();
        // Same pattern as undo — sync without deep-cloning.
        set((state) => ({
          ...syncSceneObjects(state, state.objects),
          sceneVersion: state.sceneVersion + 1,
          animationVersion: state.animationVersion + 1,
        }));
        syncActiveClonedScenePose(get());
        temporal.resume();
      },

      // ===== Multi-scene actions =====
      createNewScene: (name) => {
        const state = get();
        const newId = `scene_${crypto.randomUUID().substring(0, 8)}`;
        const sceneCount = Object.keys(state.scenes).length;
        const sceneName = name || `Scene ${sceneCount + 1}`;
        const newSceneObjects = createDefaultObjects();
        const newScene: SceneData = {
          id: newId,
          name: sceneName,
          objects: newSceneObjects,
        };

        // Save current scene's temporal history
        const temporalStore = (useStore as any).temporal.getState();
        const currentHistories = { ...state.sceneHistories };
        currentHistories[state.activeSceneId] = {
          pastStates: [...temporalStore.pastStates],
          futureStates: [...temporalStore.futureStates],
        };

        // Clear temporal and set up the new scene WHILE paused so the
        // initial scene setup is not recorded as an undoable past state.
        temporalStore.pause();
        temporalStore.clear();

        set({
          scenes: { ...state.scenes, [newId]: newScene },
          activeSceneId: newId,
          objects: newSceneObjects,
          selectedIds: [],
          sceneHistories: currentHistories,
          sceneId: crypto.randomUUID(),
          sceneVersion: state.sceneVersion + 1,
          activeScriptId: null,
        });

        temporalStore.resume();
      },

      switchScene: (targetSceneId) => {
        const state = get();
        if (targetSceneId === state.activeSceneId) return;
        const targetScene = state.scenes[targetSceneId];
        if (!targetScene) return;

        const temporalStore = (useStore as any).temporal.getState();

        // 1. Save current scene's temporal history
        const currentHistories = { ...state.sceneHistories };
        currentHistories[state.activeSceneId] = {
          pastStates: [...temporalStore.pastStates],
          futureStates: [...temporalStore.futureStates],
        };

        // 2. Clear temporal
        temporalStore.pause();
        temporalStore.clear();

        // 3. Restore target scene's history (if any)
        const targetHistory = currentHistories[targetSceneId];
        if (targetHistory) {
          (useStore as any).temporal.setState({
            pastStates: targetHistory.pastStates,
            futureStates: targetHistory.futureStates,
          });
        }

        // 4. Switch state WHILE paused so the scene switch itself
        //    is not recorded as a phantom undoable past state.
        const newActivePlayerId = updateActivePlayerOnHierarchyChange(targetScene.objects, null);
        set({
          activeSceneId: targetSceneId,
          objects: targetScene.objects,
          selectedIds: [],
          sceneHistories: currentHistories,
          sceneId: crypto.randomUUID(),
          sceneVersion: state.sceneVersion + 1,
          activeScriptId: null,
          activePlayerId: newActivePlayerId,
        });

        temporalStore.resume();
      },

      renameScene: (sceneId, name) => {
        set((state) => {
          const scene = state.scenes[sceneId];
          if (!scene) return state;
          return {
            scenes: {
              ...state.scenes,
              [sceneId]: { ...scene, name },
            },
          };
        });
      },

      deleteScene: (sceneId) => {
        const state = get();
        const sceneIds = Object.keys(state.scenes);
        if (sceneIds.length <= 1) return; // Can't delete the last scene

        const newScenes = { ...state.scenes };
        delete newScenes[sceneId];

        const newHistories = { ...state.sceneHistories };
        delete newHistories[sceneId];

        // If deleting the active scene, switch to another
        if (sceneId === state.activeSceneId) {
          const remainingIds = Object.keys(newScenes);
          const newActiveId = remainingIds[0];
          const newActiveScene = newScenes[newActiveId];

          const temporalStore = (useStore as any).temporal.getState();
          temporalStore.pause();
          temporalStore.clear();

          // Restore target history if available
          const targetHistory = newHistories[newActiveId];
          if (targetHistory) {
            (useStore as any).temporal.setState({
              pastStates: targetHistory.pastStates,
              futureStates: targetHistory.futureStates,
            });
          }

          // Switch state WHILE paused to avoid phantom history entry
          const newActivePlayerId = updateActivePlayerOnHierarchyChange(newActiveScene.objects, null);
          set({
            scenes: newScenes,
            activeSceneId: newActiveId,
            objects: newActiveScene.objects,
            selectedIds: [],
            sceneHistories: newHistories,
            sceneId: crypto.randomUUID(),
            sceneVersion: state.sceneVersion + 1,
            activePlayerId: newActivePlayerId,
          });

          temporalStore.resume();
        }
      },

      duplicateScene: (sceneId) => {
        const state = get();
        const sourceScene = state.scenes[sceneId];
        if (!sourceScene) return;

        const newId = `scene_${crypto.randomUUID().substring(0, 8)}`;
        const duplicatedObjects = sourceScene.objects.map(obj => ({
          ...obj,
        }));

        const newScene = {
          id: newId,
          name: `${sourceScene.name} (Copy)`,
          objects: duplicatedObjects,
        };

        set({
          scenes: {
            ...state.scenes,
            [newId]: newScene,
          },
        });
      },

      snapSelectedToGround: () => {
        set((state) => {
          if (state.selectedIds.length === 0) return {};

          // Gather all ground/terrain planes in the active scene (excluding Asset Vault templates)
          const terrainObjects = state.objects.filter(
            (o) =>
              o.geometry === 'plane' &&
              (o.id === 'obj_3' || o.name === 'Ground Plane' || o.heightData) &&
              !isDescendantOf(o.id, 'asset_vault', state.objects)
          );

          const newObjects = state.objects.map((obj) => {
            if (!state.selectedIds.includes(obj.id)) return obj;
            // Skip ground planes / terrain objects themselves from snapping
            if (obj.geometry === 'plane') return obj;

            // Get absolute world position of the object
            const [worldX, worldY, worldZ] = getWorldPositionOfObject(obj, state.objects);

            // Calculate bounds relative to position (distance from Y position to bottom bound)
            const bounds = computeObjectBounds(obj);
            const worldBottomY = worldY - bounds.minY;

            let terrainHeight: number | null = null;
            for (const terrain of terrainObjects) {
              const height = getTerrainWorldHeightAt(worldX, worldZ, terrain);
              if (height !== null) {
                if (terrainHeight === null || height > terrainHeight) {
                  terrainHeight = height;
                }
              }
            }

            // Fallback to Y=0 if no terrain covers this coordinate
            const finalTerrainHeight = terrainHeight !== null ? terrainHeight : 0;
            const deltaY = finalTerrainHeight - worldBottomY;

            return {
              ...obj,
              position: [obj.position[0], obj.position[1] + deltaY, obj.position[2]] as [number, number, number],
            };
          });

          return {
            ...syncSceneObjects(state, newObjects),
            sceneVersion: state.sceneVersion + 1,
          };
        });
      },

      generateAiAsset: async (prompt: string, artStyle: 'realistic' | 'stylized') => {
        const key = get().meshyApiKey || 'msy_dummy_api_key_for_test_mode_12345678';
        
        // Create task in task list
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newTask = {
          id: taskId,
          prompt,
          artStyle,
          status: 'PENDING',
          progress: 0,
          url: null,
          created_at: Date.now(),
          stage: 'preview' as const
        };
        
        set((state) => ({
          aiGenerationTasks: [newTask, ...state.aiGenerationTasks]
        }));

        // Check if key is dummy or empty, if so, run mock generation
        if (!key || key.startsWith('msy_dummy_') || key === 'empty') {
          console.log('[Meshy API] Running in MOCK mode due to dummy or empty API key');
          get().startMockTask(taskId);
          return taskId;
        }

        try {
          const response = await fetch('https://api.meshy.ai/openapi/v2/text-to-3d', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${key}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              prompt: `${prompt}, ${artStyle}`,
              mode: 'preview'
            })
          });

          if (!response.ok) {
            throw new Error(`Meshy API responded with status ${response.status}`);
          }

          const data = await response.json();
          const realTaskId = data.result;

          if (!realTaskId) {
            throw new Error('No task_id returned from Meshy API');
          }

          // Update the task mapping with the real task ID
          set((state) => ({
            aiGenerationTasks: state.aiGenerationTasks.map((t) => 
              t.id === taskId ? { ...t, id: realTaskId, status: 'IN_PROGRESS', stage: 'preview' } : t
            )
          }));

          // Start polling
          get().pollAiAssetTask(realTaskId);
          return realTaskId;
        } catch (err: any) {
          console.error('[Meshy API] Error creating task:', err);
          set((state) => ({
            aiGenerationTasks: state.aiGenerationTasks.map((t) => 
              t.id === taskId ? { ...t, status: 'FAILED', errorMsg: err.message } : t
            )
          }));
          return taskId;
        }
      },

      pollAiAssetTask: (taskId: string) => {
        const key = get().meshyApiKey || 'msy_dummy_api_key_for_test_mode_12345678';
        
        const interval = setInterval(async () => {
          try {
            const response = await fetch(`https://api.meshy.ai/openapi/v2/text-to-3d/${taskId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${key}`
              }
            });

            if (!response.ok) {
              throw new Error(`Failed to fetch task status. Status: ${response.status}`);
            }

            const data = await response.json();
            const status = data.status || 'PENDING';
            const progress = data.progress !== undefined ? data.progress : (status === 'SUCCEEDED' ? 100 : 0);
            
            set((state) => ({
              aiGenerationTasks: state.aiGenerationTasks.map((t) => 
                t.id === taskId ? { ...t, status, progress } : t
              )
            }));

            if (status === 'SUCCEEDED') {
              clearInterval(interval);
              
              const currentTask = get().aiGenerationTasks.find((t) => t.id === taskId);
              const isPreview = !currentTask || currentTask.stage === 'preview';

              if (isPreview) {
                // Trigger refinement (texturing)
                try {
                  console.log(`[Meshy API] Preview task succeeded. Starting refine task for: ${taskId}`);
                  set((state) => ({
                    aiGenerationTasks: state.aiGenerationTasks.map((t) =>
                      t.id === taskId ? { ...t, status: 'REFINING', progress: 0 } : t
                    )
                  }));

                  const refineResponse = await fetch('https://api.meshy.ai/openapi/v2/text-to-3d', {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${key}`,
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      mode: 'refine',
                      preview_task_id: taskId
                    })
                  });

                  if (!refineResponse.ok) {
                    throw new Error(`Refine request failed with status ${refineResponse.status}`);
                  }

                  const refineData = await refineResponse.json();
                  const refineTaskId = refineData.result;

                  if (!refineTaskId) {
                    throw new Error('No refine task_id returned from Meshy API');
                  }

                  // Update our task with the refine task ID, IN_PROGRESS state, and 'refine' stage
                  set((state) => ({
                    aiGenerationTasks: state.aiGenerationTasks.map((t) =>
                      t.id === taskId ? { ...t, id: refineTaskId, status: 'IN_PROGRESS', stage: 'refine', progress: 0 } : t
                    )
                  }));

                  // Start polling for the refine task
                  get().pollAiAssetTask(refineTaskId);
                } catch (refineErr: any) {
                  console.error('[Meshy API] Error initiating refine task:', refineErr);
                  set((state) => ({
                    aiGenerationTasks: state.aiGenerationTasks.map((t) =>
                      t.id === taskId ? { ...t, status: 'FAILED', errorMsg: refineErr.message } : t
                    )
                  }));
                }
                return;
              }

              const modelUrl = data.model_urls?.glb || data.result?.model_urls?.glb;
              const thumbnailUrl = data.thumbnail_url || data.preview_url || data.result?.thumbnail_url || data.result?.preview_url;
              
              if (modelUrl) {
                // Update task with final URL
                set((state) => ({
                  aiGenerationTasks: state.aiGenerationTasks.map((t) => 
                    t.id === taskId ? { ...t, url: modelUrl, thumbnailUrl } : t
                  )
                }));

                // Ingest into asset store
                const prompt = get().aiGenerationTasks.find((t) => t.id === taskId)?.prompt || 'AI Asset';
                useAssetStore.getState().addAsset({
                  id: `ai_${taskId}`,
                  name: prompt,
                  type: 'model',
                  url: modelUrl,
                  category: 'Models',
                  thumbnailUrl
                });

                // Trigger cache pre-load
                try {
                  const { useGLTF } = require('@react-three/drei');
                  useGLTF.preload(resolveProxiedUrl(modelUrl));
                } catch (e) {
                  console.warn('[Meshy API] Could not preload GLTF model cache:', e);
                }

                // Instantiate directly in scene at [0, 0.5, 0] or under cursor
                const newObjId = `obj_ai_${taskId}`;
                useStore.getState().addObject({
                  id: newObjId,
                  name: prompt,
                  type: 'gltf',
                  url: modelUrl,
                  position: [0, 0.5, 0],
                  rotation: [0, 0, 0],
                  scale: [1, 1, 1]
                });
                useStore.getState().selectObject(newObjId);
              }
            } else if (status === 'FAILED') {
              clearInterval(interval);
              const errorMsg = data.task_error?.message || 'Meshy API Task Failed';
              set((state) => ({
                aiGenerationTasks: state.aiGenerationTasks.map((t) => 
                  t.id === taskId ? { ...t, status: 'FAILED', errorMsg } : t
                )
              }));
            }
          } catch (err: any) {
            console.error('[Meshy API] Polling error:', err);
          }
        }, 5000);
      },

      startMockTask: (taskId: string) => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 25;
          
          if (progress >= 100) {
            clearInterval(interval);
            
            // Pick one of our existing standard models as a mock model
            const mockModels = [
              { name: 'Wooden Block', url: '/wooden+block+3d+model.glb' },
              { name: 'Pine Tree', url: '/pine+tree+3d+model.glb' },
              { name: 'Wood Log', url: '/wood+log+3d+model.glb' },
              { name: 'Stone Wall', url: '/stone+wall+3d+model.glb' }
            ];
            const randomModel = mockModels[Math.floor(Math.random() * mockModels.length)];
            
            set((state) => ({
              aiGenerationTasks: state.aiGenerationTasks.map((t) => 
                t.id === taskId ? { ...t, status: 'SUCCEEDED', progress: 100, url: randomModel.url } : t
              )
            }));

            // Ingest into asset store
            const prompt = get().aiGenerationTasks.find((t) => t.id === taskId)?.prompt || 'Mock AI Asset';
            useAssetStore.getState().addAsset({
              id: `ai_${taskId}`,
              name: `${prompt} (${randomModel.name})`,
              type: 'model',
              url: randomModel.url,
              category: 'Models'
            });

            // Instantiate in scene
            const newObjId = `obj_ai_${taskId}`;
            useStore.getState().addObject({
              id: newObjId,
              name: `${prompt} (${randomModel.name})`,
              type: 'gltf',
              url: randomModel.url,
              position: [0, 0.5, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1]
            });
            useStore.getState().selectObject(newObjId);
          } else {
            set((state) => ({
              aiGenerationTasks: state.aiGenerationTasks.map((t) => 
                t.id === taskId ? { ...t, status: 'IN_PROGRESS', progress } : t
              )
            }));
          }
        }, 3000);
      },

      rigModelAsset: async (objectId: string) => {
        const state = get();
        const obj = state.objects.find((o) => o.id === objectId);
        if (!obj || !obj.url) {
          toast.error('Rigging Failed', 'Selected object has no model URL.');
          return;
        }

        const key = state.meshyApiKey || 'msy_dummy_api_key_for_test_mode_12345678';
        const taskId = `rig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const newTask = {
          id: taskId,
          prompt: `Rigging: ${obj.name}`,
          artStyle: 'stylized' as any,
          status: 'PENDING',
          progress: 0,
          url: null,
          created_at: Date.now(),
          stage: 'rigging' as any,
          targetObjectId: objectId
        };

        set((state) => ({
          aiGenerationTasks: [newTask, ...state.aiGenerationTasks]
        }));

        if (!key || key.startsWith('msy_dummy_') || key === 'empty') {
          console.log('[Meshy API] Running rigging in MOCK mode');
          get().startMockRiggingTask(taskId, objectId);
          return;
        }

        try {
          const response = await fetch('https://api.meshy.ai/openapi/v1/rigging', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${key}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model_url: obj.url
            })
          });

          if (!response.ok) {
            throw new Error(`Meshy API responded with status ${response.status}`);
          }

          const data = await response.json();
          const realTaskId = data.result;

          if (!realTaskId) {
            throw new Error('No task_id returned from Meshy API');
          }

          set((state) => ({
            aiGenerationTasks: state.aiGenerationTasks.map((t) => 
              t.id === taskId ? { ...t, id: realTaskId, status: 'IN_PROGRESS' } : t
            )
          }));

          get().pollRiggingTask(realTaskId, objectId);
        } catch (err: any) {
          console.error('[Meshy API] Error creating rigging task:', err);
          toast.error('Rigging Failed', err.message);
          set((state) => ({
            aiGenerationTasks: state.aiGenerationTasks.map((t) => 
              t.id === taskId ? { ...t, status: 'FAILED', errorMsg: err.message } : t
            )
          }));
        }
      },

      pollRiggingTask: (taskId: string, objectId: string) => {
        const key = get().meshyApiKey || 'msy_dummy_api_key_for_test_mode_12345678';
        
        const interval = setInterval(async () => {
          try {
            const response = await fetch(`https://api.meshy.ai/openapi/v1/rigging/${taskId}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${key}`
              }
            });

            if (!response.ok) {
              throw new Error(`Failed to fetch rigging status. Status: ${response.status}`);
            }

            const data = await response.json();
            const status = data.status || 'PENDING';
            const progress = data.progress !== undefined ? data.progress : (status === 'SUCCEEDED' ? 100 : 0);
            
            set((state) => ({
              aiGenerationTasks: state.aiGenerationTasks.map((t) => 
                t.id === taskId ? { ...t, status, progress } : t
              )
            }));

            if (status === 'SUCCEEDED') {
              clearInterval(interval);
              
              const riggedModelUrl = data.model_url || data.result?.model_url || data.result?.model_urls?.glb;
              if (riggedModelUrl) {
                set((state) => ({
                  aiGenerationTasks: state.aiGenerationTasks.map((t) => 
                    t.id === taskId ? { ...t, url: riggedModelUrl } : t
                  )
                }));

                const objects = get().objects;
                const obj = objects.find(o => o.id === objectId);
                if (obj) {
                  const matchedAsset = useAssetStore.getState().assets.find(a => a.url === obj.url || a.id === obj.url);
                  if (matchedAsset) {
                    useAssetStore.getState().updateAsset(matchedAsset.id, { url: riggedModelUrl });
                  }
                  
                  get().updateObject(objectId, { url: riggedModelUrl });
                  set({ sceneVersion: get().sceneVersion + 1 });
                  toast.success('Model Rigged!', `Successfully rigged ${obj.name}. Standard skeleton is now available.`);
                }
              }
            } else if (status === 'FAILED') {
              clearInterval(interval);
              const errorMsg = data.task_error?.message || 'Meshy Rigging Failed';
              toast.error('Rigging Failed', errorMsg);
              set((state) => ({
                aiGenerationTasks: state.aiGenerationTasks.map((t) => 
                  t.id === taskId ? { ...t, status: 'FAILED', errorMsg } : t
                )
              }));
            }
          } catch (err: any) {
            console.error('[Meshy API] Rigging polling error:', err);
          }
        }, 5000);
      },

      startMockRiggingTask: (taskId: string, objectId: string) => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += 25;
          
          if (progress >= 100) {
            clearInterval(interval);
            
            const mockRiggedUrl = '/humanoid+robot+3d+model.glb';
            
            set((state) => ({
              aiGenerationTasks: state.aiGenerationTasks.map((t) => 
                t.id === taskId ? { ...t, status: 'SUCCEEDED', progress: 100, url: mockRiggedUrl } : t
              )
            }));

            const obj = get().objects.find(o => o.id === objectId);
            if (obj) {
              const matchedAsset = useAssetStore.getState().assets.find(a => a.url === obj.url || a.id === obj.url);
              if (matchedAsset) {
                useAssetStore.getState().updateAsset(matchedAsset.id, { url: mockRiggedUrl });
              }

              get().updateObject(objectId, { url: mockRiggedUrl });
              set({ sceneVersion: get().sceneVersion + 1 });
              toast.success('Mock Rigging Succeeded!', `Rigged ${obj.name} with standard humanoid skeleton (Mock mode).`);
            }
          } else {
            set((state) => ({
              aiGenerationTasks: state.aiGenerationTasks.map((t) => 
                t.id === taskId ? { ...t, status: 'IN_PROGRESS', progress } : t
              )
            }));
          }
        }, 2000);
      },
    }; },
    {
      partialize: (state) => ({ objects: state.objects, environment: state.environment, tracks: state.tracks }),
      equality: (a, b) => a.objects === b.objects && a.environment === b.environment && a.tracks === b.tracks,
      limit: 15,
    },
  ),
  {
    name: 'stellar-engine-storage',
    storage: createJSONStorage(() => idbWorkspaceEngine),
    partialize: (state) => {
        const {
          activeTool,
          foliageBrushAssetId,
          foliageInstances,
          foliageBrushRadius,
          foliageBrushDensity,
          environment,
          objects,
          scenes,
          activeSceneId,
          selectedIds,
          transformMode,
          pivotMode,
          snapGrid,
          snapValue,
          showGrid,
          showOverlays,
          showPhysicsDebug,
          showEmitters,
          wireframeMode,
          panelWidth,
          sidebarVisible,
          bottomPanelVisible,
          inspectorVisible,
          activePlayerId,
        } = state;
        return {
          activeTool,
          foliageBrushAssetId,
          foliageInstances,
          foliageBrushRadius,
          foliageBrushDensity,
          environment,
          objects: sanitizePayload(objects),
          scenes: sanitizeScenes(scenes),
          activeSceneId,
          selectedIds,
          transformMode,
          pivotMode,
          snapGrid,
          snapValue,
          showGrid,
          showOverlays,
          showPhysicsDebug,
          showEmitters,
          wireframeMode,
          panelWidth,
          sidebarVisible,
          bottomPanelVisible,
          inspectorVisible,
          activePlayerId,
        };
      },
      onRehydrateStorage: () => {
        return (state, error) => {
          if (error) {
            console.error('An error occurred during hydration:', error);
          }
          if (state) {
            const updates: Partial<EngineState> = {};

            // Ensure asset_vault exists in all scenes
            let scenes = state.scenes ? { ...state.scenes } : {};
            let activeSceneId = state.activeSceneId;
            if (scenes) {
              const updatedScenes = { ...scenes };
              for (const sceneId of Object.keys(updatedScenes)) {
                const scene = updatedScenes[sceneId];
                if (scene && scene.objects) {
                  updatedScenes[sceneId] = {
                    ...scene,
                    objects: rebuildSceneObjects(scene.objects),
                  };
                }
              }
              scenes = updatedScenes;
              updates.scenes = updatedScenes;
            }
            let scenesUpdated = false;
            if (scenes) {
              const updatedScenes = { ...scenes };
              for (const sceneId of Object.keys(updatedScenes)) {
                const scene = updatedScenes[sceneId];
                if (scene && scene.objects) {
                  const hasVault = scene.objects.some((o) => o.id === 'asset_vault');
                  if (!hasVault) {
                    const vaultObj: SceneObject = {
                      id: 'asset_vault',
                      name: 'Asset Vault',
                      type: 'group',
                      position: [0, 0, 0],
                      rotation: [0, 0, 0],
                      scale: [1, 1, 1],
                      locked: true,
                    };
                    updatedScenes[sceneId] = {
                      ...scene,
                      objects: [...scene.objects, vaultObj],
                    };
                    scenesUpdated = true;
                  }
                }
              }
              if (scenesUpdated) {
                updates.scenes = updatedScenes;
                scenes = updatedScenes;
              }
            }

            // Migrate old persisted state that has objects but no scenes
            if (!state.scenes || Object.keys(state.scenes).length === 0) {
              const migratedId = `scene_${crypto.randomUUID().substring(0, 8)}`;
              const migratedScene: SceneData = {
                id: migratedId,
                name: 'Scene 1',
                objects: state.objects || [],
              };
              scenes = { [migratedId]: migratedScene };
              activeSceneId = migratedId;
              updates.scenes = scenes;
              updates.activeSceneId = activeSceneId;
            }

            // Clean up old obj_player placeholder from all scenes and flat objects list
            let cleanedAny = false;
            if (scenes) {
              const updatedScenes = { ...scenes };
              for (const sceneId of Object.keys(updatedScenes)) {
                const scene = updatedScenes[sceneId];
                if (scene && scene.objects) {
                  const filtered = scene.objects.filter((o) => o.id !== 'obj_player');
                  if (filtered.length !== scene.objects.length) {
                    updatedScenes[sceneId] = {
                      ...scene,
                      objects: filtered
                    };
                    cleanedAny = true;
                  }
                }
              }
              if (cleanedAny) {
                updates.scenes = updatedScenes;
                scenes = updatedScenes;
              }
            }

            let objects = state.objects ? rebuildSceneObjects(state.objects) : [];
            if (objects.length > 0) {
              const filtered = objects.filter((o) => o.id !== 'obj_player');
              if (filtered.length !== objects.length) {
                objects = filtered;
                updates.objects = objects;
                cleanedAny = true;
              }
            }

            let activePlayerId = state.activePlayerId;
            if (cleanedAny && activePlayerId === 'obj_player') {
              activePlayerId = null;
              updates.activePlayerId = null;
            }

            // Ensure objects is in sync with active scene without dropping autosaved primitives
            const activeScene = scenes[activeSceneId];
            if (activeScene) {
              const rebuiltActiveObjects = rebuildSceneObjects(activeScene.objects || []);
              const rebuiltStateObjects = state.objects ? rebuildSceneObjects(state.objects) : [];

              if (rebuiltStateObjects.length >= rebuiltActiveObjects.length && rebuiltStateObjects.length > 0) {
                const activeObjectsMap = new Map(rebuiltActiveObjects.map((o) => [o.id, o]));
                const mergedObjects = rebuiltStateObjects.map((obj) => activeObjectsMap.get(obj.id) || obj);
                rebuiltActiveObjects.forEach((obj) => {
                  if (!mergedObjects.some((m) => m.id === obj.id)) {
                    mergedObjects.push(obj);
                  }
                });

                scenes[activeSceneId] = {
                  ...activeScene,
                  objects: mergedObjects,
                };
                updates.scenes = scenes;
                updates.objects = mergedObjects;
              } else {
                updates.objects = rebuiltActiveObjects;
              }
            }

            updates.hasHydrated = true;

            // Apply all updates reactively to notify all subscribers after store initialization is complete
            if (storeSet) {
              storeSet(updates);
            } else {
              Object.assign(state, updates);
            }

            // Clear temporal history after hydration so the initial→hydrated
            // state transition doesn't appear as an undoable past state.
            // Use setTimeout to ensure this runs after all synchronous
            // subscribers have processed the hydrated state.
            setTimeout(() => {
              const temporalStore = (useStore as any).temporal?.getState();
              if (temporalStore) {
                temporalStore.clear();
              }
            }, 0);
          }
        };
      },
    }
  ),
);

if (typeof window !== 'undefined') {
  (window as any).useStore = useStore;
  (window as any).loadedAnimationsRegistry = loadedAnimationsRegistry;
}

let lastObjects = useStore.getState().objects;
let lastEnvironment = useStore.getState().environment;
useStore.subscribe((state) => {
  if (state.environment !== lastEnvironment) {
    lastEnvironment = state.environment;
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
      try {
        localStorage.setItem('stellar-engine-environment-autosave', JSON.stringify(state.environment));
      } catch (e) {
        console.error("Failed to autosave environment settings", e);
      }
    }
  }

  if (state.objects !== lastObjects) {
    lastObjects = state.objects;

    if (state.scenes && state.activeSceneId && state.scenes[state.activeSceneId]) {
      const activeSc = state.scenes[state.activeSceneId];
      if (activeSc.objects !== state.objects) {
        state.scenes[state.activeSceneId] = {
          ...activeSc,
          objects: state.objects,
        };
      }
    }

    try {
      if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
        try {
          localStorage.setItem('stellar-engine-autosave', safeSerializeObjectsSync(state.objects));
        } catch {}
      }
      SerializationManager.scheduleAutosave(state.objects, (jsonString) => {
        idbWorkspaceEngine.setItem('stellar-engine-autosave', jsonString);
      });
    } catch (e: any) {
      console.error("Failed to autosave workspace assets", e);
    }
  }
});

export function getSymmetricalBoneName(name: string): string | null {
  // Check prefixes (L_ / R_ / l_ / r_ / L- / R-)
  if (/^[Ll]_/.test(name)) {
    return name.replace(/^L/, 'R').replace(/^l/, 'r');
  }
  if (/^[Rr]_/.test(name)) {
    return name.replace(/^R/, 'L').replace(/^r/, 'l');
  }
  if (/^[Ll]-/.test(name)) {
    return name.replace(/^L/, 'R').replace(/^l/, 'r');
  }
  if (/^[Rr]-/.test(name)) {
    return name.replace(/^R/, 'L').replace(/^r/, 'l');
  }
  
  // Check suffixes (_L / _R / _l / _r / -L / -R / -l / -r)
  if (/[_-][Ll]$/.test(name)) {
    return name.replace(/L$/, 'R').replace(/l$/, 'r');
  }
  if (/[_-][Rr]$/.test(name)) {
    return name.replace(/R$/, 'L').replace(/r$/, 'l');
  }

  // Dot suffixes (.L / .R / .l / .r)
  if (/\.[Ll]$/.test(name)) {
    return name.replace(/L$/, 'R').replace(/l$/, 'r');
  }
  if (/\.[Rr]$/.test(name)) {
    return name.replace(/R$/, 'L').replace(/r$/, 'l');
  }

  // Word matches (case preserved: Left / Right or left / right)
  if (/left/i.test(name)) {
    return name.replace(/left/gi, (match) => {
      const isFirstUpper = match.charAt(0) === 'L';
      const isSecondUpper = match.charAt(1) === 'E';
      if (isFirstUpper) {
        return isSecondUpper ? 'RIGHT' : 'Right';
      }
      return 'right';
    });
  }
  if (/right/i.test(name)) {
    return name.replace(/right/gi, (match) => {
      const isFirstUpper = match.charAt(0) === 'R';
      const isSecondUpper = match.charAt(1) === 'I';
      if (isFirstUpper) {
        return isSecondUpper ? 'LEFT' : 'Left';
      }
      return 'left';
    });
  }

  return null;
}

function updateKeyframeHelper(
  tracks: AnimationTrack[],
  boneName: string,
  property: 'position' | 'rotation' | 'scale',
  frame: number,
  value: any
): AnimationTrack[] {
  let found = false;
  const newTracks = tracks.map((track) => {
    if (track.boneName === boneName && track.property === property) {
      found = true;
      return {
        ...track,
        keyframes: {
          ...track.keyframes,
          [frame]: value,
        },
      };
    }
    return track;
  });

  if (!found) {
    newTracks.push({
      boneName,
      property,
      keyframes: {
        [frame]: value,
      },
    });
  }
  return newTracks;
}

function getInterpolatedValueForFrame(
  keyframes: Record<number, any> | Array<{ frame: number; value: any }>,
  property: 'position' | 'rotation' | 'scale' | 'morph' | 'expression',
  currentFrame: number
) {
  if (!keyframes) return null;

  // Normalize keyframe map: frameNumber -> value
  const frameMap: Record<number, any> = {};
  if (Array.isArray(keyframes)) {
    if (keyframes.length === 0) return null;
    for (const k of keyframes) {
      if (k && typeof k === 'object' && typeof k.frame === 'number') {
        frameMap[k.frame] = k.value;
      }
    }
  } else if (typeof keyframes === 'object') {
    if (Object.keys(keyframes).length === 0) return null;
    Object.assign(frameMap, keyframes);
  } else {
    return null;
  }

  const frames = Object.keys(frameMap)
    .map(Number)
    .sort((a, b) => a - b);

  if (frames.length === 0) return null;

  // Find prevFrame and nextFrame
  let prevFrame = frames[0];
  let nextFrame = frames[frames.length - 1];

  if (currentFrame <= prevFrame) {
    return frameMap[prevFrame];
  }
  if (currentFrame >= nextFrame) {
    return frameMap[nextFrame];
  }

  for (let i = 0; i < frames.length - 1; i++) {
    if (currentFrame >= frames[i] && currentFrame <= frames[i + 1]) {
      prevFrame = frames[i];
      nextFrame = frames[i + 1];
      break;
    }
  }

  if (prevFrame === nextFrame) {
    return frameMap[prevFrame];
  }

  const t = (currentFrame - prevFrame) / (nextFrame - prevFrame);

  if (property === 'rotation') {
    const valP = frameMap[prevFrame];
    const valN = frameMap[nextFrame];
    if (!valP || !valN) return valP || valN || null;
    const qPrev = new THREE.Quaternion().fromArray(valP);
    const qNext = new THREE.Quaternion().fromArray(valN);
    qPrev.slerp(qNext, t);
    return qPrev.toArray() as [number, number, number, number];
  } else if (property === 'morph' || property === 'expression') {
    const valPrev = Number(frameMap[prevFrame] ?? 0);
    const valNext = Number(frameMap[nextFrame] ?? 0);
    return valPrev + (valNext - valPrev) * t;
  } else {
    const valP = frameMap[prevFrame];
    const valN = frameMap[nextFrame];
    if (!valP || !valN) return valP || valN || null;
    const vPrev = new THREE.Vector3().fromArray(valP);
    const vNext = new THREE.Vector3().fromArray(valN);
    vPrev.lerp(vNext, t);
    return vPrev.toArray() as [number, number, number];
  }
}

/**
 * Automatically synchronizes live Three.js bone node transforms in activeClonedScene
 * from the current Zustand state (customRestPose and animated keyframe tracks at currentFrame).
 * Called on undo(), redo(), and state restorations to eliminate desync without manual rebinds.
 */
export function syncActiveClonedScenePose(state: any) {
  const scene = state.activeClonedScene;
  if (!scene) return;

  const objId = state.animationTargetId;
  const targetObj = objId ? state.objects?.find((o: any) => o.id === objId) : null;
  const customRestPose = targetObj?.customRestPose || state.customRestPose || {};
  const currentFrame = state.currentFrame ?? 0;
  const tracks = state.tracks || [];

  scene.traverse((child: any) => {
    if (child.isBone || child instanceof THREE.Bone) {
      const boneName = child.name;
      if (!boneName) return;

      // 1. Check custom rest pose default
      const rest = customRestPose[boneName];
      if (rest) {
        if (rest.position) child.position.set(rest.position[0], rest.position[1], rest.position[2]);
        if (rest.rotation) child.rotation.set(rest.rotation[0], rest.rotation[1], rest.rotation[2]);
        if (rest.scale) child.scale.set(rest.scale[0], rest.scale[1], rest.scale[2]);
      }

      // 2. Evaluate keyframe tracks at currentFrame
      const posTrack = tracks.find((t: any) => (t.boneName === boneName || t.boneId === boneName) && t.property === 'position');
      if (posTrack && posTrack.keyframes) {
        const val = getInterpolatedValueForFrame(posTrack.keyframes, 'position', currentFrame);
        if (val) {
          child.position.set(val[0], val[1], val[2]);
        }
      }

      const rotTrack = tracks.find((t: any) => (t.boneName === boneName || t.boneId === boneName) && t.property === 'rotation');
      if (rotTrack && rotTrack.keyframes) {
        const val = getInterpolatedValueForFrame(rotTrack.keyframes, 'rotation', currentFrame);
        if (val) {
          if (val.length === 4) {
            child.quaternion.set(val[0], val[1], val[2], val[3]);
          } else if (val.length === 3) {
            child.rotation.set(val[0], val[1], val[2]);
          }
        }
      }

      const scaleTrack = tracks.find((t: any) => (t.boneName === boneName || t.boneId === boneName) && t.property === 'scale');
      if (scaleTrack && scaleTrack.keyframes) {
        const val = getInterpolatedValueForFrame(scaleTrack.keyframes, 'scale', currentFrame);
        if (val) {
          child.scale.set(val[0], val[1], val[2]);
        }
      }

      child.updateMatrix();
      child.updateMatrixWorld(true);
    }
  });
}

function getOriginalClipValue(
  objId: string,
  clipName: string | null | undefined,
  boneName: string,
  property: 'position' | 'rotation' | 'scale',
  frame: number,
  defaultPose: any
) {
  if (!clipName || clipName === 'None') {
    return defaultPose?.[boneName]?.[property] || null;
  }

  const clips = loadedAnimationsRegistry[objId];
  const clip = clips?.find((c) => c.name === clipName);
  if (!clip) {
    return defaultPose?.[boneName]?.[property] || null;
  }

  const targetTrackName = `${boneName}.${property === 'rotation' ? 'quaternion' : property}`;
  const track = clip.tracks.find((t) => {
    const name = t.name;
    const cleanName = name.includes('/') ? name.split('/').pop()! : name;
    return cleanName === targetTrackName || cleanName.replace('.rotation', '.quaternion') === targetTrackName;
  });

  if (!track) {
    return defaultPose?.[boneName]?.[property] || null;
  }

  const keyframes: Record<number, any> = {};
  const valueSize = property === 'rotation' ? 4 : 3;
  for (let i = 0; i < track.times.length; i++) {
    const time = track.times[i];
    const f = Math.round(time * 30);
    const valSlice = [];
    for (let j = 0; j < valueSize; j++) {
      valSlice.push(track.values[i * valueSize + j]);
    }
    keyframes[f] = valSlice;
  }

  return getInterpolatedValueForFrame(keyframes, property, frame);
}

if (typeof window !== 'undefined') {
  (window as any).useStore = useStore;

  // Auto-subscribe to state changes to preserve active scene across Vite HMR hot-reloads and code edits
  useStore.subscribe((state) => {
    if (state.objects && state.objects.length > 0) {
      (window as any).__STELLAR_HMR_STATE__ = {
        objects: state.objects,
        scenes: state.scenes,
        activeSceneId: state.activeSceneId,
        environment: state.environment,
      };
      try {
        sessionStorage.setItem('stellar-engine-session-backup', JSON.stringify(state.objects));
        localStorage.setItem('stellar-engine-autosave', JSON.stringify(state.objects));
      } catch (e) {}
    }
  });
}
