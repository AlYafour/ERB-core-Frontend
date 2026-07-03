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

/* Two colors only — gold (accent) + red (danger) */
const GOLD    = '#C9943A';
const DANGER  = '#E05C5C';
const MUTED   = '#2A3F58';
const TEXT3   = '#4A6280';
const BORDER  = '#1A2C42';
const SURF    = '#0F1D30';

/* Pie: pending=muted, approved=gold, rejected=red */
const PIE_COLORS = [MUTED, GOLD, DANGER];

const tipStyle: CSSProperties = {
  backgroundColor: SURF,
  border: `1px solid ${BORDER}`,
  borderRadius: 8,
  color: '#E2EAF4',
  fontSize: 12,
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
};

/* ── Status Pie ──────────────────────────────────────────────────── */
export function StatusPieCard({ data }: {
  title: string;
  href: string;
  data: { name: string; value: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={36} outerRadius={58} paddingAngle={4} dataKey="value" strokeWidth={0}>
          {data.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={tipStyle} itemStyle={{ color: '#E2EAF4' }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* ── Monthly volume line chart ───────────────────────────────────── */
export function MonthlyVolumeChart({ data, label }: { data: ChartData['monthlyProcurement']; label: string }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: TEXT3 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: TEXT3 }} axisLine={false} tickLine={false} width={32} />
        <Tooltip contentStyle={tipStyle} itemStyle={{ color: '#E2EAF4' }} cursor={{ stroke: BORDER, strokeWidth: 1 }} />
        <Line type="monotone" dataKey="count" stroke={GOLD} strokeWidth={2} dot={false} name={label} />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ── Project spending bar chart ──────────────────────────────────── */
export function ProjectSpendingChart({ data, label }: { data: ChartData['projectSpending']; label: string }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ bottom: 60, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
        <XAxis dataKey="project" tick={{ fontSize: 10, fill: TEXT3 }} axisLine={false} tickLine={false} angle={-40} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11, fill: TEXT3 }} axisLine={false} tickLine={false} width={40} />
        <Tooltip contentStyle={tipStyle} itemStyle={{ color: '#E2EAF4' }} formatter={(v: number) => formatPrice(v)} />
        <Bar dataKey="spending" fill={GOLD} name={label} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
