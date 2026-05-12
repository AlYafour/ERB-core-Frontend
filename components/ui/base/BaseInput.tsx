'use client';

import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface BaseInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  className?: string;
}

export const BaseInput = forwardRef<HTMLInputElement, BaseInputProps>(
  ({ label, error, helperText, className, style, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="form-label">
            {label}
            {props.required && (
              <span style={{ color: 'var(--status-error)' }} className="ml-1">*</span>
            )}
          </label>
        )}
        <input
          ref={ref}
          className={cn('input', className)}
          style={error ? {
            borderColor: 'var(--status-error)',
            boxShadow: `0 0 0 3px var(--status-error-border)`,
            ...style,
          } : style}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-[11px]" style={{ color: 'var(--status-error)' }}>
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
BaseInput.displayName = 'BaseInput';

export interface BaseTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  className?: string;
}

export const BaseTextarea = forwardRef<HTMLTextAreaElement, BaseTextareaProps>(
  ({ label, error, helperText, className, style, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="form-label">
            {label}
            {props.required && (
              <span style={{ color: 'var(--status-error)' }} className="ml-1">*</span>
            )}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn('input resize-none', className)}
          style={error ? {
            borderColor: 'var(--status-error)',
            boxShadow: `0 0 0 3px var(--status-error-border)`,
            ...style,
          } : style}
          {...props}
        />
        {error && (
          <p className="mt-1.5 text-[11px]" style={{ color: 'var(--status-error)' }}>
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
BaseTextarea.displayName = 'BaseTextarea';
