import { create } from 'zustand';

export type Asset = {
  id: string;
  name: string;
  type: 'material' | 'model' | 'scene' | 'script' | 'image';
  url?: string;
  content?: string; // For script assets — the raw JS source
};

interface AssetStore {
  assets: Asset[];
  isLoading: boolean;
  error: string | null;
  addAsset: (asset: Asset) => void;
  deleteAsset: (id: string) => void;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  fetchAssets: (page?: number, limit?: number) => Promise<void>;
}

export const useAssetStore = create<AssetStore>((set) => ({
  assets: [
    { id: '1', name: 'PBR_Material_1', type: 'material' },
    { id: '2', name: 'PlayerModel', type: 'model' },
    { id: '3', name: 'Level_01', type: 'scene' },
    { id: '4', name: 'HDRI_Skybox', type: 'image' },
    { id: '5', name: 'BehaviorScript.js', type: 'script', content: `// BehaviorScript.js
// Runs every frame while PLAY mode is active.
// 'self' is the live THREE.Object3D — mutate it directly!

function update(self, delta) {
  self.rotation.y += 1.0 * delta;
}

update(self, delta);
` },
  ],
  isLoading: false,
  error: null,
  addAsset: (asset) => set((state) => ({ assets: [...state.assets, asset] })),
  deleteAsset: (id) =>
    set((state) => {
      const exists = state.assets.some((a) => a.id === id);
      if (!exists) {
        console.warn(`Asset with ID ${id} not found.`);
        return { error: `Asset with ID ${id} not found.` };
      }
      return { assets: state.assets.filter((a) => a.id !== id), error: null };
    }),
  updateAsset: (id, updates) =>
    set((state) => ({
      assets: state.assets.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    })),
  fetchAssets: async (page = 1, limit = 20) => {
    try {
      set({ isLoading: true, error: null });
      const response = await fetch(`/api/assets?page=${page}&limit=${limit}`);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const data = await response.json();
      set({ assets: data, isLoading: false });
    } catch (error: any) {
      console.error('Failed to fetch assets:', error);
      set({ isLoading: false, error: error.message || 'Failed to fetch assets' });
    }
  },
}));
