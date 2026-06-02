'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'error' | 'warning' | 'info' | 'active' | 'inactive' | 'on-going' | 'pending';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const VARIANT_CLASS: Record<string, string> = {
  success:   'badge badge-success',
  active:    'badge badge-success',
  error:     'badge badge-error',
  inactive:  'badge badge-error',
  rejected:  'badge badge-error',
  warning:   'badge badge-warning',
  'on-going':'badge badge-warning',
  info:      'badge badge-info',
  pending:   'badge badge-warning',
  default:   'badge',
};

const SIZE_CLASS: Record<string, string> = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1.5',
};

export function Badge({ children, variant = 'default', size = 'md', className }: BadgeProps) {
  const variantClass = VARIANT_CLASS[variant] ?? 'badge';
  return (
    <span className={cn(variantClass, SIZE_CLASS[size], className)}>
      {children}
    </span>
  );
}
