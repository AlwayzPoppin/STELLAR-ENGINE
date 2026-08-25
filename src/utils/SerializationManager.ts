/**
 * SerializationManager
 *
 * Manages asynchronous scene serialization, worker offloading, and debounced autosaves.
 * Prevents UI thread blocking during continuous autosaves or large scene exports.
 */

export interface SerializationRequest {
  resolve: (jsonString: string) => void;
  reject: (err: Error) => void;
}

export function sanitizeObjectDirect(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  if (obj.type === 'gltf_part' || obj.id === 'obj_sun' || obj.id === 'obj_moon') {
    return null;
  }
  if (obj.url && typeof obj.url === 'string' && (obj.url.includes('_shining_sun') || obj.url.includes('shining_moon_'))) {
    return null;
  }

  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'material' && value && typeof value === 'object') {
      const mat = value as Record<string, any>;
      cleanObj.material = {
        color: mat.color || '#ffffff',
        presetMap: mat.presetMap || 'none',
        customMap: typeof mat.customMap === 'string' ? mat.customMap : (mat.customMap?.image?.src || null),
        normalMap: typeof mat.normalMap === 'string' ? mat.normalMap : (mat.normalMap?.image?.src || null),
        roughness: mat.roughness !== undefined ? mat.roughness : 0.5,
        metalness: mat.metalness !== undefined ? mat.metalness : 0,
        envMapIntensity: mat.envMapIntensity !== undefined ? mat.envMapIntensity : 1,
      };
    } else if (value && typeof value === 'object' && ((value as any).isTexture || (value as any).isThreeTexture)) {
      cleanObj[key] = (value as any).image?.src || (value as any).source?.data?.src || (value as any).texturePath || null;
    } else if (typeof HTMLElement !== 'undefined' && value instanceof HTMLElement) {
      cleanObj[key] = null;
    } else {
      cleanObj[key] = value;
    }
  }

  return cleanObj;
}

export function sanitizeObjectsSync(objects: any[]): any[] {
  if (!Array.isArray(objects)) return [];
  const result: any[] = [];
  for (const obj of objects) {
    const clean = sanitizeObjectDirect(obj);
    if (clean) {
      result.push(clean);
    }
  }
  return result;
}

export function safeSerializeObjectsSync(objects: any[]): string {
  const clean = sanitizeObjectsSync(objects);
  return JSON.stringify(clean);
}

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AutosaveState {
  status: AutosaveStatus;
  lastSavedTimestamp: number | null;
}

class SerializationManagerClass {
  private worker: Worker | null = null;
  private isWorkerSupported = false;
  private pendingRequests = new Map<string, SerializationRequest>();
  private requestCounter = 0;

  // Autosave debouncing & status tracking
  private autosaveTimer: any = null;
  private latestAutosaveObjects: any[] | null = null;
  private customAutosaveHandler: ((jsonString: string) => void) | null = null;
  private autosaveState: AutosaveState = {
    status: 'idle',
    lastSavedTimestamp: null,
  };
  private listeners = new Set<(state: AutosaveState) => void>();

  constructor() {
    this.initWorker();
  }

  public getAutosaveState(): AutosaveState {
    return { ...this.autosaveState };
  }

  public subscribeAutosave(listener: (state: AutosaveState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getAutosaveState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(state: AutosaveState) {
    this.autosaveState = state;
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('[SerializationManager] Listener error:', err);
      }
    }
  }

  private initWorker() {
    if (typeof window === 'undefined' || typeof Worker === 'undefined') {
      this.isWorkerSupported = false;
      return;
    }

    try {
      this.worker = new Worker(new URL('../workers/serializationWorker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (event: MessageEvent) => {
        const { type, requestId, jsonString, error } = event.data;
        const pending = this.pendingRequests.get(requestId);
        if (!pending) return;

        this.pendingRequests.delete(requestId);
        if (type === 'SERIALIZE_SUCCESS') {
          pending.resolve(jsonString);
        } else {
          pending.reject(new Error(error || 'Serialization error'));
        }
      };

      this.worker.onerror = (err) => {
        console.warn('[SerializationManager] Worker error, falling back to sync:', err);
      };

      this.isWorkerSupported = true;
    } catch {
      this.isWorkerSupported = false;
    }
  }

  /**
   * Asynchronously serializes scene objects without blocking the main UI thread.
   */
  public async serializeObjectsAsync(objects: any[]): Promise<string> {
    if (!this.isWorkerSupported || !this.worker) {
      return safeSerializeObjectsSync(objects);
    }

    const requestId = `req_${++this.requestCounter}_${Date.now()}`;
    return new Promise<string>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      // Transfer shallow sanitized payload to worker
      try {
        const sanitized = sanitizeObjectsSync(objects);
        this.worker!.postMessage({
          type: 'SERIALIZE',
          requestId,
          objects: sanitized,
        });
      } catch {
        this.pendingRequests.delete(requestId);
        resolve(safeSerializeObjectsSync(objects));
      }
    });
  }

  /**
   * Schedules a debounced background autosave (500ms delay).
   */
  public scheduleAutosave(objects: any[], customSaveFn?: (jsonString: string) => void): void {
    this.latestAutosaveObjects = objects;
    if (customSaveFn) {
      this.customAutosaveHandler = customSaveFn;
    }

    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
    }

    this.autosaveTimer = setTimeout(async () => {
      this.autosaveTimer = null;
      if (!this.latestAutosaveObjects) return;

      const objectsToSave = this.latestAutosaveObjects;
      this.latestAutosaveObjects = null;

      this.notifyListeners({
        status: 'saving',
        lastSavedTimestamp: this.autosaveState.lastSavedTimestamp,
      });

      try {
        const jsonString = await this.serializeObjectsAsync(objectsToSave);
        if (this.customAutosaveHandler) {
          this.customAutosaveHandler(jsonString);
        }
        this.notifyListeners({
          status: 'saved',
          lastSavedTimestamp: Date.now(),
        });
      } catch (err) {
        console.error('[SerializationManager] Autosave failed:', err);
        this.notifyListeners({
          status: 'error',
          lastSavedTimestamp: this.autosaveState.lastSavedTimestamp,
        });
      }
    }, 500);
  }

  /**
   * Cancels any pending debounced autosave.
   */
  public cancelAutosave(): void {
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    this.latestAutosaveObjects = null;
  }
}

export const SerializationManager = new SerializationManagerClass();
