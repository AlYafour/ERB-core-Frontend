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

/* ── Project spending bar chart ──────────────────────────────────── */
export function ProjectSpendingChart({ data, label }: {
  data: ChartData['projectSpending'];
  label: string;
}) {
  const brand      = useCSSVar('--brand',          '#C9943A');
  const brandSubtle= useCSSVar('--brand-subtle',   'rgba(201,148,58,0.12)');
  const grid       = useCSSVar('--border-subtle',  '#1E2D45');
  const text3      = useCSSVar('--text-tertiary',  '#64748B');

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ bottom: 60, left: 0, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
        <XAxis dataKey="project" tick={{ fontSize: 10, fill: text3 }} axisLine={false}
          tickLine={false} angle={-40} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11, fill: text3 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip contentStyle={tipStyle} itemStyle={tipItemStyle}
          formatter={(v: number) => formatPrice(v)}
          cursor={{ fill: brandSubtle }} />
        <Bar dataKey="spending" fill={brand} name={label} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
