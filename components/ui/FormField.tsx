'use client';

import { ReactNode, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';

interface FormFieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: ReactNode;
  className?: string;
  fieldName?: string;
}

export default function FormField({
  label,
  required,
  error,
  helperText,
  children,
  className,
  fieldName,
}: FormFieldProps) {
  const fieldRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error && fieldRef.current) {
      // Scroll to field with error
      fieldRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

  return (
    <div ref={fieldRef} className={cn('w-full', className)}>
      {label && (
        <label
          className="form-label"
          htmlFor={fieldName}
        >
          {label}
          {required && <span style={{ color: 'var(--color-error)' }} className="ml-1">*</span>}
        </label>
      )}
      <div className={error ? 'field-with-error' : ''}>
        {children}
      </div>
      {error && (
        <div className="mt-1.5 flex items-start gap-1.5">
          <svg
            className="w-4 h-4 mt-0.5 flex-shrink-0"
            style={{ color: 'var(--color-error)' }}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-xs" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        </div>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {helperText}
        </p>
      )}
    </div>
  );
}
