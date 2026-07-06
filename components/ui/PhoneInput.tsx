'use client';

import { useState, useEffect } from 'react';

const CODES = [
  { code: '+971', label: 'UAE +971',         max: 9  },
  { code: '+966', label: 'Saudi +966',       max: 9  },
  { code: '+968', label: 'Oman +968',        max: 8  },
  { code: '+965', label: 'Kuwait +965',      max: 8  },
  { code: '+973', label: 'Bahrain +973',     max: 8  },
  { code: '+974', label: 'Qatar +974',       max: 8  },
  { code: '+962', label: 'Jordan +962',      max: 9  },
  { code: '+961', label: 'Lebanon +961',     max: 8  },
  { code: '+963', label: 'Syria +963',       max: 9  },
  { code: '+20',  label: 'Egypt +20',        max: 10 },
  { code: '+91',  label: 'India +91',        max: 10 },
  { code: '+92',  label: 'Pakistan +92',     max: 10 },
  { code: '+63',  label: 'Philippines +63',  max: 10 },
  { code: '+880', label: 'Bangladesh +880',  max: 10 },
  { code: '+94',  label: 'Sri Lanka +94',    max: 9  },
  { code: '+977', label: 'Nepal +977',       max: 10 },
  { code: '+44',  label: 'UK +44',           max: 10 },
  { code: '+1',   label: 'USA/CA +1',        max: 10 },
];

function splitValue(full: string): { code: string; local: string } {
  for (const c of CODES) {
    if (full.startsWith(c.code)) return { code: c.code, local: full.slice(c.code.length) };
  }
  return { code: '+971', local: full.replace(/^\+?\d{1,4}/, '') };
}

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}

export default function PhoneInput({ value, onChange, className = 'form-input', disabled }: PhoneInputProps) {
  const [code, setCode]   = useState(() => splitValue(value).code);
  const [local, setLocal] = useState(() => splitValue(value).local);

  useEffect(() => {
    const split = splitValue(value);
    setCode(split.code);
    setLocal(split.local);
  }, [value]);

  const maxDigits = CODES.find(c => c.code === code)?.max ?? 10;

  const handleCode = (newCode: string) => {
    setCode(newCode);
    onChange(newCode + local);
  };

  const handleLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, maxDigits);
    setLocal(digits);
    onChange(code + digits);
  };

  return (
    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
      <select
        value={code}
        onChange={(e) => handleCode(e.target.value)}
        disabled={disabled}
        className="form-select"
        style={{ width: 140, flexShrink: 0 }}
      >
        {CODES.map(c => (
          <option key={c.code} value={c.code}>{c.label}</option>
        ))}
      </select>
      <input
        type="tel"
        className={className}
        value={local}
        onChange={handleLocal}
        disabled={disabled}
        inputMode="numeric"
        maxLength={maxDigits}
        style={{ flex: 1 }}
      />
    </div>
  );
}
