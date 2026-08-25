import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

describe('MarqueeSelectionController logic', () => {
  it('should project 3D objects correctly to screen pixels and select those within box', () => {
    const width = 800;
    const height = 600;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    // Test point at origin (0, 0, 0)
    const origin = new THREE.Vector3(0, 0, 0);
    origin.project(camera);

    const screenX = (origin.x * 0.5 + 0.5) * width;
    const screenY = (-origin.y * 0.5 + 0.5) * height;

    // Origin should project near center of the screen
    expect(screenX).toBeCloseTo(400, 0);
    expect(screenY).toBeCloseTo(300, 0);
    expect(origin.z).toBeGreaterThan(-1);
    expect(origin.z).toBeLessThan(1);

    // Box covering [300, 200] to [500, 400] should encompass center point
    const minX = 300;
    const maxX = 500;
    const minY = 200;
    const maxY = 400;

    const isInside = screenX >= minX && screenX <= maxX && screenY >= minY && screenY <= maxY;
    expect(isInside).toBe(true);
  });

  it('should correctly calculate 2D bounding overlap for multi-mesh GLB models', () => {
    const width = 800;
    const height = 600;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    // Simulate GLB model hierarchy (e.g. dragon root with child meshes)
    const glbRoot = new THREE.Group();
    glbRoot.position.set(0, 0, 0);

    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
    bodyMesh.position.set(0, 1, 0);
    glbRoot.add(bodyMesh);

    const wingMesh = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 1));
    wingMesh.position.set(2, 1.5, 0);
    glbRoot.add(wingMesh);

    glbRoot.updateMatrixWorld(true);

    // Compute bounding box from GLB root
    const box3 = new THREE.Box3().setFromObject(glbRoot);
    expect(box3.isEmpty()).toBe(false);

    // Project 8 corners to screen
    const corners = [
      new THREE.Vector3(box3.min.x, box3.min.y, box3.min.z),
      new THREE.Vector3(box3.min.x, box3.min.y, box3.max.z),
      new THREE.Vector3(box3.min.x, box3.max.y, box3.min.z),
      new THREE.Vector3(box3.min.x, box3.max.y, box3.max.z),
      new THREE.Vector3(box3.max.x, box3.min.y, box3.min.z),
      new THREE.Vector3(box3.max.x, box3.min.y, box3.max.z),
      new THREE.Vector3(box3.max.x, box3.max.y, box3.min.z),
      new THREE.Vector3(box3.max.x, box3.max.y, box3.max.z),
    ];

    let objMinX = Infinity;
    let objMaxX = -Infinity;
    let objMinY = Infinity;
    let objMaxY = -Infinity;

    for (const corner of corners) {
      corner.project(camera);
      const screenX = (corner.x * 0.5 + 0.5) * width;
      const screenY = (-corner.y * 0.5 + 0.5) * height;
      objMinX = Math.min(objMinX, screenX);
      objMaxX = Math.max(objMaxX, screenX);
      objMinY = Math.min(objMinY, screenY);
      objMaxY = Math.max(objMaxY, screenY);
    }

    // A marquee box covering the center area should overlap the GLB model
    const marqueeMinX = 350;
    const marqueeMaxX = 450;
    const marqueeMinY = 250;
    const marqueeMaxY = 350;

    const overlaps = !(objMaxX < marqueeMinX || objMinX > marqueeMaxX || objMaxY < marqueeMinY || objMinY > marqueeMaxY);
    expect(overlaps).toBe(true);
  });

  it('should ignore objects behind the camera', () => {
    const width = 800;
    const height = 600;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    camera.updateProjectionMatrix();

    // Point far behind camera (0, 5, 20)
    const behind = new THREE.Vector3(0, 5, 20);
    behind.project(camera);

    // Behind camera point will have z > 1 in NDC
    expect(behind.z).toBeGreaterThan(1);
  });
});
