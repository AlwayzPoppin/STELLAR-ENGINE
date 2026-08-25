import { describe, it, expect } from 'vitest';
import { isObjFormat, isFbxFormat } from './Viewport';
import { SceneObject } from '../store/useStore';

describe('ObjModel and Format Detection Support', () => {
  it('should identify OBJ files by type, name, or url', () => {
    const objExplicit: SceneObject = {
      id: '1',
      name: 'Custom Model',
      type: 'obj',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    expect(isObjFormat(objExplicit)).toBe(true);

    const objFromName: SceneObject = {
      id: '2',
      name: 'human_survivor.obj',
      type: 'gltf', // Even if legacy type is gltf
      url: 'blob:http://localhost:5173/1234-5678',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    expect(isObjFormat(objFromName)).toBe(true);

    const objFromUrl: SceneObject = {
      id: '3',
      name: 'Survivor Mesh',
      type: 'gltf',
      url: 'https://models.example.com/assets/human_survivor.obj',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    expect(isObjFormat(objFromUrl)).toBe(true);
  });

  it('should identify FBX files by type, name, or url', () => {
    const fbxExplicit: SceneObject = {
      id: '4',
      name: 'Warrior Rig',
      type: 'fbx',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    expect(isFbxFormat(fbxExplicit)).toBe(true);

    const fbxFromName: SceneObject = {
      id: '5',
      name: 'animated_boss.fbx',
      type: 'gltf',
      url: 'blob:http://localhost:5173/abcd-efgh',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    expect(isFbxFormat(fbxFromName)).toBe(true);
  });

  it('should not misclassify GLTF or basic primitive meshes', () => {
    const gltfObj: SceneObject = {
      id: '6',
      name: 'SciFi_Drone.glb',
      type: 'gltf',
      url: 'https://models.example.com/drone.glb',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    expect(isObjFormat(gltfObj)).toBe(false);
    expect(isFbxFormat(gltfObj)).toBe(false);

    const primitiveMesh: SceneObject = {
      id: '7',
      name: 'Ground Plane',
      type: 'mesh',
      geometry: 'plane',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [100, 100, 1],
    };
    expect(isObjFormat(primitiveMesh)).toBe(false);
    expect(isFbxFormat(primitiveMesh)).toBe(false);
  });
});
