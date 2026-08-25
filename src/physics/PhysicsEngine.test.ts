import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  getWaveDisplacementAt,
  getWaveNormalAt,
  quaternionFromNormal,
  updateWaterBuoyancy,
  BuoyancyObject,
} from './PhysicsEngine';

describe('PhysicsEngine memory pooling & wave calculation precision', () => {
  it('should compute wave displacement correctly', () => {
    const disp1 = getWaveDisplacementAt(0, 0, 0);
    expect(typeof disp1).toBe('number');

    const disp2 = getWaveDisplacementAt(10, 5, 1.0, { waveHeight: 0.2, waveSpeed: 2.0 });
    expect(typeof disp2).toBe('number');
    expect(Math.abs(disp2)).toBeLessThanOrEqual(0.4);
  });

  it('should write to custom target vector without mutating hidden global state', () => {
    const targetA = new THREE.Vector3();
    const targetB = new THREE.Vector3();

    const normalA = getWaveNormalAt(0, 0, 0, undefined, targetA);
    const normalB = getWaveNormalAt(10, 10, 2.0, undefined, targetB);

    expect(normalA).toBe(targetA);
    expect(normalB).toBe(targetB);
    expect(normalA).not.toBe(normalB);

    // Verify vectors remain independent after sequential calls
    expect(normalA.x).not.toBe(normalB.x);
    expect(normalA).toBeInstanceOf(THREE.Vector3);
    expect(normalA.length()).toBeCloseTo(1.0, 5);
  });

  it('should return a new independent vector if target is omitted', () => {
    const vec1 = getWaveNormalAt(0, 0, 0);
    const vec2 = getWaveNormalAt(5, 5, 1.0);

    expect(vec1).not.toBe(vec2);
    expect(vec1.length()).toBeCloseTo(1.0, 5);
    expect(vec2.length()).toBeCloseTo(1.0, 5);
  });

  it('should write quaternion to custom target quaternion', () => {
    const normal = new THREE.Vector3(0, 1, 0);
    const targetQuat = new THREE.Quaternion();

    const result = quaternionFromNormal(normal, targetQuat);
    expect(result).toBe(targetQuat);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(0, 5);
    expect(result.z).toBeCloseTo(0, 5);
    expect(result.w).toBeCloseTo(1, 5);
  });

  it('should integrate water buoyancy forces on floating object', () => {
    const obj: BuoyancyObject = {
      position: new THREE.Vector3(0, -0.5, 0), // Partially submerged
      velocity: new THREE.Vector3(0, 0, 0),
      quaternion: new THREE.Quaternion(),
      mass: 5,
      scale: new THREE.Vector3(1, 1, 1),
    };

    updateWaterBuoyancy(obj, 0, 0, 0.016);

    // Buoyancy force should accelerate object upwards
    expect(obj.velocity!.y).toBeGreaterThan(0);
    expect(obj.position.y).toBeGreaterThan(-0.5);
  });
});
