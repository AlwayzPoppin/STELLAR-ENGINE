import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { useStore, SceneObject } from '../store/useStore';

describe('MultiSelectionGizmo transform math and batch store updates', () => {
  beforeEach(() => {
    useStore.setState({
      objects: [
        {
          id: 'obj_1',
          name: 'Box 1',
          type: 'mesh',
          geometry: 'box',
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
        {
          id: 'obj_2',
          name: 'Box 2',
          type: 'mesh',
          geometry: 'box',
          position: [10, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        },
      ],
      selectedIds: ['obj_1', 'obj_2'],
    });
  });

  it('should accurately compute the shared centroid of multiple objects', () => {
    const storeObjects = useStore.getState().objects;
    const selectedIds = useStore.getState().selectedIds;
    const selected = storeObjects.filter((o) => selectedIds.includes(o.id));

    let sumX = 0, sumY = 0, sumZ = 0;
    for (const obj of selected) {
      sumX += obj.position[0];
      sumY += obj.position[1];
      sumZ += obj.position[2];
    }
    const count = selected.length;
    const centroid = new THREE.Vector3(sumX / count, sumY / count, sumZ / count);

    // Centroid of (0,0,0) and (10,0,0) should be (5,0,0)
    expect(centroid.x).toBe(5);
    expect(centroid.y).toBe(0);
    expect(centroid.z).toBe(0);
  });

  it('should apply multi-selection delta translation to all objects', () => {
    const initialCentroid = new THREE.Vector3(5, 0, 0);
    const newAnchorPos = new THREE.Vector3(15, 2, -3); // Delta = (+10, +2, -3)

    const obj1Pos = new THREE.Vector3(0, 0, 0);
    const obj2Pos = new THREE.Vector3(10, 0, 0);

    const offset1 = obj1Pos.clone().sub(initialCentroid); // (-5, 0, 0)
    const offset2 = obj2Pos.clone().sub(initialCentroid); // (+5, 0, 0)

    const updatedPos1 = newAnchorPos.clone().add(offset1);
    const updatedPos2 = newAnchorPos.clone().add(offset2);

    expect(updatedPos1.x).toBe(10);
    expect(updatedPos1.y).toBe(2);
    expect(updatedPos1.z).toBe(-3);

    expect(updatedPos2.x).toBe(20);
    expect(updatedPos2.y).toBe(2);
    expect(updatedPos2.z).toBe(-3);
  });

  it('should orbit objects around the shared centroid when rotated', () => {
    const initialCentroid = new THREE.Vector3(5, 0, 0);
    const obj1Pos = new THREE.Vector3(0, 0, 0);
    const offset1 = obj1Pos.clone().sub(initialCentroid); // (-5, 0, 0)

    // Rotate 90 degrees around Y axis (quaternion = (0, sin(45 deg), 0, cos(45 deg)))
    const rotQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

    const rotatedOffset1 = offset1.clone().applyQuaternion(rotQuat);
    const finalPos1 = initialCentroid.clone().add(rotatedOffset1);

    // (-5, 0, 0) rotated +90 deg around Y points towards +Z: (0, 0, 5)
    expect(finalPos1.x).toBeCloseTo(5, 4);
    expect(finalPos1.y).toBeCloseTo(0, 4);
    expect(finalPos1.z).toBeCloseTo(5, 4);
  });

  it('should batch commit multiple object transform updates into store via updateObjects', () => {
    useStore.getState().updateObjects({
      obj_1: { position: [10, 2, -3], rotation: [0, 1.57, 0] },
      obj_2: { position: [20, 2, -3], rotation: [0, 1.57, 0] },
    });

    const updatedObjects = useStore.getState().objects;
    const obj1 = updatedObjects.find((o) => o.id === 'obj_1')!;
    const obj2 = updatedObjects.find((o) => o.id === 'obj_2')!;

    expect(obj1.position).toEqual([10, 2, -3]);
    expect(obj1.rotation).toEqual([0, 1.57, 0]);
    expect(obj2.position).toEqual([20, 2, -3]);
    expect(obj2.rotation).toEqual([0, 1.57, 0]);
  });
});

describe('filterGizmoOccludedIntersections', () => {
  it('should return all items when isGizmoFocused is false', async () => {
    const { filterGizmoOccludedIntersections } = await import('./Viewport');
    const mockItems: any[] = [
      { distance: 5, object: { name: 'ForegroundMesh' } },
      { distance: 10, object: { name: 'GizmoHandle', isTransformControls: true } },
      { distance: 15, object: { name: 'BackgroundMesh' } },
    ];

    const result = filterGizmoOccludedIntersections(mockItems, false);
    expect(result.length).toBe(3);
  }, 15000);

  it('should preserve foreground objects in front of gizmo and drop occluded background objects', async () => {
    const { filterGizmoOccludedIntersections } = await import('./Viewport');
    const mockItems: any[] = [
      { distance: 4, object: { name: 'ForegroundMesh' } },
      { distance: 10, object: { name: 'TransformControls_X', isTransformControls: true } },
      { distance: 15, object: { name: 'BackgroundMesh' } },
    ];

    const result = filterGizmoOccludedIntersections(mockItems, true);
    expect(result.length).toBe(1);
    expect(result[0].object.name).toBe('ForegroundMesh');
  }, 15000);

  it('should estimate gizmo distance from camera to active target when gizmo is not in hit items', async () => {
    const { filterGizmoOccludedIntersections } = await import('./Viewport');
    const mockCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    mockCamera.position.set(0, 0, 10);

    const selectedObjects: any[] = [{ position: [0, 0, 0] }]; // Distance from camera (0,0,10) is 10

    const mockItems: any[] = [
      { distance: 3, object: { name: 'ForegroundMesh' } }, // Closer than 10 -> keep
      { distance: 12, object: { name: 'BackgroundMesh' } }, // Further than 10 -> drop
    ];

    const result = filterGizmoOccludedIntersections(mockItems, true, mockCamera, selectedObjects);
    expect(result.length).toBe(1);
    expect(result[0].object.name).toBe('ForegroundMesh');
  }, 15000);
});

