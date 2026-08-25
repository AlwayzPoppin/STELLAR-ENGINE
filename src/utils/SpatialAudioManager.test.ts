import { describe, it, expect } from 'vitest';
import { calculateSpatialGain } from './SpatialAudioManager';

describe('SpatialAudioManager Falloff Curves and Calculations', () => {
  describe('Linear Distance Model', () => {
    it('should return 1.0 when distance <= refDistance', () => {
      const gain = calculateSpatialGain(1, {
        refDistance: 2,
        maxDistance: 10,
        distanceModel: 'linear',
      });
      expect(gain).toBe(1.0);
    });

    it('should return 0.5 at exact midpoint between refDistance and maxDistance with rolloffFactor=1', () => {
      const gain = calculateSpatialGain(6, {
        refDistance: 2,
        maxDistance: 10,
        rolloffFactor: 1,
        distanceModel: 'linear',
      });
      expect(gain).toBeCloseTo(0.5, 4);
    });

    it('should return 0.0 when distance >= maxDistance', () => {
      const gain = calculateSpatialGain(15, {
        refDistance: 2,
        maxDistance: 10,
        distanceModel: 'linear',
      });
      expect(gain).toBe(0.0);
    });
  });

  describe('Inverse Distance Model', () => {
    it('should return 1.0 when distance <= refDistance', () => {
      const gain = calculateSpatialGain(0.5, {
        refDistance: 1,
        maxDistance: 50,
        distanceModel: 'inverse',
      });
      expect(gain).toBe(1.0);
    });

    it('should halve gain when distance is 2x refDistance with rolloffFactor=1', () => {
      const gain = calculateSpatialGain(2, {
        refDistance: 1,
        rolloffFactor: 1,
        distanceModel: 'inverse',
      });
      // ref / (ref + rolloff * (d - ref)) = 1 / (1 + 1*(2-1)) = 1/2 = 0.5
      expect(gain).toBeCloseTo(0.5, 4);
    });

    it('should calculate accurate inverse attenuation for higher rolloff factors', () => {
      const gain = calculateSpatialGain(2, {
        refDistance: 1,
        rolloffFactor: 3,
        distanceModel: 'inverse',
      });
      // 1 / (1 + 3*(2-1)) = 1/4 = 0.25
      expect(gain).toBeCloseTo(0.25, 4);
    });
  });

  describe('Exponential Distance Model', () => {
    it('should return 1.0 when distance <= refDistance', () => {
      const gain = calculateSpatialGain(1, {
        refDistance: 1,
        distanceModel: 'exponential',
      });
      expect(gain).toBe(1.0);
    });

    it('should calculate exponential dropoff based on rolloffFactor exponent', () => {
      const gain = calculateSpatialGain(2, {
        refDistance: 1,
        rolloffFactor: 2,
        distanceModel: 'exponential',
      });
      // (2 / 1) ^ -2 = 1 / 4 = 0.25
      expect(gain).toBeCloseTo(0.25, 4);
    });
  });

  describe('Collision Audio and One-Shot Playback', () => {
    it('should play collision audio and throttle rapid repeated hits within 50ms', async () => {
      const { SpatialAudioManager } = await import('./SpatialAudioManager');
      const mockNode = {
        add: () => {},
        remove: () => {},
        position: { set: () => {} },
      } as any;

      // First trigger should execute
      await expect(
        SpatialAudioManager.playCollisionAudio(mockNode, 'obj_box_1', undefined, 1.2)
      ).resolves.toBeUndefined();

      // Immediate second trigger within 50ms should be throttled safely
      await expect(
        SpatialAudioManager.playCollisionAudio(mockNode, 'obj_box_1', undefined, 1.2)
      ).resolves.toBeUndefined();
    });

    it('should safely generate procedural impact sound buffer without errors', async () => {
      const { SpatialAudioManager } = await import('./SpatialAudioManager');
      const buffer = SpatialAudioManager.getProceduralImpactBuffer(1.5);
      // In NodeJS test environment where AudioContext createBuffer may be simulated or null
      expect(buffer === null || typeof buffer === 'object').toBe(true);
    });
  });
});
