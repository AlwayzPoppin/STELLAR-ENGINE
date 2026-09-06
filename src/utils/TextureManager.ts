import * as THREE from 'three';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { useEffect, useState, useRef } from 'react';

export const PRESET_TEXTURE_URLS: Record<string, string> = {
  grid: 'https://raw.githubusercontent.com/pmndrs/drei-assets/master/prototype/Grid_Material.png',
  brick: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/brick_diffuse.jpg',
  wood: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/hardwood2_diffuse.jpg',
  metal:
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg',
  water: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg',
};

/**
 * Checks if a texture URL points to a Basis Universal or KTX2 compressed texture container
 */
export function isCompressedTextureUrl(urlOrPreset?: string | null): boolean {
  if (!urlOrPreset) return false;
  const cleanUrl = urlOrPreset.split('?')[0].split('#')[0].toLowerCase();
  return cleanUrl.endsWith('.ktx2') || cleanUrl.endsWith('.basis');
}

export interface TextureLoadOptions {
  isNormalMap?: boolean;
  repeatX?: number;
  repeatY?: number;
  offsetX?: number;
  offsetY?: number;
  rotation?: number;
  wrapS?: THREE.Wrapping;
  wrapT?: THREE.Wrapping;
  generateMipmaps?: boolean;
  minFilter?: THREE.MinificationTextureFilter;
  magFilter?: THREE.MagnificationTextureFilter;
  anisotropy?: number;
  flipY?: boolean;
  isWater?: boolean;
  isCompressed?: boolean;
  format?: 'ktx2' | 'basis' | 'auto' | 'standard';
}

interface BaseCacheEntry {
  texture: THREE.Texture;
  refCount: number;
  lastUsed: number;
}

interface InstanceCacheEntry {
  texture: THREE.Texture;
  baseKey: string;
  refCount: number;
  lastUsed: number;
  isClone: boolean;
}

export interface TextureManagerStats {
  inFlightCount: number;
  inFlightInstanceCount: number;
  baseCacheCount: number;
  instanceCacheCount: number;
  compressedTextureCount: number;
  totalReferences: number;
  cachedUrls: string[];
  transcoderReady: boolean;
}

/**
 * Centralized Texture Loading Manager & Cache
 *
 * Provides:
 * 1. Unified THREE.LoadingManager with global progress tracking
 * 2. KTX2 / Basis Universal GPU compressed texture decoding via KTX2Loader & Web Workers
 * 3. In-flight promise deduplication to eliminate duplicate concurrent fetches
 * 4. Reference counting with automatic VRAM disposal (texture.dispose())
 * 5. Dual-layer cache: base decoded/transcoded textures + transformed material instances
 * 6. Automated color space enforcement (SRGBColorSpace for color maps, NoColorSpace for normal/data maps)
 * 7. Zero-allocation compressed texture instancing with shared mipmap buffers
 */
class TextureManagerClass {
  private loadingManager: THREE.LoadingManager;
  private loader: THREE.TextureLoader;
  private ktx2Loader: KTX2Loader;
  private transcoderPath = 'https://cdn.jsdelivr.net/npm/three@0.184.0/examples/jsm/libs/basis/';
  private transcoderReady = false;

  // In-flight requests: URL -> Promise<THREE.Texture>
  private inFlightPromises = new Map<string, Promise<THREE.Texture>>();

  // In-flight instance creation promises: InstanceKey -> Promise<THREE.Texture>
  private inFlightInstancePromises = new Map<string, Promise<THREE.Texture>>();

  // Base texture cache: Resolved URL -> BaseCacheEntry
  private baseCache = new Map<string, BaseCacheEntry>();

  // Instance cache: Composite key -> InstanceCacheEntry
  private instanceCache = new Map<string, InstanceCacheEntry>();

  // Reverse lookup: baseKey (resolved URL) -> Set of active instance keys (O(1) lookup during GC)
  private baseKeyToInstanceKeys = new Map<string, Set<string>>();

  // UUID lookup: Texture.uuid -> Composite instance key
  private uuidToInstanceKey = new Map<string, string>();

  // Max cached unused entries before LRU eviction
  private maxUnusedEntries = 50;

  // Background pruning throttling / idle callback state
  private pruneScheduled = false;
  private pruneTimer: any = null;

  // Active Three.js WebGLRenderer instance for direct GPU memory and property eviction
  private renderer: THREE.WebGLRenderer | null = null;

