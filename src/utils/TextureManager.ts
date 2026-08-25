import * as THREE from 'three';
import { useEffect, useState, useRef } from 'react';

export const PRESET_TEXTURE_URLS: Record<string, string> = {
  grid: 'https://raw.githubusercontent.com/pmndrs/drei-assets/master/prototype/Grid_Material.png',
  brick: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/brick_diffuse.jpg',
  wood: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/hardwood2_diffuse.jpg',
  metal:
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/floors/FloorsCheckerboard_S_Diffuse.jpg',
  water: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg',
};

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
  totalReferences: number;
  cachedUrls: string[];
}

/**
 * Centralized Texture Loading Manager & Cache
 *
 * Provides:
 * 1. Unified THREE.LoadingManager with global progress tracking
 * 2. In-flight promise deduplication to eliminate duplicate concurrent fetches
 * 3. Reference counting with automatic VRAM disposal (texture.dispose())
 * 4. Dual-layer cache: base decoded textures + transformed material instances
 * 5. Automated color space enforcement (SRGBColorSpace for color maps, NoColorSpace for normal/data maps)
 */
class TextureManagerClass {
  private loadingManager: THREE.LoadingManager;
  private loader: THREE.TextureLoader;

  // In-flight requests: URL -> Promise<THREE.Texture>
  private inFlightPromises = new Map<string, Promise<THREE.Texture>>();

  // In-flight instance creation promises: InstanceKey -> Promise<THREE.Texture>
  private inFlightInstancePromises = new Map<string, Promise<THREE.Texture>>();

  // Base texture cache: Resolved URL -> BaseCacheEntry
  private baseCache = new Map<string, BaseCacheEntry>();

  // Instance cache: Composite key -> InstanceCacheEntry
  private instanceCache = new Map<string, InstanceCacheEntry>();

  // UUID lookup: Texture.uuid -> Composite instance key
  private uuidToInstanceKey = new Map<string, string>();

  // Max cached unused entries before LRU eviction
  private maxUnusedEntries = 50;

  // Background pruning throttling / idle callback state
  private pruneScheduled = false;
  private pruneTimer: any = null;

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

    return `${resolvedUrl}|rx:${rx}|ry:${ry}|ox:${ox}|oy:${oy}|rot:${rot}|ws:${wrapS}|wt:${wrapT}|nm:${isNormal}|wtz:${isWater}`;
  }

  /**
   * Loads or retrieves the master decoded base texture for a resolved URL
   */
  private loadBaseTexture(resolvedUrl: string, isNormalMap = false): Promise<THREE.Texture> {
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

    // 3. Initiate single network load
    const promise = new Promise<THREE.Texture>((resolve, reject) => {
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
        const baseTex = await this.loadBaseTexture(resolvedUrl, options.isNormalMap);

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

        const instanceTex = baseTex.clone();
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

        this.instanceCache.set(instanceKey, {
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
      texture.dispose();
      return;
    }

    const instanceEntry = this.instanceCache.get(instanceKey);
    if (!instanceEntry) {
      this.uuidToInstanceKey.delete(texture.uuid);
      texture.dispose();
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
        entry.texture.dispose();
        this.instanceCache.delete(key);
      }
    }

    // Prune base cache entries that have 0 references and no active instances
    for (const [url, baseEntry] of this.baseCache.entries()) {
      if (baseEntry.refCount <= 0) {
        let hasActiveInstance = false;
        for (const inst of this.instanceCache.values()) {
          if (inst.baseKey === url) {
            hasActiveInstance = true;
            break;
          }
        }
        if (!hasActiveInstance) {
          baseEntry.texture.dispose();
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
    for (const entry of this.instanceCache.values()) {
      totalReferences += entry.refCount;
    }

    return {
      inFlightCount: this.inFlightPromises.size,
      inFlightInstanceCount: this.inFlightInstancePromises.size,
      baseCacheCount: this.baseCache.size,
      instanceCacheCount: this.instanceCache.size,
      totalReferences,
      cachedUrls: Array.from(this.baseCache.keys()),
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
      entry.texture.dispose();
    }
    this.instanceCache.clear();
    this.uuidToInstanceKey.clear();

    for (const entry of this.baseCache.values()) {
      entry.texture.dispose();
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
    ? `${options.isNormalMap ?? false}_${options.repeatX ?? 2}_${options.repeatY ?? 2}_${options.offsetX ?? 0}_${options.offsetY ?? 0}_${options.rotation ?? 0}_${options.wrapS ?? 1000}_${options.wrapT ?? 1000}_${options.isWater ?? false}`
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
