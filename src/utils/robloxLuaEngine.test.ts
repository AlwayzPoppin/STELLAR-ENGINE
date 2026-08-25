import { describe, it, expect } from 'vitest';
import { executeRobloxLuaScript, transpileRobloxLuaToJS } from './robloxLuaEngine';
import { useStore } from '../store/useStore';

describe('robloxLuaEngine Advanced Primitives & Motor6D Rigs', () => {
  it('should instantiate pyramid, cone, torus, roundedCube and beveled parts', () => {
    const sampleScript = `
local Workspace = game:GetService("Workspace")

local model = Instance.new("Model")
model.Name = "AdvancedShapeGallery"
model.Parent = Workspace

local pyramid = Instance.new("PyramidPart")
pyramid.Name = "VoxelPyramid"
pyramid.Position = Vector3.new(0, 5, 0)
pyramid.Parent = model

local cone = Instance.new("ConePart")
cone.Name = "VoxelCone"
cone.Position = Vector3.new(5, 5, 0)
cone.Parent = model

local torus = Instance.new("TorusPart")
torus.Name = "VoxelTorus"
torus.Position = Vector3.new(10, 5, 0)
torus.Parent = model

local rounded = Instance.new("RoundedBlockPart")
rounded.Name = "VoxelRoundedCube"
rounded.BevelRadius = 0.2
rounded.Position = Vector3.new(15, 5, 0)
rounded.Parent = model
`;

    const result = executeRobloxLuaScript(sampleScript);
    expect(result.success).toBe(true);
    expect(result.partsCreated).toBe(4);

    const objects = useStore.getState().objects;
    const pyramidObj = objects.find((o) => o.name === 'VoxelPyramid');
    expect(pyramidObj?.geometry).toBe('pyramid');

    const coneObj = objects.find((o) => o.name === 'VoxelCone');
    expect(coneObj?.geometry).toBe('cone');

    const torusObj = objects.find((o) => o.name === 'VoxelTorus');
    expect(torusObj?.geometry).toBe('torus');

    const roundedObj = objects.find((o) => o.name === 'VoxelRoundedCube');
    expect(roundedObj?.geometry).toBe('roundedCube');
    expect(roundedObj?.bevelRadius).toBe(0.2);
  });

  it('should instantiate organic shapes (Teardrop, WingBlade, CurvedHorn, TaperedTorso) from Lua scripts', () => {
    const organicScript = `
local Workspace = game:GetService("Workspace")

local teardrop = Instance.new("TeardropPart")
teardrop.Name = "DragonEgg"
teardrop.Parent = Workspace

local wing = Instance.new("WingBladePart")
wing.Name = "DragonWing"
wing.Parent = Workspace

local horn = Instance.new("CurvedHornPart")
horn.Name = "DragonHorn"
horn.Parent = Workspace

local torso = Instance.new("TaperedTorsoPart")
torso.Name = "DragonChest"
torso.Parent = Workspace
`;

    const result = executeRobloxLuaScript(organicScript);
    expect(result.success).toBe(true);
    expect(result.partsCreated).toBe(4);

    const objects = useStore.getState().objects;
    expect(objects.find((o) => o.name === 'DragonEgg')?.geometry).toBe('teardrop');
    expect(objects.find((o) => o.name === 'DragonWing')?.geometry).toBe('wingBlade');
    expect(objects.find((o) => o.name === 'DragonHorn')?.geometry).toBe('curvedHorn');
    expect(objects.find((o) => o.name === 'DragonChest')?.geometry).toBe('taperedTorso');
  });

  it('should instantiate Motor6D rigs connecting Part0 and Part1 in Lua scripts', () => {
    const motorScript = `
local Workspace = game:GetService("Workspace")

local torso = Instance.new("Part")
torso.Name = "Torso"
torso.Parent = Workspace

local head = Instance.new("Part")
head.Name = "Head"
head.Parent = Workspace

local neck = Instance.new("Motor6D")
neck.Name = "NeckJoint"
neck.Part0 = torso
neck.Part1 = head
neck.C0 = CFrame.new(0, 1.5, 0)
neck.C1 = CFrame.new(0, -0.5, 0)
neck.Parent = torso
`;

    const result = executeRobloxLuaScript(motorScript);
    expect(result.success).toBe(true);

    const objects = useStore.getState().objects;
    const neckObj = objects.find((o) => o.name === 'NeckJoint');
    expect(neckObj?.type).toBe('motor6d');
    expect(neckObj?.motor6dProps?.part0Id).toBeDefined();
    expect(neckObj?.motor6dProps?.part1Id).toBeDefined();

    const headObj = objects.find((o) => o.name === 'Head');
    const torsoObj = objects.find((o) => o.name === 'Torso');
    expect(headObj?.parentId).toBe(torsoObj?.id);
  });
});
