import { describe, it, expect } from 'vitest';
import { computeClampedMenuPosition } from './ContextMenu';

describe('ContextMenu boundary clipping calculation', () => {
  const viewportWidth = 1920;
  const viewportHeight = 1080;
  const menuWidth = 200;
  const menuHeight = 350;
  const padding = 8;

  it('should preserve coordinates when opened with plenty of clearance in center screen', () => {
    const pos = computeClampedMenuPosition(500, 400, menuWidth, menuHeight, viewportWidth, viewportHeight, padding);
    expect(pos.left).toBe(500);
    expect(pos.top).toBe(400);
  });

  it('should clamp bottom-right overflow to remain completely visible on screen', () => {
    // Clicked right at the bottom-right corner (1910, 1070)
    const pos = computeClampedMenuPosition(1910, 1070, menuWidth, menuHeight, viewportWidth, viewportHeight, padding);
    
    // Left should be clamped within viewportWidth - menuWidth - padding
    expect(pos.left).toBe(viewportWidth - menuWidth - padding);
    expect(pos.left + menuWidth).toBeLessThanOrEqual(viewportWidth);

    // Top should be clamped within viewportHeight - menuHeight - padding
    expect(pos.top).toBe(viewportHeight - menuHeight - padding);
    expect(pos.top + menuHeight).toBeLessThanOrEqual(viewportHeight);
  });

  it('should not allow negative or top-left boundary overflow', () => {
    const pos = computeClampedMenuPosition(-50, -20, menuWidth, menuHeight, viewportWidth, viewportHeight, padding);
    expect(pos.left).toBe(padding);
    expect(pos.top).toBe(padding);
  });
});
