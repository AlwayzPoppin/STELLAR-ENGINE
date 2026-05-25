import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useToastStore, toast } from './useToastStore';

describe('useToastStore', () => {
  beforeEach(() => {
    // Clear toasts before each test
    useToastStore.setState({ toasts: [] });
  });

  it('should initialize with empty toasts', () => {
    const state = useToastStore.getState();
    expect(state.toasts).toEqual([]);
  });

  it('should add a toast and return ID', () => {
    const id = useToastStore.getState().addToast('success', 'Project Saved', 'Successfully saved project');
    
    expect(id).toBeDefined();
    const toasts = useToastStore.getState().toasts;
    expect(toasts.length).toBe(1);
    expect(toasts[0]).toEqual({
      id,
      type: 'success',
      title: 'Project Saved',
      message: 'Successfully saved project',
      duration: 3000,
    });
  });

  it('should manually remove a toast', () => {
    const id = useToastStore.getState().addToast('error', 'Failed', 'An error occurred');
    expect(useToastStore.getState().toasts.length).toBe(1);

    useToastStore.getState().removeToast(id);
    expect(useToastStore.getState().toasts.length).toBe(0);
  });

  it('should auto-dismiss after duration', () => {
    vi.useFakeTimers();
    
    useToastStore.getState().addToast('warning', 'Warning Title', 'Warning Message', 2000);
    expect(useToastStore.getState().toasts.length).toBe(1);

    // Advance time but not enough
    vi.advanceTimersByTime(1000);
    expect(useToastStore.getState().toasts.length).toBe(1);

    // Advance time fully
    vi.advanceTimersByTime(1000);
    expect(useToastStore.getState().toasts.length).toBe(0);

    vi.useRealTimers();
  });

  it('should trigger toasts via top-level helper', () => {
    toast.success('Saved Success', 'Body msg');
    toast.error('Export Error', 'Body error');
    toast.warn('Export Warning');
    toast.info('Info message');

    const toasts = useToastStore.getState().toasts;
    expect(toasts.length).toBe(4);
    expect(toasts[0].type).toBe('success');
    expect(toasts[0].title).toBe('Saved Success');
    expect(toasts[1].type).toBe('error');
    expect(toasts[2].type).toBe('warning');
    expect(toasts[3].type).toBe('info');
  });
});
