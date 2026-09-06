import { describe, it, expect } from 'vitest';
import { FACIAL_LANDMARKS, getMirroredPosition } from './FacialLandmarks';

describe('FacialLandmarks', () => {
  it('should have 12 key facial landmarks defined in logical sequence', () => {
    expect(FACIAL_LANDMARKS.length).toBe(12);

    const keys = FACIAL_LANDMARKS.map((l) => l.key);
    expect(keys).toContain('eye_left');
    expect(keys).toContain('eye_right');
    expect(keys).toContain('brow_left');
    expect(keys).toContain('brow_right');
    expect(keys).toContain('nose_tip');
    expect(keys).toContain('cheek_left');
    expect(keys).toContain('cheek_right');
    expect(keys).toContain('lip_upper');
    expect(keys).toContain('lip_lower');
    expect(keys).toContain('lip_corner_left');
    expect(keys).toContain('lip_corner_right');
    expect(keys).toContain('chin_jaw');
  });

  it('should have valid default offsets and bone names for all landmarks', () => {
    for (const landmark of FACIAL_LANDMARKS) {
      expect(landmark.boneName.startsWith('Face_')).toBe(true);
      expect(landmark.label.length).toBeGreaterThan(0);
      expect(landmark.hint.length).toBeGreaterThan(0);
      expect(landmark.defaultLocalOffset.length).toBe(3);
    }
  });

  it('should correctly mirror X coordinates when symmetry is enabled', () => {
    const leftEyePos: [number, number, number] = [-0.035, 0.045, 0.08];
    const mirroredPos = getMirroredPosition(leftEyePos);
    expect(mirroredPos[0]).toBeCloseTo(0.035);
    expect(mirroredPos[1]).toBeCloseTo(0.045);
    expect(mirroredPos[2]).toBeCloseTo(0.08);
  });
});
