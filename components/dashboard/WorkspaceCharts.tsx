'use client';

import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, CartesianGrid,
} from 'recharts';

/* Resolve a CSS custom property to a real color (Recharts needs concrete values). */
function useVar(name: string, fb: string): string {
  const get = () => (typeof window === 'undefined' ? fb
    : getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb);
  const [v, setV] = useState(get);
  useEffect(() => {
    const u = () => setV(get());
    u();
    const o = new MutationObserver(u);
    o.observe(document.documentElement, { attributes: true });
    o.observe(document.head, { childList: true });
    return () => o.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, fb]);
  return v;
}

const tip: CSSProperties = {
  backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-default)',
  borderRadius: 8, color: 'var(--text-primary)', fontSize: 12, padding: '6px 10px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
};
const NoData = ({ height }: { height: number }) => (
  <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>Nothing to show</div>
);

export type Slice = { name: string; value: number };

/* Donut + inline legend (colour · label · value). */
export function Donut({ data, height = 132 }: { data: Slice[]; height?: number }) {
  const palette = [
    useVar('--brand', '#C9943A'),
    useVar('--status-warning', '#b45309'),
    useVar('--status-success', '#2e7d54'),
    useVar('--status-error', '#b23b3b'),
    useVar('--border-default', '#94a3b8'),
  ];
  const rows = data.filter(d => d.value > 0);
  const total = rows.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <NoData height={height} />;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 132, flexShrink: 0 }}>
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie data={rows} cx="50%" cy="50%" innerRadius={32} outerRadius={52} paddingAngle={3} dataKey="value" strokeWidth={0}>
              {rows.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
            </Pie>
            <Tooltip contentStyle={tip} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((d, i) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: palette[i % palette.length], flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Small daily bar chart (e.g. worked hours per day). */
export function MiniBars({ data, height = 132 }: { data: { label: string; value: number }[]; height?: number }) {
  const brand = useVar('--brand', '#C9943A');
  const grid  = useVar('--border-subtle', '#e5e7eb');
  const t3    = useVar('--text-tertiary', '#94a3b8');
  if (!data.some(d => d.value > 0)) return <NoData height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 9, fill: t3 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <Tooltip contentStyle={tip} cursor={{ fill: 'var(--surface-subtle)' }} />
        <Bar dataKey="value" fill={brand} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
