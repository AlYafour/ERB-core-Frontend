'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { BaseInput, BaseInputProps, BaseTextarea, BaseTextareaProps } from './base/BaseInput';

// TextField
export const TextField = forwardRef<HTMLInputElement, BaseInputProps>(
  (props, ref) => {
    return <BaseInput ref={ref} {...props} />;
  }
);
TextField.displayName = 'TextField';

// TextArea
export const TextArea = forwardRef<HTMLTextAreaElement, BaseTextareaProps>(
  (props, ref) => {
    return <BaseTextarea ref={ref} {...props} />;
  }
);
TextArea.displayName = 'TextArea';

// PasswordField
export interface PasswordFieldProps extends BaseInputProps {
  showPassword?: boolean;
  onTogglePassword?: () => void;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ showPassword = false, onTogglePassword, label, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="form-label">
            {label}
            {props.required && <span style={{ color: 'var(--color-error)' }} className="ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            type={showPassword ? 'text' : 'password'}
            className="input"
            style={{
              paddingRight: onTogglePassword ? '44px' : undefined,
            }}
            {...props}
          />
          {onTogglePassword && (
            <button
              type="button"
              onClick={onTogglePassword}
              className="absolute rounded-md transition-all duration-200"
              style={{
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '28px',
                height: '28px',
                color: 'var(--text-tertiary)',
                backgroundColor: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: 0,
                padding: 0,
                border: 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--brand)';
                e.currentTarget.style.backgroundColor = 'var(--brand-subtle)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-tertiary)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg 
                  className="w-5 h-5 transition-transform duration-200" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  style={{ strokeWidth: 2.5 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg 
                  className="w-5 h-5 transition-transform duration-200" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  style={{ strokeWidth: 2.5 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>
    );
  }
);
PasswordField.displayName = 'PasswordField';

