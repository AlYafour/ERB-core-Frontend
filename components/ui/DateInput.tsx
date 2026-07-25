'use client';

import React, { useState, useEffect } from 'react';

interface DateInputProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
  name?: string;
  style?: React.CSSProperties;
  /** ISO (YYYY-MM-DD) lower bound — a completed earlier date is flagged invalid. */
  minDate?: string;
  /** ISO (YYYY-MM-DD) upper bound — a completed later date is flagged invalid. */
  maxDate?: string;
}

function isoToDisplay(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return '';
  return `${d}/${m}/${y}`;
}

function displayToIso(display: string): string {
  const digits = display.replace(/\D/g, '');
  if (digits.length < 8) return '';
  return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
}

function outOfRange(iso: string, minDate?: string, maxDate?: string): boolean {
  if (!iso) return false;
  if (minDate && iso < minDate) return true;
  if (maxDate && iso > maxDate) return true;
  return false;
}

export default function DateInput({ value, onChange, className = 'form-input', disabled, name, style, minDate, maxDate }: DateInputProps) {
  const [display, setDisplay] = useState(() => isoToDisplay(value));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setDisplay(isoToDisplay(value));
    setInvalid(outOfRange(value, minDate, maxDate));
  }, [value, minDate, maxDate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 2) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;

    setDisplay(formatted);

    if (digits.length === 8) {
      const iso = displayToIso(formatted);
      setInvalid(outOfRange(iso, minDate, maxDate));
      onChange(iso);
    } else if (digits.length === 0) {
      setInvalid(false);
      onChange('');
    }
  };

  const rangeHint = minDate && maxDate
    ? `Date must be between ${isoToDisplay(minDate)} and ${isoToDisplay(maxDate)}`
    : minDate ? `Date must be on or after ${isoToDisplay(minDate)}`
    : maxDate ? `Date must be on or before ${isoToDisplay(maxDate)}` : undefined;

  const handleBlur = () => {
    // Reformat from stored ISO on blur to handle manual edits
    if (value) setDisplay(isoToDisplay(value));
    else setDisplay('');
  };

  return (
    <input
      type="text"
      className={className}
      value={display}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      name={name}
      aria-invalid={invalid || undefined}
      title={invalid ? rangeHint : undefined}
      style={{ ...style, ...(invalid ? { borderColor: 'var(--status-error)' } : {}) }}
      maxLength={10}
      inputMode="numeric"
      placeholder="DD/MM/YYYY"
    />
  );
}
