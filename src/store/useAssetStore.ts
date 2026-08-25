import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AssetStagingManager } from '../utils/AssetStagingManager';

export type Asset = {
  id: string;
  name: string;
  type: 'material' | 'model' | 'scene' | 'script' | 'image' | 'audio' | 'prefab' | 'primitive_prefab';
  url?: string;
  content?: string; // For script assets — the raw JS source
  category?: 'Models' | 'Textures' | 'Materials' | 'Scripts' | 'Audio' | 'Prefabs' | 'Scenes';
  thumbnailUrl?: string;
  source?: 'system' | 'user';
  geometry?: string;
  primitiveType?: string;
  material?: any;
  scale?: [number, number, number];
};

export function processImportedFile(file: File): Promise<Asset> {
  return new Promise((resolve, reject) => {
    let type: 'material' | 'model' | 'scene' | 'image' | 'script' | 'audio' | 'prefab' = 'model';
    let category: 'Models' | 'Textures' | 'Materials' | 'Scripts' | 'Audio' | 'Prefabs' | 'Scenes' = 'Models';

    const lowerName = file.name.toLowerCase();
    if (
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.webp') ||
      file.type.startsWith('image/')
    ) {
      type = 'image';
      category = 'Textures';
    } else if (
      lowerName.endsWith('.js') ||
      lowerName.endsWith('.ts') ||
      file.type === 'text/javascript' ||
      file.type === 'application/javascript'
    ) {
      type = 'script';
      category = 'Scripts';
    } else if (
      lowerName.endsWith('.mp3') ||
      lowerName.endsWith('.wav') ||
      lowerName.endsWith('.ogg') ||
      file.type.startsWith('audio/')
    ) {
      type = 'audio';
      category = 'Audio';
    }

    if (type === 'script') {
      if (typeof file.text === 'function') {
        file
          .text()
          .then((content) => {
            const asset: Asset = {
              id: crypto.randomUUID(),
              name: file.name,
              type,
              category,
              content,
              source: 'user',
            };
            useAssetStore.getState().addAsset(asset);
            resolve(asset);
          })
          .catch(reject);
      } else {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          const asset: Asset = {
            id: crypto.randomUUID(),
            name: file.name,
            type,
            category,
            content,
            source: 'user',
          };
          useAssetStore.getState().addAsset(asset);
          resolve(asset);
        };
        reader.onerror = reject;
        reader.readAsText(file);
      }
    } else {
      // Zero-copy instantaneous Blob URL creation for 3D models, textures, and audio
      const url = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : '';

      const asset: Asset = {
        id: crypto.randomUUID(),
        name: file.name,
        type,
        category,
        url,
        thumbnailUrl: type === 'image' ? url : undefined,
        source: 'user',
      };
      useAssetStore.getState().addAsset(asset);
      resolve(asset);
    }
  });
}

const buildAssetMap = (assets: Asset[]): Record<string, Asset> => {
  const map: Record<string, Asset> = {};
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    map[a.id] = a;
    if (a.url) {
      map[a.url] = a;
    }
  }
  return map;
};

interface AssetStore {
  assets: Asset[];
  customAssets: Asset[];
  assetMap: Record<string, Asset>;
  isLoading: boolean;
  error: string | null;
  hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;
  addAsset: (asset: Asset) => void;
  deleteAsset: (id: string) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  fetchAssets: (page?: number, limit?: number) => Promise<void>;
}

