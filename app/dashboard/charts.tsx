'use client';

import {
  LineChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { formatPrice } from '@/lib/utils/format';
import type { CSSProperties } from 'react';
import type { ChartData } from '@/lib/api/dashboard';

const D = {
  ground:  '#07101F',
  surf:    '#0F1D30',
  border:  '#1A2C42',
  text:    '#E2EAF4',
  text3:   '#4A6280',
  gold:    '#C9943A',
  teal:    '#2ECFA8',
  danger:  '#E05C5C',
  warn:    '#E8A94A',
};

const PIE_COLORS = [D.warn, D.teal, D.danger, '#6B8FE8'];

const tipStyle: CSSProperties = {
  backgroundColor: '#0F1D30',
  border: `1px solid #1A2C42`,
  borderRadius: 8,
  color: '#E2EAF4',
  fontSize: 12,
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
};

/* ── Status Pie card ─────────────────────────────────────────────── */
export function StatusPieCard({ data }: {
  title: string;
  href: string;
  data: { name: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <PieChart>
        <Pie
          data={data}
          cx="50%" cy="50%"
          innerRadius={42} outerRadius={68}
          paddingAngle={3}
          dataKey="value"
          strokeWidth={0}
        >
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={tipStyle} itemStyle={{ color: D.text }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ── Monthly volume line chart ───────────────────────────────────── */
export function MonthlyVolumeChart({ data, label }: { data: ChartData['monthlyProcurement']; label: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <defs>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor={D.gold}  stopOpacity={0.25} />
            <stop offset="95%" stopColor={D.gold}  stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={D.border} vertical={false} />
        <XAxis dataKey="month"  tick={{ fontSize: 11, fill: D.text3 }} axisLine={false} tickLine={false} />
        <YAxis                  tick={{ fontSize: 11, fill: D.text3 }} axisLine={false} tickLine={false} width={32} />
        <Tooltip contentStyle={tipStyle} itemStyle={{ color: D.text }} cursor={{ stroke: D.border, strokeWidth: 1 }} />
        <Legend wrapperStyle={{ fontSize: 11, color: D.text3 }} />
        <Line type="monotone" dataKey="count" stroke={D.gold} strokeWidth={2} dot={false} name={label} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── Project spending bar chart ──────────────────────────────────── */
export function ProjectSpendingChart({ data, label }: { data: ChartData['projectSpending']; label: string }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ bottom: 60, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={D.border} vertical={false} />
        <XAxis dataKey="project" tick={{ fontSize: 10, fill: D.text3 }} axisLine={false} tickLine={false} angle={-40} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11, fill: D.text3 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip contentStyle={tipStyle} itemStyle={{ color: D.text }} formatter={(v: number) => formatPrice(v)} />
        <Bar dataKey="spending" fill={D.teal} name={label} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
