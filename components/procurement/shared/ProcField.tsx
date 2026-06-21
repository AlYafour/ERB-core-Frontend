import type { ReactNode } from 'react';

export function ProcField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="proc-info-field">
      <span className="proc-info-label">{label}</span>
      <div className="proc-info-value">{value || <span className="proc-info-value--empty">—</span>}</div>
    </div>
  );
}
