import * as THREE from 'three';
import { useGLTF, useFBX } from '@react-three/drei';
import { OBJLoader } from 'three-stdlib';
import { TextureManager } from './TextureManager';

export type StagingAssetType = 'model' | 'gltf' | 'fbx' | 'obj' | 'texture' | 'image';
export type StagingStatus = 'queued' | 'staging' | 'ready' | 'error';

export interface StagingItem {
  id: string;
  url: string;
  type: StagingAssetType;
  status: StagingStatus;
  progress: number; // 0 to 1
  error?: string;
  timestamp: number;
}

export interface StagingProgressEvent {
  total: number;
  completed: number;
  inFlight: number;
  percent: number;
  activeItem?: StagingItem;
}

type ProgressListener = (event: StagingProgressEvent) => void;
type ItemReadyListener = (item: StagingItem) => void;

/**
 * AssetStagingManagerClass — Centralized Asset Preloading, Parsing, & Staging Queue
 *
 * Responsibilities:
 * 1. Pre-downloads and pre-parses GLTF/GLB models, FBX models, OBJ models, and textures off-screen.
 * 2. Concurrency-throttled worker queue (max 3 in-flight) to prevent main-thread locking.
 * 3. In-flight promise deduplication across duplicate asset references.
 * 4. Staging status tracking and real-time progress callbacks for HUD indicators.
 */
class AssetStagingManagerClass {
  private queue: StagingItem[] = [];
  private inFlight = new Map<string, Promise<void>>();
  private stagedAssets = new Set<string>(); // Set of ready asset URLs
  private assetStatuses = new Map<string, StagingStatus>();
  private maxConcurrency = 1;
  private activeCount = 0;
  private isProcessing = false;

  private progressListeners = new Set<ProgressListener>();
  private itemReadyListeners = new Set<ItemReadyListener>();

  /**
   * Pre-stages an asset (GLTF, FBX, OBJ, or Texture) into memory
   */
  public stageAsset(url: string, type: StagingAssetType = 'gltf'): Promise<void> {
    if (!url) return Promise.resolve();

    // Normalize type
    let normalizedType: StagingAssetType = type;
    const lowerUrl = url.toLowerCase();
    if (lowerUrl.endsWith('.obj')) {
      normalizedType = 'obj';
    } else if (lowerUrl.endsWith('.fbx')) {
      normalizedType = 'fbx';
    } else if (lowerUrl.endsWith('.glb') || lowerUrl.endsWith('.gltf')) {
      normalizedType = 'gltf';
    } else if (
      lowerUrl.endsWith('.png') ||
      lowerUrl.endsWith('.jpg') ||
      lowerUrl.endsWith('.jpeg') ||
      lowerUrl.endsWith('.webp')
    ) {
      normalizedType = 'texture';
    }

    // Return if already staged and ready
    if (this.stagedAssets.has(url)) {
      return Promise.resolve();
    }

    // Return in-flight promise if currently loading
    const existingInFlight = this.inFlight.get(url);
    if (existingInFlight) {
      return existingInFlight;
    }

    // Create item record
    const item: StagingItem = {
      id: `stage_${crypto.randomUUID()}`,
      url,
      type: normalizedType,
      status: 'queued',
      progress: 0,
      timestamp: Date.now(),
    };

    this.queue.push(item);
    this.assetStatuses.set(url, 'queued');
    this.emitProgress();

    // Initiate task promise
    const promise = new Promise<void>((resolve, reject) => {
      const execute = async () => {
        this.activeCount++;
        this.emitProgress(item);

        try {
          if (normalizedType === 'obj') {
            if (typeof document !== 'undefined' && typeof OBJLoader !== 'undefined') {
              const loader = new OBJLoader();
              await new Promise<void>((res, rej) => {
                loader.load(url, () => res(), undefined, (err) => rej(err));
              });
            }
          } else if (normalizedType === 'fbx') {
            if (typeof useFBX !== 'undefined' && typeof (useFBX as any).preload === 'function') {
              (useFBX as any).preload(url);
            }
          } else if (normalizedType === 'texture' || normalizedType === 'image') {
            if (typeof document !== 'undefined') {
              await TextureManager.acquireTexture(url);
            }
          } else {
            // Default: GLTF / GLB
            if (typeof useGLTF !== 'undefined' && typeof (useGLTF as any).preload === 'function') {
              (useGLTF as any).preload(url);
            }
          }

          item.status = 'ready';
          item.progress = 1;
          this.stagedAssets.add(url);
          this.assetStatuses.set(url, 'ready');

          this.itemReadyListeners.forEach((fn) => {
            try {
              fn(item);
            } catch (err) {
              console.error('[AssetStagingManager] Listener error:', err);
            }
          });

          resolve();
        } catch (error: any) {
          console.warn(`[AssetStagingManager] Failed to pre-stage asset "${url}":`, error);
          item.status = 'error';
          item.error = error?.message || 'Preload failed';
          this.assetStatuses.set(url, 'error');
          reject(error);
        } finally {
          this.activeCount--;
          this.inFlight.delete(url);
          this.emitProgress();
          // Stagger next asset to allow 60 FPS frame render
          setTimeout(() => this.processNext(), 50);
        }
      };

      (item as any)._run = execute;
    });

    this.inFlight.set(url, promise);
    this.processNext();

    return promise;
  }

