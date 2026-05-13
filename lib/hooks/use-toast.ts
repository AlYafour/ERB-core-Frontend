'use client';

import { useState, useEffect, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

let toastId = 0;
const listeners = new Set<(toasts: Toast[]) => void>();
let toasts: Toast[] = [];

function notify() {
  listeners.forEach((listener) => listener([...toasts]));
}

export function toast(message: string, type: ToastType = 'info') {
  const id = `toast-${++toastId}`;
  toasts = [...toasts, { id, message, type }];
  notify();
  
  // Auto remove after 5 seconds
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, 5000);
}

export function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export function useToast() {
  const [state, setState] = useState<Toast[]>([]);
  
  useEffect(() => {
    const listener = (newToasts: Toast[]) => {
      setState(newToasts);
    };
    listeners.add(listener);
    listener(toasts);
    
    return () => {
      listeners.delete(listener);
    };
  }, []);
  
  return {
    toasts: state,
    toast,
    removeToast,
  };
}

// Confirmation dialog hook
let confirmResolve: ((value: boolean) => void) | null = null;
let confirmListeners = new Set<(state: ConfirmState | null) => void>();

export interface ConfirmState {
  isOpen: boolean;
  message: string;
}

export function confirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    confirmResolve = resolve;
    const state: ConfirmState = { isOpen: true, message };
    confirmListeners.forEach((listener) => listener(state));
  });
}

export function useConfirm() {
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  
  useEffect(() => {
    const listener = (state: ConfirmState | null) => {
      setConfirmState(state);
    };
    confirmListeners.add(listener);
    
    return () => {
      confirmListeners.delete(listener);
    };
  }, []);
  
  const handleConfirm = useCallback(() => {
    if (confirmResolve) {
      confirmResolve(true);
      confirmResolve = null;
    }
    confirmListeners.forEach((listener) => listener(null));
  }, []);
  
  const handleCancel = useCallback(() => {
    if (confirmResolve) {
      confirmResolve(false);
      confirmResolve = null;
    }
    confirmListeners.forEach((listener) => listener(null));
  }, []);
  
  return {
    confirmState,
    handleConfirm,
    handleCancel,
  };
}
