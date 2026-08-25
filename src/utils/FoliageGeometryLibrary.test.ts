import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  PROCEDURAL_FOLIAGE_PRESETS,
  getProceduralFoliageParts,
  computeFoliageInstanceColor,
  applyWindSwayShader,
} from './FoliageGeometryLibrary';

describe('FoliageGeometryLibrary', () => {
  it('should list all registered procedural foliage presets', () => {
    expect(PROCEDURAL_FOLIAGE_PRESETS.length).toBeGreaterThanOrEqual(5);
    const ids = PROCEDURAL_FOLIAGE_PRESETS.map((p) => p.id);
    expect(ids).toContain('procedural:grass');
    expect(ids).toContain('procedural:pine_tree');
    expect(ids).toContain('procedural:rock');
    expect(ids).toContain('procedural:bush');
    expect(ids).toContain('procedural:flower');
  });

  it('should generate valid geometries and materials for all procedural presets', () => {
    for (const preset of PROCEDURAL_FOLIAGE_PRESETS) {
      const parts = getProceduralFoliageParts(preset.id);
      expect(parts).not.toBeNull();
      expect(parts!.length).toBeGreaterThan(0);

      for (const part of parts!) {
        expect(part.geometry).toBeInstanceOf(THREE.BufferGeometry);
        expect(part.material).toBeDefined();
        expect(part.localMatrix).toBeInstanceOf(THREE.Matrix4);
        expect(typeof part.baseColorHex).toBe('string');
      }
    }
  });

  it('should return null for non-procedural asset URLs', () => {
    expect(getProceduralFoliageParts('/models/pine_tree.glb')).toBeNull();
    expect(getProceduralFoliageParts('')).toBeNull();
  });

  it('should generate deterministic color variations for identical instance IDs', () => {
    const colorA1 = computeFoliageInstanceColor('#4ade80', 'fol_instance_123');
    const colorA2 = computeFoliageInstanceColor('#4ade80', 'fol_instance_123');
    const colorB = computeFoliageInstanceColor('#4ade80', 'fol_instance_456');

    expect(colorA1.getHexString()).toBe(colorA2.getHexString());
    // Different instance IDs should produce distinct tint nuances
    expect(colorA1.getHexString()).not.toBe(colorB.getHexString());
  });

  it('should apply wind sway shader uniforms via onBeforeCompile', () => {
    const mat = new THREE.MeshStandardMaterial({ color: '#22c55e' });
    applyWindSwayShader(mat, 1.5);

    expect(typeof mat.onBeforeCompile).toBe('function');
    expect(typeof mat.customProgramCacheKey).toBe('function');
    expect(mat.customProgramCacheKey()).toBe('foliage_wind_sway_1.50');

    const mockShader = {
      uniforms: {} as any,
      vertexShader: 'void main() { #include <begin_vertex> }',
    };

    mat.onBeforeCompile(mockShader as any, {} as any);

    expect(mockShader.uniforms.uWindTime).toBeDefined();
    expect(mockShader.uniforms.uWindStrength).toBeDefined();
    expect(mockShader.vertexShader).toContain('uniform float uWindTime;');
    expect(mockShader.vertexShader).toContain('heightFactor');
  });
});
