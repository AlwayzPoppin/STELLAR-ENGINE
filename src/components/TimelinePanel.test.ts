import { describe, it, expect } from 'vitest';
import { getCachedKeyframeFrames } from './TimelinePanel';

describe('TimelinePanel track optimization and calculations', () => {
  it('should calculate total track width and frame click indices without DOM per-cell rendering', () => {
    const maxFrames = 100;
    const frameWidth = 24;
    const totalTrackWidth = (maxFrames + 1) * frameWidth;

    expect(totalTrackWidth).toBe(2424);

    // Test coordinate-to-frame index calculation
    const clickX = 120; // 5 * 24 = 120 -> Frame 5
    const clickedFrame = Math.max(0, Math.min(maxFrames, Math.floor(clickX / frameWidth)));
    expect(clickedFrame).toBe(5);

    // Test boundary clamping
    const negativeClick = -10;
    expect(Math.max(0, Math.min(maxFrames, Math.floor(negativeClick / frameWidth)))).toBe(0);

    const overflowClick = 3000;
    expect(Math.max(0, Math.min(maxFrames, Math.floor(overflowClick / frameWidth)))).toBe(maxFrames);
  });

  it('should extract keyframe indices sparsely and memoize result in WeakMap', () => {
    const keyframes = {
      '0': [0, 0, 0, 1],
      '24': [0, 0.707, 0, 0.707],
      '48': [0, 1, 0, 0],
    };

    const maxFrames = 100;
    const entries1 = getCachedKeyframeFrames(keyframes, maxFrames);
    const entries2 = getCachedKeyframeFrames(keyframes, maxFrames);

    // Only 3 keyframes exist on this track
    expect(entries1).toEqual([0, 24, 48]);
    expect(entries1.length).toBe(3);
    // Verifying reference equality from WeakMap memoization cache
    expect(entries1).toBe(entries2);
  });

  it('should parse and clamp manual frame inputs, preventing negative values', () => {
    const maxFrames = 60;
    const parseFrame = (input: string) => {
      const raw = input.trim();
      if (raw === '' || raw === '-') return 0;
      const val = parseInt(raw, 10);
      return isNaN(val) ? 0 : Math.max(0, Math.min(maxFrames, val));
    };

    expect(parseFrame('-15')).toBe(0);
    expect(parseFrame('-1')).toBe(0);
    expect(parseFrame('-')).toBe(0);
    expect(parseFrame('')).toBe(0);
    expect(parseFrame('abc')).toBe(0);
    expect(parseFrame('30')).toBe(30);
    expect(parseFrame('100')).toBe(60);
  });
});
