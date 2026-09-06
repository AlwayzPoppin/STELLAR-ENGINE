import { useStore, SceneObject, getWorldPositionOfObject } from '../store/useStore';
import { toast } from '../store/useToastStore';
import { CollisionEventBroker } from '../physics/CollisionEventBroker';
import { getSceneTerrainElevation, calculateEntityTerrainTargetY } from '../physics/TerrainFollowingController';
import * as luaparse from 'luaparse';

// Roblox Material to Stellar Engine Material Mapper
const MATERIAL_MAP: Record<string, { roughness: number; metalness: number }> = {
  SmoothPlastic: { roughness: 0.3, metalness: 0.1 },
  Plastic: { roughness: 0.5, metalness: 0.1 },
  Neon: { roughness: 0.05, metalness: 0.0 },
  Metal: { roughness: 0.2, metalness: 0.9 },
  Slate: { roughness: 0.8, metalness: 0.2 },
  Granite: { roughness: 0.9, metalness: 0.1 },
  Wood: { roughness: 0.7, metalness: 0.0 },
  Glass: { roughness: 0.1, metalness: 0.1 },
};

function resolveGeometryFromClassName(className: string = 'Part'): any {
  const lower = (typeof className === 'string' ? className : 'Part').toLowerCase();
  if (lower.includes('forearm') || lower.includes('limb') || lower.includes('arm') || lower.includes('leg') || lower.includes('calf') || lower.includes('shin')) return 'forearm';
  if (lower.includes('teardrop') || lower.includes('egg')) return 'teardrop';
  if (lower.includes('wing') || lower.includes('fin') || lower.includes('scythe')) return 'wingBlade';
  if (lower.includes('horn') || lower.includes('tusk') || lower.includes('claw')) return 'curvedHorn';
  if (lower.includes('torso') || lower.includes('pelvis') || lower.includes('trapezoid')) return 'taperedTorso';
  if (lower.includes('pyramid')) return 'pyramid';
  if (lower.includes('cone')) return 'cone';
  if (lower.includes('torus')) return 'torus';
  if (lower.includes('cylinder')) return 'cylinder';
  if (lower.includes('wedge')) return 'wedge';
  if (lower.includes('rounded') || lower.includes('beveled')) return 'roundedCube';
  if (lower.includes('sphere') || lower.includes('ball')) return 'sphere';
  return 'box';
}

export interface ExecutionResult {
  success: boolean;
  partsCreated: number;
  containerName?: string;
  error?: string;
}

