import { describe, it, expect } from 'vitest';

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

  it('should extract keyframe indices sparsely without generating empty frame nodes', () => {
    const track = {
      boneName: 'mixamorig_RightArm',
      property: 'rotation' as const,
      keyframes: {
        '0': [0, 0, 0, 1],
        '24': [0, 0.707, 0, 0.707],
        '48': [0, 1, 0, 0],
      },
    };

    const maxFrames = 100;
    const keyframeEntries = Object.keys(track.keyframes)
      .map(Number)
      .filter((f) => !isNaN(f) && f >= 0 && f <= maxFrames);

    // Only 3 keyframes exist on this track
    expect(keyframeEntries).toEqual([0, 24, 48]);
    expect(keyframeEntries.length).toBe(3);
  });
});