const DEFAULT_ASSETS: Asset[] = [
  { id: 'fire_pit', name: 'Fire Pit', type: 'model', url: '/Meshy_AI_fire_pit.glb', category: 'Models', source: 'system' },
  { id: 'long_grass', name: 'Long Grass', type: 'model', url: '/Meshy_AI_long_grass_0519031509_texture.glb', category: 'Models', source: 'system' },
  { id: 'short_grass', name: 'Short Grass', type: 'model', url: '/Meshy_AI_short_grass_0519031623_texture.glb', category: 'Models', source: 'system' },
  { id: 'rocky_mountain', name: 'Rocky Mountain', type: 'model', url: '/rocky+mountain+3d+model.glb', category: 'Models', source: 'system' },
  { id: 'stylized_tree', name: 'Stylized Tree', type: 'model', url: '/stylized+tree+3d+model.glb', category: 'Models', source: 'system' },
  { id: 'dirt_ground', name: 'Dirt Ground', type: 'model', url: '/Meshy_AI_dirt_ground_0519042354_texture.glb', category: 'Models', source: 'system' },
  { id: 'dirt_ground_2', name: 'Dirt Ground 2', type: 'model', url: '/Meshy_AI_dirt_ground_2_0519045015_texture.glb', category: 'Models', source: 'system' },
  { id: 'brick_wall', name: 'Brick Wall', type: 'model', url: '/brick+wall+3d+model.glb', category: 'Models', source: 'system' },
  { id: 'door', name: 'Door', type: 'model', url: '/door+3d+model.glb', category: 'Models', source: 'system' },
  { id: 'pine_tree', name: 'Pine Tree', type: 'model', url: '/pine+tree+3d+model.glb', category: 'Models', source: 'system' },
  { id: 'stone_block_wall', name: 'Stone Block Wall', type: 'model', url: '/stone+block+wall+3d+model.glb', category: 'Models', source: 'system' },
  { id: 'stone_wall', name: 'Stone Wall', type: 'model', url: '/stone+wall+3d+model.glb', category: 'Models', source: 'system' },
  { id: 'wood_log', name: 'Wood Log', type: 'model', url: '/wood+log+3d+model.glb', category: 'Models', source: 'system' },
  { id: 'wood_log_2', name: 'Wood Log 2', type: 'model', url: '/wood+log+2.glb', category: 'Models', source: 'system' },
  { id: 'wooden_block', name: 'Wooden Block', type: 'model', url: '/wooden+block+3d+model.glb', category: 'Models', source: 'system' },
  { id: 'wooden_wall_1', name: 'Wooden Wall 1', type: 'model', url: '/wooden+wall+1.glb', category: 'Models', source: 'system' },
];

const lastPersistedValues = new Map<string, string>();
const lastQuotaWarnTimes = new Map<string, number>();

// Custom IndexedDB storage engine with localStorage fallback for non-browser/test environments
const getStorageEngine = (): any => {
  if (typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined') {
    const DB_NAME = 'stellar-engine-assets';
    const STORE_NAME = 'assets';

    const openDB = (): Promise<IDBDatabase> => {
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    };

    let saveTimeout: any = null;
    const pendingWrites = new Map<string, any>();

    const flushWrite = async (name: string): Promise<void> => {
      const value = pendingWrites.get(name);
      if (value === undefined) return;
      pendingWrites.delete(name);

      try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, 'readwrite');
          const store = transaction.objectStore(STORE_NAME);
          const request = store.put({ id: name, value });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (e) {
        console.error(e);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        pendingWrites.forEach((_, name) => {
          flushWrite(name);
        });
      });
    }

    return {
      getItem: async (name: string): Promise<any> => {
        if (pendingWrites.has(name)) {
          return pendingWrites.get(name);
        }
        try {
          const db = await openDB();
          return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(name);
            request.onsuccess = () => {
              resolve(request.result ? request.result.value : null);
            };
            request.onerror = () => resolve(null);
          });
        } catch (e) {
          console.error(e);
          return null;
        }
      },
      setItem: async (name: string, value: any): Promise<void> => {
        pendingWrites.set(name, value);
        if (saveTimeout) {
          clearTimeout(saveTimeout);
        }
        return new Promise((resolve) => {
          saveTimeout = setTimeout(async () => {
            saveTimeout = null;
            await flushWrite(name);
            resolve();
          }, 1000); // Debounce IndexedDB writes by 1 second
        });
      },
      removeItem: async (name: string): Promise<void> => {
        pendingWrites.delete(name);
        if (saveTimeout) {
          clearTimeout(saveTimeout);
        }
        try {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(name);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        } catch (e) {
          console.error(e);
        }
      }
    };
  }

  // Fallback storage
  return {
    getItem: (name: string) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const val = window.localStorage.getItem(name);
          return val ? JSON.parse(val) : null;
        } catch (e) {
          return null;
        }
      }
      return null;
    },
    setItem: (name: string, value: any) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const serialized = JSON.stringify(value);
          if (lastPersistedValues.get(name) === serialized) {
            return;
          }
          lastPersistedValues.set(name, serialized);
          window.localStorage.setItem(name, serialized);
        } catch (e) {
          const now = Date.now();
          const lastWarn = lastQuotaWarnTimes.get(name) || 0;
          if (now - lastWarn > 5000) {
            console.warn('Storage quota exceeded, unable to persist assets locally.');
            lastQuotaWarnTimes.set(name, now);
          }
        }
      }
    },
    removeItem: (name: string) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          window.localStorage.removeItem(name);
        } catch (e) {}
      }
    }
  };
};