export function executeRobloxLuaScript(scriptText: string): ExecutionResult {
  try {
    let partsCreatedCount = 0;
    const instancesMap = new Map<string, any>();
    const createdObjectsList: SceneObject[] = [];

    // 1. Color3 Helper
    const Color3 = {
      fromHex: (hex: string) => {
        if (!hex) return '#ffffff';
        let cleanHex = String(hex).trim();
        if (cleanHex === 'undefined' || cleanHex === 'null' || cleanHex === '') return '#ffffff';
        if (!cleanHex.startsWith('#')) cleanHex = '#' + cleanHex;
        if (cleanHex.includes('undefined') || cleanHex.includes('null')) return '#ffffff';
        return cleanHex;
      },
      fromRGB: (r: number = 255, g: number = 255, b: number = 255) => {
        const toHex = (n: number) => {
          const num = Number(n);
          const safeNum = isNaN(num) ? 255 : Math.min(255, Math.max(0, Math.round(num)));
          return safeNum.toString(16).padStart(2, '0');
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      },
      new: (r?: number | string, g?: number, b?: number) => {
        if (typeof r === 'string') return Color3.fromHex(r);
        const safeR = r === undefined ? 1 : Number(r) || 0;
        const safeG = g === undefined ? 1 : Number(g) || 0;
        const safeB = b === undefined ? 1 : Number(b) || 0;
        return Color3.fromRGB(safeR * 255, safeG * 255, safeB * 255);
      },
    };

    const BRICK_COLOR_MAP: Record<string, string> = {
      'Bright red': '#c4281c',
      'Bright blue': '#0d69ac',
      'Bright green': '#287f47',
      'Bright yellow': '#f5cd30',
      'Dark stone grey': '#635f62',
      'Medium stone grey': '#a1a5a2',
      'Light stone grey': '#e5e4df',
      'Black': '#1b2a35',
      'White': '#f8f8f8',
      'Really red': '#ff0000',
      'Really blue': '#0000ff',
      'Really black': '#111111',
    };

    const BrickColor = {
      new: (val: any) => {
        if (typeof val === 'string') {
          const mapped = BRICK_COLOR_MAP[val] || Color3.fromHex(val);
          return { Color: mapped, hex: mapped, Name: val };
        }
        return { Color: '#ffffff', hex: '#ffffff', Name: 'White' };
      },
      random: () => {
        const col = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
        return { Color: col, hex: col, Name: 'Random' };
      },
      Red: () => ({ Color: '#ff0000', hex: '#ff0000', Name: 'Red' }),
      Blue: () => ({ Color: '#0000ff', hex: '#0000ff', Name: 'Blue' }),
      Green: () => ({ Color: '#00ff00', hex: '#00ff00', Name: 'Green' }),
      Yellow: () => ({ Color: '#ffff00', hex: '#ffff00', Name: 'Yellow' }),
      Black: () => ({ Color: '#111111', hex: '#111111', Name: 'Black' }),
      White: () => ({ Color: '#ffffff', hex: '#ffffff', Name: 'White' }),
    };

    // 2. Vector3 Helper
    class Vector3Obj {
      x: number;
      y: number;
      z: number;
      X: number;
      Y: number;
      Z: number;
      constructor(x: number = 0, y: number = 0, z: number = 0) {
        this.x = Number(x) || 0;
        this.y = Number(y) || 0;
        this.z = Number(z) || 0;
        this.X = this.x;
        this.Y = this.y;
        this.Z = this.z;
      }
    }

    const Vector3 = {
      new: (x: number = 0, y: number = 0, z: number = 0) => new Vector3Obj(x, y, z),
      zero: new Vector3Obj(0, 0, 0),
      one: new Vector3Obj(1, 1, 1),
    };

    // 3. CFrame Helper
    class CFrameObj {
      position: Vector3Obj;
      constructor(x: number = 0, y: number = 0, z: number = 0) {
        this.position = new Vector3Obj(x, y, z);
      }
    }

    const CFrame = {
      new: (x: number = 0, y: number = 0, z: number = 0) => new CFrameObj(x, y, z),
    };

    // 4. Enum Helper
    const Enum = {
      Material: {
        SmoothPlastic: 'SmoothPlastic',
        Plastic: 'Plastic',
        Neon: 'Neon',
        Metal: 'Metal',
        Slate: 'Slate',
        Granite: 'Granite',
        Wood: 'Wood',
        Glass: 'Glass',
      },
      PartType: {
        Block: 'box',
        Box: 'box',
        Ball: 'sphere',
        Sphere: 'sphere',
        Cylinder: 'cylinder',
        Wedge: 'wedge',
        CornerWedge: 'wedge',
        Pyramid: 'pyramid',
        Cone: 'cone',
        Torus: 'torus',
        RoundedBlock: 'roundedCube',
        RoundedCube: 'roundedCube',
        Teardrop: 'teardrop',
        Egg: 'teardrop',
        WingBlade: 'wingBlade',
        Wing: 'wingBlade',
        Fin: 'wingBlade',
        CurvedHorn: 'curvedHorn',
        Horn: 'curvedHorn',
        Tusk: 'curvedHorn',
        Claw: 'curvedHorn',
        TaperedTorso: 'taperedTorso',
        Torso: 'taperedTorso',
        Pelvis: 'taperedTorso',
        Trapezoid: 'taperedTorso',
      },
      SurfaceType: {
        Smooth: 'Smooth',
        Studs: 'Studs',
      },
    };

    // 5. Instance Proxy Factory
    function createInstanceProxy(className: string = 'Part'): any {
      const cls = className || 'Part';
      const id = `roblox_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const isRounded = cls.toLowerCase().includes('rounded') || cls.toLowerCase().includes('beveled');

      if (className === 'Motor6D' || className === 'Weld' || className === 'ManualWeld') {
        const motorData = {
          id: `motor6d_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name: className,
          part0: null as any,
          part1: null as any,
          c0: [0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number],
          c1: [0, 0, 0, 0, 0, 0] as [number, number, number, number, number, number],
          currentAngle: 0,
          parent: null as any,
        };

        const motorProxy: any = {
          get id() { return motorData.id; },
          get Name() { return motorData.name; },
          set Name(val: string) { motorData.name = val; },
          get Part0() { return motorData.part0; },
          set Part0(val: any) {
            motorData.part0 = val;
            syncMotor6DJoint();
          },
          get Part1() { return motorData.part1; },
          set Part1(val: any) {
            motorData.part1 = val;
            syncMotor6DJoint();
          },
          get C0() { return new CFrameObj(motorData.c0[0], motorData.c0[1], motorData.c0[2]); },
          set C0(val: any) {
            if (val && val.position) {
              motorData.c0[0] = val.position.x || 0;
              motorData.c0[1] = val.position.y || 0;
              motorData.c0[2] = val.position.z || 0;
            }
            syncMotor6DJoint();
          },
          get C1() { return new CFrameObj(motorData.c1[0], motorData.c1[1], motorData.c1[2]); },
          set C1(val: any) {
            if (val && val.position) {
              motorData.c1[0] = val.position.x || 0;
              motorData.c1[1] = val.position.y || 0;
              motorData.c1[2] = val.position.z || 0;
            }
            syncMotor6DJoint();
          },
          get CurrentAngle() { return motorData.currentAngle; },
          set CurrentAngle(val: number) { motorData.currentAngle = Number(val) || 0; syncMotor6DJoint(); },
          get Parent() { return motorData.parent; },
          set Parent(parentProxy: any) {
            motorData.parent = parentProxy;
            syncMotor6DJoint();
          },
          IsA: (typeStr: string) => typeStr === className || typeStr === 'JointInstance' || typeStr === 'Motor6D',
          Destroy: () => {},
        };

        function syncMotor6DJoint() {
          const part0Id = motorData.part0?.id;
          const part1Id = motorData.part1?.id;
          if (part0Id && part1Id) {
            const existingIdx = createdObjectsList.findIndex((o) => o.id === motorData.id);
            const jointObj: SceneObject = {
              id: motorData.id,
              name: motorData.name,
              type: 'motor6d',
              position: [motorData.c0[0], motorData.c0[1], motorData.c0[2]],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
              parentId: motorData.parent?.id !== 'workspace_root' ? motorData.parent?.id : part0Id,
              motor6dProps: {
                part0Id,
                part1Id,
                c0: motorData.c0,
                c1: motorData.c1,
                currentAngle: motorData.currentAngle,
              },
            };

            if (existingIdx >= 0) {
              createdObjectsList[existingIdx] = jointObj;
            } else {
              createdObjectsList.push(jointObj);
            }

            const part1Obj = createdObjectsList.find((o) => o.id === part1Id);
            if (part1Obj && !part1Obj.parentId) {
              part1Obj.parentId = part0Id;
            }
          }
        }

        instancesMap.set(motorData.id, motorProxy);
        return motorProxy;
      }

      const instanceData = {
        id,
        className,
        name: className === 'Model' ? 'New Model' : 'Part',
        geometry: resolveGeometryFromClassName(className),
        bevelRadius: isRounded ? 0.15 : 0,
        bevelSegments: 8,
        position: [0, 0, 0] as [number, number, number],
        scale: [1, 1, 1] as [number, number, number],
        color: '#ffffff',
        material: 'SmoothPlastic',
        anchored: true,
        canCollide: true,
        transparency: 0,
        parent: null as any,
        children: [] as any[],
        isPushedToStore: false,
      };

      const proxy: any = {
        get id() { return instanceData.id; },
        get Name() { return instanceData.name; },
        set Name(val: string) {
          instanceData.name = val;
          const targetObj = createdObjectsList.find((o) => o.id === instanceData.id);
          if (targetObj) targetObj.name = val;
          if (instanceData.isPushedToStore) {
            useStore.getState().updateObject(instanceData.id, { name: val });
          }
        },
        get Shape() { return instanceData.geometry; },
        set Shape(val: any) {
          const geomStr = String(val);
          const resolved = (Enum.PartType as any)[geomStr] || geomStr;
          instanceData.geometry = resolved;
          const targetObj = createdObjectsList.find((o) => o.id === instanceData.id);
          if (targetObj) targetObj.geometry = resolved;
          if (instanceData.isPushedToStore) {
            useStore.getState().updateObject(instanceData.id, { geometry: resolved });
          }
        },
        get BevelRadius() { return instanceData.bevelRadius; },
        set BevelRadius(val: any) {
          const r = Number(val) || 0;
          instanceData.bevelRadius = r;
          const targetObj = createdObjectsList.find((o) => o.id === instanceData.id);
          if (targetObj) targetObj.bevelRadius = r;
          if (instanceData.isPushedToStore) {
            useStore.getState().updateObject(instanceData.id, { bevelRadius: r });
          }
        },
        get BevelSegments() { return instanceData.bevelSegments; },
        set BevelSegments(val: any) {
          const segs = Number(val) || 8;
          instanceData.bevelSegments = segs;
          const targetObj = createdObjectsList.find((o) => o.id === instanceData.id);
          if (targetObj) targetObj.bevelSegments = segs;
          if (instanceData.isPushedToStore) {
            useStore.getState().updateObject(instanceData.id, { bevelSegments: segs });
          }
        },
        get Anchored() { return instanceData.anchored; },
        set Anchored(val: boolean) {
          const b = !!val;
          instanceData.anchored = b;
          const targetObj = createdObjectsList.find((o) => o.id === instanceData.id);
          if (targetObj) {
            targetObj.anchored = b;
            targetObj.physics = b ? 'fixed' : 'dynamic';
          }
        },
        get CanCollide() { return instanceData.canCollide; },
        set CanCollide(val: boolean) {
          const b = !!val;
          instanceData.canCollide = b;
          const targetObj = createdObjectsList.find((o) => o.id === instanceData.id);
          if (targetObj) targetObj.isSolid = b;
        },
        get Material() { return instanceData.material; },
        set Material(val: any) {
          const matStr = String(val);
          instanceData.material = matStr;
          const matConfig = MATERIAL_MAP[matStr] || { roughness: 0.4, metalness: 0.1 };
          const targetObj = createdObjectsList.find((o) => o.id === instanceData.id);
          if (targetObj && targetObj.material) {
            targetObj.material.roughness = matConfig.roughness;
            targetObj.material.metalness = matConfig.metalness;
          }
        },
        get Transparency() { return instanceData.transparency; },
        set Transparency(val: any) {
          const t = Number(val) || 0;
          instanceData.transparency = t;
          const targetObj = createdObjectsList.find((o) => o.id === instanceData.id);
          if (targetObj && targetObj.material) {
            targetObj.material.opacity = Math.max(0, Math.min(1, 1 - t));
          }
        },
        get BrickColor() {
          return BrickColor.new(instanceData.color);
        },
        set BrickColor(val: any) {
          const bc = BrickColor.new(val);
          proxy.Color = bc.Color;
        },
        get TopSurface() { return 'Smooth'; },
        set TopSurface(_val: any) {},
        get BottomSurface() { return 'Smooth'; },
        set BottomSurface(_val: any) {},
        get LeftSurface() { return 'Smooth'; },
        set LeftSurface(_val: any) {},
        get RightSurface() { return 'Smooth'; },
        set RightSurface(_val: any) {},
        get FrontSurface() { return 'Smooth'; },
        set FrontSurface(_val: any) {},
        get BackSurface() { return 'Smooth'; },
        set BackSurface(_val: any) {},
        get Color() { return instanceData.color; },
        set Color(val: any) {
          let col = '#ffffff';
          if (typeof val === 'string') {
            col = val;
          } else if (val && typeof val === 'object') {
            col = val.hex || val.color || val.Color || '#ffffff';
          }
          if (!col.startsWith('#')) col = '#' + col;
          if (col.includes('undefined') || col.includes('null') || col === '#') {
            col = '#ffffff';
          }
          instanceData.color = col;
          const targetObj = createdObjectsList.find((o) => o.id === instanceData.id);
          if (targetObj && targetObj.material) targetObj.material.color = col;
        },
        get Size() {
          return new Vector3Obj(instanceData.scale[0], instanceData.scale[1], instanceData.scale[2]);
        },
        set Size(val: any) {
          if (val) {
            instanceData.scale = [val.x ?? val.X ?? 1, val.y ?? val.Y ?? 1, val.z ?? val.Z ?? 1];
            const targetObj = createdObjectsList.find((o) => o.id === instanceData.id);
            if (targetObj) targetObj.scale = instanceData.scale;
          }
        },
        get Position() {
          return new Vector3Obj(instanceData.position[0], instanceData.position[1], instanceData.position[2]);
        },
        set Position(val: any) {
          if (val) {
            instanceData.position = [val.x ?? val.X ?? 0, val.y ?? val.Y ?? 0, val.z ?? val.Z ?? 0];
            const targetObj = createdObjectsList.find((o) => o.id === instanceData.id);
            if (targetObj) targetObj.position = instanceData.position;
          }
        },
        get CFrame() {
          return new CFrameObj(...instanceData.position);
        },
        set CFrame(val: any) {
          if (val) {
            const px = val.position?.x ?? val.x ?? val.X ?? 0;
            const py = val.position?.y ?? val.y ?? val.Y ?? 0;
            const pz = val.position?.z ?? val.z ?? val.Z ?? 0;
            instanceData.position = [px, py, pz];
            const targetObj = createdObjectsList.find((o) => o.id === instanceData.id);
            if (targetObj) targetObj.position = instanceData.position;
          }
        },
        get Parent() { return instanceData.parent; },
        set Parent(parentProxy: any) {
          instanceData.parent = parentProxy;

          // Resolve parentId
          const parentId = parentProxy && parentProxy.id !== 'workspace_root' ? parentProxy.id : null;

          const existingInList = createdObjectsList.find((o) => o.id === instanceData.id);
          if (existingInList) {
            existingInList.parentId = parentId;
          } else {
            // Push object into creation queue
            const matConfig = MATERIAL_MAP[instanceData.material] || { roughness: 0.4, metalness: 0.1 };
            const newObject: SceneObject = {
              id: instanceData.id,
              name: instanceData.name,
              type: cls === 'Model' || cls === 'Folder' ? 'group' : 'mesh',
              geometry: cls === 'Model' || cls === 'Folder' ? undefined : (instanceData.geometry as any),
              bevelRadius: instanceData.bevelRadius,
              bevelSegments: instanceData.bevelSegments,
              position: [...instanceData.position],
              rotation: [0, 0, 0],
              scale: [...instanceData.scale],
              physics: instanceData.anchored ? 'fixed' : 'dynamic',
              anchored: instanceData.anchored,
              isSolid: instanceData.canCollide,
              parentId: parentId,
              material: {
                color: instanceData.color,
                roughness: matConfig.roughness,
                metalness: matConfig.metalness,
                envMapIntensity: 1,
              },
            };

            createdObjectsList.push(newObject);
            instanceData.isPushedToStore = true;

            if (cls !== 'Model' && cls !== 'Folder') {
              partsCreatedCount++;
            }
          }
        },
        IsA: (typeStr: string) => typeStr === className || (typeStr === 'BasePart' && className !== 'Model') || typeStr === 'Instance',
        FindFirstChild: (childName: string) => {
          const currentObjects = [...useStore.getState().objects, ...createdObjectsList];
          const found = currentObjects.find(
            (o) => o.name === childName && (instanceData.id === 'workspace_root' || o.parentId === instanceData.id)
          );
          if (!found) return null;
          return createInstanceProxy(found.type === 'group' ? 'Model' : 'Part');
        },
        FindFirstChildOfClass: (clsName: string) => {
          const currentObjects = [...useStore.getState().objects, ...createdObjectsList];
          const found = currentObjects.find(
            (o) => (instanceData.id === 'workspace_root' || o.parentId === instanceData.id)
          );
          if (!found) return null;
          return createInstanceProxy('Part');
        },
        Touched: {
          Connect: (...args: any[]) => {
            const fn = typeof args[0] === 'function' ? args[0] : (typeof args[1] === 'function' ? args[1] : null);
            if (!fn) return { Disconnect: () => {} };
            const unsub = CollisionEventBroker.onObjectCollision(instanceData.id, (evt) => {
              if (evt.type === 'collision_enter' || evt.type === 'trigger_enter') {
                const otherPartId = evt.targetId === instanceData.id ? evt.otherId : evt.targetId;
                const otherProxy = createInstanceProxy('Part');
                otherProxy.Name = evt.otherObject?.name || otherPartId;
                try {
                  fn(otherProxy);
                } catch (e: any) {
                  console.error(`[Lua Touched Error]:`, e.message);
                }
              }
            });
            return {
              Disconnect: () => unsub(),
            };
          },
        },
        TouchEnded: {
          Connect: (...args: any[]) => {
            const fn = typeof args[0] === 'function' ? args[0] : (typeof args[1] === 'function' ? args[1] : null);
            if (!fn) return { Disconnect: () => {} };
            const unsub = CollisionEventBroker.onObjectCollision(instanceData.id, (evt) => {
              if (evt.type === 'collision_exit' || evt.type === 'trigger_exit') {
                const otherPartId = evt.targetId === instanceData.id ? evt.otherId : evt.targetId;
                const otherProxy = createInstanceProxy('Part');
                otherProxy.Name = evt.otherObject?.name || otherPartId;
                try {
                  fn(otherProxy);
                } catch (e: any) {
                  console.error(`[Lua TouchEnded Error]:`, e.message);
                }
              }
            });
            return {
              Disconnect: () => unsub(),
            };
          },
        },
        Destroy: () => {
          const state = useStore.getState();
          const target = state.objects.find((o) => o.name === instanceData.name || o.id === instanceData.id);
          if (target) {
            state.deleteObject(target.id);
          }
        },
      };

      instancesMap.set(id, proxy);
      return proxy;
    }

    // 6. Workspace Root Handle
    const WorkspaceProxy = {
      id: 'workspace_root',
      name: 'Workspace',
      FindFirstChild: (childName: string) => {
        const currentObjects = [...useStore.getState().objects, ...createdObjectsList];
        const found = currentObjects.find((o) => o.name === childName);
        if (!found) return null;
        const childProxy = createInstanceProxy(found.type === 'group' ? 'Model' : 'Part');
        childProxy.Name = found.name;
        return childProxy;
      },
    };

    // 7. Instance Global
    const Instance = {
      new: (...args: any[]) => {
        const className = typeof args[0] === 'string' ? args[0] : (typeof args[1] === 'string' ? args[1] : 'Part');
        const parent = typeof args[0] === 'object' && args[0] !== null && typeof args[0].id === 'string'
          ? args[0]
          : (typeof args[1] === 'object' && args[1] !== null ? args[1] : args[2]);
        const p = createInstanceProxy(className);
        if (parent) p.Parent = parent;
        return p;
      },
    };

    // 8. game Global
    const game = {
      GetService: (...args: any[]) => {
        const serviceName = typeof args[0] === 'string' ? args[0] : args[1];
        if (serviceName === 'Workspace') return WorkspaceProxy;
        return WorkspaceProxy;
      },
      Workspace: WorkspaceProxy,
    };

    // 9. Transpile Roblox Lua to JS for Browser Execution
    const jsCode = transpileRobloxLuaToJS(scriptText);

    // 10. Execute in Scope
    const runner = new Function(
      'game',
      'Workspace',
      'workspace',
      'Instance',
      'Vector3',
      'CFrame',
      'Color3',
      'BrickColor',
      'Enum',
      'task',
      'wait',
      'pcall',
      'print',
      'warn',
      'error',
      'assert',
      'tostring',
      'ipairs',
      'pairs',
      'math',
      'os',
      'setmetatable',
      'Engine',
      'table',
      jsCode
    );

    const task = {
      wait: (s: number = 0) => {},
    };

    const print = (...args: any[]) => {
      console.log('[Lua Print]', ...args);
    };

    const warn = (...args: any[]) => {
      console.warn('[Lua Warn]', ...args);
    };

    const error = (msg: any) => {
      const errorMsg = String(msg || 'error');
      console.error('[Lua Error]', errorMsg);
      throw new Error(`[Lua Error] ${errorMsg}`);
    };

    const assert = (cond: any, msg?: string) => {
      if (!cond) {
        const errorMsg = msg || 'assertion failed!';
        console.error('[Lua Assert Error]', errorMsg);
        throw new Error(`[Lua Assert Error] ${errorMsg}`);
      }
      return cond;
    };

    const pcall = (fn: Function) => {
      try {
        const res = fn();
        return [true, res];
      } catch (err) {
        return [false, err];
      }
    };

    const ipairs = (arr: any[]) => {
      if (!arr || !Array.isArray(arr)) return [];
      return arr.map((item, idx) => [idx + 1, item]);
    };

    const pairs = (obj: any) => {
      if (!obj) return [];
      if (Array.isArray(obj)) return obj.map((item, idx) => [idx + 1, item]);
      return Object.entries(obj);
    };

    const luaMath = {
      sqrt: Math.sqrt,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      asin: Math.asin,
      acos: Math.acos,
      atan: Math.atan,
      atan2: Math.atan2,
      abs: Math.abs,
      max: Math.max,
      min: Math.min,
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
      random: (min?: number, max?: number) => {
        if (min === undefined) return Math.random();
        if (max === undefined) return Math.floor(Math.random() * min) + 1;
        return Math.floor(Math.random() * (max - min + 1)) + min;
      },
      rad: (deg: number) => (deg * Math.PI) / 180,
      deg: (rad: number) => (rad * 180) / Math.PI,
      pi: Math.PI,
      huge: Infinity,
    };

    const luaOs = {
      clock: () => performance.now() / 1000,
      time: () => Math.floor(Date.now() / 1000),
    };

    const setmetatable = (target: any, meta: any) => {
      if (target && meta && meta.__index) {
        Object.setPrototypeOf(target, meta.__index);
      }
      return target || {};
    };

    const Engine = {
      GetTime: () => performance.now() / 1000,
      SpawnParticles: (effectType: string, x: number, y: number, z: number) => {
        console.info(`[Engine Particle] ${effectType} at (${x}, ${y}, ${z})`);
      },

      // ── Game Variables Bridge ──
      SetVariable: (key: string, val: boolean | number | string) => {
        useStore.getState().setGameVariable(key, val);
      },
      GetVariable: (key: string) => {
        return useStore.getState().gameVariables[key];
      },
      DeleteVariable: (key: string) => {
        useStore.getState().deleteGameVariable(key);
      },
      GetVariables: () => {
        return { ...useStore.getState().gameVariables };
      },

      // ── Quests & Objectives Bridge ──
      GetQuests: () => {
        return useStore.getState().quests;
      },
      GetQuest: (questId: string) => {
        const state = useStore.getState();
        return state.quests.find((q) => q.id === questId || (q.title && questId && q.title.toLowerCase() === questId.toLowerCase()));
      },
      StartQuest: (questId: string) => {
        const state = useStore.getState();
        const quest = state.quests.find((q) => q.id === questId || (q.title && questId && q.title.toLowerCase() === questId.toLowerCase()));
        if (quest) {
          state.updateQuest(quest.id, { status: 'active' });
        }
      },
      CompleteQuest: (questId: string) => {
        const state = useStore.getState();
        const quest = state.quests.find((q) => q.id === questId || (q.title && questId && q.title.toLowerCase() === questId.toLowerCase()));
        if (quest) {
          const completedObjectives = quest.objectives.map((o) => ({ ...o, completed: true, currentCount: o.targetCount }));
          state.updateQuest(quest.id, { status: 'completed', objectives: completedObjectives });
          state.triggerScriptedEvents('on_quest_complete', quest.id);
        }
      },
      CompleteObjective: (questId: string, objId: string) => {
        const state = useStore.getState();
        const quest = state.quests.find((q) => q.id === questId || (q.title && questId && q.title.toLowerCase() === questId.toLowerCase()));
        if (quest) {
          const updatedObjectives = quest.objectives.map((obj) => {
            if (
              obj.id === objId ||
              (obj.description && objId && obj.description.toLowerCase().includes(objId.toLowerCase())) ||
              (obj.targetName && objId && obj.targetName.toLowerCase() === objId.toLowerCase())
            ) {
              return { ...obj, completed: true, currentCount: obj.targetCount };
            }
            return obj;
          });
          const allCompleted = updatedObjectives.length > 0 && updatedObjectives.every((o) => o.completed);
          state.updateQuest(quest.id, {
            objectives: updatedObjectives,
            status: allCompleted ? 'completed' : quest.status,
          });
          if (allCompleted) {
            state.triggerScriptedEvents('on_quest_complete', quest.id);
          }
        }
      },
      UpdateObjective: (questId: string, objId: string, count: number) => {
        const state = useStore.getState();
        const quest = state.quests.find((q) => q.id === questId || (q.title && questId && q.title.toLowerCase() === questId.toLowerCase()));
        if (quest) {
          const updatedObjectives = quest.objectives.map((obj) => {
            if (
              obj.id === objId ||
              (obj.description && objId && obj.description.toLowerCase().includes(objId.toLowerCase())) ||
              (obj.targetName && objId && obj.targetName.toLowerCase() === objId.toLowerCase())
            ) {
              const newCount = Math.max(0, count);
              return { ...obj, currentCount: newCount, completed: newCount >= obj.targetCount };
            }
            return obj;
          });
          const allCompleted = updatedObjectives.length > 0 && updatedObjectives.every((o) => o.completed);
          state.updateQuest(quest.id, {
            objectives: updatedObjectives,
            status: allCompleted ? 'completed' : quest.status,
          });
          if (allCompleted) {
            state.triggerScriptedEvents('on_quest_complete', quest.id);
          }
        }
      },

      // ── Scripted Events & Dialogues Bridge ──
      TriggerEvent: (triggerType: string, targetId?: string) => {
        useStore.getState().triggerScriptedEvents(triggerType as any, targetId);
      },
      ShowDialogue: (text: string, speakerName?: string, speakerId?: string) => {
        useStore.getState().setActiveDialogue({
          id: `dialogue_${Date.now()}`,
          text,
          speakerName,
          speakerId,
        });
      },
      CloseDialogue: () => {
        useStore.getState().setActiveDialogue(null);
      },

      // ── Terrain Height & Pathing Bridge ──
      GetTerrainHeight: (x: number, z: number) => {
        const state = useStore.getState();
        return getSceneTerrainElevation(x, z, state.objects, 0);
      },
      SnapToTerrain: (objectId: string, offset: number = 0) => {
        const state = useStore.getState();
        const obj = state.objects.find((o) => o.id === objectId || o.name === objectId);
        if (obj) {
          const [worldX, , worldZ] = getWorldPositionOfObject(obj, state.objects);
          const targetY = calculateEntityTerrainTargetY(obj, worldX, worldZ, state.objects, offset);
          state.updateObject(obj.id, { position: [obj.position[0], targetY, obj.position[2]] });
          return targetY;
        }
        return null;
      },
    };

    const luaTable = {
      insert: (arr: any[], val: any) => { if (Array.isArray(arr)) arr.push(val); },
      remove: (arr: any[], idx?: number) => { if (Array.isArray(arr)) arr.splice((idx ?? arr.length) - 1, 1); },
      sort: (arr: any[], cmp?: Function) => { if (Array.isArray(arr)) arr.sort(cmp as any); },
      concat: (arr: any[], sep?: string) => { if (Array.isArray(arr)) return arr.join(sep || ''); return ''; },
    };

    const moduleResult = runner(
      game,
      WorkspaceProxy,
      WorkspaceProxy,
      Instance,
      Vector3,
      CFrame,
      Color3,
      BrickColor,
      Enum,
      task,
      (s: number) => {},
      pcall,
      print,
      warn,
      error,
      assert,
      String,
      ipairs,
      pairs,
      luaMath,
      luaOs,
      setmetatable,
      Engine,
      luaTable
    );

    // Auto-instantiate class modules that return a constructor table
    if (createdObjectsList.length === 0 && moduleResult && typeof moduleResult.new === 'function') {
      try {
        const instance = moduleResult.new({ x: 0, y: 5, z: 0 });
        // Check if instance has a scene graph tree (root with shapeType/children)
        const rootNode = instance?.root || instance;
        if (rootNode && (rootNode.shapeType || rootNode.children)) {
          const modelId = `model_${Date.now()}`;
          const modelGroup: SceneObject = {
            id: modelId,
            name: instance?.name || (scriptText.toLowerCase().includes('dragon') ? 'Dragon' : (rootNode?.name ? `${rootNode.name} Model` : 'Spawned Model')),
            type: 'group',
            position: [instance?.position?.x || 0, instance?.position?.y || 5, instance?.position?.z || 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
          };
          createdObjectsList.push(modelGroup);
          traverseSceneGraphNode(rootNode, modelId, createdObjectsList);
          partsCreatedCount = createdObjectsList.length;
        }
      } catch (e) {
        console.warn('[Auto-instantiate Warning]', e);
      }
    }

    // Batch add all created objects to store in 1 atomic operation
    if (createdObjectsList.length > 0) {
      useStore.getState().addObjects(createdObjectsList);
      
      const modelObj = createdObjectsList.find((o) => o.type === 'group');
      if (modelObj) {
        useStore.getState().setSelectedIds([modelObj.id]);
      }
    }

    toast.success(
      'Roblox Script Executed',
      `Instantiated ${partsCreatedCount} part(s) into Workspace!`
    );

    return {
      success: true,
      partsCreated: partsCreatedCount,
    };
  } catch (err: any) {
    const errorMsg = `[Roblox Lua Engine Error]: ${err.message || err}\n${err.stack || ''}`;
    console.error(errorMsg);
    toast.error('Script Execution Error', err.message || 'Failed to execute Roblox Lua script.');
    return {
      success: false,
      partsCreated: 0,
      error: err.message,
    };
  }
}

