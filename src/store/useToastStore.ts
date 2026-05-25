import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (type: ToastType, title: string, message?: string, duration?: number) => string;
  removeToast: (id: string) => void;
}

const activeTimeouts = new Map<string, any>();

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  addToast: (type, title, message, duration = 3000) => {
    const id = crypto.randomUUID();
    set((state) => ({
      toasts: [...state.toasts, { id, type, title, message, duration }],
    }));

    if (duration > 0) {
      const timeout = setTimeout(() => {
        get().removeToast(id);
      }, duration);
      activeTimeouts.set(id, timeout);
    }

    return id;
  },
  removeToast: (id) => {
    if (activeTimeouts.has(id)) {
      clearTimeout(activeTimeouts.get(id));
      activeTimeouts.delete(id);
    }
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

export const toast = {
  success: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().addToast('success', title, message, duration),
  error: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().addToast('error', title, message, duration),
  warn: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().addToast('warning', title, message, duration),
  info: (title: string, message?: string, duration?: number) =>
    useToastStore.getState().addToast('info', title, message, duration),
};
