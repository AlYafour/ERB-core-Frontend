export interface KPIItem {
  label: string;
  value: number | string;
  variant?: 'total' | 'warning' | 'success' | 'error' | 'info' | 'neutral';
  sub?: string;
  loading?: boolean;
}

export function ProcKPIBar({ items }: { items: KPIItem[] }) {
  return (
    <div className="proc-kpi-bar">
      {items.map((item, i) => (
        <div key={i} className={`proc-kpi-card proc-kpi-card--${item.variant ?? 'neutral'}`}>
          <span className="proc-kpi-value">
            {item.loading ? <span style={{ color: 'var(--text-muted)', fontSize: 20 }}>—</span> : item.value}
          </span>
          <span className="proc-kpi-label">{item.label}</span>
          {item.sub && <span className="proc-kpi-sub">{item.sub}</span>}
        </div>
      ))}
    </div>
  );
}
