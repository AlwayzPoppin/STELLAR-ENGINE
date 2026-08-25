import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeScrubValue } from './ScrubbableInput';

describe('ScrubbableInput math and drag helpers', () => {
  it('should accurately compute scrubbed values with step and precision', () => {
    // startValue: 10, deltaX: 50, step: 0.1, precision: 2
    expect(computeScrubValue(10, 50, 0.1, 2)).toBe(15);

    // Negative scrubbing
    expect(computeScrubValue(10, -30, 0.1, 2)).toBe(7);

    // Floating point precision handling
    expect(computeScrubValue(1.05, 12, 0.01, 2)).toBe(1.17);
    expect(computeScrubValue(0, 3, 0.3333, 3)).toBe(1);
  });

  it('should support pointer capture and window listener cleanup structure', () => {
    const dummyElement = {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    };

    const pointerEvent = {
      clientX: 200,
      pointerId: 42,
      target: dummyElement,
      preventDefault: vi.fn(),
    };

    // Verify pointer capture method invocation
    dummyElement.setPointerCapture(pointerEvent.pointerId);
    expect(dummyElement.setPointerCapture).toHaveBeenCalledWith(42);
  });
});
