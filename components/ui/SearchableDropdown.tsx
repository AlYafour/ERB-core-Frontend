'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface DropdownOption {
  value: string | number;
  label: string;
  searchText?: string;
}

interface SearchableDropdownProps {
  options: DropdownOption[];
  value: string | number | null | undefined;
  onChange: (value: string | number | null) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  allowClear?: boolean;
  filterFunction?: (option: DropdownOption, query: string) => boolean;
}

interface MenuPosition {
  top: number;
  left: number;
  width: number;
  openUpward: boolean;
}

const MENU_MAX_HEIGHT = 240;
const VIEWPORT_MARGIN = 8;

export default function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  label,
  required = false,
  disabled = false,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No options found',
  className = '',
  allowClear = false,
  filterFunction,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuPos, setMenuPos] = useState<MenuPosition | null>(null);
  const [mounted, setMounted] = useState(false);

  const triggerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const selectedOption = useMemo(() => {
    if (value === null || value === undefined || value === '') return null;
    return options.find((opt) => opt.value === value) || null;
  }, [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    if (filterFunction) return options.filter((opt) => filterFunction(opt, query));
    return options.filter((opt) => {
      const labelMatch = opt.label?.toLowerCase().includes(query);
      const searchTextMatch = opt.searchText?.toLowerCase().includes(query);
      const valueMatch = String(opt.value).toLowerCase().includes(query);
      return labelMatch || searchTextMatch || valueMatch;
    });
  }, [options, searchQuery, filterFunction]);

  const computePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - VIEWPORT_MARGIN;
    const menuHeight = Math.min(MENU_MAX_HEIGHT, filteredOptions.length * 36 + 2);
    const openUpward = spaceBelow < menuHeight && spaceAbove > spaceBelow;

    setMenuPos({
      top: openUpward ? rect.top + window.scrollY - menuHeight - 4 : rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: rect.width,
      openUpward,
    });
  }, [filteredOptions.length]);

  const openMenu = useCallback(() => {
    if (disabled) return;
    computePosition();
    setIsOpen(true);
  }, [disabled, computePosition]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setSearchQuery('');
  }, []);

  // Recompute position on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => computePosition();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [isOpen, computePosition]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, closeMenu]);

  // Focus search input when open
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Keyboard: Escape closes
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, closeMenu]);

  const handleSelect = (option: DropdownOption) => {
    onChange(option.value);
    closeMenu();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    closeMenu();
  };

  const displayValue = selectedOption ? selectedOption.label : '';

  const menu = mounted && isOpen && menuPos ? createPortal(
    <div
      ref={menuRef}
      className="dropdown-container"
      style={{
        position: 'absolute',
        top: menuPos.top,
        left: menuPos.left,
        width: menuPos.width,
        zIndex: 9999,
        maxHeight: MENU_MAX_HEIGHT,
        overflowY: 'auto',
        boxSizing: 'border-box',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {filteredOptions.length === 0 ? (
        <div
          style={{
            padding: '10px 16px',
            fontSize: 'var(--font-sm)',
            color: 'var(--text-tertiary)',
            textAlign: 'center',
          }}
        >
          {emptyMessage}
        </div>
      ) : (
        filteredOptions.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelect(option);
            }}
            className={`dropdown-item${selectedOption?.value === option.value ? ' selected' : ''}`}
          >
            {option.label}
          </button>
        ))
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div className={`relative ${className}`} style={{ position: 'relative' }}>
      {label && (
        <label className="form-label">
          {label} {required && <span style={{ color: 'var(--color-error)' }}>*</span>}
        </label>
      )}

      <div
        ref={triggerRef}
        className={`input cursor-pointer flex items-center justify-between${isOpen ? ' ring-2' : ''}${disabled ? ' opacity-50 cursor-not-allowed' : ''}`}
        style={{
          borderColor: isOpen ? 'var(--input-focus-border)' : 'var(--input-border)',
          boxShadow: isOpen ? '0 0 0 3px var(--input-focus-ring)' : 'none',
          userSelect: 'none',
        }}
        onClick={() => isOpen ? closeMenu() : openMenu()}
      >
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full bg-transparent outline-none border-none p-0"
            style={{ color: 'var(--text-primary)', cursor: 'text' }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span style={{ color: displayValue ? 'var(--text-primary)' : 'var(--input-placeholder)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {displayValue || placeholder}
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 4 }}>
          {allowClear && selectedOption && !isOpen && (
            <button
              type="button"
              onClick={handleClear}
              style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
            >
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg
            style={{ color: 'var(--text-tertiary)', transition: 'transform 0.15s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
            width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {menu}
    </div>
  );
}
