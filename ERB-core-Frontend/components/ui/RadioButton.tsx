'use client';

import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils/cn';

export interface RadioButtonProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

export const RadioButton = forwardRef<HTMLInputElement, RadioButtonProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="w-full">
        <label className="flex items-center gap-2 cursor-pointer group">
          <input
            ref={ref}
            type="radio"
            className={cn(
              'w-4 h-4 border-border bg-input text-primary',
              'focus:ring-2 focus:ring-primary focus:ring-offset-2',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'cursor-pointer',
              error && 'border-destructive',
              className
            )}
            {...props}
          />
          {label && (
            <span className={cn(
              'text-sm text-foreground',
              props.disabled && 'opacity-50 cursor-not-allowed'
            )}>
              {label}
              {props.required && <span className="text-destructive ml-1">*</span>}
            </span>
          )}
        </label>
        {error && (
          <p className="mt-1.5 text-xs text-destructive">{error}</p>
        )}
      </div>
    );
  }
);

RadioButton.displayName = 'RadioButton';

// Radio Group
export interface RadioGroupProps {
  name: string;
  value?: string;
  onChange?: (value: string) => void;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  error?: string;
  className?: string;
}

export function RadioGroup({ name, value, onChange, options, error, className }: RadioGroupProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {options.map((option) => (
        <RadioButton
          key={option.value}
          name={name}
          value={option.value}
          checked={value === option.value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={option.disabled}
          label={option.label}
        />
      ))}
      {error && (
        <p className="text-xs text-destructive mt-1.5">{error}</p>
      )}
    </div>
  );
}

