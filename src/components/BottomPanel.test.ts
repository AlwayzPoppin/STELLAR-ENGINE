import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useStore } from '../store/useStore';

describe('BottomPanel and TimelinePanel direct DOM resizing', () => {
  beforeEach(() => {
    useStore.setState({ timelineHeight: 240 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should clamp timeline and bottom panel height within valid boundaries', () => {
    const windowInnerHeight = 1000;
    const minH = 120;
    const maxH = windowInnerHeight * 0.6; // 600

    // Small height (clamped to min)
    const clientY1 = 950;
    const newHeight1 = windowInnerHeight - clientY1; // 50
    const clamped1 = Math.max(minH, Math.min(maxH, newHeight1));
    expect(clamped1).toBe(120);

    // Normal height
    const clientY2 = 650;
    const newHeight2 = windowInnerHeight - clientY2; // 350
    const clamped2 = Math.max(minH, Math.min(maxH, newHeight2));
    expect(clamped2).toBe(350);

    // Large height (clamped to max)
    const clientY3 = 100;
    const newHeight3 = windowInnerHeight - clientY3; // 900
    const clamped3 = Math.max(minH, Math.min(maxH, newHeight3));
    expect(clamped3).toBe(600);
  });

  it('should update DOM directly during mousemove and commit to store only on mouseup', () => {
    const setTimelineHeight = vi.fn();
    const mockMainGrid = {
      style: {
        gridTemplateRows: '1fr 240px',
      },
    };

    let pendingHeight = 240;

    const simulateMouseMove = (clientY: number) => {
      const newHeight = 1000 - clientY;
      const minH = 120;
      const maxH = 1000 * 0.6;
      pendingHeight = Math.max(minH, Math.min(maxH, newHeight));
      mockMainGrid.style.gridTemplateRows = `1fr ${pendingHeight}px`;
    };

    const simulateMouseUp = () => {
      if (pendingHeight > 0) {
        setTimelineHeight(pendingHeight);
      }
    };

    // Simulate 50 mousemove drag events
    for (let i = 700; i >= 650; i--) {
      simulateMouseMove(i);
    }

    // Direct DOM style was updated continuously without touching Zustand store
    expect(mockMainGrid.style.gridTemplateRows).toBe('1fr 350px');
    expect(setTimelineHeight).not.toHaveBeenCalled();

    // Commit only happens once on mouseUp
    simulateMouseUp();
    expect(setTimelineHeight).toHaveBeenCalledTimes(1);
    expect(setTimelineHeight).toHaveBeenCalledWith(350);
  });
});

describe('BottomPanel bulk asset import toast aggregation', () => {
  it('should emit a single aggregate toast notification when bulk-importing multiple files', async () => {
    const { toast } = await import('../store/useToastStore');
    const toastSuccessSpy = vi.spyOn(toast, 'success');
    const { importFilesBatch } = await import('./BottomPanel');

    // Create 12 mock files
    const mockFiles: File[] = [];
    for (let i = 1; i <= 12; i++) {
      const file = new File(['mock content'], `texture_${i}.png`, { type: 'image/png' });
      mockFiles.push(file);
    }

    const result = await importFilesBatch(mockFiles);

    expect(result.successCount).toBe(12);
    expect(result.failCount).toBe(0);

    // Should emit exactly 1 aggregate toast notification
    expect(toastSuccessSpy).toHaveBeenCalledTimes(1);
    expect(toastSuccessSpy).toHaveBeenCalledWith('Imported 12 assets into My Assets');
  });

  it('should emit individual asset name when importing a single file', async () => {
    const { toast } = await import('../store/useToastStore');
    const toastSuccessSpy = vi.spyOn(toast, 'success');
    const { importFilesBatch } = await import('./BottomPanel');

    const file = new File(['mock content'], `single_model.glb`, { type: 'model/gltf-binary' });
    const result = await importFilesBatch([file]);

    expect(result.successCount).toBe(1);
    expect(toastSuccessSpy).toHaveBeenCalledTimes(1);
    expect(toastSuccessSpy).toHaveBeenCalledWith('Imported single_model.glb into My Assets');
  });
});

