import { describe, it, expect, vi, beforeEach } from 'vitest';
import { failedScripts, compiledScripts, clearCompiledScripts } from './Viewport';

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

  it('should cleanly manage compiledScripts Map and purge old references', () => {
    clearCompiledScripts();

    const scriptId = 'rotator_script';
    const fn1 = new Function('self', 'delta', 'self.rotation.y += delta');
    compiledScripts.set(scriptId, fn1);

    expect(compiledScripts.has(scriptId)).toBe(true);
    expect(compiledScripts.get(scriptId)).toBe(fn1);

    // Update with new compilation
    const fn2 = new Function('self', 'delta', 'self.rotation.x += delta');
    compiledScripts.set(scriptId, fn2);
    expect(compiledScripts.get(scriptId)).toBe(fn2);

    // Delete / unmount
    compiledScripts.delete(scriptId);
    expect(compiledScripts.has(scriptId)).toBe(false);
    expect(compiledScripts.get(scriptId)).toBeUndefined();

    // Clear all
    compiledScripts.set('s1', () => {});
    compiledScripts.set('s2', () => {});
    clearCompiledScripts();
    expect(compiledScripts.size).toBe(0);
  });
});
