'use client';

import { useState, useEffect } from 'react';
import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { CSSProperties } from 'react';
import { formatPrice } from '@/lib/utils/format';
import type { ChartData } from '@/lib/api/dashboard';

/* ── CSS variable resolver ───────────────────────────────────────
   Recharts passes fill/stroke as SVG presentation attributes,
   which don't resolve CSS custom properties in all browsers.
   We read the computed values explicitly and pass real hex/rgb.
   ──────────────────────────────────────────────────────────────── */
function useCSSVar(name: string, fallback: string): string {
  const resolve = () => {
    if (typeof window === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  };
  const [val, setVal] = useState(resolve);
  useEffect(() => {
    const update = () => setVal(resolve());
    update();
    // React to dark/light toggle (data-theme attr change)
    const attrObs = new MutationObserver(update);
    attrObs.observe(document.documentElement, { attributes: true });
    // React to tenant theme injection (<style id="tenant-theme"> added to head)
    const headObs = new MutationObserver(update);
    headObs.observe(document.head, { childList: true });
    return () => { attrObs.disconnect(); headObs.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, fallback]);
  return val;
}

/* Shared tooltip style — reads CSS vars via inline style (works fine in HTML) */
const tipStyle: CSSProperties = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border-default)',
  borderRadius: 8,
  color: 'var(--text-primary)',
  fontSize: 12,
  padding: '8px 12px',
  boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
};
const tipItemStyle: CSSProperties = { color: 'var(--text-primary)' };

/* ── Status Pie ──────────────────────────────────────────────────── */
export function StatusPieCard({ data }: {
  title: string;
  href: string;
  data: { name: string; value: number }[];
}) {
  const brand  = useCSSVar('--brand',          '#C9943A');
  const danger = useCSSVar('--status-error',   '#E05C5C');
  const muted  = useCSSVar('--border-default', '#263449');
  const PIE    = [muted, brand, danger];

  return (
    <ResponsiveContainer width="100%" height={130}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={34} outerRadius={54}
          paddingAngle={3} dataKey="value" strokeWidth={0}>
          {data.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
        </Pie>
        <Tooltip contentStyle={tipStyle} itemStyle={tipItemStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ── Monthly volume line chart ───────────────────────────────────── */
export function MonthlyVolumeChart({ data, label }: {
  data: ChartData['monthlyProcurement'];
  label: string;
}) {
  const brand  = useCSSVar('--brand',          '#C9943A');
  const grid   = useCSSVar('--border-subtle',  '#1E2D45');
  const text3  = useCSSVar('--text-tertiary',  '#64748B');

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: text3 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: text3 }} axisLine={false} tickLine={false} width={30} />
        <Tooltip contentStyle={tipStyle} itemStyle={tipItemStyle}
          cursor={{ stroke: grid, strokeWidth: 1 }} />
        <Line type="monotone" dataKey="count" stroke={brand} strokeWidth={2.5}
          dot={false} name={label} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── Project spending pie/donut chart ────────────────────────────── */
export function ProjectSpendingPieChart({ data }: {
  data: ChartData['projectSpending'];
}) {
  const c1 = useCSSVar('--brand',          '#C9943A');
  const c2 = useCSSVar('--wine-300',       '#E0B870');
  const c3 = useCSSVar('--status-error',   '#E05C5C');
  const c4 = useCSSVar('--border-strong',  '#4A5568');
  const c5 = useCSSVar('--text-tertiary',  '#94A3B8');

  const PIE = [c1, c3, c2, c4, c5];
  const top = data.slice(0, 5);
  const total = top.reduce((s, d) => s + d.spending, 0);

  return (
    <>
      <ResponsiveContainer width="100%" height={130}>
        <PieChart>
          <Pie data={top} cx="50%" cy="50%" innerRadius={34} outerRadius={54}
            paddingAngle={3} dataKey="spending" strokeWidth={0}>
            {top.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
          </Pie>
          <Tooltip contentStyle={tipStyle} itemStyle={tipItemStyle}
            formatter={(v: number) => formatPrice(v)}
            labelFormatter={(_, payload) => payload?.[0]?.name ?? ''} />
        </PieChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 10 }}>
        {top.slice(0, 4).map((d, i) => (
          <div key={d.project} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
              <div style={{ width: 7, height: 7, borderRadius: 2, background: PIE[i], flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.project}
              </span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0, paddingLeft: 6 }}>
              {total > 0 ? Math.round(d.spending / total * 100) : 0}%
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