export const useAssetStore = create<AssetStore>()(
  persist(
    (set) => ({
      assets: [...DEFAULT_ASSETS],
      customAssets: [],
      assetMap: buildAssetMap(DEFAULT_ASSETS),
      isLoading: false,
      error: null,
      hasHydrated: false,
      setHasHydrated: (val) => set({ hasHydrated: val }),
      addAsset: (asset) =>
        set((state) => {
          const assetWithSource = { ...asset, source: 'user' as const };
          const updatedCustom = [...state.customAssets, assetWithSource];
          // Filter out duplicates if any
          const customIds = new Set(updatedCustom.map((a) => a.id));
          const baseAssets = DEFAULT_ASSETS.filter((a) => !customIds.has(a.id));
          const mergedAssets = [...baseAssets, ...updatedCustom];
          return {
            customAssets: updatedCustom,
            assets: mergedAssets,
            assetMap: buildAssetMap(mergedAssets),
          };
        }),
      deleteAsset: (id) =>
        set((state) => {
          const isDefault = DEFAULT_ASSETS.some((a) => a.id === id);
          if (isDefault) {
            // Can't delete defaults, but we filter it out of assets array at runtime
            const nextAssets = state.assets.filter((a) => a.id !== id);
            return {
              assets: nextAssets,
              assetMap: buildAssetMap(nextAssets),
              error: null,
            };
          }
          const exists = state.customAssets.some((a) => a.id === id);
          if (!exists) {
            console.warn(`Asset with ID ${id} not found.`);
            return { error: `Asset with ID ${id} not found.` };
          }
          const updatedCustom = state.customAssets.filter((a) => a.id !== id);
          const customIds = new Set(updatedCustom.map((a) => a.id));
          const baseAssets = DEFAULT_ASSETS.filter((a) => !customIds.has(a.id));
          const mergedAssets = [...baseAssets, ...updatedCustom];
          return {
            customAssets: updatedCustom,
            assets: mergedAssets,
            assetMap: buildAssetMap(mergedAssets),
            error: null,
          };
        }),
      updateAsset: (id, updates) =>
        set((state) => {
          const isCustom = state.customAssets.some((a) => a.id === id);
          const updatedAssets = state.assets.map((a) =>
            a.id === id ? { ...a, ...updates } : a
          );
          if (isCustom) {
            return {
              customAssets: state.customAssets.map((a) =>
                a.id === id ? { ...a, ...updates } : a
              ),
              assets: updatedAssets,
              assetMap: buildAssetMap(updatedAssets),
            };
          }
          return {
            assets: updatedAssets,
            assetMap: buildAssetMap(updatedAssets),
          };
        }),
      fetchAssets: async (page = 1, limit = 20) => {
        try {
          set({ isLoading: true, error: null });
          const response = await fetch(`/api/assets?page=${page}&limit=${limit}`);
          if (!response.ok) {
            throw new Error('Network response was not ok');
          }
          const data = await response.json();
          // Merge custom assets on top of fetched API assets
          set((state) => {
            const customIds = new Set(state.customAssets.map((a) => a.id));
            const apiAssets = data.filter((a: Asset) => !customIds.has(a.id));
            const mergedAssets = [...apiAssets, ...state.customAssets];
            return {
              assets: mergedAssets,
              assetMap: buildAssetMap(mergedAssets),
              isLoading: false,
            };
          });
        } catch (error: any) {
          console.error('Failed to fetch assets:', error);
          set({ isLoading: false, error: error.message || 'Failed to fetch assets' });
        }
      },
    }),
    {
      name: 'stellar-engine-assets-store',
      storage: getStorageEngine(),
      partialize: (state) => ({ customAssets: state.customAssets } as any),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const runHydration = () => {
            const customIds = new Set((state.customAssets || []).map((a) => a.id));
            const baseAssets = DEFAULT_ASSETS.filter((a) => !customIds.has(a.id));
            const mergedAssets = [...baseAssets, ...(state.customAssets || [])];
            const map = buildAssetMap(mergedAssets);
            
            if (typeof useAssetStore !== 'undefined') {
              useAssetStore.setState({ assets: mergedAssets, assetMap: map, hasHydrated: true });
            } else {
              Object.assign(state, { assets: mergedAssets, assetMap: map, hasHydrated: true });
            }

            // Pre-warm starter 3D models in staging queue during idle time
            if (typeof window !== 'undefined') {
              const starterModels = mergedAssets.filter((a) => a.type === 'model' && a.url);
              starterModels.forEach((a) => {
                if (a.url) {
                  AssetStagingManager.stageAsset(a.url, 'gltf').catch(() => {});
                }
              });
            }
          };

          if (typeof window !== 'undefined' && typeof (window as any).requestIdleCallback === 'function') {
            (window as any).requestIdleCallback(runHydration);
          } else {
            if (typeof window === 'undefined') {
              runHydration();
            } else {
              setTimeout(runHydration, 100);
            }
          }
        }
      },
    }
  )
);

if (typeof window !== 'undefined') {
  (window as any).useAssetStore = useAssetStore;
}