  /**
   * Associates the active WebGLRenderer to allow deep GPU texture and property cache purges
   * and initialize hardware GPU transcoder support for KTX2 / Basis Universal textures.
   */
  public setRenderer(renderer: THREE.WebGLRenderer | null): void {
    this.renderer = renderer;
    if (renderer && this.ktx2Loader) {
      try {
        this.ktx2Loader.detectSupport(renderer);
        this.transcoderReady = true;
      } catch (err) {
        console.warn('[TextureManager] Failed to detect GPU compression support for KTX2Loader:', err);
      }
    }
  }

  /**
   * Configures the Basis Universal WebAssembly transcoder library path
   */
  public setTranscoderPath(path: string): void {
    this.transcoderPath = path;
    if (this.ktx2Loader) {
      this.ktx2Loader.setTranscoderPath(path);
    }
  }

  /**
   * Exposes the shared KTX2Loader instance for GLTFLoader / KHR_texture_basisu extensions
   */
  public getKTX2Loader(): KTX2Loader {
    return this.ktx2Loader;
  }

  /**
   * Deeply purges a texture from memory, releasing WebGLRenderTarget,
   * ImageBitmap resources, WebGLRenderer GPU cache bindings, and material maps.
   */
  public disposeTexture(texture: THREE.Texture | null | undefined): void {
    if (!texture) return;

    try {
      // 1. Dispose any attached WebGLRenderTarget
      if ((texture as any).renderTarget) {
        try {
          (texture as any).renderTarget.dispose?.();
        } catch {}
        (texture as any).renderTarget = null;
      }
      if ((texture as any).__renderTarget) {
        try {
          (texture as any).__renderTarget.dispose?.();
        } catch {}
        (texture as any).__renderTarget = null;
      }

      // 2. Clear WebGLRenderer texture cache bindings if renderer is available
      if (this.renderer) {
        try {
          (this.renderer as any).properties?.remove?.(texture);
          (this.renderer as any).textures?.reset?.(texture);
          (this.renderer as any).disposeTexture?.(texture);
        } catch {}
      }

      // 3. Close ImageBitmap if present to release browser VRAM backing
      if (texture.image && typeof (texture.image as any).close === 'function') {
        try {
          (texture.image as any).close();
        } catch {}
      }

      // 4. Invalidate material uniforms / bound materials referencing this map
      if ((texture as any).__boundMaterials && Array.isArray((texture as any).__boundMaterials)) {
        (texture as any).__boundMaterials.forEach((mat: any) => {
          if (mat) {
            if (mat.map === texture) mat.map = null;
            if (mat.normalMap === texture) mat.normalMap = null;
            if (mat.roughnessMap === texture) mat.roughnessMap = null;
            if (mat.metalnessMap === texture) mat.metalnessMap = null;
            mat.needsUpdate = true;
          }
        });
        (texture as any).__boundMaterials = null;
      }

      // 5. Clear mipmap buffers on compressed textures
      if ((texture as any).mipmaps) {
        (texture as any).mipmaps = null;
      }

      // 6. Native Three.js texture disposal and event dispatch
      texture.dispose();
      texture.dispatchEvent({ type: 'dispose' });

      // 7. Mark disposed
      if (texture.source) {
        (texture.source as any).data = null;
      }
      (texture as any).image = null;
      if (texture.userData) {
        texture.userData.disposed = true;
      }
    } catch (err) {
      console.warn('[TextureManager] Error during texture resource disposal:', err);
    }
  }

  constructor() {
    this.loadingManager = new THREE.LoadingManager(
      () => {
        // All items loaded
      },
      (_item, loaded, total) => {
        if (process.env.NODE_ENV === 'development' && total > 0 && loaded === total) {
          // Texture batch complete
        }
      },
      (url) => {
        console.error(`[TextureManager] Failed to load asset via LoadingManager: ${url}`);
      }
    );

    this.loader = new THREE.TextureLoader(this.loadingManager);
    this.loader.setCrossOrigin('anonymous');

    this.ktx2Loader = new KTX2Loader(this.loadingManager);
    this.ktx2Loader.setTranscoderPath(this.transcoderPath);
  }

  /**
   * Resolves preset names (e.g. 'brick', 'water') or passes through absolute/relative URLs
   */
  public resolveUrl(urlOrPreset: string): string {
    if (!urlOrPreset) return '';
    return PRESET_TEXTURE_URLS[urlOrPreset] || urlOrPreset;
  }

