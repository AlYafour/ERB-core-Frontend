'use client';

import { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface BaseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'success' | 'view' | 'edit' | 'delete';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  children: ReactNode;
  className?: string;
}

export function BaseButton({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  className,
  ...props
}: BaseButtonProps) {
  const variantClass = {
    primary:     'btn-primary',
    secondary:   'btn-secondary',
    ghost:       'btn-ghost',
    view:        'btn-secondary',
    edit:        'btn-edit',
    delete:      'btn-destructive',
    destructive: 'btn-destructive',
    success:     'btn-success',
  }[variant];

  /* Heights are explicit so they override the .btn default cleanly */
  const sizeClass = {
    sm: 'h-8 px-3 text-[11px]',
    md: 'h-[34px] px-4 text-[13px]',
    lg: 'h-9 px-5 text-[13px]',
  }[size];

  return (
    <button
      className={cn('btn', variantClass, sizeClass, isLoading && 'cursor-wait', className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <svg
            className="animate-spin h-3.5 w-3.5 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none" viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
