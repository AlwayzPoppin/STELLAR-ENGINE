import { create } from 'zustand';
import { temporal } from 'zundo';
import { useAssetStore } from './useAssetStore';

export type SceneObject = {
  id: string;
  name: string;
  type: 'mesh' | 'light' | 'group' | 'gltf' | 'csg';
  geometry?: 'box' | 'sphere' | 'plane' | 'cylinder' | 'cone' | 'wedge' | 'torus' | 'torusKnot' | 'ring' | 'tornado' | 'smoke' | 'water' | 'sparks' | 'fire';
  url?: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  csgMode?: 'base' | 'addition' | 'subtraction' | 'intersection';
  material?: {
    color: string;
    roughness: number;
    metalness: number;
    envMapIntensity: number;
    map?: string;
  };
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
  behavior?: 'none' | 'spin' | 'float' | 'follow';
  physics?: 'dynamic' | 'fixed' | 'none';
  scripts?: string[];
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
  animationPath?: [number, number, number][];
  joints?: JointData[];
};

export interface JointData {
  id: string;
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  parentId: string | null;
}

export type EnvironmentSettings = {
  ambientIntensity: number;
  directionalIntensity: number;
  bloomIntensity: number;
  preset: 'city' | 'sunset' | 'dawn' | 'night' | 'warehouse' | 'forest' | 'apartment' | 'studio' | 'park' | 'lobby';
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
  cloudsType: 'volumetric' | 'flat' | 'cirrus' | 'voxel' | 'nimbus' | 'snow' | 'blizzard';
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
};

export interface FoliageInstanceData {
  id: string;
  assetUrl: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
}

interface EngineState {
  activeTool: 'select' | 'foliage' | 'animation_path' | 'skeleton_rig';
  setActiveTool: (tool: 'select' | 'foliage' | 'animation_path' | 'skeleton_rig') => void;
  foliageBrushAssetId: string | null;
  setFoliageBrushAssetId: (id: string | null) => void;
  foliageInstances: FoliageInstanceData[];
  addFoliageInstance: (instance: FoliageInstanceData) => void;
  clearFoliage: (assetUrl?: string) => void;
  eraseFoliageInRadius: (point: [number, number, number], radius: number, assetUrl?: string | null) => void;
  foliageBrushRadius: number;
  setFoliageBrushRadius: (r: number) => void;
  foliageBrushDensity: number;
  setFoliageBrushDensity: (d: number) => void;
  environment: EnvironmentSettings;
  updateEnvironment: (updates: Partial<EnvironmentSettings>) => void;
  objects: SceneObject[];
  selectedIds: string[];
  transformMode: 'translate' | 'rotate' | 'scale';
  setTransformMode: (mode: 'translate' | 'rotate' | 'scale') => void;
  snapGrid: boolean;
  toggleSnapGrid: () => void;
  snapValue: number;
  setSnapValue: (val: number) => void;
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
  selectObject: (id: string | null, multi?: boolean) => void;
  updateObject: (id: string, updates: Partial<SceneObject>) => void;
  addJoint: (objectId: string, joint: JointData) => void;
  updateJoint: (objectId: string, jointId: string, updates: Partial<JointData>) => void;
  deleteJoint: (objectId: string, jointId: string) => void;
  addObject: (obj: SceneObject) => void;
  deleteObject: (id: string) => void;
  duplicateObject: (id: string) => void;
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
      | 'light'
      | 'group',
  ) => void;
  setParent: (childId: string, parentId: string | null) => void;
  clearScene: () => void;
  saveProject: () => void;
  loadProject: (jsonData: string) => void;
  contextMenu: { x: number; y: number; type: 'hierarchy' | 'viewport' | 'workspace' | 'lighting'; targetId: string | null } | null;
  openContextMenu: (x: number, y: number, type: 'hierarchy' | 'viewport' | 'workspace' | 'lighting', targetId: string | null) => void;
  closeContextMenu: () => void;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  groupSelected: () => void;
  ungroupSelected: () => void;
  csgOperation: (op: 'addition' | 'subtraction' | 'intersection') => void;
  createScriptForObject: (objectId?: string) => void;
  // Script Document Interface
  openScripts: string[];
  activeScriptId: string | null;
  openScript: (id: string) => void;
  closeScript: (id: string) => void;
  setActiveScript: (id: string | null) => void;
  copiedProperties: Partial<SceneObject> | null;
  copyProperties: (obj: SceneObject) => void;
  pasteProperties: (targetId: string) => void;
}

