import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AssetStagingManager } from './AssetStagingManager';
import { TextureManager } from './TextureManager';

describe('AssetStagingManager queue and preloading', () => {
  beforeEach(() => {
    AssetStagingManager.clear();
    vi.restoreAllMocks();
  });

  it('should queue and pre-stage assets with status tracking', async () => {
    const stagePromise = AssetStagingManager.stageAsset('/models/hero.glb', 'gltf');

    expect(AssetStagingManager.getStatus('/models/hero.glb')).toBe('staging');

    await stagePromise;

    expect(AssetStagingManager.isStaged('/models/hero.glb')).toBe(true);
    expect(AssetStagingManager.getStatus('/models/hero.glb')).toBe('ready');
  });

  it('should deduplicate concurrent staging calls for the exact same URL', async () => {
    const p1 = AssetStagingManager.stageAsset('/models/dragon.glb', 'gltf');
    const p2 = AssetStagingManager.stageAsset('/models/dragon.glb', 'gltf');

    // Should return identical in-flight promise
    expect(p1).toBe(p2);

    await Promise.all([p1, p2]);
    expect(AssetStagingManager.isStaged('/models/dragon.glb')).toBe(true);
  });

  it('should delegate texture staging to TextureManager', async () => {
    // Provide a dummy document so Node doesn't skip
    (global as any).document = {};
    const acquireSpy = vi.spyOn(TextureManager, 'acquireTexture').mockResolvedValue({} as any);

    await AssetStagingManager.stageAsset('/textures/ground_diffuse.png', 'texture');

    expect(acquireSpy).toHaveBeenCalledWith('/textures/ground_diffuse.png');
    expect(AssetStagingManager.isStaged('/textures/ground_diffuse.png')).toBe(true);
    delete (global as any).document;
  });

  it('should emit progress events across batch asset staging', async () => {
    const progressEvents: any[] = [];
    const unsubscribe = AssetStagingManager.subscribeProgress((event) => {
      progressEvents.push(event);
    });

    await AssetStagingManager.stageAssets([
      { url: '/models/tree.glb', type: 'gltf' },
      { url: '/models/rock.glb', type: 'gltf' },
      { url: '/models/pine.glb', type: 'gltf' },
    ]);

    unsubscribe();

    expect(progressEvents.length).toBeGreaterThan(1);
    const finalEvent = progressEvents[progressEvents.length - 1];
    expect(finalEvent.total).toBe(3);
    expect(finalEvent.completed).toBe(3);
    expect(finalEvent.percent).toBe(100);
  });

  it('should auto-detect and stage Wavefront .obj and FBX assets', async () => {
    await AssetStagingManager.stageAsset('/models/human_survivor.obj');
    expect(AssetStagingManager.isStaged('/models/human_survivor.obj')).toBe(true);

    await AssetStagingManager.stageAsset('/models/warrior.fbx');
    expect(AssetStagingManager.isStaged('/models/warrior.fbx')).toBe(true);
  });

  it('should utilize requestIdleCallback when available for background queue processing', async () => {
    const idleSpy = vi.fn((cb, opts) => setTimeout(cb, 0));
    (global as any).requestIdleCallback = idleSpy;

    await AssetStagingManager.stageAsset('/models/idle_check.glb');

    expect(idleSpy).toHaveBeenCalledWith(expect.any(Function), { timeout: 50 });
    delete (global as any).requestIdleCallback;
  });
});
