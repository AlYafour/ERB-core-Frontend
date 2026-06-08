'use client';

import { useState, useEffect, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  action?: { label: string; onClick: () => void };
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
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); notify(); }, 5000);
}

export function toastWithUndo(message: string, onUndo: () => void, durationMs = 5000) {
  const id = `toast-${++toastId}`;
  const action = { label: 'Undo', onClick: () => { onUndo(); removeToast(id); } };
  toasts = [...toasts, { id, message, type: 'success' as ToastType, action }];
  notify();
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); notify(); }, durationMs);
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