  /**
   * Generates a deterministic composite key for a texture instance with specific UV transforms
   */
  private generateInstanceKey(resolvedUrl: string, opts: TextureLoadOptions): string {
    const rx = opts.repeatX ?? 2;
    const ry = opts.repeatY ?? 2;
    const ox = opts.offsetX ?? 0;
    const oy = opts.offsetY ?? 0;
    const rot = opts.rotation ?? 0;
    const wrapS = opts.wrapS ?? THREE.RepeatWrapping;
    const wrapT = opts.wrapT ?? THREE.RepeatWrapping;
    const isNormal = !!opts.isNormalMap;
    const isWater = !!opts.isWater;
    const isComp = isCompressedTextureUrl(resolvedUrl) || !!opts.isCompressed || opts.format === 'ktx2' || opts.format === 'basis';

    return `${resolvedUrl}|rx:${rx}|ry:${ry}|ox:${ox}|oy:${oy}|rot:${rot}|ws:${wrapS}|wt:${wrapT}|nm:${isNormal}|wtz:${isWater}|cmp:${isComp}`;
  }

  /**
   * Helper to insert an instance into instanceCache and register in baseKey reverse-lookup Set
   */
  private setInstanceInCache(instanceKey: string, entry: InstanceCacheEntry): void {
    this.instanceCache.set(instanceKey, entry);
    let instanceSet = this.baseKeyToInstanceKeys.get(entry.baseKey);
    if (!instanceSet) {
      instanceSet = new Set<string>();
      this.baseKeyToInstanceKeys.set(entry.baseKey, instanceSet);
    }
    instanceSet.add(instanceKey);
  }

  /**
   * Helper to remove an instance from instanceCache and unregister from baseKey reverse-lookup Set
   */
  private deleteInstanceFromCache(instanceKey: string): void {
    const entry = this.instanceCache.get(instanceKey);
    if (entry) {
      const instanceSet = this.baseKeyToInstanceKeys.get(entry.baseKey);
      if (instanceSet) {
        instanceSet.delete(instanceKey);
        if (instanceSet.size === 0) {
          this.baseKeyToInstanceKeys.delete(entry.baseKey);
        }
      }
      this.instanceCache.delete(instanceKey);
    }
  }

  /**
   * Loads or retrieves the master decoded base texture for a resolved URL
   */
  private loadBaseTexture(
    resolvedUrl: string,
    isNormalMap = false,
    options: TextureLoadOptions = {}
  ): Promise<THREE.Texture> {
    // 1. Return from base cache if available
    const existing = this.baseCache.get(resolvedUrl);
    if (existing) {
      existing.lastUsed = Date.now();
      return Promise.resolve(existing.texture);
    }

    // 2. Return in-flight promise if currently loading
    const inFlight = this.inFlightPromises.get(resolvedUrl);
    if (inFlight) {
      return inFlight;
    }

    const isCompressed =
      isCompressedTextureUrl(resolvedUrl) ||
      options.isCompressed ||
      options.format === 'ktx2' ||
      options.format === 'basis';

    // 3. Initiate single network load
    const promise = new Promise<THREE.Texture>((resolve, reject) => {
      if (isCompressed) {
        this.ktx2Loader.load(
          resolvedUrl,
          (loadedTex) => {
            this.inFlightPromises.delete(resolvedUrl);

            loadedTex.colorSpace = isNormalMap ? THREE.NoColorSpace : THREE.SRGBColorSpace;
            loadedTex.wrapS = options.wrapS ?? THREE.RepeatWrapping;
            loadedTex.wrapT = options.wrapT ?? THREE.RepeatWrapping;
            if (options.minFilter) loadedTex.minFilter = options.minFilter;
            if (options.magFilter) loadedTex.magFilter = options.magFilter;
            if (options.anisotropy !== undefined) loadedTex.anisotropy = options.anisotropy;
            else loadedTex.anisotropy = 16;
            loadedTex.needsUpdate = true;

            this.baseCache.set(resolvedUrl, {
              texture: loadedTex,
              refCount: 0,
              lastUsed: Date.now(),
            });

            resolve(loadedTex);
          },
          undefined,
          (error) => {
            this.inFlightPromises.delete(resolvedUrl);
            console.error(`[TextureManager] Error loading KTX2/Basis texture from "${resolvedUrl}":`, error);
            reject(error);
          }
        );
      } else {
        this.loader.load(
          resolvedUrl,
          (loadedTex) => {
            this.inFlightPromises.delete(resolvedUrl);

            // Configure color space & filtering
            loadedTex.colorSpace = isNormalMap ? THREE.NoColorSpace : THREE.SRGBColorSpace;
            loadedTex.wrapS = THREE.RepeatWrapping;
            loadedTex.wrapT = THREE.RepeatWrapping;
            loadedTex.generateMipmaps = true;
            loadedTex.minFilter = THREE.LinearMipmapLinearFilter;
            loadedTex.magFilter = THREE.LinearFilter;
            loadedTex.anisotropy = 16;
            loadedTex.needsUpdate = true;

            this.baseCache.set(resolvedUrl, {
              texture: loadedTex,
              refCount: 0,
              lastUsed: Date.now(),
            });

            resolve(loadedTex);
          },
          undefined,
          (error) => {
            this.inFlightPromises.delete(resolvedUrl);
            console.error(`[TextureManager] Error loading texture from "${resolvedUrl}":`, error);
            reject(error);
          }
        );
      }
    });

    this.inFlightPromises.set(resolvedUrl, promise);
    return promise;
  }

