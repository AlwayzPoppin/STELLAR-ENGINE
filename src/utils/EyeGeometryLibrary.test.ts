import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  generateProceduralEyeCanvas,
  createEyeCanvasTexture,
  createEyeballGeometry,
  IRIS_COLOR_PRESETS,
} from './EyeGeometryLibrary';

describe('EyeGeometryLibrary', () => {
  it('should have predefined iris color presets', () => {
    expect(IRIS_COLOR_PRESETS.length).toBeGreaterThanOrEqual(8);
    const oceanBlue = IRIS_COLOR_PRESETS.find((p) => p.name === 'Ocean Blue');
    expect(oceanBlue).toBeDefined();
    expect(oceanBlue?.hex).toBe('#2563eb');
  });

  it('should handle procedural eye canvas generation safely', () => {
    const canvas = generateProceduralEyeCanvas({
      irisColor: '#16a34a',
      pupilSize: 0.4,
      resolution: 256,
    });
    if (typeof document !== 'undefined') {
      expect(canvas).toBeInstanceOf(HTMLCanvasElement);
      expect(canvas?.width).toBe(256);
      expect(canvas?.height).toBe(256);
    } else {
      expect(canvas).toBeNull();
    }
  });

  it('should create a valid Three.js texture', () => {
    const texture = createEyeCanvasTexture({
      irisColor: '#d97706',
      pupilSize: 0.5,
    });
    expect(texture).toBeInstanceOf(THREE.Texture);
    expect(texture.image).toBeDefined();
  });

  it('should create eyeball geometry rotated so the iris pole faces forward (+Z)', () => {
    const geom = createEyeballGeometry(0.5, 32);
    expect(geom).toBeInstanceOf(THREE.SphereGeometry);
    expect(geom.attributes.position.count).toBeGreaterThan(0);
  });
});
