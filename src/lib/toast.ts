'use client';

type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration?: number;
}

type Listener = (toasts: ToastMessage[]) => void;

let toasts: ToastMessage[] = [];
let listeners: Listener[] = [];

function notify() {
  listeners.forEach((listener) => listener([...toasts]));
}

export const toast = {
  show(message: string, type: ToastType = 'info', title?: string, duration: number = 3500) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newToast: ToastMessage = { id, message, type, title, duration };
    toasts = [newToast, ...toasts].slice(0, 4);
    notify();

    setTimeout(() => {
      toast.dismiss(id);
    }, duration);

    return id;
  },
  success(message: string, title?: string) {
    return toast.show(message, 'success', title);
  },
  error(message: string, title?: string) {
    return toast.show(message, 'error', title);
  },
  info(message: string, title?: string) {
    return toast.show(message, 'info', title);
  },
  warning(message: string, title?: string) {
    return toast.show(message, 'warning', title);
  },
  dismiss(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  },
  subscribe(listener: Listener) {
    listeners.push(listener);
    listener([...toasts]);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};
