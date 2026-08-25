import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processImportedFile, useAssetStore } from './useAssetStore';

describe('useAssetStore processImportedFile zero-copy URL creation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should create instant Blob URLs for 3D model files without Base64 encoding', async () => {
    const mockCreateObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/mock-model-uuid');

    const file = new File(['mock binary glb content'], 'Dragon_Model.glb', {
      type: 'model/gltf-binary',
    });

    const asset = await processImportedFile(file);

    expect(mockCreateObjectURL).toHaveBeenCalledWith(file);
    expect(asset.type).toBe('model');
    expect(asset.category).toBe('Models');
    expect(asset.url).toBe('blob:http://localhost/mock-model-uuid');
    expect(asset.content).toBeUndefined();
  });

  it('should create instant Blob URLs for texture images', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/mock-image-uuid');

    const file = new File(['mock image png content'], 'Ground_Diffuse.png', {
      type: 'image/png',
    });

    const asset = await processImportedFile(file);

    expect(asset.type).toBe('image');
    expect(asset.category).toBe('Textures');
    expect(asset.url).toBe('blob:http://localhost/mock-image-uuid');
    expect(asset.thumbnailUrl).toBe('blob:http://localhost/mock-image-uuid');
  });

  it('should read script text content as string', async () => {
    const scriptSource = 'console.log("hello world");';
    const file = new File([scriptSource], 'PlayerController.js', {
      type: 'text/javascript',
    });

    const asset = await processImportedFile(file);

    expect(asset.type).toBe('script');
    expect(asset.category).toBe('Scripts');
    expect(asset.content).toBe(scriptSource);
  });
});
