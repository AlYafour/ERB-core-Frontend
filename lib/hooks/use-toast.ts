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

// Accept either the string API — toast('Saved', 'success') — or an object API
// — toast({ title: 'Saved', variant: 'success' }). Both are used across the app;
// normalizing here keeps every call site working AND prevents rendering an object
// as a React child (which throws "Objects are not valid as a React child").
export type ToastInput =
  | string
  | { title?: string; message?: string; description?: string; variant?: string; type?: ToastType };

const VARIANT_TO_TYPE: Record<string, ToastType> = {
  success: 'success', error: 'error', destructive: 'error',
  warning: 'warning', warn: 'warning', info: 'info', default: 'info',
};

function normalizeToast(input: ToastInput, fallbackType: ToastType): { message: string; type: ToastType } {
  if (typeof input === 'string') return { message: input, type: fallbackType };
  const message = input.message ?? input.title ?? input.description ?? '';
  const raw = input.variant ?? input.type ?? fallbackType;
  return { message: String(message), type: VARIANT_TO_TYPE[raw] ?? fallbackType };
}

export function toast(input: ToastInput, type: ToastType = 'info') {
  const { message, type: resolvedType } = normalizeToast(input, type);
  const id = `toast-${++toastId}`;
  toasts = [...toasts, { id, message, type: resolvedType }];
  notify();
  setTimeout(() => { toasts = toasts.filter((t) => t.id !== id); notify(); }, 5000);
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
const confirmListeners = new Set<(state: ConfirmState | null) => void>();

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