/** Recursively traverse a Lua scene-graph node tree and create SceneObjects */
function traverseSceneGraphNode(node: any, parentId: string, objects: SceneObject[]): void {
  if (!node || !node.name) return;

  const id = `node_${node.name.replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;

  const geometryMap: Record<string, string> = {
    cube: 'box', box: 'box', wedge: 'wedge', cylinder: 'cylinder',
    pyramid: 'pyramid', cone: 'cone', sphere: 'sphere', torus: 'torus',
  };

  const geometry = geometryMap[node.shapeType] || 'box';
  const offset = node.offset || { x: 0, y: 0, z: 0 };
  const scale = node.scale || { x: 1, y: 1, z: 1 };
  const rotation = node.rotation || { pitch: 0, yaw: 0, roll: 0 };

  // Assign colors based on body part names for visual variety
  let color = '#b41e1e';
  const nameLower = (node.name || '').toLowerCase();
  if (nameLower.includes('wing') && nameLower.includes('membrane')) color = '#781414';
  else if (nameLower.includes('wing')) color = '#991818';
  else if (nameLower.includes('head') || nameLower.includes('snout') || nameLower.includes('jaw')) color = '#dc3228';
  else if (nameLower.includes('horn')) color = '#3d3d3d';
  else if (nameLower.includes('tail')) color = '#8b1a1a';
  else if (nameLower.includes('leg') || nameLower.includes('foot')) color = '#a02020';
  else if (nameLower.includes('neck')) color = '#c42020';

  const obj: SceneObject = {
    id,
    name: node.name,
    type: 'mesh',
    geometry: geometry as any,
    parentId,
    position: [offset.x || 0, offset.y || 0, offset.z || 0],
    rotation: [rotation.pitch || 0, rotation.yaw || 0, rotation.roll || 0],
    scale: [scale.x || 1, scale.y || 1, scale.z || 1],
    material: { color, roughness: 0.35, metalness: 0.2, envMapIntensity: 1 },
    physics: 'fixed',
    anchored: true,
  };

  objects.push(obj);

  // Recurse into children
  const children = node.children;
  if (children && Array.isArray(children)) {
    for (const child of children) {
      traverseSceneGraphNode(child, id, objects);
    }
  }
}

/**
 * Transpiles Roblox Lua script syntax to executable JavaScript using luaparse AST.
 * Falls back gracefully to regex conversion if syntax errors or non-standard tokens occur.
 */
export function transpileRobloxLuaToJS(luaCode: string): string {
  const loopGuardHeader = `let __totalLoopIterations = 0;\nfunction __checkLoopGuard() { if (++__totalLoopIterations > 50000) throw new Error("Script Execution Error: Infinite loop detected or maximum iteration limit exceeded (50,000 iterations)."); }\n`;

  try {
    const ast = luaparse.parse(luaCode, {
      wait: false,
      comments: false,
      scope: true,
      locations: false,
      ranges: false,
      luaVersion: '5.3',
    });

    const jsCode = transpileChunk(ast);
    return loopGuardHeader + jsCode;
  } catch (parseError: any) {
    // If strict AST parsing fails (e.g. non-standard syntax), fallback to regex transpiler
    return loopGuardHeader + transpileRobloxLuaFallback(luaCode);
  }
}

/** Transpiles a block of Lua statements into JavaScript code */
function transpileBlock(statements: luaparse.Statement[]): string {
  if (!statements || statements.length === 0) return '';
  return statements.map(transpileStatement).filter(Boolean).join('\n');
}

/** Transpiles a Lua AST chunk */
function transpileChunk(chunk: luaparse.Chunk): string {
  return transpileBlock(chunk.body);
}

/** Transpiles a single Lua statement into JavaScript */
function transpileStatement(stmt: luaparse.Statement): string {
  if (!stmt) return '';

  switch (stmt.type) {
    case 'LocalStatement': {
      if (stmt.variables.length > 1 && stmt.init.length === 1) {
        const varNames = stmt.variables.map((v) => v.name).join(', ');
        const initVal = transpileExpression(stmt.init[0]);
        return `var [${varNames}] = Array.isArray(${initVal}) ? ${initVal} : [${initVal}];`;
      }
      const decls = stmt.variables.map((v, i) => {
        const init = stmt.init[i];
        return `${v.name}${init ? ` = ${transpileExpression(init)}` : ' = null'}`;
      });
      return `var ${decls.join(', ')};`;
    }

    case 'AssignmentStatement': {
      if (stmt.variables.length === 1) {
        const target = transpileExpression(stmt.variables[0]);
        const val = stmt.init[0] ? transpileExpression(stmt.init[0]) : 'null';
        return `${target} = ${val};`;
      }
      const targets = stmt.variables.map(transpileExpression).join(', ');
      const inits = stmt.init.map(transpileExpression).join(', ');
      return `[${targets}] = [${inits}];`;
    }

    case 'CallStatement': {
      return `${transpileExpression(stmt.expression)};`;
    }

    case 'IfStatement': {
      return stmt.clauses
        .map((clause) => {
          if (clause.type === 'IfClause') {
            return `if (${transpileExpression(clause.condition)}) {\n${transpileBlock(clause.body)}\n}`;
          } else if (clause.type === 'ElseifClause') {
            return `else if (${transpileExpression(clause.condition)}) {\n${transpileBlock(clause.body)}\n}`;
          } else if (clause.type === 'ElseClause') {
            return `else {\n${transpileBlock(clause.body)}\n}`;
          }
          return '';
        })
        .join(' ');
    }

    case 'WhileStatement': {
      return `while (${transpileExpression(stmt.condition)}) {\n  __checkLoopGuard();\n${transpileBlock(stmt.body)}\n}`;
    }

    case 'RepeatStatement': {
      return `do {\n  __checkLoopGuard();\n${transpileBlock(stmt.body)}\n} while (!(${transpileExpression(stmt.condition)}));`;
    }

    case 'DoStatement': {
      return `{\n${transpileBlock(stmt.body)}\n}`;
    }

    case 'ReturnStatement': {
      if (!stmt.arguments || stmt.arguments.length === 0) return 'return;';
      if (stmt.arguments.length === 1) return `return ${transpileExpression(stmt.arguments[0])};`;
      return `return [${stmt.arguments.map(transpileExpression).join(', ')}];`;
    }

    case 'BreakStatement': {
      return 'break;';
    }

    case 'ForNumericStatement': {
      const v = stmt.variable.name;
      const start = transpileExpression(stmt.start);
      const end = transpileExpression(stmt.end);
      const step = stmt.step ? transpileExpression(stmt.step) : '1';
      const isStepNegative = stmt.step && stmt.step.type === 'UnaryExpression' && stmt.step.operator === '-';
      const cmp = isStepNegative ? '>=' : '<=';
      return `for (let ${v} = ${start}; ${v} ${cmp} ${end}; ${v} += ${step}) {\n  __checkLoopGuard();\n${transpileBlock(stmt.body)}\n}`;
    }

    case 'ForGenericStatement': {
      const firstIter = stmt.iterators[0];
      const varNames = stmt.variables.map((v) => v.name).join(', ');
      if (
        firstIter &&
        firstIter.type === 'CallExpression' &&
        firstIter.base.type === 'Identifier' &&
        (firstIter.base.name === 'pairs' || firstIter.base.name === 'ipairs')
      ) {
        const arg = firstIter.arguments[0] ? transpileExpression(firstIter.arguments[0]) : '{}';
        return `for (let [${varNames}] of pairs(${arg})) {\n  __checkLoopGuard();\n${transpileBlock(stmt.body)}\n}`;
      }
      const iterStr = stmt.iterators.map(transpileExpression).join(', ');
      return `for (let [${varNames}] of ${iterStr}) {\n  __checkLoopGuard();\n${transpileBlock(stmt.body)}\n}`;
    }

    case 'FunctionDeclaration': {
      return transpileFunctionDeclaration(stmt);
    }

    default:
      return '';
  }
}

/** Transpiles a Lua function declaration statement or expression */
function transpileFunctionDeclaration(decl: luaparse.FunctionDeclaration): string {
  const params = decl.parameters.map((p) => (p.type === 'Identifier' ? p.name : '...args')).join(', ');
  const body = transpileBlock(decl.body);

  if (decl.identifier) {
    if (decl.identifier.type === 'MemberExpression') {
      const base = transpileExpression(decl.identifier.base);
      const name = decl.identifier.identifier.name;
      if (decl.identifier.indexer === ':') {
        const allParams = params ? `self, ${params}` : 'self';
        return `${base}.${name} = function(${allParams}) {\n${body}\n};`;
      } else {
        return `${base}.${name} = function(${params}) {\n${body}\n};`;
      }
    } else if (decl.identifier.type === 'Identifier') {
      if (decl.isLocal) {
        return `var ${decl.identifier.name} = function(${params}) {\n${body}\n};`;
      }
      return `function ${decl.identifier.name}(${params}) {\n${body}\n}`;
    }
  }
  return `function(${params}) {\n${body}\n}`;
}

/** Transpiles Lua TableConstructorExpression into JS Array or Object */
function transpileTableConstructor(node: luaparse.TableConstructorExpression): string {
  if (!node.fields || node.fields.length === 0) {
    return '{}';
  }
  const isPureSequence = node.fields.every((f) => f.type === 'TableValue');
  if (isPureSequence) {
    return `[${node.fields.map((f) => transpileExpression((f as luaparse.TableValue).value)).join(', ')}]`;
  }
  const fields = node.fields
    .map((f, idx) => {
      if (f.type === 'TableKeyString') {
        return `${f.key.name}: ${transpileExpression(f.value)}`;
      } else if (f.type === 'TableKey') {
        return `[${transpileExpression(f.key)}]: ${transpileExpression(f.value)}`;
      } else if (f.type === 'TableValue') {
        return `[${idx + 1}]: ${transpileExpression(f.value)}`;
      }
      return '';
    })
    .filter(Boolean);
  return `({ ${fields.join(', ')} })`;
}

/** Transpiles a single Lua expression into JavaScript */
function transpileExpression(node: luaparse.Expression): string {
  if (!node) return 'null';

  switch (node.type) {
    case 'Identifier':
      return node.name === 'nil' ? 'null' : node.name;

    case 'StringLiteral':
      if (node.raw) {
        if (node.raw.startsWith('[[') && node.raw.endsWith(']]')) {
          return JSON.stringify(node.raw.slice(2, -2));
        }
        return node.raw;
      }
      return JSON.stringify(node.value ?? '');

    case 'NumericLiteral':
      return node.raw ?? `${node.value}`;

    case 'BooleanLiteral':
      return node.raw ?? `${node.value}`;

    case 'NilLiteral':
      return 'null';

    case 'VarargLiteral':
      return '...args';

    case 'MemberExpression':
      return `${transpileExpression(node.base)}.${node.identifier.name}`;

    case 'IndexExpression':
      return `${transpileExpression(node.base)}[${transpileExpression(node.index)}]`;

    case 'CallExpression': {
      if (node.base.type === 'MemberExpression' && node.base.indexer === ':') {
        const baseObj = transpileExpression(node.base.base);
        const methodName = node.base.identifier.name;
        const args = node.arguments.map(transpileExpression).join(', ');
        const fullArgs = args ? `${baseObj}, ${args}` : baseObj;
        return `${baseObj}.${methodName}(${fullArgs})`;
      }
      const base = transpileExpression(node.base);
      const args = node.arguments.map(transpileExpression).join(', ');
      return `${base}(${args})`;
    }

    case 'TableCallExpression': {
      return `${transpileExpression(node.base)}(${transpileExpression(node.arguments)})`;
    }

    case 'StringCallExpression': {
      return `${transpileExpression(node.base)}(${transpileExpression(node.argument)})`;
    }

    case 'TableConstructorExpression':
      return transpileTableConstructor(node);

    case 'FunctionDeclaration':
      return transpileFunctionDeclaration(node);

    case 'BinaryExpression': {
      const left = transpileExpression(node.left);
      const right = transpileExpression(node.right);
      switch (node.operator) {
        case '..':
          return `(${left} + ${right})`;
        case '^':
          return `Math.pow(${left}, ${right})`;
        case '~=':
          return `(${left} !== ${right})`;
        case '==':
          return `(${left} === ${right})`;
        case '//':
          return `Math.floor(${left} / ${right})`;
        default:
          return `(${left} ${node.operator} ${right})`;
      }
    }

    case 'LogicalExpression': {
      const left = transpileExpression(node.left);
      const right = transpileExpression(node.right);
      const op = node.operator === 'and' ? '&&' : '||';
      return `(${left} ${op} ${right})`;
    }

    case 'UnaryExpression': {
      const arg = transpileExpression(node.argument);
      switch (node.operator) {
        case 'not':
          return `(!${arg})`;
        case '-':
          return `(-${arg})`;
        case '#':
          return `(${arg} ? (${arg}.length !== undefined ? ${arg}.length : Object.keys(${arg}).length) : 0)`;
        case '~':
          return `(~${arg})`;
        default:
          return `(!${arg})`;
      }
    }

    default:
      return 'null';
  }
}

/** Fallback regex-based transpiler for non-standard Lua scripts */
function transpileRobloxLuaFallback(luaCode: string): string {
  let js = luaCode;

  // 1. Remove single-line comments -- ...
  js = js.replace(/--.*$/gm, '');

  // 2. Convert Lua tables to JS objects or arrays using placeholder substitution
  function convertLuaTables(code: string): string {
    let result = code;
    const placeholders: string[] = [];

    let hasMatches = true;
    let pass = 0;
    while (hasMatches && pass < 6) {
      pass++;
      hasMatches = false;
      result = result.replace(/\{([^{}]*)\}/g, (match, inner) => {
        hasMatches = true;
        const trimmed = inner.trim();
        if (trimmed === '') return '{}';

        let converted = inner;
        if (/\b[a-zA-Z_][a-zA-Z0-9_]*\s*=\s*/.test(trimmed)) {
          converted = inner.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*/g, '$1: ');
          const id = `__OBJ_${placeholders.length}__`;
          placeholders.push(`{${converted}}`);
          return id;
        }

        const id = `__OBJ_${placeholders.length}__`;
        placeholders.push(`[${converted}]`);
        return id;
      });
    }

    for (let i = placeholders.length - 1; i >= 0; i--) {
      result = result.replace(`__OBJ_${i}__`, placeholders[i]);
    }

    return result;
  }

  js = convertLuaTables(js);
  js = js.replace(/\.children\s*=\s*\{\}/g, '.children = []');

  // 3. Transpile function declarations:
  js = js.replace(/\bfunction\s+([a-zA-Z0-9_]+):([a-zA-Z0-9_]+)\s*\((.*?)\)/g, (match, obj, method, params) => {
    const p = params.trim() ? `self, ${params}` : 'self';
    return `${obj}.${method} = function(${p}) {`;
  });
  js = js.replace(/\bfunction\s+([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*\((.*?)\)/g, '$1.$2 = function($3) {');
  js = js.replace(/\bfunction\s+([a-zA-Z0-9_]+)\s*\((.*?)\)(?!\s*\{)/g, 'function $1($2) {');
  js = js.replace(/\bfunction\s*\((.*?)\)(?!\s*\{)/g, 'function($1) {');

  // 4. Convert Lua loops
  js = js.replace(
    /for\s+([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s+in\s+(?:pairs|ipairs)\(([^)]+)\)\s+do/g,
    'for (let [$1, $2] of pairs($3)) {'
  );
  js = js.replace(
    /for\s+([a-zA-Z0-9_]+)\s+in\s+([^\s\()]+)\s+do/g,
    'for (let $1 of $2) {'
  );
  js = js.replace(
    /for\s+([a-zA-Z0-9_]+)\s*=\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s+do/g,
    'for (let $1 = $2; $1 <= $3; $1 += $4) {'
  );
  js = js.replace(
    /for\s+([a-zA-Z0-9_]+)\s*=\s*([^,]+)\s*,\s*([^\s]+)\s+do/g,
    'for (let $1 = $2; $1 <= $3; $1++) {'
  );
  js = js.replace(
    /while\s+(.*?)\s+do/g,
    'while ($1) {'
  );

  // 5. Convert Lua if ... then ... end
  js = js.replace(/if\s+(.*?)\s+then/g, 'if ($1) {');
  js = js.replace(/\belseif\s+(.*?)\s+then/g, '} else if ($1) {');
  js = js.replace(/\belse\b/g, '} else {');
  js = js.replace(/\bend\b/g, '}');

  // 6. Convert local variable definitions
  js = js.replace(/\blocal\s+([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)\s*=\s*/g, 'var [$1, $2] = ');
  js = js.replace(/\blocal\s+/g, 'var ');

  // 7. Convert method calls: obj:Method(args) -> obj.Method(obj, args)
  js = js.replace(/([a-zA-Z0-9_]+):([a-zA-Z0-9_]+)\((\))/g, '$1.$2($1)');
  js = js.replace(/([a-zA-Z0-9_]+):([a-zA-Z0-9_]+)\((?!\))/g, '$1.$2($1, ');

  // 8. Convert Roblox nil -> null
  js = js.replace(/\bnil\b/g, 'null');

  // 9. Convert Lua string concatenation .. -> +
  js = js.replace(/([^\.])\.\.([^\.])/g, '$1 + $2');

  // 10. Convert Lua operators
  js = js.replace(/\bnot\b/g, '!');
  js = js.replace(/\band\b/g, '&&');
  js = js.replace(/\bor\b/g, '||');

  // 11. Convert Lua len operator #var
  js = js.replace(/#([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, varName) => {
    if (/^[0-9A-Fa-f]{6}$/.test(varName) || /^[0-9A-Fa-f]{3}$/.test(varName)) {
      return `#${varName}`;
    }
    return `(${varName} ? ${varName}.length : 0)`;
  });
  js = js.replace(/#([0-9]+)/g, '$1');

  // 12. Inject loop guard
  js = js.replace(/(\bfor\b[^{]*\{|\bwhile\b[^{]*\{)/g, '$1 __checkLoopGuard(); ');

  return js;
}
