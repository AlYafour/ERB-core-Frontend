'use client';

/**
 * DateInputDMY — a date field that ALWAYS reads and writes day/month/year,
 * regardless of the user's browser/OS locale (the native <input type="date">
 * renders mm/dd/yyyy on US-locale machines and offers no way to override).
 * Typing auto-inserts the slashes (22072026 → 22/07/2026); the calendar
 * button opens the real native picker, so nothing is lost. Value in/out is
 * always ISO (yyyy-mm-dd) — exactly what the API expects.
 */

import { useEffect, useRef, useState } from 'react';

const isoToDmy = (iso: string): string => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

const dmyToIso = (dmy: string): string | null => {
  const m = dmy.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]), mo = Number(m[2]), y = Number(m[3]);
  const probe = new Date(Date.UTC(y, mo - 1, d));
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== mo - 1 || probe.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
};

export default function DateInputDMY({ value, onChange, style, disabled }: {
  value: string;                       // ISO yyyy-mm-dd or ''
  onChange: (iso: string) => void;
  style?: React.CSSProperties;
  disabled?: boolean;
}) {
  const [text, setText] = useState(isoToDmy(value));
  const pickerRef = useRef<HTMLInputElement>(null);

  // External value changes (e.g. loading an existing voucher) sync in.
  useEffect(() => { setText(isoToDmy(value)); }, [value]);

  const handleTyping = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 8);
    let out = digits;
    if (digits.length > 4) out = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    else if (digits.length > 2) out = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    setText(out);
    if (out === '') { onChange(''); return; }
    const iso = dmyToIso(out);
    if (iso) onChange(iso);
  };

  const handleBlur = () => {
    // Incomplete/invalid text reverts to the last good value.
    if (text && !dmyToIso(text)) setText(isoToDmy(value));
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        value={text}
        disabled={disabled}
        onChange={e => handleTyping(e.target.value)}
        onBlur={handleBlur}
        style={{ ...style, paddingInlineEnd: 34 }}
      />
      <button
        type="button" tabIndex={-1} disabled={disabled} title="Open calendar"
        onClick={() => {
          const el = pickerRef.current;
          if (!el) return;
          el.value = value || '';
          if (typeof el.showPicker === 'function') el.showPicker();
          else el.click();
        }}
        style={{
          position: 'absolute', top: '50%', insetInlineEnd: 6, transform: 'translateY(-50%)',
          width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'none', border: 'none', cursor: disabled ? 'default' : 'pointer',
          color: 'var(--text-muted)', fontSize: 14, padding: 0,
        }}
      >📅</button>
      {/* Hidden native input drives the calendar popup only. */}
      <input
        ref={pickerRef} type="date" tabIndex={-1} aria-hidden="true"
        onChange={e => { if (e.target.value) onChange(e.target.value); }}
        style={{ position: 'absolute', insetInlineEnd: 6, top: 0, width: 24, height: '100%', opacity: 0, pointerEvents: 'none' }}
      />
    </div>
  );
}
