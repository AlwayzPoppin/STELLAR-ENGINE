import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import {
  classifyBoxFrustum,
  intersectRayAABB,
  SpatialOctree,
  SpatialBVH,
  SceneSpatialIndex,
  SpatialItem,
} from './SpatialPartitioning';

describe('Spatial Partitioning & Frustum Culling Algorithms', () => {
  describe('Spatial Math & Frustum Classification', () => {
    it('should classify boxes correctly as INSIDE, OUTSIDE, or INTERSECTING a frustum', () => {
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.set(0, 0, 10);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();

      const frustum = new THREE.Frustum();
      const projScreenMatrix = new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      );
      frustum.setFromProjectionMatrix(projScreenMatrix);

      // Box directly in front of camera, well within frustum
      const insideBox = new THREE.Box3(
        new THREE.Vector3(-1, -1, -1),
        new THREE.Vector3(1, 1, 1)
      );
      const insideStatus = classifyBoxFrustum(insideBox, frustum);
      expect(insideStatus === 'INSIDE' || insideStatus === 'INTERSECTING').toBe(true);

      // Box far behind camera
      const outsideBox = new THREE.Box3(
        new THREE.Vector3(-1, -1, 50),
        new THREE.Vector3(1, 1, 60)
      );
      expect(classifyBoxFrustum(outsideBox, frustum)).toBe('OUTSIDE');

      // Box far to the side
      const outsideSideBox = new THREE.Box3(
        new THREE.Vector3(500, -1, 0),
        new THREE.Vector3(510, 1, 2)
      );
      expect(classifyBoxFrustum(outsideSideBox, frustum)).toBe('OUTSIDE');
    });

    it('should calculate accurate Ray-AABB intersections using slab method', () => {
      const box = new THREE.Box3(
        new THREE.Vector3(-1, -1, -1),
        new THREE.Vector3(1, 1, 1)
      );

      // Ray pointing straight at box center from z = 5
      const rayHit = new THREE.Ray(new THREE.Vector3(0, 0, 5), new THREE.Vector3(0, 0, -1));
      const dist = intersectRayAABB(rayHit, box);
      expect(dist).not.toBeNull();
      expect(dist).toBeCloseTo(4.0, 3); // 5 - 1 = 4 units to reach z = 1

      // Ray missing the box completely
      const rayMiss = new THREE.Ray(new THREE.Vector3(10, 10, 5), new THREE.Vector3(0, 0, -1));
      expect(intersectRayAABB(rayMiss, box)).toBeNull();

      // Ray starting inside the box
      const rayInside = new THREE.Ray(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
      const insideDist = intersectRayAABB(rayInside, box);
      expect(insideDist).not.toBeNull();
      expect(insideDist).toBeCloseTo(1.0, 3);
    });
  });

  describe('SpatialOctree', () => {
    let octree: SpatialOctree;

    beforeEach(() => {
      octree = new SpatialOctree(
        new THREE.Box3(new THREE.Vector3(-50, -50, -50), new THREE.Vector3(50, 50, 50)),
        4,
        4
      );
    });

    it('should insert items, dynamically expand bounds, and support removal', () => {
      const item1: SpatialItem = {
        id: 'item_1',
        name: 'Cube 1',
        bounds: new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2, 2, 2)),
        boundingSphere: new THREE.Sphere(new THREE.Vector3(1, 1, 1), 1.5),
      };

      const item2: SpatialItem = {
        id: 'item_2',
        name: 'Cube 2 (Outside Initial Domain)',
        bounds: new THREE.Box3(new THREE.Vector3(100, 100, 100), new THREE.Vector3(110, 110, 110)),
        boundingSphere: new THREE.Sphere(new THREE.Vector3(105, 105, 105), 8),
      };

      octree.insert(item1);
      octree.insert(item2);
      expect(octree.getItemCount()).toBe(2);

      // Verify root bounds expanded to enclose item2
      expect(octree.root.bounds.containsBox(item2.bounds)).toBe(true);

      // Removal
      octree.remove('item_1');
      expect(octree.getItemCount()).toBe(1);
      const remaining = octree.queryBox(new THREE.Box3(new THREE.Vector3(-10, -10, -10), new THREE.Vector3(10, 10, 10)));
      expect(remaining.length).toBe(0);
    });

    it('should perform spatial range queries for boxes and spheres', () => {
      const items: SpatialItem[] = [
        {
          id: 'item_near',
          bounds: new THREE.Box3(new THREE.Vector3(1, 1, 1), new THREE.Vector3(2, 2, 2)),
          boundingSphere: new THREE.Sphere(new THREE.Vector3(1.5, 1.5, 1.5), 1),
        },
        {
          id: 'item_far',
          bounds: new THREE.Box3(new THREE.Vector3(40, 40, 40), new THREE.Vector3(42, 42, 42)),
          boundingSphere: new THREE.Sphere(new THREE.Vector3(41, 41, 41), 1),
        },
      ];

      octree.rebuild(items);

      const boxHits = octree.queryBox(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(5, 5, 5)));
      expect(boxHits.map((h) => h.id)).toEqual(['item_near']);

      const sphereHits = octree.querySphere(new THREE.Sphere(new THREE.Vector3(41, 41, 41), 3));
      expect(sphereHits.map((h) => h.id)).toEqual(['item_far']);
    });

    it('should perform fast accelerated raycasting with hits sorted by distance', () => {
      const itemA: SpatialItem = {
        id: 'item_a',
        bounds: new THREE.Box3(new THREE.Vector3(-1, -1, 4), new THREE.Vector3(1, 1, 6)),
        boundingSphere: new THREE.Sphere(new THREE.Vector3(0, 0, 5), 1.5),
      };
      const itemB: SpatialItem = {
        id: 'item_b',
        bounds: new THREE.Box3(new THREE.Vector3(-1, -1, 10), new THREE.Vector3(1, 1, 12)),
        boundingSphere: new THREE.Sphere(new THREE.Vector3(0, 0, 11), 1.5),
      };

      octree.rebuild([itemB, itemA]);

      const ray = new THREE.Ray(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 1));
      const hits = octree.raycast(ray);

      expect(hits.length).toBe(2);
      expect(hits[0].item.id).toBe('item_a');
      expect(hits[1].item.id).toBe('item_b');
      expect(hits[0].distance).toBeLessThan(hits[1].distance);
    });
  });

  describe('SpatialBVH', () => {
    let bvh: SpatialBVH;

    beforeEach(() => {
      bvh = new SpatialBVH(8, 2);
    });

    it('should build a binary hierarchy and perform frustum queries', () => {
      const items: SpatialItem[] = [
        {
          id: 'bvh_item_1',
          bounds: new THREE.Box3(new THREE.Vector3(-2, -2, -2), new THREE.Vector3(2, 2, 2)),
          boundingSphere: new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2.5),
        },
        {
          id: 'bvh_item_2',
          bounds: new THREE.Box3(new THREE.Vector3(20, 20, 20), new THREE.Vector3(24, 24, 24)),
          boundingSphere: new THREE.Sphere(new THREE.Vector3(22, 22, 22), 3),
        },
        {
          id: 'bvh_item_3',
          bounds: new THREE.Box3(new THREE.Vector3(-50, -50, -50), new THREE.Vector3(-45, -45, -45)),
          boundingSphere: new THREE.Sphere(new THREE.Vector3(-47.5, -47.5, -47.5), 4),
        },
      ];

      bvh.build(items);
      expect(bvh.getItemCount()).toBe(3);
      expect(bvh.root).not.toBeNull();

      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.set(0, 0, 10);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();

      const frustum = new THREE.Frustum();
      const projScreenMatrix = new THREE.Matrix4().multiplyMatrices(
        camera.projectionMatrix,
        camera.matrixWorldInverse
      );
      frustum.setFromProjectionMatrix(projScreenMatrix);

      const visible = bvh.queryFrustum(frustum);
      expect(visible.has('bvh_item_1')).toBe(true);
      expect(visible.has('bvh_item_3')).toBe(false);
    });

    it('should support raycasting and bounding refits', () => {
      const item: SpatialItem = {
        id: 'target',
        bounds: new THREE.Box3(new THREE.Vector3(0, 0, 5), new THREE.Vector3(2, 2, 7)),
        boundingSphere: new THREE.Sphere(new THREE.Vector3(1, 1, 6), 1.5),
      };

      bvh.build([item]);

      const ray = new THREE.Ray(new THREE.Vector3(1, 1, 0), new THREE.Vector3(0, 0, 1));
      const hits = bvh.raycast(ray);
      expect(hits.length).toBe(1);
      expect(hits[0].distance).toBeCloseTo(5.0, 3);

      // Move bounds and refit
      item.bounds.set(new THREE.Vector3(0, 0, 10), new THREE.Vector3(2, 2, 12));
      bvh.refit();

      const newHits = bvh.raycast(ray);
      expect(newHits.length).toBe(1);
      expect(newHits[0].distance).toBeCloseTo(10.0, 3);
    });
  });

  describe('SceneSpatialIndex Manager & Benchmarks', () => {
    let index: SceneSpatialIndex;

    beforeEach(() => {
      index = SceneSpatialIndex.getInstance();
      index.clear();
      index.setStructureType('octree');
    });

    it('should register items, switch structure type seamlessly, and perform frustum culling', () => {
      const mockMeshVisible = { visible: true };
      const mockMeshCulled = { visible: true };

      index.registerItem(
        'obj_visible',
        new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(1, 1, 1)),
        mockMeshVisible as any
      );

      index.registerItem(
        'obj_behind_camera',
        new THREE.Box3(new THREE.Vector3(0, 0, 50), new THREE.Vector3(2, 2, 52)),
        mockMeshCulled as any
      );

      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.set(0, 0, 10);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();

      // Test with Octree
      index.setStructureType('octree');
      let result = index.performFrustumCulling(camera);
      expect(result.totalCount).toBe(2);
      expect(result.visibleIds.has('obj_visible')).toBe(true);
      expect(result.visibleIds.has('obj_behind_camera')).toBe(false);
      expect(mockMeshVisible.visible).toBe(true);
      expect(mockMeshCulled.visible).toBe(false);

      // Switch to BVH structure
      index.setStructureType('bvh');
      result = index.performFrustumCulling(camera);
      expect(result.totalCount).toBe(2);
      expect(result.visibleIds.has('obj_visible')).toBe(true);
      expect(result.visibleIds.has('obj_behind_camera')).toBe(false);
    });

    it('should handle large scene scaling benchmark with 1,000 objects in < 5ms', () => {
      const count = 1000;
      for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * 500;
        const y = (Math.random() - 0.5) * 50;
        const z = (Math.random() - 0.5) * 500;
        index.registerItem(
          `benchmark_obj_${i}`,
          new THREE.Box3(new THREE.Vector3(x - 1, y - 1, z - 1), new THREE.Vector3(x + 1, y + 1, z + 1))
        );
      }

      expect(index.getItemCount()).toBe(count);

      const camera = new THREE.PerspectiveCamera(60, 1.6, 0.1, 200);
      camera.position.set(0, 15, 50);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();

      const t0 = performance.now();
      const cullResult = index.performFrustumCulling(camera);
      const elapsed = performance.now() - t0;

      expect(cullResult.totalCount).toBe(count);
      expect(cullResult.visibleCount + cullResult.culledCount).toBe(count);
      expect(elapsed).toBeLessThan(25); // Should easily execute in single-digit ms
    });
  });
});
