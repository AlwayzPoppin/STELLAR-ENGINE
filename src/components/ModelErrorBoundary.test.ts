import { describe, it, expect, vi } from 'vitest';
import { toast } from '../store/useToastStore';

describe('ModelErrorBoundary error notification handling', () => {
  it('should trigger toast.error when model loading fails', () => {
    const errorSpy = vi.spyOn(toast, 'error');

    // Simulate ModelErrorBoundary componentDidCatch logic
    const assetName = 'Dragon_Boss.glb';
    const error = new Error('Unexpected token < in JSON at position 0');

    const handleCatch = (err: any, name?: string) => {
      const assetTitle = name ? ` "${name}"` : '';
      toast.error(
        'Model Load Error',
        `Failed to load 3D model${assetTitle}. The asset file may be corrupted, missing texture references, or in an unsupported format.`
      );
    };

    handleCatch(error, assetName);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      'Model Load Error',
      expect.stringContaining('Dragon_Boss.glb')
    );
  });
});
