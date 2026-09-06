import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { applyVertexWeightBrush } from '../utils/weightPainting';

describe('Vertex Weight Painter Logic', () => {
  it('should initialize color attribute on geometry when painting on unweighted mesh', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1, 2, 2, 2);
    expect(geometry.attributes.color).toBeUndefined();

    const modified = applyVertexWeightBrush({
      geometry,
      localHitPoint: new THREE.Vector3(0.5, 0.5, 0.5),
      radius: 0.5,
      strength: 1.0,
      targetValue: 1.0,
      channel: 'r',
    });

    expect(modified).toBe(true);
    expect(geometry.attributes.color).toBeDefined();
    expect(geometry.attributes.color.itemSize).toBe(4);
  });

  it('should modify only vertices within the brush radius', () => {
    const geometry = new THREE.PlaneGeometry(2, 2, 4, 4);
    const hitPoint = new THREE.Vector3(0, 0, 0);

    applyVertexWeightBrush({
      geometry,
      localHitPoint: hitPoint,
      radius: 0.4,
      strength: 1.0,
      targetValue: 1.0,
      channel: 'g', // Wind sway
    });

    const posAttr = geometry.attributes.position;
    const colorAttr = geometry.attributes.color as THREE.BufferAttribute;

    const vPos = new THREE.Vector3();
    let insideCount = 0;
    let outsideCount = 0;

    for (let i = 0; i < posAttr.count; i++) {
      vPos.fromBufferAttribute(posAttr, i);
      const dist = vPos.distanceTo(hitPoint);
      const weight = colorAttr.getComponent(i, 1); // Green channel

      if (dist <= 0.4) {
        expect(weight).toBeGreaterThan(0);
        insideCount++;
      } else {
        expect(weight).toBe(0);
        outsideCount++;
      }
    }

    expect(insideCount).toBeGreaterThan(0);
    expect(outsideCount).toBeGreaterThan(0);
  });

  it('should independently paint across all 4 channels (R, G, B, A)', () => {
    const geometry = new THREE.SphereGeometry(1, 8, 8);
    const hitPoint = new THREE.Vector3(0, 1, 0);

    // Paint R (Electrical)
    applyVertexWeightBrush({
      geometry,
      localHitPoint: hitPoint,
      radius: 0.5,
      strength: 1.0,
      targetValue: 0.8,
      channel: 'r',
    });

    // Paint G (Wind Sway)
    applyVertexWeightBrush({
      geometry,
      localHitPoint: hitPoint,
      radius: 0.5,
      strength: 1.0,
      targetValue: 0.6,
      channel: 'g',
    });

    // Paint B (Pulse Glow)
    applyVertexWeightBrush({
      geometry,
      localHitPoint: hitPoint,
      radius: 0.5,
      strength: 1.0,
      targetValue: 0.4,
      channel: 'b',
    });

    // Paint A (Jiggle Physics)
    applyVertexWeightBrush({
      geometry,
      localHitPoint: hitPoint,
      radius: 0.5,
      strength: 1.0,
      targetValue: 0.9,
      channel: 'a',
    });

    const colorAttr = geometry.attributes.color as THREE.BufferAttribute;

    // Find the vertex closest to (0, 1, 0)
    let closestIdx = 0;
    let minDistance = Infinity;
    const vPos = new THREE.Vector3();
    for (let i = 0; i < geometry.attributes.position.count; i++) {
      vPos.fromBufferAttribute(geometry.attributes.position, i);
      const d = vPos.distanceTo(hitPoint);
      if (d < minDistance) {
        minDistance = d;
        closestIdx = i;
      }
    }

    expect(colorAttr.getComponent(closestIdx, 0)).toBeCloseTo(0.8, 1);
    expect(colorAttr.getComponent(closestIdx, 1)).toBeCloseTo(0.6, 1);
    expect(colorAttr.getComponent(closestIdx, 2)).toBeCloseTo(0.4, 1);
    expect(colorAttr.getComponent(closestIdx, 3)).toBeCloseTo(0.9, 1);
  });

  it('should support erase mode by reducing weights toward 0', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1, 4, 4, 4);
    const hitPoint = new THREE.Vector3(0.5, 0.5, 0.5);

    // 1. Paint weights to 1.0
    applyVertexWeightBrush({
      geometry,
      localHitPoint: hitPoint,
      radius: 0.6,
      strength: 1.0,
      targetValue: 1.0,
      channel: 'r',
    });

    const colorAttr = geometry.attributes.color as THREE.BufferAttribute;
    const initialPeakWeight = colorAttr.getComponent(0, 0);

    // 2. Erase weights (targetValue = 0.0)
    applyVertexWeightBrush({
      geometry,
      localHitPoint: hitPoint,
      radius: 0.6,
      strength: 0.8,
      targetValue: 0.0,
      channel: 'r',
    });

    const erasedPeakWeight = colorAttr.getComponent(0, 0);
    expect(erasedPeakWeight).toBeLessThan(initialPeakWeight);
  });
});
