'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  width?: number | string;
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, placeholder = 'Search…', className, width = 280, style, ...rest }, ref) => {
    return (
      <div style={{ position: 'relative', width, flexShrink: 0 }}>
        {/* Search icon */}
        <svg
          width="14" height="14"
          viewBox="0 0 24 24" fill="none" stroke="currentColor"
          style={{
            position: 'absolute',
            left: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)',
            pointerEvents: 'none',
          }}
        >
          <circle cx="11" cy="11" r="8" strokeWidth="2" strokeLinecap="round" />
          <path d="M21 21l-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
        </svg>

        <input
          ref={ref}
          type="search"
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          className={cn('input', className)}
          style={{
            paddingLeft: 32,
            paddingRight: value ? 32 : undefined,
            height: 36,
            width: '100%',
            ...style,
          }}
          {...rest}
        />

        {/* Clear button */}
        {value && (
          <button
            type="button"
            onClick={() => onChange?.('')}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              borderRadius: 'var(--radius-full)',
              border: 'none',
              background: 'var(--border-default)',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              transition: 'background 100ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--border-strong)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--border-default)'; }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path strokeLinecap="round" d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);
SearchInput.displayName = 'SearchInput';