  /**
   * Acquires a texture instance with specified options and increments reference count
   */
  public acquireTexture(
    urlOrPreset: string,
    options: TextureLoadOptions = {}
  ): Promise<THREE.Texture> {
    const resolvedUrl = this.resolveUrl(urlOrPreset);
    if (!resolvedUrl) {
      return Promise.reject(new Error('[TextureManager] Cannot acquire texture with empty URL'));
    }

    const instanceKey = this.generateInstanceKey(resolvedUrl, options);

    // 1. Check if instance already exists in cache
    const existingInstance = this.instanceCache.get(instanceKey);
    if (existingInstance) {
      existingInstance.refCount++;
      existingInstance.lastUsed = Date.now();

      const baseEntry = this.baseCache.get(existingInstance.baseKey);
      if (baseEntry) {
        baseEntry.refCount++;
        baseEntry.lastUsed = Date.now();
      }

      return Promise.resolve(existingInstance.texture);
    }

    // 2. Check if instance is currently being created in-flight
    const inFlightInstance = this.inFlightInstancePromises.get(instanceKey);
    if (inFlightInstance) {
      return inFlightInstance.then((tex) => {
        const inst = this.instanceCache.get(instanceKey);
        if (inst) {
          inst.refCount++;
          inst.lastUsed = Date.now();
        }
        const baseEntry = this.baseCache.get(resolvedUrl);
        if (baseEntry) {
          baseEntry.refCount++;
          baseEntry.lastUsed = Date.now();
        }
        return tex;
      });
    }

    // 3. Initiate instance creation
    const instancePromise = (async () => {
      try {
        // Load base texture (deduplicated)
        const baseTex = await this.loadBaseTexture(resolvedUrl, options.isNormalMap, options);

        // Re-check instance cache after await
        const cachedInst = this.instanceCache.get(instanceKey);
        if (cachedInst) {
          cachedInst.refCount++;
          cachedInst.lastUsed = Date.now();
          const baseEntry = this.baseCache.get(resolvedUrl);
          if (baseEntry) {
            baseEntry.refCount++;
            baseEntry.lastUsed = Date.now();
          }
          return cachedInst.texture;
        }

        // Configure instance (clone for independent UV offsets/repeats e.g. animated water)
        const rx = options.repeatX ?? 2;
        const ry = options.repeatY ?? 2;
        const ox = options.offsetX ?? 0;
        const oy = options.offsetY ?? 0;
        const rot = options.rotation ?? 0;
        const wrapS = options.wrapS ?? THREE.RepeatWrapping;
        const wrapT = options.wrapT ?? THREE.RepeatWrapping;

        let instanceTex: THREE.Texture;
        if ((baseTex as any).isCompressedTexture || (baseTex as any).mipmaps) {
          const compTex = baseTex as THREE.CompressedTexture;
          instanceTex = new THREE.CompressedTexture(
            compTex.mipmaps,
            compTex.image?.width || 0,
            compTex.image?.height || 0,
            compTex.format,
            compTex.type
          );
          instanceTex.minFilter = compTex.minFilter;
          instanceTex.magFilter = compTex.magFilter;
          instanceTex.generateMipmaps = false;
          instanceTex.anisotropy = compTex.anisotropy;
        } else {
          instanceTex = baseTex.clone();
        }

        instanceTex.wrapS = wrapS;
        instanceTex.wrapT = wrapT;
        instanceTex.repeat.set(rx, ry);
        instanceTex.offset.set(ox, oy);
        instanceTex.rotation = rot;
        instanceTex.colorSpace = options.isNormalMap ? THREE.NoColorSpace : THREE.SRGBColorSpace;
        if (options.flipY !== undefined) {
          instanceTex.flipY = options.flipY;
        }
        instanceTex.needsUpdate = true;

        this.setInstanceInCache(instanceKey, {
          texture: instanceTex,
          baseKey: resolvedUrl,
          refCount: 1,
          lastUsed: Date.now(),
          isClone: true,
        });

        this.uuidToInstanceKey.set(instanceTex.uuid, instanceKey);

        // Increment base reference count
        const baseEntry = this.baseCache.get(resolvedUrl);
        if (baseEntry) {
          baseEntry.refCount++;
          baseEntry.lastUsed = Date.now();
        }

        return instanceTex;
      } finally {
        this.inFlightInstancePromises.delete(instanceKey);
      }
    })();

    this.inFlightInstancePromises.set(instanceKey, instancePromise);
    return instancePromise;
  }

