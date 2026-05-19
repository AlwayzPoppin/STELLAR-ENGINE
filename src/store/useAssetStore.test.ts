import { describe, it, expect } from 'vitest';
import { useAssetStore } from './useAssetStore';

describe('useAssetStore', () => {
  it('should have initial assets', () => {
    const state = useAssetStore.getState();
    expect(state.assets.length).toBe(5);
    expect(state.assets[0].name).toBe('PBR_Material_1');
  });

  it('should add an asset', () => {
    const state = useAssetStore.getState();
    state.addAsset({ id: '6', name: 'New_Asset', type: 'model' });
    
    const updatedState = useAssetStore.getState();
    expect(updatedState.assets.length).toBe(6);
    expect(updatedState.assets.find(a => a.id === '6')?.name).toBe('New_Asset');
  });

  it('should delete an asset', () => {
    const state = useAssetStore.getState();
    state.deleteAsset('6'); // Delete the one we just added
    
    const updatedState = useAssetStore.getState();
    expect(updatedState.assets.length).toBe(5);
    expect(updatedState.assets.find(a => a.id === '6')).toBeUndefined();
  });

  it('should handle fetch assets failure', async () => {
    // Mock fetch to fail
    const originalFetch = global.fetch;
    global.fetch = (async () => ({
      ok: false,
      status: 500,
    })) as any;
    
    const state = useAssetStore.getState();
    await state.fetchAssets();
    
    const updatedState = useAssetStore.getState();
    expect(updatedState.error).toBe('Network response was not ok');
    expect(updatedState.isLoading).toBe(false);
    
    // Restore fetch
    global.fetch = originalFetch;
  });
});
