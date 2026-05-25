import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { generateAutoSpine } from './AutoRigger';

describe('AutoRigger', () => {
  it('should generate custom T-Pose spine for Test Player', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial());
    const { bones } = generateAutoSpine(mesh, '/humanoid+robot+3d+model.glb');
    
    expect(bones.length).toBe(19);
    
    // Check Waist and Spine
    const waist = bones.find(b => b.name === 'AutoRig_Waist');
    const spine = bones.find(b => b.name === 'AutoRig_Spine');
    expect(waist).toBeDefined();
    expect(spine).toBeDefined();
    expect(waist!.position.y).toBeCloseTo(0.4734375); // waist is at its absolute position (it is the root)
    expect(spine!.position.y).toBeCloseTo(0.637477438 - 0.4734375); // spine is relative to waist parent
    
    // Check Spine absolute position in mesh local space
    mesh.updateMatrixWorld(true);
    
    const spineWorld = new THREE.Vector3();
    spine!.getWorldPosition(spineWorld);
    expect(spineWorld.y).toBeCloseTo(0.637477438, 5);
    expect(spineWorld.z).toBeCloseTo(-0.00036085, 5);
  });

  it('should generate algorithmic spine for generic models', () => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1), new THREE.MeshBasicMaterial());
    const { bones } = generateAutoSpine(mesh, '/generic_character.glb');
    
    expect(bones.length).toBe(66);
    
    const rootBone = bones.find(b => b.name === 'root');
    const pelvis = bones.find(b => b.name === 'pelvis');
    expect(rootBone).toBeDefined();
    expect(pelvis).toBeDefined();
    
    // Bounding box of 2x4x1 centered at 0 would have min Y at -2, max Y at 2.
    // Height is 4. Center is 0.
    // root position y is min Y + height * 0.48 = -2 + 1.92 = -0.08.
    // pelvis relative position y is 0 (overlapping).
    expect(rootBone!.position.y).toBeCloseTo(-0.08);
    expect(pelvis!.position.y).toBeCloseTo(0);
    
    mesh.updateMatrixWorld(true);
    const pelvisWorld = new THREE.Vector3();
    pelvis!.getWorldPosition(pelvisWorld);
    expect(pelvisWorld.y).toBeCloseTo(-0.08);
  });

  it('should generate custom T-Pose spine with facing correction for backwards Test Player', () => {
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -1, 1.5, 0,
      0, 0, -1,
      0, 0, 1,
      0, 2, -1,
      0, 2, 1,
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    
    const { bones } = generateAutoSpine(mesh, '/humanoid+robot+3d+model.glb');
    
    expect(bones.length).toBe(19);
    
    const spine = bones.find(b => b.name === 'AutoRig_Spine');
    expect(spine).toBeDefined();
    
    mesh.updateMatrixWorld(true);
    const spineWorld = new THREE.Vector3();
    spine!.getWorldPosition(spineWorld);
    expect(spineWorld.z).toBeCloseTo(0.00036085, 5);
  });
});
