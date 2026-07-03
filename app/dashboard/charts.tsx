'use client';

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

/* CSS-variable colors — adapt to tenant theme + light/dark mode */
const BRAND  = 'var(--brand)';
const DANGER = 'var(--status-error)';
const TEXT3  = 'var(--text-tertiary)';
const GRID   = 'var(--border-subtle)';

/* Pie: pending=neutral, approved=brand, rejected=danger */
const PIE_COLORS = ['var(--border-default)', 'var(--brand)', 'var(--status-error)'];

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
  return (
    <ResponsiveContainer width="100%" height={130}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={34} outerRadius={54} paddingAngle={3} dataKey="value" strokeWidth={0}>
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={tipStyle} itemStyle={tipItemStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ── Monthly volume line chart ───────────────────────────────────── */
export function MonthlyVolumeChart({ data, label }: { data: ChartData['monthlyProcurement']; label: string }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: TEXT3 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: TEXT3 }} axisLine={false} tickLine={false} width={30} />
        <Tooltip contentStyle={tipStyle} itemStyle={tipItemStyle} cursor={{ stroke: GRID, strokeWidth: 1 }} />
        <Line type="monotone" dataKey="count" stroke={BRAND} strokeWidth={2.5} dot={false} name={label} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── Project spending bar chart ──────────────────────────────────── */
export function ProjectSpendingChart({ data, label }: { data: ChartData['projectSpending']; label: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ bottom: 60, left: 0, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="project" tick={{ fontSize: 10, fill: TEXT3 }} axisLine={false} tickLine={false} angle={-40} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11, fill: TEXT3 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip contentStyle={tipStyle} itemStyle={tipItemStyle} formatter={(v: number) => formatPrice(v)} cursor={{ fill: 'var(--brand-subtle)' }} />
        <Bar dataKey="spending" fill={BRAND} name={label} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