  /**
   * Releases a previously acquired texture instance, decrementing reference count and disposing if unused
   */
  public releaseTexture(texture: THREE.Texture | null | undefined): void {
    if (!texture || !texture.uuid) return;

    const instanceKey = this.uuidToInstanceKey.get(texture.uuid);
    if (!instanceKey) {
      // Fallback: manually dispose if not tracked
      this.disposeTexture(texture);
      return;
    }

    const instanceEntry = this.instanceCache.get(instanceKey);
    if (!instanceEntry) {
      this.uuidToInstanceKey.delete(texture.uuid);
      this.disposeTexture(texture);
      return;
    }

    instanceEntry.refCount = Math.max(0, instanceEntry.refCount - 1);
    instanceEntry.lastUsed = Date.now();

    const baseEntry = this.baseCache.get(instanceEntry.baseKey);
    if (baseEntry) {
      baseEntry.refCount = Math.max(0, baseEntry.refCount - 1);
      baseEntry.lastUsed = Date.now();
    }

    // If unused, schedule idle pruning to avoid O(N log N) sorting bottlenecks during rapid batch releases
    this.schedulePruning();
  }

  /**
   * Schedules a debounced/idle pruning pass to avoid synchronous sorting bottlenecks during rapid releases.
   */
  public schedulePruning(): void {
    if (this.pruneScheduled) return;
    this.pruneScheduled = true;

    if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
      this.pruneTimer = window.requestIdleCallback(
        () => {
          this.pruneScheduled = false;
          this.pruneTimer = null;
          this.pruneUnused();
        },
        { timeout: 1000 }
      );
    } else {
      this.pruneTimer = setTimeout(() => {
        this.pruneScheduled = false;
        this.pruneTimer = null;
        this.pruneUnused();
      }, 100);
    }
  }

  /**
   * Prunes unused cached textures if cache size exceeds limit
   */
  public pruneUnused(): void {
    const unusedInstances: [string, InstanceCacheEntry][] = [];
    for (const [key, entry] of this.instanceCache.entries()) {
      if (entry.refCount <= 0) {
        unusedInstances.push([key, entry]);
      }
    }

    // Sort by lastUsed (oldest first)
    if (unusedInstances.length > this.maxUnusedEntries) {
      unusedInstances.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
      const toRemove = unusedInstances.slice(0, unusedInstances.length - this.maxUnusedEntries);

      for (const [key, entry] of toRemove) {
        this.uuidToInstanceKey.delete(entry.texture.uuid);
        this.disposeTexture(entry.texture);
        this.deleteInstanceFromCache(key);
      }
    }

    // Prune base cache entries that have 0 references and no active instances (O(1) reverse lookup)
    for (const [url, baseEntry] of this.baseCache.entries()) {
      if (baseEntry.refCount <= 0) {
        const instanceSet = this.baseKeyToInstanceKeys.get(url);
        const hasActiveInstance = Boolean(instanceSet && instanceSet.size > 0);
        if (!hasActiveInstance) {
          this.disposeTexture(baseEntry.texture);
          this.baseCache.delete(url);
        }
      }
    }
  }

  /**
   * Pre-warms/loads a list of texture URLs into cache
   */
  public async preload(urlsOrPresets: string[]): Promise<void> {
    await Promise.all(
      urlsOrPresets.map(async (url) => {
        try {
          const resolved = this.resolveUrl(url);
          if (resolved) {
            await this.loadBaseTexture(resolved);
          }
        } catch (e) {
          console.warn(`[TextureManager] Preload skipped for "${url}":`, e);
        }
      })
    );
  }

  /**
   * Returns cache diagnostics and memory metrics
   */
  public getStats(): TextureManagerStats {
    let totalReferences = 0;
    let compressedTextureCount = 0;
    for (const entry of this.instanceCache.values()) {
      totalReferences += entry.refCount;
      if ((entry.texture as any).isCompressedTexture || (entry.texture as any).mipmaps) {
        compressedTextureCount++;
      }
    }
    for (const entry of this.baseCache.values()) {
      if ((entry.texture as any).isCompressedTexture || (entry.texture as any).mipmaps) {
        compressedTextureCount++;
      }
    }

    return {
      inFlightCount: this.inFlightPromises.size,
      inFlightInstanceCount: this.inFlightInstancePromises.size,
      baseCacheCount: this.baseCache.size,
      instanceCacheCount: this.instanceCache.size,
      compressedTextureCount,
      totalReferences,
      cachedUrls: Array.from(this.baseCache.keys()),
      transcoderReady: this.transcoderReady,
    };
  }

  /**
   * Clears and disposes all textures in cache
   */
  public clear(): void {
    if (this.pruneTimer) {
      if (typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(this.pruneTimer);
      } else {
        clearTimeout(this.pruneTimer);
      }
      this.pruneTimer = null;
    }
    this.pruneScheduled = false;

    for (const entry of this.instanceCache.values()) {
      this.disposeTexture(entry.texture);
    }
    this.instanceCache.clear();
    this.baseKeyToInstanceKeys.clear();
    this.uuidToInstanceKey.clear();

    for (const entry of this.baseCache.values()) {
      this.disposeTexture(entry.texture);
    }
    this.baseCache.clear();
    this.inFlightPromises.clear();
    this.inFlightInstancePromises.clear();
  }
}

