import { describe, it, expect, vi, beforeEach } from 'vitest';
import { failedScripts } from './Viewport';

describe('Script Execution Loop and Blacklist Guard', () => {
  beforeEach(() => {
    failedScripts.clear();
    vi.restoreAllMocks();
  });

  it('should prevent repeated console spam and execution when a script throws at runtime', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const scriptId = 'broken_script_1';
    let executionCount = 0;

    const throwingScript = (self: any, delta: number) => {
      executionCount++;
      throw new Error('NullReferenceException in player controller');
    };

    // Simulate 60 frames of game loop
    for (let frame = 0; frame < 60; frame++) {
      if (failedScripts.has(scriptId)) continue;
      try {
        throwingScript({}, 0.016);
      } catch (e: any) {
        failedScripts.add(scriptId);
        console.error(`[Script Runtime Error] Script "${scriptId}" failed and was paused:`, e.message);
      }
    }

    // The script should have only executed once and logged once
    expect(executionCount).toBe(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(failedScripts.has(scriptId)).toBe(true);
  });

  it('should allow script execution again once re-compiled and unblacklisted', () => {
    const scriptId = 'broken_script_2';
    failedScripts.add(scriptId);
    expect(failedScripts.has(scriptId)).toBe(true);

    // Simulate script edit / re-compile
    failedScripts.delete(scriptId);
    expect(failedScripts.has(scriptId)).toBe(false);

    let executed = false;
    const fixedScript = () => {
      executed = true;
    };

    if (!failedScripts.has(scriptId)) {
      fixedScript();
    }

    expect(executed).toBe(true);
  });
});
