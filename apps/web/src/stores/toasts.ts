import { create } from 'zustand';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info' | 'warning';
  title: string;
  description?: string;
  durationMs?: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, 'id'>) => number;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    const duration = toast.durationMs ?? 4500;
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export function toastSuccess(title: string, description?: string) {
  return useToasts.getState().push({ kind: 'success', title, description });
}
export function toastError(title: string, description?: string) {
  return useToasts.getState().push({ kind: 'error', title, description });
}
export function toastInfo(title: string, description?: string) {
  return useToasts.getState().push({ kind: 'info', title, description });
}
export function toastWarning(title: string, description?: string) {
  return useToasts.getState().push({ kind: 'warning', title, description });
}

/** Convert an unknown thrown value into a human message. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'خطای غیرمنتظره رخ داد';
}
