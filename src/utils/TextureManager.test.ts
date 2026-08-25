import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { TextureManager, PRESET_TEXTURE_URLS } from './TextureManager';

describe('TextureManager', () => {
  let loadSpy: any;

  beforeEach(() => {
    TextureManager.clear();

    // Mock THREE.TextureLoader.prototype.load
    loadSpy = vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((function (
      this: THREE.TextureLoader,
      url: string,
      onLoad?: (texture: THREE.Texture) => void
    ) {
      const tex = new THREE.Texture();
      tex.image = { width: 512, height: 512 } as any;
      if (onLoad) {
        setTimeout(() => onLoad(tex), 10);
      }
      return tex;
    }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should resolve preset texture names to their URLs', () => {
    expect(TextureManager.resolveUrl('brick')).toBe(PRESET_TEXTURE_URLS.brick);
    expect(TextureManager.resolveUrl('water')).toBe(PRESET_TEXTURE_URLS.water);
    expect(TextureManager.resolveUrl('https://example.com/custom.png')).toBe('https://example.com/custom.png');
    expect(TextureManager.resolveUrl('')).toBe('');
  });

  it('should deduplicate concurrent in-flight requests for the same URL', async () => {
    const url = 'https://example.com/texture_concurrent.png';

    // Initiate 5 concurrent acquires for the same URL
    const promises = [
      TextureManager.acquireTexture(url, { repeatX: 2, repeatY: 2 }),
      TextureManager.acquireTexture(url, { repeatX: 2, repeatY: 2 }),
      TextureManager.acquireTexture(url, { repeatX: 2, repeatY: 2 }),
      TextureManager.acquireTexture(url, { repeatX: 2, repeatY: 2 }),
      TextureManager.acquireTexture(url, { repeatX: 2, repeatY: 2 }),
    ];

    const results = await Promise.all(promises);

    // Should only have initiated ONE actual TextureLoader.load call
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).toHaveBeenCalledWith(url, expect.any(Function), undefined, expect.any(Function));

    // All results should share the exact same cached instance
    expect(results[0]).toBe(results[1]);
    expect(results[1]).toBe(results[2]);

    const stats = TextureManager.getStats();
    expect(stats.baseCacheCount).toBe(1);
    expect(stats.instanceCacheCount).toBe(1);
    expect(stats.totalReferences).toBe(5);
  });

  it('should assign correct color space (SRGB vs NoColorSpace)', async () => {
    const colorUrl = 'https://example.com/diffuse.png';
    const normalUrl = 'https://example.com/normal.png';

    const colorTex = await TextureManager.acquireTexture(colorUrl, { isNormalMap: false });
    const normalTex = await TextureManager.acquireTexture(normalUrl, { isNormalMap: true });

    expect(colorTex.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(normalTex.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('should correctly increment and decrement reference counts on acquire and release', async () => {
    const url = 'https://example.com/refcount_test.png';

    const tex1 = await TextureManager.acquireTexture(url, { repeatX: 1, repeatY: 1 });
    let stats = TextureManager.getStats();
    expect(stats.totalReferences).toBe(1);

    const tex2 = await TextureManager.acquireTexture(url, { repeatX: 1, repeatY: 1 });
    stats = TextureManager.getStats();
    expect(stats.totalReferences).toBe(2);
    expect(tex1).toBe(tex2);

    TextureManager.releaseTexture(tex1);
    stats = TextureManager.getStats();
    expect(stats.totalReferences).toBe(1);

    TextureManager.releaseTexture(tex2);
    stats = TextureManager.getStats();
    expect(stats.totalReferences).toBe(0);
  });

  it('should create separate instances for different repeat or UV options', async () => {
    const url = 'https://example.com/transform_test.png';

    const texA = await TextureManager.acquireTexture(url, { repeatX: 2, repeatY: 2 });
    const texB = await TextureManager.acquireTexture(url, { repeatX: 4, repeatY: 4 });

    expect(texA).not.toBe(texB);
    expect(texA.repeat.x).toBe(2);
    expect(texA.repeat.y).toBe(2);
    expect(texB.repeat.x).toBe(4);
    expect(texB.repeat.y).toBe(4);

    // Only ONE base load should have occurred despite 2 distinct instance transforms
    expect(loadSpy).toHaveBeenCalledTimes(1);

    const stats = TextureManager.getStats();
    expect(stats.baseCacheCount).toBe(1);
    expect(stats.instanceCacheCount).toBe(2);
  });

  it('should clear all caches on TextureManager.clear()', async () => {
    const url = 'https://example.com/clear_test.png';
    await TextureManager.acquireTexture(url);

    expect(TextureManager.getStats().baseCacheCount).toBe(1);
    expect(TextureManager.getStats().instanceCacheCount).toBe(1);

    TextureManager.clear();

    expect(TextureManager.getStats().baseCacheCount).toBe(0);
    expect(TextureManager.getStats().instanceCacheCount).toBe(0);
    expect(TextureManager.getStats().inFlightCount).toBe(0);
  });

  it('should schedule throttled pruning on release and allow manual pruneUnused', async () => {
    const url = 'https://example.com/prune_test.png';
    const tex = await TextureManager.acquireTexture(url);

    expect(TextureManager.getStats().totalReferences).toBe(1);

    TextureManager.releaseTexture(tex);
    expect(TextureManager.getStats().totalReferences).toBe(0);

    // Explicitly run pruneUnused to test synchronous LRU purge
    TextureManager.pruneUnused();
    expect(TextureManager.getStats().totalReferences).toBe(0);
  });
});

