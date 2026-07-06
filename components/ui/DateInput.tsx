'use client';

import { useState, useEffect } from 'react';

interface DateInputProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
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

export default function DateInput({ value, onChange, className = 'form-input', disabled }: DateInputProps) {
  const [display, setDisplay] = useState(() => isoToDisplay(value));

  useEffect(() => {
    setDisplay(isoToDisplay(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
    let formatted = digits;
    if (digits.length > 2) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    if (digits.length > 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;

    setDisplay(formatted);

    if (digits.length === 8) {
      const iso = displayToIso(formatted);
      onChange(iso);
    } else if (digits.length === 0) {
      onChange('');
    }
  };

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
      maxLength={10}
      inputMode="numeric"
    />
  );
}
