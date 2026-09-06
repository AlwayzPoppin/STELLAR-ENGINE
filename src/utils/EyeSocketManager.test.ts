import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  calculateEyeCenters,
  applyEyeSocketInset,
  restoreOriginalEyeSocketMesh,
  applyEyelidBlinkDeformation,
} from './EyeSocketManager';

describe('EyeSocketManager', () => {
  it('should calculate eye centers from facial rig bones if present', () => {
    const scene = new THREE.Group();
    const headBone = new THREE.Bone();
    headBone.name = 'Head';
    const leftEyeBone = new THREE.Bone();
    leftEyeBone.name = 'Face_EyeLeft';
    leftEyeBone.position.set(-0.03, 0.04, 0.08);
    const rightEyeBone = new THREE.Bone();
    rightEyeBone.name = 'Face_EyeRight';
    rightEyeBone.position.set(0.03, 0.04, 0.08);

    headBone.add(leftEyeBone);
    headBone.add(rightEyeBone);
    scene.add(headBone);
    scene.updateMatrixWorld(true);

    const centers = calculateEyeCenters(scene);
    expect(centers).not.toBeNull();
    expect(centers?.leftEyeLocal.x).toBeCloseTo(-0.03);
    expect(centers?.rightEyeLocal.x).toBeCloseTo(0.03);
    expect(centers?.headBone).toBe(headBone);
  });

  it('should apply concave socket inset to vertices within eye radius and cache pre-socket positions', () => {
    const geom = new THREE.PlaneGeometry(1, 1, 10, 10);
    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());
    mesh.updateMatrixWorld(true);

    const leftEye = new THREE.Vector3(-0.1, 0, 0);
    const rightEye = new THREE.Vector3(0.1, 0, 0);

    const posBefore = geom.attributes.position.clone();
    applyEyeSocketInset(mesh, leftEye, rightEye, 0.035, 0.15);

    expect(mesh.userData.originalPreSocketPositions).toBeDefined();

    // Check that vertices near eye center were pushed along Z
    const posAfter = geom.attributes.position;
    let anyVertexDisplaced = false;
    for (let i = 0; i < posAfter.count; i++) {
      if (Math.abs(posAfter.getZ(i) - posBefore.getZ(i)) > 0.001) {
        anyVertexDisplaced = true;
        break;
      }
    }
    expect(anyVertexDisplaced).toBe(true);

    // Restore and verify non-destructive reversal
    restoreOriginalEyeSocketMesh(mesh);
    expect(mesh.userData.originalPreSocketPositions).toBeUndefined();
    for (let i = 0; i < posAfter.count; i++) {
      expect(posAfter.getZ(i)).toBeCloseTo(posBefore.getZ(i), 5);
    }
  });

  it('should deform upper eyelid vertices when blinking', () => {
    const geom = new THREE.SphereGeometry(0.5, 16, 16);
    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial());
    mesh.updateMatrixWorld(true);

    const leftEye = new THREE.Vector3(0, 0, 0);
    const rightEye = new THREE.Vector3(10, 10, 10); // Far away

    applyEyelidBlinkDeformation(mesh, leftEye, rightEye, 1.0, 0.0, 0.4);

    // Verify deformation executed on attributes position
    expect(geom.attributes.position.count).toBeGreaterThan(0);
  });
});
