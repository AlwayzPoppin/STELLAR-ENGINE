import { describe, it, expect } from 'vitest';
import { useAssetStore } from './useAssetStore';

describe('useAssetStore', () => {
  it('should have initial assets', () => {
    const state = useAssetStore.getState();
    expect(state.assets.length).toBeGreaterThan(0);
    expect(state.assets[0].name).toBeDefined();
  });

  it('should add an asset', () => {
    const state = useAssetStore.getState();
    const initialLen = state.assets.length;
    state.addAsset({ id: 'some_unique_id_xyz', name: 'New_Asset', type: 'model' });
    
    const updatedState = useAssetStore.getState();
    expect(updatedState.assets.length).toBe(initialLen + 1);
    expect(updatedState.assets.find(a => a.id === 'some_unique_id_xyz')?.name).toBe('New_Asset');
  });

  it('should delete an asset', () => {
    const state = useAssetStore.getState();
    const initialLen = state.assets.length;
    state.deleteAsset('some_unique_id_xyz'); // Delete the one we just added
    
    const updatedState = useAssetStore.getState();
    expect(updatedState.assets.length).toBe(initialLen - 1);
    expect(updatedState.assets.find(a => a.id === 'some_unique_id_xyz')).toBeUndefined();
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
