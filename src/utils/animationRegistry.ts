import { useState, useEffect } from 'react';

export interface MeshyAnimation {
  action_id: number;
  name: string;
  category: string;
  subcategory: string;
  loop: boolean;
  axis: 'forward' | 'backward' | 'back-left' | 'back-right' | 'forward-left' | 'forward-right' | null;
}

class AnimationRegistry {
  private animations: MeshyAnimation[] = [];
  private byNameMap: Map<string, MeshyAnimation> = new Map();
  private byIdMap: Map<number, MeshyAnimation> = new Map();
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  /**
   * Asynchronously load animations JSON chunk to keep main bundle small
   * and optimize cold startup time-to-interactive.
   */
  async load(): Promise<void> {
    if (this.isLoaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const module = await import('./meshy_animations.json');
        const data = module.default || module;
        this.animations = (data.animations || []) as MeshyAnimation[];

        this.byNameMap.clear();
        this.byIdMap.clear();

        for (const anim of this.animations) {
          this.byNameMap.set(anim.name.toLowerCase(), anim);
          this.byIdMap.set(anim.action_id, anim);
        }
        this.isLoaded = true;
      } catch (err) {
        console.error('[AnimationRegistry] Failed to asynchronously load meshy_animations.json:', err);
      } finally {
        this.loadPromise = null;
      }
    })();

    return this.loadPromise;
  }

  getIsLoaded(): boolean {
    return this.isLoaded;
  }

  getAll(): MeshyAnimation[] {
    return this.animations;
  }

  get(name: string): MeshyAnimation | undefined {
    return this.byNameMap.get(name.toLowerCase());
  }

  getById(id: number): MeshyAnimation | undefined {
    return this.byIdMap.get(id);
  }

  getByCategory(category: string): MeshyAnimation[] {
    return this.animations.filter(
      (anim) => anim.category.toLowerCase() === category.toLowerCase()
    );
  }

  getBySubcategory(subcategory: string): MeshyAnimation[] {
    return this.animations.filter(
      (anim) => anim.subcategory.toLowerCase() === subcategory.toLowerCase()
    );
  }

  isLooping(nameOrId: string | number): boolean {
    if (typeof nameOrId === 'number') {
      const match = this.getById(nameOrId);
      if (match) return match.loop;
    } else if (typeof nameOrId === 'string') {
      const match = this.get(nameOrId);
      if (match) return match.loop;
      // Fallback heuristic for common motion clips if registry is still loading
      const lower = nameOrId.toLowerCase();
      if (['idle', 'walk', 'run', 'sprint', 'swim', 'fly', 'hover', 'breathe'].some((k) => lower.includes(k))) {
        return true;
      }
    }
    return false;
  }

  getAxis(nameOrId: string | number): string | null {
    if (typeof nameOrId === 'number') {
      return this.getById(nameOrId)?.axis ?? null;
    }
    return this.get(nameOrId)?.axis ?? null;
  }
}

export const animationRegistry = new AnimationRegistry();

/**
 * React hook to lazily trigger and monitor animation registry loading
 */
export function useAnimationRegistry(): { isLoaded: boolean; registry: AnimationRegistry } {
  const [isLoaded, setIsLoaded] = useState<boolean>(animationRegistry.getIsLoaded());

  useEffect(() => {
    if (!animationRegistry.getIsLoaded()) {
      animationRegistry.load().then(() => {
        setIsLoaded(true);
      });
    }
  }, []);

  return { isLoaded, registry: animationRegistry };
}
