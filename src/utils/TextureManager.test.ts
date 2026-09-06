import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { TextureManager, PRESET_TEXTURE_URLS, isCompressedTextureUrl } from './TextureManager';

describe('TextureManager', () => {
  let loadSpy: any;
  let ktx2LoadSpy: any;
  let detectSupportSpy: any;

  beforeEach(() => {
    TextureManager.clear();
    TextureManager.setRenderer(null);

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

    // Mock KTX2Loader.prototype.load
    ktx2LoadSpy = vi.spyOn(KTX2Loader.prototype, 'load').mockImplementation((function (
      this: KTX2Loader,
      url: string,
      onLoad?: (texture: THREE.CompressedTexture) => void
    ) {
      const compTex = new THREE.CompressedTexture(
        [{ data: new Uint8Array([1, 2, 3, 4]), width: 512, height: 512 }],
        512,
        512,
        THREE.RGBA_BPTC_Format,
        THREE.UnsignedByteType
      );
      if (onLoad) {
        setTimeout(() => onLoad(compTex), 10);
      }
      return compTex;
    }) as any);

    // Mock KTX2Loader.prototype.detectSupport
    detectSupportSpy = vi.spyOn(KTX2Loader.prototype, 'detectSupport').mockImplementation(function (
      this: KTX2Loader
    ) {
      return this;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should correctly identify compressed texture URLs (.ktx2 and .basis)', () => {
    expect(isCompressedTextureUrl('https://example.com/texture.ktx2')).toBe(true);
    expect(isCompressedTextureUrl('https://example.com/texture.KTX2')).toBe(true);
    expect(isCompressedTextureUrl('https://example.com/texture.basis')).toBe(true);
    expect(isCompressedTextureUrl('https://example.com/texture.ktx2?version=2#cache')).toBe(true);
    expect(isCompressedTextureUrl('https://example.com/texture.png')).toBe(false);
    expect(isCompressedTextureUrl('https://example.com/texture.jpg')).toBe(false);
    expect(isCompressedTextureUrl('https://example.com/texture.webp')).toBe(false);
    expect(isCompressedTextureUrl('')).toBe(false);
    expect(isCompressedTextureUrl(null)).toBe(false);
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

  it('should load KTX2 / Basis compressed textures via KTX2Loader and track compression stats', async () => {
    const ktx2Url = 'https://assets.stellar-engine.io/textures/materials/ground_rock.ktx2';

    const tex = await TextureManager.acquireTexture(ktx2Url, {
      repeatX: 3,
      repeatY: 3,
      isNormalMap: false,
    });

    expect(ktx2LoadSpy).toHaveBeenCalledTimes(1);
    expect(loadSpy).not.toHaveBeenCalled();

    expect(tex.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(tex.repeat.x).toBe(3);
    expect(tex.repeat.y).toBe(3);
    expect((tex as any).isCompressedTexture).toBe(true);

    const stats = TextureManager.getStats();
    expect(stats.compressedTextureCount).toBeGreaterThan(0);
    expect(stats.baseCacheCount).toBe(1);
    expect(stats.instanceCacheCount).toBe(1);
  });

  it('should assign correct color space (SRGB vs NoColorSpace) on standard and compressed textures', async () => {
    const colorUrl = 'https://example.com/diffuse.png';
    const normalUrl = 'https://example.com/normal.png';
    const compColorUrl = 'https://example.com/diffuse.ktx2';
    const compNormalUrl = 'https://example.com/normal.ktx2';

    const colorTex = await TextureManager.acquireTexture(colorUrl, { isNormalMap: false });
    const normalTex = await TextureManager.acquireTexture(normalUrl, { isNormalMap: true });
    const compColorTex = await TextureManager.acquireTexture(compColorUrl, { isNormalMap: false });
    const compNormalTex = await TextureManager.acquireTexture(compNormalUrl, { isNormalMap: true });

    expect(colorTex.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(normalTex.colorSpace).toBe(THREE.NoColorSpace);
    expect(compColorTex.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(compNormalTex.colorSpace).toBe(THREE.NoColorSpace);
  });

  it('should properly configure GPU transcoder detection when setRenderer is invoked', () => {
    const mockRenderer: any = {
      capabilities: {},
      extensions: {},
    };

    TextureManager.setRenderer(mockRenderer);
    expect(detectSupportSpy).toHaveBeenCalledWith(mockRenderer);
    expect(TextureManager.getStats().transcoderReady).toBe(true);

    TextureManager.setRenderer(null);
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

  it('should create separate instances for different repeat or UV options on compressed textures without duplicate network requests', async () => {
    const url = 'https://example.com/compressed_transform_test.ktx2';

    const texA = await TextureManager.acquireTexture(url, { repeatX: 2, repeatY: 2 });
    const texB = await TextureManager.acquireTexture(url, { repeatX: 4, repeatY: 4 });

    expect(texA).not.toBe(texB);
    expect(texA.repeat.x).toBe(2);
    expect(texA.repeat.y).toBe(2);
    expect(texB.repeat.x).toBe(4);
    expect(texB.repeat.y).toBe(4);

    // Only ONE network/KTX2 load should have occurred despite 2 distinct instance transforms
    expect(ktx2LoadSpy).toHaveBeenCalledTimes(1);

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

  it('should maintain base texture in cache if active instances still reference it, and dispose when all instances are removed', async () => {
    const url = 'https://example.com/multi_instance_prune.png';

    // Acquire 2 distinct instances of the same base texture
    const inst1 = await TextureManager.acquireTexture(url, { repeatX: 1, repeatY: 1 });
    const inst2 = await TextureManager.acquireTexture(url, { repeatX: 2, repeatY: 2 });

    expect(TextureManager.getStats().baseCacheCount).toBe(1);
    expect(TextureManager.getStats().instanceCacheCount).toBe(2);

    // Release inst1; inst2 is still active
    TextureManager.releaseTexture(inst1);
    TextureManager.pruneUnused();

    // Base cache must still be preserved because inst2 is alive
    expect(TextureManager.getStats().baseCacheCount).toBe(1);
    expect(TextureManager.getStats().instanceCacheCount).toBe(2);

    // Release inst2
    TextureManager.releaseTexture(inst2);
    expect(TextureManager.getStats().totalReferences).toBe(0);

    // After releasing both, if base refCount is 0 and no active references remain, pruneUnused can safely clean up
    TextureManager.pruneUnused();
    expect(TextureManager.getStats().totalReferences).toBe(0);
  });

  it('should deeply purge WebGLRenderTarget, ImageBitmap, and renderer properties upon release and prune', async () => {
    const url = 'https://example.com/vram_leak_test.png';
    const tex = await TextureManager.acquireTexture(url);

    // Mock WebGLRenderTarget attached to texture
    const mockDisposeRenderTarget = vi.fn();
    (tex as any).renderTarget = {
      dispose: mockDisposeRenderTarget,
    };

    // Mock ImageBitmap close method
    const mockCloseBitmap = vi.fn();
    (tex as any).image = {
      width: 512,
      height: 512,
      close: mockCloseBitmap,
    };

    // Mock material referencing this texture
    const mockMaterial: any = {
      map: tex,
      normalMap: null,
      needsUpdate: false,
    };
    (tex as any).__boundMaterials = [mockMaterial];

    // Mock WebGLRenderer cache
    const mockRemoveProp = vi.fn();
    const mockResetTexture = vi.fn();
    const mockRenderer: any = {
      properties: { remove: mockRemoveProp },
      textures: { reset: mockResetTexture },
    };
    TextureManager.setRenderer(mockRenderer);

    // Release and clear
    TextureManager.releaseTexture(tex);
    TextureManager.clear();

    expect(mockDisposeRenderTarget).toHaveBeenCalledTimes(1);
    expect(mockCloseBitmap).toHaveBeenCalledTimes(1);
    expect(mockRemoveProp).toHaveBeenCalledWith(tex);
    expect(mockResetTexture).toHaveBeenCalledWith(tex);
    expect(mockMaterial.map).toBeNull();
    expect(mockMaterial.needsUpdate).toBe(true);

    TextureManager.setRenderer(null);
  });
});