export const TextureManager = new TextureManagerClass();

/**
 * React Hook for declarative texture loading with automatic caching & unmount cleanup
 */
export function useManagedTexture(
  urlOrPreset?: string | null,
  options?: TextureLoadOptions
): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);

  // Stable serialized options key to prevent redundant re-acquisitions
  const optKey = options
    ? `${options.isNormalMap ?? false}_${options.repeatX ?? 2}_${options.repeatY ?? 2}_${options.offsetX ?? 0}_${options.offsetY ?? 0}_${options.rotation ?? 0}_${options.wrapS ?? 1000}_${options.wrapT ?? 1000}_${options.isWater ?? false}_${options.isCompressed ?? false}_${options.format ?? 'auto'}`
    : 'default';

  const currentTextureRef = useRef<THREE.Texture | null>(null);

  useEffect(() => {
    if (!urlOrPreset) {
      if (currentTextureRef.current) {
        TextureManager.releaseTexture(currentTextureRef.current);
        currentTextureRef.current = null;
      }
      setTexture(null);
      return;
    }

    let isMounted = true;

    TextureManager.acquireTexture(urlOrPreset, options)
      .then((acquiredTex) => {
        if (!isMounted) {
          TextureManager.releaseTexture(acquiredTex);
          return;
        }

        // Release previous texture if switching
        if (currentTextureRef.current && currentTextureRef.current !== acquiredTex) {
          TextureManager.releaseTexture(currentTextureRef.current);
        }

        currentTextureRef.current = acquiredTex;
        setTexture(acquiredTex);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error(`[useManagedTexture] Failed to load "${urlOrPreset}":`, err);
        if (currentTextureRef.current) {
          TextureManager.releaseTexture(currentTextureRef.current);
          currentTextureRef.current = null;
        }
        setTexture(null);
      });

    return () => {
      isMounted = false;
      if (currentTextureRef.current) {
        TextureManager.releaseTexture(currentTextureRef.current);
        currentTextureRef.current = null;
      }
    };
  }, [urlOrPreset, optKey]);

  return texture;
}
