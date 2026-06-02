'use client';
import { useRef, useState } from 'react';

interface FileUploadFieldProps {
  label: string;
  required?: boolean;
  value?: File | string | null;
  onChange: (file: File | null) => void;
  accept?: string;
  error?: string;
}

export default function FileUploadField({
  label, required, value, onChange, accept = '.pdf,.jpg,.jpeg,.png', error,
}: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const fileName = value instanceof File ? value.name : null;
  const hasExistingUrl = typeof value === 'string' && value.length > 0;
  const hasFile = !!fileName || hasExistingUrl;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onChange(file);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <label className="form-label">
        {label}{required && <span style={{ color: 'var(--color-error)', marginLeft: 2 }}>*</span>}
      </label>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--brand)' : error ? 'var(--status-error)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-5) var(--space-4)',
          background: dragging ? 'var(--brand-subtle)' : 'var(--surface-subtle)',
          cursor: 'pointer',
          textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)',
        }}
      >
        {hasFile ? (
          <>
            <div style={{
              width: 40, height: 40, borderRadius: 'var(--radius-md)',
              background: 'var(--brand-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--brand)',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <polyline points="13 2 13 9 20 9" />
              </svg>
            </div>
            <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)', margin: 0 }}>
              {fileName ?? 'Existing file attached'}
            </p>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
              Click to replace
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
              {hasExistingUrl && (
                <a
                  href={value as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  style={{ fontSize: 'var(--text-xs)', color: 'var(--brand)', textDecoration: 'underline' }}
                >
                  View file
                </a>
              )}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onChange(null); }}
                style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              >
                Remove
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{
              width: 40, height: 40, borderRadius: 'var(--radius-md)',
              background: 'var(--card-bg)', border: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-tertiary)',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-medium)', color: 'var(--text-primary)', margin: 0 }}>
                Drop file here, or click to browse
              </p>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', margin: 'var(--space-1) 0 0' }}>
                PDF, JPG, PNG supported
              </p>
            </div>
          </>
        )}
      </div>

      {error && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--status-error)', margin: 0 }}>{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); e.target.value = ''; }}
      />
    </div>
  );
}