export const useStore = create<EngineState>()(
  temporal(
    (set, get) => ({
      activeTool: 'select',
      setActiveTool: (tool) => set({ activeTool: tool }),
      foliageBrushAssetId: null,
      setFoliageBrushAssetId: (id) => set({ foliageBrushAssetId: id }),
      foliageInstances: [],
      addFoliageInstance: (instance) => set((state) => ({ foliageInstances: [...state.foliageInstances, instance] })),
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
      environment: {
        ambientIntensity: 0.2,
        directionalIntensity: 1.5,
        bloomIntensity: 1.5,
        preset: 'sunset',
        fogEnabled: false,
        fogColor: '#101012',
        fogNear: 5,
        fogFar: 30,
        fogDensity: 0.01,
        exposure: 1,
        timeOfDay: 12,
        cycleDuration: 60,
        cloudsEnabled: true,
        cloudsDensity: 0.5,
        cloudsSpeed: 1.0,
        cloudsType: 'volumetric',
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
      },
      updateEnvironment: (updates) =>
        set((state) => ({
          environment: { ...state.environment, ...updates },
        })),
      objects: [
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
        },
        {
          id: 'obj_player',
          name: 'Test Player',
          type: 'fbx',
          url: '/HUMANOID_TEST_PLAYER/Meshy_AI_HUMANOID_TEST_PLAYER_0513183418_texture_fbx/Meshy_AI_HUMANOID_TEST_PLAYER_0513183418_texture.fbx',
          position: [-2, 1, 0],
          rotation: [0, 0, 0],
          scale: [0.01, 0.01, 0.01],
          physics: 'dynamic',
          physicsMass: 80,
          physicsCollisions: true,
          visible: true,
          parentId: 'starter_player',
        },
        {
          id: 'obj_sun',
          name: 'Physical Sun',
          type: 'gltf',
          url: '/_shining_sun.glb',
          position: [200, 400, 200],
          rotation: [0, 0, 0],
          scale: [10, 10, 10],
          visible: true,
          celestialProps: {
            colorTemperature: 5600,
            diskScale: 1.0,
            volumetricIntensity: 1.0,
            atmosphericContribution: 1.0,
            godRaysEnabled: true,
            rayWeight: 0.6,
            rayDecay: 0.93,
            rayExposure: 0.6,
          },
        },
        {
          id: 'obj_moon',
          name: 'Physical Moon',
          type: 'gltf',
          url: '/shining_moon_.glb',
          position: [-200, -400, -200],
          rotation: [0, 0, 0],
          scale: [10, 10, 10],
          visible: true,
          celestialProps: {
            colorTemperature: 4000,
            diskScale: 0.8,
            volumetricIntensity: 0.5,
            atmosphericContribution: 0.2,
          },
        },
      ],
      selectedIds: [],
      transformMode: 'translate',
      setTransformMode: (mode) => set({ transformMode: mode }),
      snapGrid: false,
      toggleSnapGrid: () => set((state) => ({ snapGrid: !state.snapGrid })),
      snapValue: 1.0,
      setSnapValue: (val) => set({ snapValue: val }),
      showGrid: true,
      toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
      showOverlays: true,
      toggleOverlays: () => set((state) => ({ showOverlays: !state.showOverlays })),
      showPhysicsDebug: false,
      togglePhysicsDebug: () => set((state) => ({ showPhysicsDebug: !state.showPhysicsDebug })),
      showEmitters: true,
      toggleEmitters: () => set((state) => ({ showEmitters: !state.showEmitters })),
      wireframeMode: false,
      toggleWireframeMode: () => set((state) => ({ wireframeMode: !state.wireframeMode })),
      isPlaying: false,
      togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),
      stopPlay: () => set({ isPlaying: false }),
      selectObject: (id, multi) =>
        set((state) => {
          if (multi && id) {
            if (state.selectedIds.includes(id)) {
              return { selectedIds: state.selectedIds.filter((v) => v !== id) };
            }
            return { selectedIds: [...state.selectedIds, id] };
          }
          return { selectedIds: id ? [id] : [] };
        }),
      updateObject: (id, updates) =>
        set((state) => ({
          objects: state.objects.map((obj) => (obj.id === id ? { ...obj, ...updates } : obj)),
        })),
      addJoint: (objectId, joint) =>
        set((state) => ({
          objects: state.objects.map((obj) =>
            obj.id === objectId
              ? { ...obj, joints: [...(obj.joints || []), joint] }
              : obj
          ),
        })),
      updateJoint: (objectId, jointId, updates) =>
        set((state) => ({
          objects: state.objects.map((obj) =>
            obj.id === objectId
              ? {
                  ...obj,
                  joints: (obj.joints || []).map((j) =>
                    j.id === jointId ? { ...j, ...updates } : j
                  ),
                }
              : obj
          ),
        })),
      deleteJoint: (objectId, jointId) =>
        set((state) => ({
          objects: state.objects.map((obj) =>
            obj.id === objectId
              ? {
                  ...obj,
                  joints: (obj.joints || []).filter((j) => j.id !== jointId),
                }
              : obj
          ),
        })),
      addObject: (obj) => set((state) => ({ objects: [...state.objects, obj] })),
      deleteObject: (id) =>
        set((state) => ({
          objects: state.objects
            .filter((obj) => obj.id !== id)
            .map((obj) => (obj.parentId === id ? { ...obj, parentId: null } : obj)),
          selectedIds: state.selectedIds.filter((selected) => selected !== id),
        })),
      duplicateObject: (id) =>
        set((state) => {
          const objToCopy = state.objects.find((o) => o.id === id);
          if (!objToCopy) return state;
          const newObj: SceneObject = {
            ...objToCopy,
            id: `obj_${crypto.randomUUID()}`,
            name: `${objToCopy.name} (Copy)`,
            position: [objToCopy.position[0] + 0.5, objToCopy.position[1], objToCopy.position[2] + 0.5],
            material: { ...objToCopy.material! },
          };
          return { objects: [...state.objects, newObj], selectedIds: [newObj.id] };
        }),
      addPrimitive: (type) => {
        const state = get();
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

          return {
            objects: state.objects.map((obj) => (obj.id === childId ? { ...obj, parentId } : obj)),
          };
        }),
      clearScene: () => set({ objects: [], selectedIds: [] }),
      saveProject: () => {
        const state = get();
        const data = JSON.stringify({ objects: state.objects, environment: state.environment }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'scene.stellar';
        a.click();
        URL.revokeObjectURL(url);
      },
      loadProject: (jsonStr: string) => {
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.objects && parsed.environment) {
            set({ objects: parsed.objects, environment: parsed.environment, selectedIds: [] });
          } else {
            alert('Invalid project file structure.');
          }
        } catch (e) {
          alert('Failed to parse project file.');
        }
      },
      contextMenu: null,
      openContextMenu: (x, y, type, targetId = null) => set({ contextMenu: { x, y, type, targetId } }),
      closeContextMenu: () => set({ contextMenu: null }),
      createScriptForObject: (objectId) => {
        const scriptId = crypto.randomUUID();
        const newScript = {
          id: scriptId,
          name: 'Script.js',
          type: 'script' as const,
          content: `function update(self, delta) {\n\t// Logic for ${objectId || 'Workspace'}\n}`,
        };

        // 1. Register in Asset Store
        useAssetStore.getState().addAsset(newScript);

        // 2. Link to Object (if applicable)
        if (objectId) {
          set((state) => ({
            objects: state.objects.map((obj) =>
              obj.id === objectId
                ? { ...obj, scripts: [...(obj.scripts || []), scriptId] }
                : obj
            ),
          }));
        }

        // 3. Open in the new Viewport Tab instantly
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

          const newObjects = state.objects.map((obj) => {
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

          return {
            objects: [...newObjects, newGroup],
            selectedIds: [groupId],
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

          return {
            objects: newObjects,
            selectedIds: [...newSelectedIds, ...extractedChildrenIds],
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

          // Use first selected object as center/base
          const baseObj = selectedObjects[0];
          const cx = baseObj.position[0];
          const cy = baseObj.position[1];
          const cz = baseObj.position[2];

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

          const newObjects = state.objects.map((obj) => {
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

          return {
            objects: [...newObjects, newCsgGroup],
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
          return {
            objects: state.objects.map((obj) =>
              obj.id === targetId ? { ...obj, ...state.copiedProperties } : obj
            ),
          };
        }),
    }),
    {
      partialize: (state) => ({ objects: state.objects, environment: state.environment }),
    },
  ),
);
