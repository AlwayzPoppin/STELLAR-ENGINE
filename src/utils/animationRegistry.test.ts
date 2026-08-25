import { describe, it, expect } from 'vitest';
import { animationRegistry } from './animationRegistry';

describe('AnimationRegistry asynchronous loading', () => {
  it('should support safe fallback heuristics before load', () => {
    // Before loading or for unknown clips, check fallback
    expect(animationRegistry.isLooping('Female_Walk_Cycle')).toBe(true);
    expect(animationRegistry.isLooping('Zombie_Run')).toBe(true);
    expect(animationRegistry.isLooping('Player_Idle_01')).toBe(true);
    expect(animationRegistry.isLooping('Melee_Slash_01')).toBe(false);
  });

  it('should asynchronously load animations dataset and build lookup maps', async () => {
    await animationRegistry.load();

    expect(animationRegistry.getIsLoaded()).toBe(true);
    const all = animationRegistry.getAll();
    expect(all.length).toBeGreaterThan(500);

    const idle = animationRegistry.get('idle');
    expect(idle).toBeDefined();
    expect(idle?.loop).toBe(true);

    const byId = animationRegistry.getById(0);
    expect(byId).toBeDefined();
    expect(byId?.name.toLowerCase()).toBe('idle');
  });

  it('should correctly query animations by category and subcategory', async () => {
    await animationRegistry.load();

    const walkAndRun = animationRegistry.getByCategory('WalkAndRun');
    expect(walkAndRun.length).toBeGreaterThan(0);

    for (const anim of walkAndRun) {
      expect(anim.category.toLowerCase()).toBe('walkandrun');
    }
  });
});
