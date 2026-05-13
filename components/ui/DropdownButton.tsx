'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface DropdownButtonItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

interface DropdownButtonProps {
  label: string;
  items: DropdownButtonItem[];
  variant?: 'primary' | 'secondary' | 'success' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  disabled?: boolean;
}

export default function DropdownButton({
  label,
  items,
  variant = 'primary',
  size = 'md',
  className,
  disabled = false,
}: DropdownButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleItemClick = (item: DropdownButtonItem) => {
    item.onClick();
    setIsOpen(false);
  };

  const buttonClasses = cn(
    'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 ease-in-out whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2',
    variant === 'primary' && 'bg-[var(--brand-orange)] text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] focus:ring-[var(--ring)] shadow-sm',
    variant === 'secondary' && 'bg-secondary text-secondary-foreground border border-border hover:bg-muted focus:ring-[var(--grey-400)]',
    variant === 'success' && 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-600',
    variant === 'ghost' && 'bg-transparent text-foreground hover:bg-accent focus:ring-primary',
    size === 'sm' && 'h-9 px-3 text-xs rounded-md',
    size === 'md' && 'h-[42px] px-4 text-sm rounded-md',
    size === 'lg' && 'h-12 px-6 text-base rounded-md',
    className
  );

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={buttonClasses}
      >
        <span>{label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            style={{ backgroundColor: 'transparent' }}
          />
          <div className="absolute z-50 mt-1 w-56 rounded-md shadow-lg bg-[var(--card)] border border-[var(--border)]">
            <div className="py-1">
              {items.map((item, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--accent)] transition-colors flex items-center gap-2"
                  style={{ color: 'var(--foreground)' }}
                >
                  {item.icon && <span className="w-4 h-4">{item.icon}</span>}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

