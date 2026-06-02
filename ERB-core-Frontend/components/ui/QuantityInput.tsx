'use client';

import { useState, useEffect } from 'react';

interface QuantityInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  placeholder?: string;
  className?: string;
}

export default function QuantityInput({
  value,
  onChange,
  min = 1,
  step = 1,
  placeholder = 'Qty',
  className = '',
}: QuantityInputProps) {
  const [localValue, setLocalValue] = useState(value.toString());

  useEffect(() => {
    setLocalValue(value.toString());
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setLocalValue(inputValue);
    
    if (inputValue === '' || inputValue === '-') {
      return;
    }
    
    const numValue = parseInt(inputValue, 10);
    if (!isNaN(numValue) && numValue >= min) {
      onChange(numValue);
    }
  };

  const handleBlur = () => {
    const numValue = parseInt(localValue, 10);
    if (localValue === '' || isNaN(numValue) || numValue < min) {
      setLocalValue(min.toString());
      onChange(min);
    } else {
      setLocalValue(numValue.toString());
    }
  };

  const handleIncrement = () => {
    const newValue = value + step;
    setLocalValue(newValue.toString());
    onChange(newValue);
  };

  const handleDecrement = () => {
    const newValue = Math.max(min, value - step);
    setLocalValue(newValue.toString());
    onChange(newValue);
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <button
        type="button"
        onClick={handleDecrement}
        disabled={value <= min}
        className="px-2 py-1.5 text-muted-foreground border border-border rounded-l-md bg-input hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
      >
        −
      </button>
      <input
        type="number"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        min={min}
        step={step}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border-y border-border bg-input text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 focus:border-primary text-center font-semibold"
      />
      <button
        type="button"
        onClick={handleIncrement}
        className="px-2 py-1.5 text-muted-foreground border border-border rounded-r-md bg-input hover:bg-accent transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
      >
        +
      </button>
    </div>
  );
}

