import { create } from 'zustand';
import { persist, StateStorage, createJSONStorage } from 'zustand/middleware';

export type Asset = {
  id: string;
  name: string;
  type: 'material' | 'model' | 'scene' | 'script' | 'image' | 'audio' | 'prefab';
  url?: string;
  content?: string; // For script assets — the raw JS source
  category?: 'Models' | 'Textures' | 'Materials' | 'Scripts' | 'Audio' | 'Prefabs' | 'Scenes';
  thumbnailUrl?: string;
};

interface AssetStore {
  assets: Asset[];
  customAssets: Asset[];
  isLoading: boolean;
  error: string | null;
  addAsset: (asset: Asset) => void;
  deleteAsset: (id: string) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  fetchAssets: (page?: number, limit?: number) => Promise<void>;
}

const DEFAULT_ASSETS: Asset[] = [
  { id: '1', name: 'PBR_Material_1', type: 'material', category: 'Materials' },
  { id: '2', name: 'PlayerModel', type: 'model', category: 'Models' },
  { id: '3', name: 'Level_01', type: 'scene', category: 'Scenes' },
  { id: '4', name: 'HDRI_Skybox', type: 'image', category: 'Textures' },
  {
    id: 'water_texture',
    name: 'Water Texture',
    type: 'image',
    url: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg',
    category: 'Textures',
    thumbnailUrl: 'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/waternormals.jpg'
  },
  { id: 'fire_pit', name: 'Fire Pit', type: 'model', url: '/Meshy_AI_fire_pit.glb', category: 'Models' },
  { id: 'long_grass', name: 'Long Grass', type: 'model', url: '/Meshy_AI_long_grass_0519031509_texture.glb', category: 'Models' },
  { id: 'short_grass', name: 'Short Grass', type: 'model', url: '/Meshy_AI_short_grass_0519031623_texture.glb', category: 'Models' },
  { id: 'rocky_mountain', name: 'Rocky Mountain', type: 'model', url: '/rocky+mountain+3d+model.glb', category: 'Models' },
  { id: 'stylized_tree', name: 'Stylized Tree', type: 'model', url: '/stylized+tree+3d+model.glb', category: 'Models' },
  { id: 'dirt_ground', name: 'Dirt Ground', type: 'model', url: '/Meshy_AI_dirt_ground_0519042354_texture.glb', category: 'Models' },
  { id: 'dirt_ground_2', name: 'Dirt Ground 2', type: 'model', url: '/Meshy_AI_dirt_ground_2_0519045015_texture.glb', category: 'Models' },
  { id: 'brick_wall', name: 'Brick Wall', type: 'model', url: '/brick+wall+3d+model.glb', category: 'Models' },
  { id: 'door', name: 'Door', type: 'model', url: '/door+3d+model.glb', category: 'Models' },
  { id: 'humanoid_robot', name: 'Humanoid Robot', type: 'model', url: '/humanoid+robot+3d+model.glb', category: 'Models' },
  { id: 'pine_tree', name: 'Pine Tree', type: 'model', url: '/pine+tree+3d+model.glb', category: 'Models' },
  { id: 'stone_block_wall', name: 'Stone Block Wall', type: 'model', url: '/stone+block+wall+3d+model.glb', category: 'Models' },
  { id: 'stone_wall', name: 'Stone Wall', type: 'model', url: '/stone+wall+3d+model.glb', category: 'Models' },
  { id: 'wood_log', name: 'Wood Log', type: 'model', url: '/wood+log+3d+model.glb', category: 'Models' },
  { id: 'wood_log_2', name: 'Wood Log 2', type: 'model', url: '/wood+log+2.glb', category: 'Models' },
  { id: 'wooden_block', name: 'Wooden Block', type: 'model', url: '/wooden+block+3d+model.glb', category: 'Models' },
  { id: 'wooden_wall_1', name: 'Wooden Wall 1', type: 'model', url: '/wooden+wall+1.glb', category: 'Models' },
  {
    id: '5',
    name: 'BehaviorScript.js',
    type: 'script',
    category: 'Scripts',
    content: `// BehaviorScript.js
// Runs every frame while PLAY mode is active.
// 'self' is the live THREE.Object3D — mutate it directly!

function update(self, delta) {
  self.rotation.y += 1.0 * delta;
}

update(self, delta);
`
  },
];

// Custom IndexedDB storage engine with localStorage fallback for non-browser/test environments
const getStorageEngine = (): StateStorage => {
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

    return {
      getItem: async (name: string): Promise<string | null> => {
        try {
          const db = await openDB();
          return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(name);
            request.onsuccess = () => {
              resolve(request.result ? JSON.stringify(request.result.value) : null);
            };
            request.onerror = () => resolve(null);
          });
        } catch (e) {
          console.error(e);
          return null;
        }
      },
      setItem: async (name: string, value: string): Promise<void> => {
        try {
          const db = await openDB();
          return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put({ id: name, value: JSON.parse(value) });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        } catch (e) {
          console.error(e);
        }
      },
      removeItem: async (name: string): Promise<void> => {
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
        return window.localStorage.getItem(name);
      }
      return null;
    },
    setItem: (name: string, value: string) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(name, value);
      }
    },
    removeItem: (name: string) => {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(name);
      }
    }
  };
};

export const useAssetStore = create<AssetStore>()(
  persist(
    (set) => ({
      assets: [...DEFAULT_ASSETS],
      customAssets: [],
      isLoading: false,
      error: null,
      addAsset: (asset) =>
        set((state) => {
          const updatedCustom = [...state.customAssets, asset];
          // Filter out duplicates if any
          const customIds = new Set(updatedCustom.map((a) => a.id));
          const baseAssets = DEFAULT_ASSETS.filter((a) => !customIds.has(a.id));
          return {
            customAssets: updatedCustom,
            assets: [...baseAssets, ...updatedCustom],
          };
        }),
      deleteAsset: (id) =>
        set((state) => {
          const isDefault = DEFAULT_ASSETS.some((a) => a.id === id);
          if (isDefault) {
            // Can't delete defaults, but we filter it out of assets array at runtime
            return {
              assets: state.assets.filter((a) => a.id !== id),
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
          return {
            customAssets: updatedCustom,
            assets: [...baseAssets, ...updatedCustom],
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
            };
          }
          return {
            assets: updatedAssets,
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
            return {
              assets: [...apiAssets, ...state.customAssets],
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
      storage: createJSONStorage(() => getStorageEngine()),
      partialize: (state) => ({ customAssets: state.customAssets } as any),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Merge customAssets into assets list
          const customIds = new Set((state.customAssets || []).map((a) => a.id));
          const baseAssets = DEFAULT_ASSETS.filter((a) => !customIds.has(a.id));
          state.assets = [...baseAssets, ...(state.customAssets || [])];
        }
      },
    }
  )
);