  /**
   * Pre-stages multiple assets in batch
   */
  public async stageAssets(
    assets: Array<{ url: string; type?: StagingAssetType }>
  ): Promise<void> {
    await Promise.all(assets.map((a) => this.stageAsset(a.url, a.type || 'gltf')));
  }

  /**
   * Process next queued items up to maxConcurrency
   */
  private processNext(): void {
    while (this.activeCount < this.maxConcurrency && this.queue.length > 0) {
      const nextItem = this.queue.find((i) => i.status === 'queued');
      if (!nextItem) break;

      nextItem.status = 'staging';
      this.assetStatuses.set(nextItem.url, 'staging');
      const runFn = (nextItem as any)._run;
      if (typeof runFn === 'function') {
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(() => runFn(), { timeout: 100 });
        } else {
          setTimeout(runFn, 16);
        }
      }
    }
  }

  /**
   * Check if a specific URL is already staged in memory
   */
  public isStaged(url: string): boolean {
    return this.stagedAssets.has(url);
  }

  /**
   * Get staging status for a specific URL
   */
  public getStatus(url: string): StagingStatus {
    return this.assetStatuses.get(url) || 'queued';
  }

  /**
   * Subscribe to global staging progress updates
   */
  public subscribeProgress(listener: ProgressListener): () => void {
    this.progressListeners.add(listener);
    // Send immediate initial progress snapshot
    listener(this.getProgressSnapshot());
    return () => {
      this.progressListeners.delete(listener);
    };
  }

  /**
   * Subscribe to individual asset ready events
   */
  public onAssetReady(listener: ItemReadyListener): () => void {
    this.itemReadyListeners.add(listener);
    return () => {
      this.itemReadyListeners.delete(listener);
    };
  }

  /**
   * Get snapshot of current staging queue progress
   */
  public getProgressSnapshot(activeItem?: StagingItem): StagingProgressEvent {
    const total = this.queue.length;
    const completed = this.queue.filter((i) => i.status === 'ready' || i.status === 'error').length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 100;

    return {
      total,
      completed,
      inFlight: this.activeCount,
      percent,
      activeItem,
    };
  }

  private emitProgress(activeItem?: StagingItem): void {
    const snapshot = this.getProgressSnapshot(activeItem);
    this.progressListeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[AssetStagingManager] Progress listener error:', err);
      }
    });
  }

  /**
   * Clear queue and resets staging records
   */
  public clear(): void {
    this.queue = [];
    this.inFlight.clear();
    this.stagedAssets.clear();
    this.assetStatuses.clear();
    this.activeCount = 0;
    this.emitProgress();
  }
}

export const AssetStagingManager = new AssetStagingManagerClass();
