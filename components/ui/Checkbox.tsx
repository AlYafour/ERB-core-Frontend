'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="w-full">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            ref={ref}
            type="checkbox"
            className={cn(
              'w-4 h-4 rounded cursor-pointer',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              className
            )}
            style={{
              accentColor: 'var(--color-orange-500)',
              borderColor: error ? 'var(--color-error)' : 'var(--input-border)',
            }}
            {...props}
          />
          {label && (
            <span
              className={cn('text-sm', props.disabled && 'opacity-50 cursor-not-allowed')}
              style={{ color: 'var(--text-primary)' }}
            >
              {label}
              {props.required && <span style={{ color: 'var(--color-error)', marginLeft: 4 }}>*</span>}
            </span>
          )}
        </label>
        {error && (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--color-error)' }}>{error}</p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';
